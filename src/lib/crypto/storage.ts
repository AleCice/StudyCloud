/**
 * Utility per la crittografia AES-GCM delle chiavi API in LocalStorage e Database Supabase
 * Utilizza Web Crypto API (window.crypto.subtle) e Server Actions con AES-256-GCM
 */

import { saveUserApiKeyAction, getUserApiKeyAction } from '@/app/(dashboard)/settings/actions'

const STORAGE_KEYS = {
  GEMINI: '_enc_gemini_api_key',
  SALT: '_enc_sec_salt',
  MODEL: '_studycloud_gemini_model'
} as const

const APP_DERIVATION_SECRET = "UniAssistant_Secure_Key_Vault_v1_2026"

let memoryCachedKey: string | null = null

/**
 * Recupera o genera un salt crittografico persistente nel browser
 */
function getOrCreateSalt(): Uint8Array {
  if (typeof window === 'undefined') return new Uint8Array(16)
  
  const existing = localStorage.getItem(STORAGE_KEYS.SALT)
  if (existing) {
    try {
      const arr = JSON.parse(existing)
      return new Uint8Array(arr)
    } catch { /* genera nuovo */ }
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(STORAGE_KEYS.SALT, JSON.stringify(Array.from(salt)))
  return salt
}

/**
 * Deriva una chiave simmetrica AES-GCM (256-bit) usando PBKDF2
 */
async function deriveAesKey(salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(APP_DERIVATION_SECRET),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  )

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/**
 * Cifra una stringa di testo con AES-GCM
 */
export async function encryptText(plainText: string): Promise<string> {
  if (typeof window === 'undefined' || !plainText) return ''
  
  const salt = getOrCreateSalt()
  const key = await deriveAesKey(salt)
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer as ArrayBuffer
    },
    key,
    enc.encode(plainText)
  )

  const payload = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext))
  }

  return btoa(JSON.stringify(payload))
}

/**
 * Decifra una stringa AES-GCM precedentemente cifrata
 */
export async function decryptText(encryptedBase64: string): Promise<string | null> {
  if (typeof window === 'undefined' || !encryptedBase64) return null
  
  try {
    const raw = atob(encryptedBase64)
    const payload = JSON.parse(raw)
    if (!payload.iv || !payload.data) return null

    const salt = getOrCreateSalt()
    const key = await deriveAesKey(salt)
    const iv = new Uint8Array(payload.iv)
    const data = new Uint8Array(payload.data)

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv.buffer as ArrayBuffer
      },
      key,
      data.buffer as ArrayBuffer
    )

    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch (err) {
    console.warn("Impossibile decifrare il dato da localStorage:", err)
    return null
  }
}

/**
 * Salva una chiave API cifrata sia in localStorage (cache rapida) che sul Database Supabase (AES-256-GCM)
 */
export async function saveEncryptedApiKey(provider: 'gemini', apiKey: string): Promise<void> {
  const clean = apiKey.trim()
  memoryCachedKey = clean || null

  if (typeof window !== 'undefined') {
    const storageKey = STORAGE_KEYS.GEMINI
    if (!clean) {
      localStorage.removeItem(storageKey)
    } else {
      const encrypted = await encryptText(clean)
      localStorage.setItem(storageKey, encrypted)
    }
  }

  // Persisti la chiave cifrata nel Database Supabase per renderla disponibile su qualsiasi dispositivo
  try {
    await saveUserApiKeyAction(clean)
  } catch (err) {
    console.error("Errore salvataggio chiave API su database Supabase:", err)
  }
}

/**
 * Recupera e decifra una chiave API da memoria, localStorage o direttamente dal Database Supabase
 */
export async function getEncryptedApiKey(provider: 'gemini' = 'gemini'): Promise<string | null> {
  if (memoryCachedKey) return memoryCachedKey

  if (typeof window !== 'undefined') {
    const storageKey = STORAGE_KEYS.GEMINI
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const decrypted = await decryptText(raw)
      if (decrypted) {
        memoryCachedKey = decrypted
        return decrypted
      }
    }
  }

  // Fallback / Sincronizzazione: recupero dal Database Supabase (es. nuovo dispositivo o cache svuotata)
  try {
    const dbKey = await getUserApiKeyAction()
    if (dbKey) {
      memoryCachedKey = dbKey
      if (typeof window !== 'undefined') {
        const encrypted = await encryptText(dbKey)
        localStorage.setItem(STORAGE_KEYS.GEMINI, encrypted)
      }
      return dbKey
    }
  } catch (err) {
    console.warn("Impossibile recuperare la chiave API dal database Supabase:", err)
  }

  return null
}

/**
 * Salva la chiave API Gemini cifrata in localStorage
 */
export async function saveEncryptedApiKeys(keys: { geminiApiKey?: string }): Promise<void> {
  if (typeof window === 'undefined') return
  if (keys.geminiApiKey !== undefined) {
    await saveEncryptedApiKey('gemini', keys.geminiApiKey)
  }
  // Rimuovi eventuale chiave legacy ElevenLabs se presente in localStorage
  localStorage.removeItem('_enc_elevenlabs_api_key')
}

/**
 * Carica e decifra la chiave API memorizzata
 */
export async function loadEncryptedApiKeys(): Promise<{ geminiApiKey: string | null }> {
  if (typeof window === 'undefined') {
    return { geminiApiKey: null }
  }

  // Rimuovi eventuale chiave legacy ElevenLabs se presente in localStorage
  localStorage.removeItem('_enc_elevenlabs_api_key')

  const gemini = await getEncryptedApiKey('gemini')

  return {
    geminiApiKey: gemini
  }
}

/**
 * Recupera il modello Gemini selezionato dall'utente (default: gemini-3.5-flash-lite)
 */
export function getSelectedGeminiModel(): string {
  if (typeof window === 'undefined') return 'gemini-3.5-flash-lite'
  return localStorage.getItem(STORAGE_KEYS.MODEL) || 'gemini-3.5-flash-lite'
}

/**
 * Salva il modello Gemini preferito dall'utente in localStorage
 */
export function setSelectedGeminiModel(modelId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.MODEL, modelId.trim())
}
