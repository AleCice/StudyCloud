import { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbeddings, chunkText } from '@/lib/ai/extractor'

export interface SaveChunksParams {
  admin: SupabaseClient
  userId: string
  documentId: string
  text: string
  userApiKey?: string | null
}

/**
 * Inserisce i chunk e i rispettivi vettori di embedding nel database Supabase in modo sicuro e verificato.
 * La tabella public.chunks ha le colonne: (id, user_id, document_id, content, embedding, chunk_index, created_at).
 * Non deve includere course_id (che risiede esclusivamente in documents).
 */
export async function saveDocumentChunksSafely(params: SaveChunksParams): Promise<{ count: number }> {
  const { admin, userId, documentId, text, userApiKey } = params

  if (!text || text.trim().length === 0) {
    return { count: 0 }
  }

  // 1. Suddivisione in chunks
  const chunks = chunkText(text)
  if (chunks.length === 0) {
    return { count: 0 }
  }

  // 2. Generazione degli embeddings (vettori a 768 dimensioni)
  const embeddings = await generateEmbeddings(chunks, userApiKey)

  // 3. Costruzione payload rispettando rigorosamente lo schema PostgreSQL
  const chunksToInsert = chunks.map((chunk, index) => {
    const vector = embeddings[index]
    const validVector = Array.isArray(vector) && vector.length === 768 ? vector : new Array(768).fill(0)
    
    return {
      user_id: userId,
      document_id: documentId,
      chunk_index: index,
      content: chunk,
      embedding: `[${validVector.join(',')}]`
    }
  })

  // 4. Inserimento a batch (max 50 chunk per chiamata per evitare limiti di payload)
  const batchSize = 50
  for (let i = 0; i < chunksToInsert.length; i += batchSize) {
    const batch = chunksToInsert.slice(i, i + batchSize)
    const { error } = await admin.from('chunks').insert(batch)
    if (error) {
      console.error(`[RAG Save Error] Errore inserimento batch chunk [${i}-${i + batch.length}]:`, error)
      throw new Error(`Impossibile persistere i vettori RAG nel database: ${error.message}`)
    }
  }

  return { count: chunksToInsert.length }
}
