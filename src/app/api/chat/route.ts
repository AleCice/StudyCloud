import { streamText, generateText } from 'ai'
import { getGoogleClient, resolveGeminiModelId } from '@/lib/ai/gemini-client'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbeddings } from '@/lib/ai/extractor'
import { resolveContextDocIds } from '@/lib/ai/context'
import { logAiUsage, checkBudgetGuardrail } from '@/lib/ai/usage'

export const maxDuration = 60

export async function POST(req: Request) {
  const effectiveGeminiKey = req.headers.get('x-gemini-key')?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!effectiveGeminiKey) {
    return new Response(
      "CHIAVE_API_MANCANTE: Nessuna chiave API Google Gemini configurata. " +
      "Configura GEMINI_API_KEY sul server o inseriscila nelle Impostazioni per iniziare a chattare.",
      { status: 401 }
    )
  }

  const modelId = resolveGeminiModelId(req.headers.get('x-gemini-model'))
  const google = getGoogleClient(effectiveGeminiKey)

  const { messages, sessionId, contextFilter } = await req.json()
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Non autorizzato", { status: 401 })

  // Controllo budget mensile (Cost Guardrail)
  const budgetCheck = await checkBudgetGuardrail(user.id)
  if (!budgetCheck.allowed) {
    return new Response(budgetCheck.message || "Budget mensile AI superato.", { status: 429 })
  }

  const admin = createAdminClient()

  // Controllo autorizzativo (Fix IDOR / BOLA): Verifica che la sessione appartenga all'utente
  if (sessionId) {
    const { data: sessionOwner, error: sessionErr } = await admin
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionErr || !sessionOwner) {
      return new Response("Accesso negato: sessione chat non valida o non autorizzata.", { status: 403 })
    }
  }

  // 1. Estrai l'ultimo messaggio dell'utente
  const lastUserMessage = messages[messages.length - 1]

  let contextText = ""
  let allUserDocsList: string = ""
  let contextDescription = "Tutti i materiali"

  try {
    // 2. Risolvi i documenti consentiti in base al filtro gerarchico (Corso / Cartella / Sottocartella / File)
    const resolvedContext = await resolveContextDocIds(user.id, contextFilter)
    const allowedDocIds = resolvedContext.docIds
    const effectiveCourseId = resolvedContext.courseId
    contextDescription = resolvedContext.description

    // Recupera i metadati dei documenti attivi per il contesto
    let docsQuery = admin
      .from('documents')
      .select('id, title, course:courses(name)')
      .eq('user_id', user.id)

    if (allowedDocIds && allowedDocIds.length > 0) {
      docsQuery = docsQuery.in('id', allowedDocIds)
    } else if (allowedDocIds && allowedDocIds.length === 0) {
      // Nessun documento nella cartella selezionata
      docsQuery = docsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    }

    const { data: activeDocs } = await docsQuery

    if (activeDocs && activeDocs.length > 0) {
      allUserDocsList = activeDocs.map(d => `- "${d.title}" ${((d as any)?.course?.name ? `(Corso: ${(d as any).course.name})` : '')}`).join("\n")
    }

    // 3. Ricerca Ibrida: Matching per Parole Chiave nei Titoli dei Documenti & Video
    const queryText = (lastUserMessage.content || '').toLowerCase()
    const queryWords = queryText
      .replace(/[^\w\sàèéìòù]/gi, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length >= 3 && !['cosa', 'come', 'dove', 'quando', 'perche', 'perché', 'della', 'delle', 'degli', 'nella', 'nelle', 'questo', 'questa', 'quello', 'quella', 'sono', 'sulla', 'sulle', 'puoi', 'spiega', 'spiegami', 'dimmi', 'parlami', 'guarda', 'video'].includes(w))

    const keywordMatchedDocIds = new Set<string>()
    if (activeDocs && activeDocs.length > 0) {
      for (const d of activeDocs) {
        const titleLower = d.title.toLowerCase()
        const matchesWord = queryWords.some((w: string) => titleLower.includes(w))
        const isVideoMentioned = (queryText.includes('video') || queryText.includes('youtube')) && (d as any).file_type === 'youtube'
        if (matchesWord || isVideoMentioned) {
          keywordMatchedDocIds.add(d.id)
        }
      }
    }

    const matchedChunksList: any[] = []
    const seenChunkIds = new Set<string>()

    // 4. Se ci sono documenti/video con titolo corrispondente, preleva i relativi chunk
    if (keywordMatchedDocIds.size > 0) {
      const { data: directDocChunks } = await admin
        .from('chunks')
        .select('id, content, document_id')
        .in('document_id', Array.from(keywordMatchedDocIds))
        .limit(15)

      if (directDocChunks) {
        for (const c of directDocChunks) {
          if (!seenChunkIds.has(c.id || c.content)) {
            seenChunkIds.add(c.id || c.content)
            matchedChunksList.push(c)
          }
        }
      }
    }

    // 5. Genera l'embedding e ricerca vettoriale pgvector con soglia permissiva
    try {
      const queryEmbeddings = await generateEmbeddings([lastUserMessage.content], effectiveGeminiKey)
      const queryVector = queryEmbeddings[0]

      const { data: vectorChunks } = await admin.rpc('match_chunks', {
        query_embedding: `[${queryVector.join(',')}]`,
        match_threshold: 0.05,
        match_count: 15,
        p_user_id: user.id,
        p_course_id: effectiveCourseId || null
      })

      if (vectorChunks) {
        let filteredVectorChunks = vectorChunks
        if (allowedDocIds && allowedDocIds.length > 0) {
          const allowedSet = new Set(allowedDocIds)
          filteredVectorChunks = filteredVectorChunks.filter((c: any) => allowedSet.has(c.document_id))
        }

        for (const c of filteredVectorChunks) {
          if (!seenChunkIds.has(c.id || c.content)) {
            seenChunkIds.add(c.id || c.content)
            matchedChunksList.push(c)
          }
        }
      }
    } catch (vectorErr) {
      console.warn("Avviso ricerca vettoriale RAG:", vectorErr)
    }

    // 6. Copertura di sicurezza: se abbiamo pochi chunk, preleva chunk dai documenti attivi
    if (matchedChunksList.length < 3 && activeDocs && activeDocs.length > 0) {
      const fallbackDocIds = activeDocs.slice(0, 5).map(d => d.id)
      const { data: fallbackChunks } = await admin
        .from('chunks')
        .select('id, content, document_id')
        .in('document_id', fallbackDocIds)
        .limit(10)

      if (fallbackChunks) {
        for (const c of fallbackChunks) {
          if (!seenChunkIds.has(c.id || c.content)) {
            seenChunkIds.add(c.id || c.content)
            matchedChunksList.push(c)
          }
        }
      }
    }

    // 7. Costruisci il testo di contesto formattato
    if (matchedChunksList.length > 0) {
      const docIds = Array.from(new Set(matchedChunksList.map((c: any) => c.document_id))) as string[]
      const { data: docs } = await admin
        .from('documents')
        .select('id, title, file_type, course:courses(name)')
        .in('id', docIds)
      
      const docMap = new Map(docs?.map(d => [d.id, d]) || [])

      contextText = matchedChunksList.map((c: any) => {
        const docInfo = docMap.get(c.document_id)
        const isYt = (docInfo as any)?.file_type === 'youtube'
        const title = docInfo?.title || 'Materiale didattico'
        const typeBadge = isYt ? ' [Video YouTube / Trascrizione]' : ''
        const course = (docInfo as any)?.course?.name ? ` (Corso: ${(docInfo as any).course.name})` : ''
        return `[FONTE: "${title}"${typeBadge}${course}]\n${c.content}`
      }).join("\n\n---\n\n")
    }
  } catch (err) {
    console.error("Errore generazione contesto RAG:", err)
  }

  // 8. System Prompt Didattico Avanzato per Gemini 3.5 Flash Lite
  const systemPrompt = `Sei StudyCloud, l'assistente e tutor universitario AI d'eccellenza per lo studente.
Il tuo scopo è guidare lo studente nello studio con spiegazioni brillanti, pedagogiche, rigorose, chiare e complete in lingua italiana.

CONTESTO DIDATTICO ATTIVO:
${contextDescription}

MATERIALI & VIDEO CARICATI DALLO STUDENTE:
${allUserDocsList || "Nessun documento nel contesto corrente."}

ESTRATTO DAI MATERIALI E TRASCRIZIONI VIDEO DELLA KNOWLEDGE BASE:
${contextText || "Nessun frammento specifico estratto (usa le tue conoscenze accademiche per spiegare il tema collegandolo al programma di studio)."}

LINEE GUIDA PER LA RISPOSTA:
1. DIDATTICA ED ESAUSTIVITÀ:
   - Rispondi SEMPRE in modo completo ed esaustivo alla domanda o spiegazione richiesta dallo studente (anche se si tratta di lezioni, video o concetti fisici/matematici/scientifici).
   - Se lo studente chiede spiegazioni su un argomento o su un video/documento caricato (es. la carica elettrica, leggi di Coulomb, campo elettrico, conservazione, conduttori/isolanti, ecc.), esponi l'argomento in modo chiaro, dettagliato e strutturato.
   - Non dire mai "non posso rispondere" o "non ho trovato informazioni": offri sempre la spiegazione accademica completa e accurata collegandola ai materiali presenti nel contesto!

2. FORMATTAZIONE & STRUTTURA:
   - Usa titoli ('###') per dividere i capitoli/sezioni della spiegazione.
   - Usa il **grassetto** per principi e nozioni chiave.
   - Includi elenchi puntati per passaggi, proprietà ed elenchi ordinati.
   - Cita esplicitamente le fonti o i video caricati dallo studente (es. *[Fonte: Video YouTube - "Titolo"]* o *[Fonte: "Nome Documento"]*).

3. FORMATTAZIONE MATEMATICA LATEX (MANDATORIA):
   - Scrivi TUTTE le formule matematiche e fisiche, equazioni, simboli e variabili utilizzando la notazione LaTeX standard, che verrà renderizzata graficamente con KaTeX.
   - Formule in blocco indipendente: racchiudile tra doppi dollari '$$ ... $$' (es. '$$\vec{E} = \frac{\vec{F}}{q_0}$$', '$$F = k_0 \frac{|Q|q_0}{r^2}$$', '$$\vec{E}_{\text{tot}} = \sum_{i=1}^{n} \vec{E}_i$$').
   - Formule e simboli nel testo: racchiudili tra singoli dollari '$ ... $' (es. '$Q > 0$', '$\vec{E}$', '$\varepsilon_0$', '$q_0$', '$r^2$').
   - Usa sempre i comandi LaTeX corretti: '\vec{...}' per vettori, '\frac{...}{...}' per frazioni, '\cdot' per moltiplicazione, '\sum_{i=1}^{n}' per sommatorie con pedici/apici corretti, '\text{...}' per unità di misura (es. '$\text{N/C}$', '$\text{V/m}$', '$\text{C}$').
`

  const result = await streamText({
    model: google(`models/${modelId}`),
    system: systemPrompt,
    messages: messages,
    async onFinish({ text, usage }) {
      await logAiUsage({
        userId: user.id,
        feature: 'chat',
        model: `models/${modelId}`,
        inputTokens: (usage as any)?.promptTokens || Math.round(systemPrompt.length / 4),
        outputTokens: (usage as any)?.completionTokens || Math.round(text.length / 4)
      })

      if (sessionId) {
        await admin.from('chat_messages').insert([
          { session_id: sessionId, user_id: user.id, role: 'user', content: lastUserMessage.content },
          { session_id: sessionId, user_id: user.id, role: 'assistant', content: text }
        ])

        try {
          const { data: session } = await admin.from('chat_sessions').select('title').eq('id', sessionId).single()
          const isDefaultTitle = !session?.title || session.title.toLowerCase().includes('nuova conversazione') || session.title.length > 35
          
          if (isDefaultTitle) {
            const titleRes = await generateText({
              model: google(`models/${modelId}`),
              system: "Sei un generatore di titoli per chat universitarie. Genera un titolo conciso (3-5 parole, senza virgolette) sul tema trattato.",
              prompt: `Domanda studente: "${lastUserMessage.content}"\nRisposta: "${text.substring(0, 300)}"`
            })

            const cleanTitle = titleRes.text.trim().replace(/^["']|["']$/g, '').replace(/[.\n\r]/g, '')
            if (cleanTitle && cleanTitle.length > 2) {
              await admin.from('chat_sessions').update({ title: cleanTitle }).eq('id', sessionId).eq('user_id', user.id)
            }
          }
        } catch (titleErr) {
          console.error("Errore generazione titolo:", titleErr)
        }
      }
    }
  })

  return result.toTextStreamResponse()
}
