'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ContextSelection } from '@/lib/ai/context'

export async function getChatSessions() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const [sessionsRes, profileRes] = await Promise.all([
    admin.from('chat_sessions').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    admin.from('profiles').select('preferences').eq('id', user.id).single()
  ])

  if (sessionsRes.error) {
    console.error("Errore fetch sessions:", sessionsRes.error)
    return []
  }

  const chatContexts = (profileRes.data?.preferences as any)?.chat_contexts || {}

  return (sessionsRes.data || []).map(s => ({
    ...s,
    context_filter: chatContexts[s.id] || s.context_filter || { type: 'all', name: 'Tutti i materiali' }
  }))
}

export async function createChatSession(title: string = "Nuova Conversazione", contextFilter?: ContextSelection) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autorizzato")

  const admin = createAdminClient()
  const effectiveFilter = contextFilter || { type: 'all', name: 'Tutti i materiali' }
  
  const { data, error } = await admin
    .from('chat_sessions')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error) throw new Error("Impossibile creare la sessione: " + error.message)

  // Salva context_filter persistentemente in profiles.preferences
  try {
    const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).single()
    const existing = (profile?.preferences as any)?.chat_contexts || {}
    await admin.from('profiles').update({
      preferences: {
        ...(profile?.preferences || {}),
        chat_contexts: {
          ...existing,
          [data.id]: effectiveFilter
        }
      }
    }).eq('id', user.id)
  } catch (prefErr) {
    console.warn("Avviso persistenza context_filter:", prefErr)
  }

  revalidatePath('/chat')
  return { ...data, context_filter: effectiveFilter }
}

export async function updateChatSessionContext(sessionId: string, contextFilter: ContextSelection) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const admin = createAdminClient()
  // Controllo autorizzativo (Fix IDOR / BOLA)
  const { data: session } = await admin
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return false

  try {
    const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).single()
    const existing = (profile?.preferences as any)?.chat_contexts || {}
    await admin.from('profiles').update({
      preferences: {
        ...(profile?.preferences || {}),
        chat_contexts: {
          ...existing,
          [sessionId]: contextFilter
        }
      }
    }).eq('id', user.id)
  } catch (err) {
    console.warn("Errore salvataggio context_filter sessione:", err)
  }
  return true
}

export async function deleteChatSession(sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autorizzato")

  const admin = createAdminClient()
  const { error } = await admin
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) throw new Error("Impossibile eliminare la sessione")

  // Pulisci il context filter orfano
  try {
    const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).single()
    const existing = (profile?.preferences as any)?.chat_contexts || {}
    if (existing[sessionId]) {
      delete existing[sessionId]
      await admin.from('profiles').update({
        preferences: {
          ...(profile?.preferences || {}),
          chat_contexts: existing
        }
      }).eq('id', user.id)
    }
  } catch {}

  revalidatePath('/chat')
  return true
}

export async function getChatMessages(sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()

  // Controllo autorizzativo (Fix IDOR / BOLA): Verifica che la sessione appartenga all'utente
  const { data: session } = await admin
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) return []
  
  const { data, error } = await admin
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error("Errore fetch messaggi:", error)
    return []
  }
  
  return data.map(msg => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content
  }))
}

export async function getChatContextOptions() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { courses: [], documents: [] }

  const admin = createAdminClient()

  const [coursesRes, docsRes] = await Promise.all([
    admin.from('courses').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
    admin.from('documents').select('id, title').eq('user_id', user.id).order('title', { ascending: true })
  ])

  return {
    courses: coursesRes.data || [],
    documents: docsRes.data || []
  }
}

export async function getContextTreeAction() {
  const { getHierarchicalContextTree } = await import('@/lib/ai/context')
  return await getHierarchicalContextTree()
}
