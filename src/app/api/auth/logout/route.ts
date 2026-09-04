import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch (err) {
    console.error("Errore durante il logout:", err)
  }

  // Reindirizza l'utente a /login con redirect HTTP 303 See Other
  const loginUrl = new URL('/login', req.url)
  return NextResponse.redirect(loginUrl, { status: 303 })
}

