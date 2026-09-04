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
      "Configura GEMINI_API_KEY sul server o inseriscila nelle Impostazioni per iniziare la sessione di tutoraggio.",
      { status: 401 }
    )
  }

  const modelId = resolveGeminiModelId(req.headers.get('x-gemini-model'))
  const google = getGoogleClient(effectiveGeminiKey)

  const { messages, sessionId, courseId, contextFilter, difficulty } = await req.json()
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Non autorizzato", { status: 401 })

  // Controllo budget
  const budgetCheck = await checkBudgetGuardrail(user.id)
  if (!budgetCheck.allowed) {
    return new Response(budgetCheck.message || "Budget mensile superato.", { status: 429 })
  }

  const admin = createAdminClient()

  // Controllo autorizzativo (Fix IDOR / BOLA): Verifica che la sessione appartenga all'utente
  if (sessionId) {
    const { data: sessionOwner, error: sessionErr } = await admin
      .from('tutor_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionErr || !sessionOwner) {
      return new Response("Accesso negato: sessione tutor non valida o non autorizzata.", { status: 403 })
    }
  }

  const lastUserMessage = messages[messages.length - 1]
  let contextText = ""
  let contextDescription = "Tutti i materiali"

  try {
    const filter = contextFilter || (courseId ? { type: 'course', id: courseId } : null)
    const resolvedContext = await resolveContextDocIds(user.id, filter)
    const allowedDocIds = resolvedContext.docIds
    const effectiveCourseId = resolvedContext.courseId
    contextDescription = resolvedContext.description

    const queryEmbeddings = await generateEmbeddings([
      lastUserMessage.content === "Inizia" ? "concetti chiave importanti da ricordare riassunto" : lastUserMessage.content
    ], effectiveGeminiKey)
    const queryVector = queryEmbeddings[0]

    const { data: rawChunks, error } = await supabase.rpc('match_chunks', {
      query_embedding: `[${queryVector.join(',')}]`,
      match_threshold: 0.25, 
      match_count: 6,
      p_user_id: user.id,
      p_course_id: effectiveCourseId
    })

    let matchedChunks = rawChunks || []

    if (allowedDocIds) {
      const allowedSet = new Set(allowedDocIds)
      matchedChunks = matchedChunks.filter((c: any) => allowedSet.has(c.document_id))
    }

    if (matchedChunks.length > 0) {
      contextText = matchedChunks.map((c: any) => c.content).join("\n\n---\n\n")
    }
  } catch (err) {
    console.error("Errore RAG Tutor:", err)
  }

  const systemPrompt = `Sei un professore universitario e tutor accademico esperto. Stai conducendo un'interrogazione / esame orale simulato con lo studente per il corso/argomento: ${contextDescription}.
Livello di difficoltà selezionato: ${difficulty || 'Medio'}.

REGOLE DELL'ESAME / TUTORING:
1. Poni rigorosamente UNA sola domanda chiara per turno. Non fare elenchi di domande, test a scelta multipla o questionari.
2. Quando lo studente risponde, valuta la risposta con rigore accademico ed incoraggiamento:
   - Se corretta o parziale: evidenzia i punti positivi, correggi o approfondisci eventuali imprecisioni (incluse formule in LaTeX) e poni la domanda successiva.
   - Se errata o mancante: spiega il concetto con chiarezza e poni una domanda correlata per aiutarlo a ragionare.
3. Se il messaggio è "Inizia", dai un caloroso benvenuto universitario (massimo una breve riga) e poni SUBITO la prima singola domanda fondamentale sul programma.
   IMPORTANTE: Non ripetere MAI il saluto due volte. Non generare risposte duplicate o messaggi concatenati tra loro. Genera ESATTAMENTE una sola frase di benvenuto seguita da una singola domanda.
4. Mantieni un tono motivante, professionale e universitario.

CONTESTO DAGLI APPUNTI DELLO STUDENTE (usa queste informazioni):
${contextText || "Nessun documento specifico trovato. Fai domande generali coerenti con la materia."}
`

  const result = await streamText({
    model: google(`models/${modelId}`),
    system: systemPrompt,
    messages: messages,
    async onFinish({ text, usage }) {
      await logAiUsage({
        userId: user.id,
        feature: 'tutor',
        model: `models/${modelId}`,
        inputTokens: (usage as any)?.promptTokens || Math.round(systemPrompt.length / 4),
        outputTokens: (usage as any)?.completionTokens || Math.round(text.length / 4)
      })

      if (sessionId) {
        if (lastUserMessage.content !== "Inizia") {
          await admin.from('tutor_messages').insert({
            session_id: sessionId,
            user_id: user.id,
            role: 'user',
            content: lastUserMessage.content
          })
        }
        await admin.from('tutor_messages').insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'assistant',
          content: text
        })

        // Rilevamento automatico degli argomenti deboli (Weak Topics)
        if (courseId && lastUserMessage.content !== "Inizia") {
          try {
            const analysis = await generateText({
              model: google(`models/${modelId}`),
              system: "Sei un analista dell'apprendimento. Analizza lo scambio e verifica se lo studente ha commesso un errore, mostrato dubbi o lacune su un argomento specifico. Se sì, restituisci un JSON con 'hasWeakTopic': true, 'topicName' (max 3-4 parole), 'description' (sintesi dell'errore o lacuna). Se la risposta era corretta, restituisci 'hasWeakTopic': false. Nessun markup.",
              prompt: `Domanda/Risposta dello studente: "${lastUserMessage.content}"\nValutazione del tutor: "${text}"`
            })

            const parsed = JSON.parse(analysis.text.trim().replace(/```json/g, '').replace(/```/g, ''))
            if (parsed.hasWeakTopic && parsed.topicName) {
              const topicName = parsed.topicName.trim()
              
              // Controlla se l'argomento è già presente
              const { data: existing } = await admin
                .from('weak_topics')
                .select('id, occurrences')
                .eq('user_id', user.id)
                .eq('course_id', courseId)
                .ilike('topic_name', topicName)
                .single()

              if (existing) {
                await admin
                  .from('weak_topics')
                  .update({ 
                    occurrences: (existing.occurrences || 1) + 1,
                    status: 'active',
                    description: parsed.description || undefined,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existing.id)
              } else {
                await admin
                  .from('weak_topics')
                  .insert({
                    user_id: user.id,
                    course_id: courseId,
                    topic_name: topicName,
                    description: parsed.description || 'Argomento con errori durante la sessione di tutoraggio',
                    status: 'active',
                    occurrences: 1
                  })
              }
            }
          } catch (weakErr) {
            // Non bloccare lo stream se l'analisi asincrona ha un piccolo intoppo
            console.warn("Analisi weak topics:", weakErr)
          }
        }
      }
    }
  })

  return result.toTextStreamResponse()
}
