'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { generateText } from 'ai'
import { getGoogleClient, resolveGeminiModelId } from '@/lib/ai/gemini-client'
import { ContextSelection, resolveContextDocIds } from '@/lib/ai/context'

export async function getCourses() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin.from('courses').select('id, name').eq('user_id', user.id).order('name', { ascending: true })
  return data || []
}

export async function getFlashcards(courseId?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  let query = admin
    .from('flashcards')
    .select(`
      *,
      course:courses(name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (courseId) {
    query = query.eq('course_id', courseId)
  }

  const { data, error } = await query
  if (error) {
    console.error("Errore fetch flashcards:", error)
    return []
  }
  return data || []
}

export async function createCustomFlashcard(courseId: string, front: string, back: string, tag: string = 'Generale') {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('flashcards')
    .insert({
      user_id: user.id,
      course_id: courseId,
      front: front.trim(),
      back: back.trim(),
      tags: [tag.trim() || 'Generale']
    })
    .select(`*, course:courses(name)`)
    .single()

  if (error) throw error
  revalidatePath('/flashcards')
  return data
}

/**
 * Parser resiliente per JSON generato da LLM con caratteri di escape e formule LaTeX
 */
function parseFlashcardsSafe(rawText: string): Array<{ front: string; back: string; tag?: string }> {
  let text = rawText.trim()
  
  // Rimuovi wrapper markdown tipo ```json ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  
  // Trova il blocco compreso tra il primo '[' e l'ultimo ']'
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }

  // 1. Prova il parse diretto
  try {
    const res = JSON.parse(text)
    if (Array.isArray(res) && res.length > 0) {
      return res.filter(item => item && (item.front || item.domanda) && (item.back || item.risposta)).map(item => ({
        front: item.front || item.domanda,
        back: item.back || item.risposta,
        tag: item.tag || item.argomento || 'Studio'
      }))
    }
  } catch {}

  // 2. Normalizzazione backslash LaTeX non escapati per JSON (es. \v, \f, \e, \q, \l, \s, \p, \d, \a)
  try {
    const sanitized = text.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1')
    const res = JSON.parse(sanitized)
    if (Array.isArray(res) && res.length > 0) {
      return res.filter(item => item && (item.front || item.domanda) && (item.back || item.risposta)).map(item => ({
        front: item.front || item.domanda,
        back: item.back || item.risposta,
        tag: item.tag || item.argomento || 'Studio'
      }))
    }
  } catch {}

  // 3. Fallback con RegExp: estrai i singoli campi da ciascun oggetto
  try {
    const cards: Array<{ front: string; back: string; tag?: string }> = []
    const objRegex = /\{[\s\S]*?"front"\s*:\s*"([\s\S]*?)"[\s\S]*?"back"\s*:\s*"([\s\S]*?)"(?:[\s\S]*?"tag"\s*:\s*"([\s\S]*?)")?[\s\S]*?\}/g
    let match
    while ((match = objRegex.exec(text)) !== null) {
      cards.push({
        front: match[1].replace(/\\"/g, '"'),
        back: match[2].replace(/\\"/g, '"'),
        tag: match[3] || 'Studio'
      })
    }
    if (cards.length > 0) return cards
  } catch {}

  throw new Error("Impossibile generare le flashcard in formato valido. Riprova.")
}

export async function generateFlashcardsForContext(
  contextFilter?: ContextSelection | null, 
  topic?: string,
  userApiKey?: string | null,
  userModel?: string | null
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  if (!userApiKey || !userApiKey.trim()) {
    throw new Error("CHIAVE_API_MANCANTE: Inserisci la tua chiave API personale di Google Gemini nelle Impostazioni per generare le flashcard.")
  }

  const google = getGoogleClient(userApiKey)
  const modelId = resolveGeminiModelId(userModel)
  const admin = createAdminClient()

  // 1. Risolvi il contesto gerarchico (Corsi / Cartelle / Sottocartelle / File)
  const resolved = await resolveContextDocIds(user.id, contextFilter)
  const allowedDocIds = resolved.docIds
  const effectiveCourseId = resolved.courseId

  // Se non c'è un corso specifico nel contesto, usa il primo corso dell'utente
  let finalCourseId = effectiveCourseId
  if (!finalCourseId) {
    const { data: firstCourse } = await admin.from('courses').select('id').eq('user_id', user.id).limit(1).single()
    finalCourseId = firstCourse?.id || null
  }

  if (!finalCourseId) {
    throw new Error("Nessun corso di studio registrato. Crea prima un corso per salvare le flashcard.")
  }

  // 2. Recupera i chunks più rilevanti per l'utente
  let query = admin
    .from('chunks')
    .select('content, document_id')
    .eq('user_id', user.id)
    .limit(16)

  if (allowedDocIds && allowedDocIds.length > 0) {
    query = query.in('document_id', allowedDocIds)
  }

  const { data: chunks } = await query
  let context = chunks?.map(c => c.content).join("\n\n") || ""

  if (!context && allowedDocIds && allowedDocIds.length > 0) {
    const { data: docs } = await admin.from('documents').select('title').in('id', allowedDocIds)
    if (docs && docs.length > 0) {
      context = `Documenti nel contesto: ${docs.map(d => d.title).join(", ")}`
    }
  }

  if (!context) {
    context = `Argomento e Contesto Didattico: ${resolved.description}`
  }

  // 3. Chiedi a Gemini di generare flashcard di studio di alta qualità
  const prompt = `Analizza questo materiale e programma di studio universitario:
CONTESTO: ${resolved.description}
${topic ? `ARGOMENTO RICHIESTO: ${topic}\n` : ''}
TESTO DISPONIBILE DAI MATERIALI:
${context}

Genera da 5 a 8 flashcard di studio efficaci, rigorose e strutturate per l'apprendimento attivo.

REGOLE MANDATORIE:
1. Restituisci ESCLUSIVAMENTE un array JSON valido senza testo introduttivo o conclusivo.
2. Struttura di ogni oggetto JSON:
   - "front": domanda chiara o concetto/teorema da spiegare
   - "back": risposta rigorosa, chiara ed esaustiva
   - "tag": breve tag tematico
3. Per le formule matematiche/fisiche usa la notazione LaTeX standard con simbolo $ (es. $E = F / q_0$, $\\vec{E}$, $\\varepsilon_0$). Nel JSON effettua il corretto escape dei backslash (es. \\\\vec{E}).
`

  const aiRes = await generateText({
    model: google(`models/${modelId}`),
    system: "Sei un generatore di flashcards universitarie per Anki. Restituisci ESCLUSIVAMENTE un array JSON valido di oggetti con chiavi 'front', 'back', 'tag'.",
    prompt
  })

  const cards = parseFlashcardsSafe(aiRes.text)

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("Nessuna flashcard generata.")
  }

  // 4. Salva le flashcards nel database
  const toInsert = cards.map(c => ({
    user_id: user.id,
    course_id: finalCourseId,
    front: c.front,
    back: c.back,
    tags: c.tag ? [c.tag] : ['Studio']
  }))

  const { error: insertError } = await admin.from('flashcards').insert(toInsert)
  if (insertError) throw insertError

  revalidatePath('/flashcards')
  return { success: true, count: cards.length, courseId: finalCourseId }
}

export async function deleteFlashcard(cardId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { error } = await admin
    .from('flashcards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/flashcards')
  return true
}
