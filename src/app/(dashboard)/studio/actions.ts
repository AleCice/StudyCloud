'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { generateText } from 'ai'
import { getGoogleClient, resolveGeminiModelId } from '@/lib/ai/gemini-client'

export interface SlideItem {
  id: string
  title: string
  subtitle?: string
  layout: 'title' | 'bullets' | 'columns' | 'formula' | 'code' | 'quote'
  bullets?: string[]
  leftColumn?: string
  rightColumn?: string
  formula?: string
  code?: string
  codeLanguage?: string
  quote?: string
  quoteAuthor?: string
  notes?: string
  inverted?: boolean
}

export interface PresentationContent {
  slides: SlideItem[]
  meta?: {
    totalSlides: number
    suggestedMinutes?: number
    author?: string
    courseName?: string
  }
}

export interface DocumentSection {
  id: string
  title: string
  content: string
  keyPoints?: string[]
  formula?: string
}

export interface DocumentContent {
  markdown?: string
  sections?: DocumentSection[]
  abstract?: string
  glossary?: Array<{ term: string; definition: string }>
  cheatsheetColumns?: Array<{ title: string; items: string[] }>
  meta?: {
    readingTimeMinutes?: number
    sourceDocsCount?: number
  }
}

export type ArtifactType = 'presentation' | 'document'
export type ArtifactSubtype = 
  | 'slides_exam' 
  | 'slides_quick' 
  | 'weak_topics' 
  | 'summary' 
  | 'cheatsheet' 
  | 'report'

export interface StudioArtifact {
  id: string
  user_id: string
  course_id: string | null
  title: string
  type: ArtifactType
  subtype: ArtifactSubtype
  content: PresentationContent | DocumentContent
  source_doc_ids: string[]
  theme: string
  created_at: string
  updated_at: string
  course?: { name: string } | null
}

/* =========================================================================
   GET ALL ARTIFACTS
   ========================================================================= */
export async function getStudioArtifacts(courseId?: string | null): Promise<StudioArtifact[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  // 1. Prova prima dalla tabella PostgreSQL studio_artifacts
  try {
    let query = admin
      .from('studio_artifacts')
      .select(`*, course:courses(name)`)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    const { data, error } = await query
    if (!error && data) {
      return data as StudioArtifact[]
    }
  } catch (err) {
    console.warn("Tabella studio_artifacts non ancora disponibile, uso fallback preferences.")
  }

  // 2. Fallback trasparente su profiles.preferences.studio_artifacts
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const artifacts = ((profile?.preferences as any)?.studio_artifacts || []) as StudioArtifact[]
    if (courseId) {
      return artifacts.filter(a => a.course_id === courseId)
    }
    return artifacts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  } catch (fallbackErr) {
    console.error("Errore fallback studio_artifacts:", fallbackErr)
    return []
  }
}

/* =========================================================================
   GET SINGLE ARTIFACT
   ========================================================================= */
export async function getStudioArtifact(id: string): Promise<StudioArtifact | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  try {
    const { data, error } = await admin
      .from('studio_artifacts')
      .select(`*, course:courses(name)`)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!error && data) {
      return data as StudioArtifact
    }
  } catch (err) {
    // Continua con fallback
  }

  // Fallback preferences
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const artifacts = ((profile?.preferences as any)?.studio_artifacts || []) as StudioArtifact[]
    return artifacts.find(a => a.id === id) || null
  } catch (e) {
    return null
  }
}

/* =========================================================================
   SAVE / UPDATE ARTIFACT
   ========================================================================= */
export async function saveStudioArtifact(artifact: Partial<StudioArtifact> & { title: string; type: ArtifactType }): Promise<StudioArtifact> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const artifactId = artifact.id || crypto.randomUUID()

  // Controllo autorizzativo (Fix IDOR / BOLA): Verifica se l'ID esiste già ed appartiene all'utente
  if (artifact.id) {
    const { data: existingArtifact } = await admin
      .from('studio_artifacts')
      .select('user_id')
      .eq('id', artifact.id)
      .single()

    if (existingArtifact && existingArtifact.user_id !== user.id) {
      throw new Error("Accesso negato: non sei autorizzato a modificare questo artefatto.")
    }
  }

  const payload: StudioArtifact = {
    id: artifactId,
    user_id: user.id,
    course_id: artifact.course_id || null,
    title: artifact.title.trim() || 'Documento Senza Titolo',
    type: artifact.type,
    subtype: artifact.subtype || (artifact.type === 'presentation' ? 'slides_exam' : 'summary'),
    content: artifact.content || (artifact.type === 'presentation' ? { slides: [] } : { markdown: '' }),
    source_doc_ids: artifact.source_doc_ids || [],
    theme: artifact.theme || 'monochrome',
    created_at: artifact.created_at || now,
    updated_at: now
  }

  // Prova salvataggio su studio_artifacts
  try {
    const { data, error } = await admin
      .from('studio_artifacts')
      .upsert(payload)
      .select(`*, course:courses(name)`)
      .single()

    if (!error && data) {
      revalidatePath('/studio')
      revalidatePath(`/studio/${artifactId}`)
      return data as StudioArtifact
    }
  } catch (err) {
    console.warn("Salvataggio su tabella fallito, uso preferences fallback:", err)
  }

  // Fallback: salvataggio su profiles.preferences
  const { data: profile } = await admin
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .single()

  const currentPrefs = (profile?.preferences as any) || {}
  const list = (currentPrefs.studio_artifacts || []) as StudioArtifact[]
  const filtered = list.filter(a => a.id !== artifactId)
  filtered.unshift(payload)

  await admin
    .from('profiles')
    .update({
      preferences: {
        ...currentPrefs,
        studio_artifacts: filtered
      }
    })
    .eq('id', user.id)

  revalidatePath('/studio')
  revalidatePath(`/studio/${artifactId}`)
  return payload
}

/* =========================================================================
   DELETE ARTIFACT
   ========================================================================= */
export async function deleteStudioArtifact(id: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  try {
    await admin
      .from('studio_artifacts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
  } catch (err) {
    // Ignora se la tabella non esiste
  }

  // Rimuovi anche da preferences fallback
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single()

    const currentPrefs = (profile?.preferences as any) || {}
    const list = (currentPrefs.studio_artifacts || []) as StudioArtifact[]
    const filtered = list.filter(a => a.id !== id)

    await admin
      .from('profiles')
      .update({
        preferences: {
          ...currentPrefs,
          studio_artifacts: filtered
        }
      })
      .eq('id', user.id)
  } catch (err) {
    console.error("Errore cancellazione fallback:", err)
  }

  revalidatePath('/studio')
  return true
}

/* =========================================================================
   AI GENERATION FROM RAG & KNOWLEDGE BASE
   ========================================================================= */
export interface GenerateStudioArtifactParams {
  type: ArtifactType
  subtype: ArtifactSubtype
  courseId?: string | null
  sourceDocIds?: string[]
  topicPrompt?: string
  depth?: 'short' | 'standard' | 'deep'
  formatStyle?: 'academic' | 'schematic' | 'qa'
  includeFormulas?: boolean
  includeTables?: boolean
  includeGlossary?: boolean
  targetExport?: 'docx' | 'pdf' | 'markdown' | 'pptx'
  userApiKey?: string | null
  userModel?: string | null
}

export async function generateStudioArtifactAction(params: GenerateStudioArtifactParams): Promise<StudioArtifact> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  if (!params.userApiKey || !params.userApiKey.trim()) {
    throw new Error("Chiave API Google Gemini non trovata. Inseriscila nelle Impostazioni.")
  }

  const google = getGoogleClient(params.userApiKey)
  const modelId = resolveGeminiModelId(params.userModel)
  const admin = createAdminClient()

  // 1. Recupero del contesto RAG
  let contextText = ""
  let retrievedChunks: string[] = []

  // A. Se subtype è weak_topics (concetti deboli del Tutor)
  if (params.subtype === 'weak_topics') {
    let weakQuery = admin
      .from('tutor_weak_topics')
      .select('topic, notes, course:courses(name)')
      .eq('user_id', user.id)
      .eq('mastered', false)

    if (params.courseId) {
      weakQuery = weakQuery.eq('course_id', params.courseId)
    }

    const { data: weakTopics } = await weakQuery
    if (weakTopics && weakTopics.length > 0) {
      contextText = "CONCETTI DEBOLI REGISTRATI DAL TUTOR:\n" + 
        weakTopics.map(w => `- Argomento: ${w.topic}\n  Note tutor: ${w.notes || 'Necessita chiarimento'}\n  Corso: ${(w.course as any)?.name || 'Generale'}`).join("\n\n")
    }
  }

  // B. Se specificati sourceDocIds, carica i loro chunk
  if (!contextText && params.sourceDocIds && params.sourceDocIds.length > 0) {
    const { data: chunks } = await admin
      .from('chunks')
      .select('content, document_id')
      .in('document_id', params.sourceDocIds)
      .eq('user_id', user.id)
      .limit(20)

    if (chunks && chunks.length > 0) {
      retrievedChunks = chunks.map(c => c.content)
      contextText = retrievedChunks.join("\n\n---\n\n")
    }
  }

  // C. Se nessun doc specifico ma indicato un corso
  if (!contextText && params.courseId) {
    const { data: docs } = await admin
      .from('documents')
      .select('id')
      .eq('course_id', params.courseId)
      .eq('user_id', user.id)
      .limit(6)

    const docIds = (docs || []).map(d => d.id)
    if (docIds.length > 0) {
      const { data: chunks } = await admin
        .from('chunks')
        .select('content')
        .in('document_id', docIds)
        .eq('user_id', user.id)
        .limit(16)

      if (chunks && chunks.length > 0) {
        retrievedChunks = chunks.map(c => c.content)
        contextText = retrievedChunks.join("\n\n---\n\n")
      }
    }
  }

  // D. Fallback generale se vuoto
  if (!contextText) {
    const { data: chunks } = await admin
      .from('chunks')
      .select('content')
      .eq('user_id', user.id)
      .limit(10)

    retrievedChunks = (chunks || []).map(c => c.content)
    contextText = retrievedChunks.join("\n\n---\n\n") || "Materiale didattico universitario generale."
  }

  const antiSlopDirectives = `
REGOLE TASSATIVE ANTI-AI SLOP:
- ZERO convenevoli o saluti ("Benvenuti", "In questa dispensa esploreremo...", "Questo documento ha lo scopo di...", "È opportuno sottolineare...").
- ZERO conclusioni retoriche o riassunti vuoti ("In conclusione speriamo che...", "In sintesi abbiamo visto che...").
- NESSUN preambolo: inizia IMMEDIATAMENTE con il contenuto tecnico denso, definizioni rigorose e formule.
- Massima densità di informazione per riga. Bullet point compatti e asciutti (massimo 1 frase diretta per punto).
`

  // 2. Generazione con Gemini basata sul tipo
  if (params.type === 'presentation') {
    const slideCount = params.depth === 'short' ? 5 : params.depth === 'deep' ? 12 : 8

    const systemPrompt = `Sei un docente universitario rigoroso.
Crea una presentazione accademica a slide per esami universitari.
${antiSlopDirectives}
Stile: brutalista, tipografico ad alto contrasto, minimalista, rigoroso.
Regole per le formule: usa notazione LaTeX con $$...$$ per formule in evidenza e $...$ per formule inline.
Regole per i layout:
- Slide 1: layout "title" con inverted: true (copertina monolitica nera con titolo conciso)
- Slide intermedie: varia tra "bullets", "columns", "formula", "code", "quote"
- Slide finale: layout "bullets" o "title" con inverted: true (sintesi formule d'esame e domande probabili)
- Campo "notes": inserisci note tecniche per il relatore (dimostrazione da argomentare a voce, passaggi algebrici o possibili domande a trabocchetto del professore).

RISPONDI ESCLUSIVAMENTE CON UN OGGETTO JSON VALIDO (senza markdown wrapping, senza \`\`\`json):
{
  "title": "Titolo Essenziale",
  "meta": {
    "suggestedMinutes": ${slideCount * 1.5},
    "courseName": "Materia"
  },
  "slides": [
    {
      "id": "slide-1",
      "title": "TITOLO ARGOMENTO",
      "subtitle": "Definizione formale o ambito d'esame",
      "layout": "title",
      "inverted": true,
      "notes": "Introduzione diretta della definizione senza preamboli..."
    },
    {
      "id": "slide-2",
      "title": "Enunciato e Ipotesi",
      "layout": "bullets",
      "bullets": ["Ipotesi 1: enunciato formale", "Ipotesi 2: condizioni al contorno", "Tesi fondamentale"],
      "notes": "Verificare le condizioni necessarie..."
    },
    {
      "id": "slide-3",
      "title": "Equazione Fondamentale",
      "layout": "formula",
      "formula": "$$\\\\nabla \\\\cdot \\\\mathbf{E} = \\\\frac{\\\\rho}{\\\\varepsilon_0}$$",
      "bullets": ["Significato fisico di ciascun parametro", "Forma differenziale vs forma integrale"],
      "notes": "Dimostrare il passaggio con il teorema della divergenza..."
    }
  ]
}`

    const userPrompt = `Fonti didattiche di riferimento:\n${contextText.slice(0, 10000)}\n\n` +
      `Argomento richiesto: ${params.topicPrompt || 'Sintesi d\'esame'}\n` +
      `Numero di slide tassativo: ${slideCount}\n` +
      (params.formatStyle === 'qa' ? `Formato: focalizzati su domande tipiche d'esame e risposte telegrafiche esatte.\n` : '') +
      `Genera ${slideCount} slide con zero fuffa e massimo rigore accademico.`

    const { text } = await generateText({
      model: google(modelId),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2
    })

    let cleanJson = text.trim()
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)

    let parsed: any
    try {
      parsed = JSON.parse(cleanJson.trim())
    } catch (err) {
      console.error("Errore parsing JSON slide:", err, cleanJson)
      parsed = {
        title: params.topicPrompt || "Presentazione Didattica",
        slides: [
          { id: "1", title: params.topicPrompt || "Presentazione Didattica", subtitle: "Studio", layout: "title", inverted: true },
          { id: "2", title: "Concetti Fondamentali", layout: "bullets", bullets: ["Definizione formale", "Condizioni di validità", "Riferimento alle dispense"] },
          { id: "3", title: "Verifica e Q&A", layout: "bullets", bullets: ["Formule chiave", "Domande tipiche del docente"], inverted: true }
        ]
      }
    }

    const saved = await saveStudioArtifact({
      title: parsed.title || params.topicPrompt || 'Presentazione Didattica',
      type: 'presentation',
      subtype: params.subtype,
      course_id: params.courseId || null,
      source_doc_ids: params.sourceDocIds || [],
      content: {
        slides: parsed.slides || [],
        meta: {
          totalSlides: (parsed.slides || []).length,
          suggestedMinutes: parsed.meta?.suggestedMinutes || slideCount * 1.5,
          courseName: parsed.meta?.courseName || 'Accademico'
        }
      }
    })

    return saved

  } else {
    // Generazione Documento Didattico (Dispensa, Formulario, Relazione)
    const sectionCount = params.depth === 'short' ? 3 : params.depth === 'deep' ? 7 : 4

    const systemPrompt = `Sei un autore accademico e professore universitario.
Crea una dispensa universitaria rigorosa, densa, priva di testo inutile o convenevoli.
${antiSlopDirectives}
Linee guida strutturali:
- Titolo accademico sintetico ed esatto.
- Sezioni tematiche numerate (1.0, 2.0...) focalizzate su: definizioni formali, teoremi, dimostrazioni, esempi operativi e tabelle.
${params.includeFormulas !== false ? '- Formule matematiche in KaTeX ($$ per formule isolate, $ per formule inline).' : ''}
${params.includeTables ? '- Includi almeno una tabella di sintesi Markdown (| Parametro | Significato | Unità |).' : ''}
${params.includeGlossary ? '- Glossario finale dei termini formali.' : ''}
${params.formatStyle === 'qa' ? '- Struttura basata su: Domanda d\'esame -> Risposta dimostrata -> Trabocchetto comune.' : ''}
${params.formatStyle === 'schematic' ? '- Struttura a schemi logici, liste dense a punti e collegamenti causa-effetto.' : ''}

RISPONDI ESCLUSIVAMENTE CON UN OGGETTO JSON VALIDO (senza markdown wrapping, senza \`\`\`json):
{
  "title": "Titolo Dispensa",
  "sections": [
    {
      "id": "sec-1",
      "title": "1.0 Definizione e Ipotesi Fondamentali",
      "content": "Trattazione tecnica diretta con formule $$...$$ e analisi concettuale senza preamboli...",
      "keyPoints": ["Punto 1", "Punto 2"]
    }
  ],
  "glossary": [
    { "term": "Termine", "definition": "Definizione formale e rigorosa" }
  ],
  "meta": {
    "readingTimeMinutes": ${sectionCount * 2}
  }
}`

    const userPrompt = `Fonti didattiche di riferimento:\n${contextText.slice(0, 10000)}\n\n` +
      `Tipologia: ${params.subtype}\n` +
      `Argomento specifico: ${params.topicPrompt || 'Dispensa d\'esame completa'}\n` +
      `Numero indicativo di sezioni: ${sectionCount}\n` +
      (params.depth ? `Livello di approfondimento: ${params.depth}\n` : '') +
      `Nessun riempitivo: vai direttamente al sodo con massima precisione analitica.`

    const { text } = await generateText({
      model: google(modelId),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2
    })

    let cleanJson = text.trim()
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)

    let parsed: any
    try {
      parsed = JSON.parse(cleanJson.trim())
    } catch (err) {
      console.error("Errore parsing JSON documento:", err, cleanJson)
      parsed = {
        title: params.topicPrompt || "Dispensa di Studio",
        sections: [
          { id: "1", title: "1.0 Analisi dei Materiali", content: text, keyPoints: ["Riferimento alle dispense caricate"] }
        ]
      }
    }

    // Ricostruisce il markdown completo senza testi riempitivi
    const fullMarkdown = `# ${parsed.title}\n\n` +
      (parsed.sections || []).map((s: any) => `## ${s.title}\n\n${s.content}\n\n` + 
        (s.keyPoints && s.keyPoints.length > 0 ? `**Punti Chiave:**\n` + s.keyPoints.map((k: string) => `- ${k}`).join('\n') + '\n\n' : '')
      ).join('---\n\n') +
      (parsed.glossary && parsed.glossary.length > 0 ? `## Glossario dei Termini\n\n` + parsed.glossary.map((g: any) => `- **${g.term}**: ${g.definition}`).join('\n') : '')

    const saved = await saveStudioArtifact({
      title: parsed.title || params.topicPrompt || 'Dispensa Didattica',
      type: 'document',
      subtype: params.subtype,
      course_id: params.courseId || null,
      source_doc_ids: params.sourceDocIds || [],
      content: {
        markdown: fullMarkdown,
        abstract: parsed.abstract,
        sections: parsed.sections || [],
        glossary: parsed.glossary || [],
        meta: {
          readingTimeMinutes: parsed.meta?.readingTimeMinutes || sectionCount * 2
        }
      }
    })

    return saved
  }
}
