import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Legge le variabili d'ambiente da .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const geminiApiKey = process.env.GEMINI_API_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRORE: Credenziali Supabase mancanti in .env.local")
  process.exit(1)
}

const admin = createClient(supabaseUrl, supabaseKey)

async function syncAllDocuments() {
  console.log("=== INIZIO RISINCRONIZZAZIONE RAG COMPLETA PER TUTTI I DOCUMENTI ===")
  console.log("Modello Embedding:", "gemini-embedding-2 (768D)")

  // 1. Recupera tutti i documenti
  const { data: docs, error: docsErr } = await admin
    .from('documents')
    .select('*')
    .order('created_at', { ascending: true })

  if (docsErr || !docs) {
    console.error("Errore recupero documenti:", docsErr)
    process.exit(1)
  }

  console.log(`Trovati ${docs.length} documenti da risincronizzare:`)
  docs.forEach(d => console.log(`- [${d.id}] "${d.title}" (${d.file_type})`))

  const { chunkText, generateEmbeddings, extractTextFromBuffer } = await import('../src/lib/ai/extractor')
  const { getYouTubeTranscript, extractYouTubeVideoId } = await import('../src/lib/ai/youtube')

  let totalNewChunks = 0

  for (const doc of docs) {
    console.log(`\n--------------------------------------------------`)
    console.log(`Elaborazione: "${doc.title}"...`)

    let fullText = ""

    // A. Se è un video YouTube
    if (doc.file_type === 'youtube' || doc.file_path?.includes('youtube.com') || doc.file_path?.includes('youtu.be')) {
      const videoId = extractYouTubeVideoId(doc.file_path) || doc.file_path
      try {
        console.log(`Recupero trascrizione/sintesi YouTube per videoId: ${videoId}...`)
        fullText = await getYouTubeTranscript(videoId, doc.title, doc.user_id, geminiApiKey)
      } catch (ytErr) {
        console.warn(`Avviso recupero YouTube per ${doc.title}:`, ytErr)
      }
    } else {
      // B. File da storage
      try {
        console.log(`Download file da storage: ${doc.file_path}...`)
        const { data: fileData, error: dlErr } = await admin.storage.from('documents').download(doc.file_path)
        if (!dlErr && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer())
          fullText = await extractTextFromBuffer(buffer, doc.file_type, geminiApiKey)
        }
      } catch (stErr) {
        console.warn(`Avviso download storage per ${doc.title}:`, stErr)
      }
    }

    // Fallback: se vuoto, recupera testo dai vecchi chunks
    if (!fullText || fullText.trim().length < 10) {
      console.log(`Fallback sui frammenti di testo pre-esistenti nel DB...`)
      const { data: oldChunks } = await admin
        .from('chunks')
        .select('content')
        .eq('document_id', doc.id)
        .order('chunk_index', { ascending: true })

      if (oldChunks && oldChunks.length > 0) {
        fullText = oldChunks.map(c => c.content).join('\n\n')
      }
    }

    if (!fullText || fullText.trim().length < 10) {
      console.error(`IMPOSSIBILE estrarre testo per "${doc.title}". Salto.`)
      continue
    }

    // 2. Suddivisione con il nuovo chunker semantico (senza parole tagliate)
    const chunks = chunkText(fullText)
    console.log(`Generati ${chunks.length} chunk semantici ordinati.`)
    console.log(`Anteprima Chunk #1:`, JSON.stringify(chunks[0].substring(0, 140) + '...'))

    // 3. Generazione embeddings 768D con gemini-embedding-2
    console.log(`Calcolo vettori latenti con gemini-embedding-2...`)
    const embeddings = await generateEmbeddings(chunks, geminiApiKey)

    // 4. Rimozione vecchi chunks e inserimento nuovi chunks
    await admin.from('chunks').delete().eq('document_id', doc.id)

    const chunksToInsert = chunks.map((content, idx) => {
      const vec = embeddings[idx]
      const validVec = Array.isArray(vec) && vec.length === 768 ? vec : new Array(768).fill(0)
      return {
        user_id: doc.user_id,
        document_id: doc.id,
        chunk_index: idx,
        content,
        embedding: `[${validVec.join(',')}]`
      }
    })

    const { error: insErr } = await admin.from('chunks').insert(chunksToInsert)
    if (insErr) {
      console.error(`Errore salvataggio chunks per "${doc.title}":`, insErr)
    } else {
      console.log(`SALVATI CON SUCCESSO ${chunksToInsert.length} chunk e vettori RAG per "${doc.title}".`)
      totalNewChunks += chunksToInsert.length
      await admin.from('documents').update({ status: 'elaborato' }).eq('id', doc.id)
    }
  }

  console.log(`\n==================================================`)
  console.log(`RISINCRONIZZAZIONE RAG COMPLETATA!`)
  console.log(`Totale nuovi chunk e vettori generati: ${totalNewChunks}`)
  console.log(`==================================================`)
}

syncAllDocuments().catch(err => {
  console.error("Errore critico durante la sincronizzazione:", err)
  process.exit(1)
})
