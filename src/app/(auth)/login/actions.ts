'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getSafeErrorMessage(errorMsg: string): string {
  const lower = (errorMsg || '').toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Credenziali non corrette. Verifica email e password.'
  }
  if (lower.includes('already registered') || lower.includes('user already exists')) {
    return 'Un account con questa email risulta già registrato.'
  }
  if (lower.includes('password should be at least')) {
    return 'La password deve contenere almeno 6 caratteri.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Troppi tentativi di accesso. Riprova tra qualche minuto.'
  }
  return 'Si è verificato un errore durante l\'operazione. Riprova.'
}

export async function login(formData: FormData) {
  const supabase = createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error("Login error:", error.message)
    const safeMsg = getSafeErrorMessage(error.message)
    redirect(`/login?message=${encodeURIComponent(safeMsg)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    console.error("Signup error:", error.message)
    const safeMsg = getSafeErrorMessage(error.message)
    redirect(`/login?message=${encodeURIComponent(safeMsg)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
