'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getAiUsageAnalytics } from '@/lib/ai/usage'
import { logAuditEvent } from '@/lib/audit'

export async function getSettingsData() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const [profileRes, coursesRes, docsRes, auditRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('courses').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
    admin.from('documents').select('id, size_bytes').eq('user_id', user.id),
    admin.from('audit_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
  ])

  const profile = profileRes.data || { full_name: '', preferences: {} }
  const courses = coursesRes.data || []
  const docs = docsRes.data || []
  const totalSizeBytes = docs.reduce((acc, d) => acc + (Number(d.size_bytes) || 0), 0)

  const aiAnalytics = await getAiUsageAnalytics(user.id)

  return {
    user: {
      id: user.id,
      email: user.email || ''
    },
    profile,
    courses,
    totalDocs: docs.length,
    totalStorageMB: (totalSizeBytes / (1024 * 1024)).toFixed(2),
    aiAnalytics,
    recentAuditLogs: auditRes.data || []
  }
}

export async function updateProfileSettings(data: {
  fullName: string
  university: string
  degreeCourse: string
  academicYear: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).single()
  const currentPrefs = profile?.preferences || {}

  const updatedPrefs = {
    ...currentPrefs,
    university: data.university.trim(),
    degree_course: data.degreeCourse.trim(),
    academic_year: data.academicYear.trim()
  }

  await admin.from('profiles').update({
    full_name: data.fullName.trim(),
    preferences: updatedPrefs
  }).eq('id', user.id)

  await logAuditEvent({
    userId: user.id,
    action: 'SETTINGS_PROFILE_UPDATE',
    entityType: 'settings',
    details: { fullName: data.fullName, university: data.university }
  })

  revalidatePath('/settings')
  return { success: true }
}

export async function updateBudgetSettings(monthlyBudget: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).single()
  const currentPrefs = profile?.preferences || {}

  const updatedPrefs = {
    ...currentPrefs,
    monthly_budget: monthlyBudget
  }

  await admin.from('profiles').update({ preferences: updatedPrefs }).eq('id', user.id)

  await logAuditEvent({
    userId: user.id,
    action: 'SETTINGS_BUDGET_UPDATE',
    entityType: 'settings',
    details: { monthly_budget: monthlyBudget }
  })

  revalidatePath('/settings')
  return { success: true }
}

export async function updateAiSettings(aiPrefs: Record<string, any> = {}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).single()
  const currentPrefs = { ...(profile?.preferences || {}) }

  // Rimuovi eventuali parametri legacy di ElevenLabs o voce
  delete currentPrefs.elevenLabsApiKey
  delete currentPrefs.elevenLabsVoiceId
  delete currentPrefs.defaultVoice
  delete currentPrefs.voiceProvider

  const updatedPrefs = {
    ...currentPrefs,
    ...aiPrefs
  }

  await admin.from('profiles').update({ preferences: updatedPrefs }).eq('id', user.id)
  revalidatePath('/settings')
  return { success: true }
}

export async function exportAllUserData() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  const [profile, courses, folders, documents, flashcards, chatSessions] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('courses').select('*').eq('user_id', user.id),
    admin.from('folders').select('*').eq('user_id', user.id),
    admin.from('documents').select('*').eq('user_id', user.id),
    admin.from('flashcards').select('*').eq('user_id', user.id),
    admin.from('chat_sessions').select('*, chat_messages(*)').eq('user_id', user.id)
  ])

  await logAuditEvent({
    userId: user.id,
    action: 'EXPORT_ALL_DATA',
    entityType: 'user'
  })

  return {
    exportDate: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    profile: profile.data,
    courses: courses.data || [],
    folders: folders.data || [],
    documents: documents.data || [],
    flashcards: flashcards.data || [],
    chatSessions: chatSessions.data || []
  }
}
