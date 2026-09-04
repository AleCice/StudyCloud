import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { DEFAULT_GEMINI_MODEL } from './models'

/**
 * Crea l'istanza Google Generative AI (@ai-sdk/google)
 * Supporta la chiave passata dal client oppure la chiave server process.env.GEMINI_API_KEY
 */
export function getGoogleClient(userApiKey?: string | null) {
  const key = userApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "CHIAVE_API_MANCANTE: Nessuna chiave API Google Gemini configurata. " +
      "Imposta GEMINI_API_KEY sul server o inseriscila nelle Impostazioni."
    )
  }
  return createGoogleGenerativeAI({
    apiKey: key
  })
}

/**
 * Crea l'istanza SDK nativa @google/generative-ai (per embeddings, audio/video)
 * Supporta la chiave passata dal client oppure la chiave server process.env.GEMINI_API_KEY
 */
export function getGoogleSDK(userApiKey?: string | null) {
  const key = userApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "CHIAVE_API_MANCANTE: Nessuna chiave API Google Gemini configurata. " +
      "Imposta GEMINI_API_KEY sul server o inseriscila nelle Impostazioni."
    )
  }
  return new GoogleGenerativeAI(key)
}

/**
 * Risolve l'ID del modello Gemini richiesto o ritorna il default
 */
export function resolveGeminiModelId(requestedModel?: string | null): string {
  if (!requestedModel || requestedModel.trim() === '') {
    return DEFAULT_GEMINI_MODEL
  }
  return requestedModel.trim().replace(/^models\//, '')
}
