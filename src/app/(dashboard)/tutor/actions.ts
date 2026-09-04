'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { generateText } from 'ai'
import { getGoogleClient, resolveGeminiModelId } from '@/lib/ai/gemini-client'

/* =========================================================================
   SESSIONI E MESSAGGI TUTOR
   ========================================================================= */

export async function createTutorSession(
  courseId: string, 
  documentId: string | null = null, 
  difficulty: string = 'Medio',
  topic: string = ''
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Utente non autenticato")

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('tutor_sessions')
    .insert({
      user_id: user.id,
      course_id: courseId,
      document_id: documentId,
      difficulty: difficulty
    })
    .select(`
      *,
      course:courses(name),
      document:documents(title)
    `)
    .single()

  if (error) throw error
  
  revalidatePath('/tutor')
  return data
}

export async function getTutorSessions() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tutor_sessions')
    .select(`
      *,
      course:courses(name),
      document:documents(title)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Errore recupero sessioni tutor:", error)
    return []
  }
  return data
}

export async function getTutorMessages(sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  // Controllo autorizzativo (Fix IDOR / BOLA): Verifica che la sessione appartenga all'utente
  const { data: session } = await admin
    .from('tutor_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return []

  const { data, error } = await admin
    .from('tutor_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return []
  return data
}

export async function deleteTutorSession(sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  await admin.from('tutor_sessions').delete().eq('id', sessionId).eq('user_id', user.id)
  revalidatePath('/tutor')
  return { success: true }
}

/* =========================================================================
   ARGOMENTI DEBOLI (WEAK TOPICS)
   ========================================================================= */

export async function getWeakTopics(courseId?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  let query = admin
    .from('weak_topics')
    .select(`
      *,
      course:courses(name)
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (courseId) {
    query = query.eq('course_id', courseId)
  }

  const { data, error } = await query
  if (error) {
    console.error("Errore fetch weak_topics:", error)
    return []
  }
  return data
}

export async function updateWeakTopicStatus(topicId: string, status: 'active' | 'reviewed' | 'mastered') {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { error } = await admin
    .from('weak_topics')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', topicId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/tutor')
  return { success: true }
}

export async function deleteWeakTopic(topicId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { error } = await admin
    .from('weak_topics')
    .delete()
    .eq('id', topicId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/tutor')
  return { success: true }
}

/* =========================================================================
   FLASHCARDS & ESPORTAZIONE ANKI
   ========================================================================= */

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
  return data
}

export async function generateFlashcardsForCourse(
  courseId: string, 
  topic?: string,
  userApiKey?: string | null,
  userModel?: string | null
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  if (!userApiKey || !userApiKey.trim()) {
    throw new Error("CHIAVE_API_MANCANTE: Inserisci la tua chiave API personale di Google Gemini nelle Impostazioni.")
  }

  const google = getGoogleClient(userApiKey)
  const modelId = resolveGeminiModelId(userModel)
  const admin = createAdminClient()

  // 1. Recupera i chunks più rilevanti del corso
  const { data: chunks } = await admin
    .from('chunks')
    .select('content')
    .eq('user_id', user.id)
    .limit(10)

  const context = chunks?.map(c => c.content).join("\n\n") || "Nessun testo specifico."

  // 2. Chiedi a Gemini di generare un array JSON di Flashcard
  const prompt = `Analizza questo materiale di studio universitario per il corso.${topic ? ` Argomento specifico: ${topic}.` : ''}
Genera 5 flashcard di studio efficaci.
Per ogni flashcard fornisci:
- "front": una domanda chiara, un concetto da definire o una formula da completare
- "back": la risposta precisa, sintetica e corretta
- "tag": una parola chiave sull'argomento

TESTO DISPONIBILE:
${context}
`

  const aiRes = await generateText({
    model: google(`models/${modelId}`),
    system: "Sei un generatore di flashcards universitarie per Anki. Restituisci ESCLUSIVAMENTE un array JSON valido di oggetti con chiavi 'front', 'back', 'tag'.",
    prompt
  })

  let text = aiRes.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }

  let cards: Array<{ front: string; back: string; tag?: string }> = []
  try {
    cards = JSON.parse(text)
  } catch {
    try {
      const sanitized = text.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1')
      cards = JSON.parse(sanitized)
    } catch {
      const objRegex = /\{[\s\S]*?"front"\s*:\s*"([\s\S]*?)"[\s\S]*?"back"\s*:\s*"([\s\S]*?)"(?:[\s\S]*?"tag"\s*:\s*"([\s\S]*?)")?[\s\S]*?\}/g
      let match
      while ((match = objRegex.exec(text)) !== null) {
        cards.push({
          front: match[1].replace(/\\"/g, '"'),
          back: match[2].replace(/\\"/g, '"'),
          tag: match[3] || 'Tutor'
        })
      }
    }
  }

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error("Nessuna flashcard generata. Riprova.")
  }

  // 3. Salva le flashcards nel database
  const toInsert = cards.map(c => ({
    user_id: user.id,
    course_id: courseId,
    front: c.front,
    back: c.back,
    tags: c.tag ? [c.tag] : ['Studio']
  }))

  const { error: insertError } = await admin.from('flashcards').insert(toInsert)
  if (insertError) throw insertError

  revalidatePath('/tutor')
  return { success: true, count: cards.length }
}

export async function deleteFlashcard(cardId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { error } = await admin.from('flashcards').delete().eq('id', cardId).eq('user_id', user.id)
  if (error) throw error
  revalidatePath('/tutor')
  return { success: true }
}
