import { getGoogleSDK } from './gemini-client'

/**
 * Estrae il testo da un buffer con eventuale fallback OCR tramite Gemini
 */
export async function extractTextFromBuffer(buffer: Buffer, fileType: string, userApiKey?: string | null): Promise<string> {
  let extractedText = ""

  if (fileType.includes('pdf')) {
    try {
      extractedText = await new Promise<string>((resolve, reject) => {
        const PDFParser = require('pdf2json')
        const pdfParser = new PDFParser(null, 1)

        pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)))
        pdfParser.on("pdfParser_dataReady", () => {
          const raw = pdfParser.getRawTextContent() || ""
          resolve(raw)
        })

        pdfParser.parseBuffer(buffer)
      })
    } catch (parseErr) {
      console.warn("pdf2json parsing fallito, procedo con Gemini Multimodal OCR:", parseErr)
    }

    // Se il testo estratto è vuoto o troppo scarso (es. PDF scansionato, ricevuta, modulo grafico)
    if ((!extractedText || extractedText.trim().length < 40) && userApiKey) {
      try {
        const genAI = getGoogleSDK(userApiKey)
        const visionModel = genAI.getGenerativeModel({ model: "gemini-3.7-flash" })
        const result = await visionModel.generateContent([
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'application/pdf'
            }
          },
          "Trascrivi ed estrai integralmente tutto il testo presente in questo documento PDF, incluse intestazioni, formule matematiche, tabelle e note. Restituisci SOLO il testo estratto fedelmente senza commenti."
        ])
        extractedText = result.response.text()
      } catch (geminiErr) {
        console.error("Errore Gemini Multimodal PDF OCR:", geminiErr)
      }
    }

    return extractedText.trim()
  }
  
  // Immagini (JPEG, PNG, WebP)
  if (fileType.includes('image')) {
    if (userApiKey) {
      try {
        const genAI = getGoogleSDK(userApiKey)
        const visionModel = genAI.getGenerativeModel({ model: "gemini-3.7-flash" })
        const result = await visionModel.generateContent([
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: fileType
            }
          },
          "Trascrivi ed estrai fedelmente tutto il testo e le formule presenti in questa immagine."
        ])
        return result.response.text().trim()
      } catch (imgErr) {
        console.error("Errore OCR Immagine:", imgErr)
        return ""
      }
    }
    return ""
  }

  // Se è testo semplice o CSV
  if (fileType.includes('text') || fileType.includes('csv')) {
    return buffer.toString('utf-8').trim()
  }

  return buffer.toString('utf-8').trim()
}

/**
 * Suddivide il testo in chunk logici e semantici ordinati.
 * Preserva:
 * 1. Confini naturali di paragrafo (\n\n) e intestazioni Markdown (#, ##, ###)
 * 2. Integrità delle frasi (punto, punto esclamativo, punto interrogativo)
 * 3. Garanzia assoluta di non spezzare MAI parole a metà
 * 4. Overlap coerente a livello di frasi intere
 */
export function chunkText(
  text: string, 
  maxChunkLength: number = 750, 
  minChunkLength: number = 220
): string[] {
  if (!text || text.trim().length === 0) return []

  // Normalizza i ritorni a capo
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // Dividi per paragrafi logici (doppio ritorno a capo o sezioni)
  const rawParagraphs = normalizedText.split(/\n\s*\n/)
  const paragraphs: string[] = []

  for (const p of rawParagraphs) {
    const trimmed = p.trim()
    if (!trimmed) continue

    // Se un paragrafo è molto lungo (> maxChunkLength), spezzalo per frasi complete
    if (trimmed.length > maxChunkLength) {
      const sentences = trimmed.match(/[^.!?\n]+[.!?\n]+(?:\s+|$)|[^.!?\n]+$/g) || [trimmed]
      let currentSub = ''

      for (const sent of sentences) {
        const sTrim = sent.trim()
        if (!sTrim) continue

        if ((currentSub + ' ' + sTrim).trim().length <= maxChunkLength) {
          currentSub = currentSub ? `${currentSub} ${sTrim}` : sTrim
        } else {
          if (currentSub) paragraphs.push(currentSub)
          currentSub = sTrim
        }
      }
      if (currentSub) paragraphs.push(currentSub)
    } else {
      paragraphs.push(trimmed)
    }
  }

  // Raggruppa i paragrafi in chunk compatti e ordinati (~500-750 caratteri)
  const chunks: string[] = []
  let currentChunk = ''

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    
    if (currentChunk && (currentChunk.length + para.length + 2 > maxChunkLength)) {
      chunks.push(currentChunk.trim())

      // Overlap intelligente a frase intera: se c'è una frase conclusiva adatta, usala come ponte
      const sentences = currentChunk.match(/[^.!?\n]+[.!?\n]+(?:\s+|$)/g) || []
      const lastSentence = sentences.length > 1 ? sentences[sentences.length - 1].trim() : ''

      if (lastSentence && lastSentence.length < 180 && lastSentence.length > 25) {
        currentChunk = `${lastSentence}\n\n${para}`
      } else {
        currentChunk = para
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para
    }
  }

  if (currentChunk.trim()) {
    // Se l'ultimo chunk è molto piccolo, accorpalo al precedente se possibile
    if (chunks.length > 0 && currentChunk.trim().length < minChunkLength) {
      const prev = chunks[chunks.length - 1]
      if (prev.length + currentChunk.length < maxChunkLength * 1.25) {
        chunks[chunks.length - 1] = `${prev}\n\n${currentChunk.trim()}`
      } else {
        chunks.push(currentChunk.trim())
      }
    } else {
      chunks.push(currentChunk.trim())
    }
  }

  return chunks
}

/**
 * Genera gli embeddings per un array di testi usando Gemini.
 * Utilizza il modello di punta multimodale "gemini-embedding-2" (ai.google.dev/gemini-api/docs/embeddings)
 * con parametro Matryoshka outputDimensionality: 768 (compatibile con pgvector(768) di Supabase).
 * Fallback automatico su "gemini-embedding-2-preview" e "gemini-embedding-001".
 */
export async function generateEmbeddings(chunks: string[], userApiKey?: string | null): Promise<number[][]> {
  const cleanApiKey = userApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!cleanApiKey) {
    throw new Error("CHIAVE_API_MANCANTE: Inserisci la tua API Key di Google Gemini nelle Impostazioni per generare i vettori RAG.")
  }

  const genAI = getGoogleSDK(cleanApiKey)
  const embeddingModels = ["gemini-embedding-2", "gemini-embedding-2-preview", "gemini-embedding-001"]
  let lastError: any = null

  for (const modelName of embeddingModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const embeddings: number[][] = []

      for (let i = 0; i < chunks.length; i++) {
        const text = chunks[i]
        if (!text || !text.trim()) {
          embeddings.push(new Array(768).fill(0))
          continue
        }

        // Pacing per evitare picchi di quota
        if (i > 0) {
          await new Promise(r => setTimeout(r, 60))
        }

        // Retry con backoff per errori 429 (Resource Exhausted / Rate Limit)
        let result: any = null
        let attempts = 0
        const maxAttempts = 3

        while (attempts < maxAttempts) {
          try {
            attempts++
            result = await model.embedContent({
              content: { role: 'user', parts: [{ text }] },
              outputDimensionality: 768
            } as any)
            break
          } catch (callErr: any) {
            const is429 = callErr?.status === 429 || 
                          callErr?.message?.includes('429') || 
                          callErr?.message?.includes('Resource exhausted')
            if (is429 && attempts < maxAttempts) {
              const backoffMs = attempts * 1200
              console.warn(`[Gemini 429 Rate Limit] Attesa ${backoffMs}ms prima di riprovare chunk ${i+1}...`)
              await new Promise(r => setTimeout(r, backoffMs))
              continue
            }
            throw callErr
          }
        }

        const values = result?.embedding?.values
        if (!values || values.length === 0) {
          throw new Error(`Embedding vuoto restituito da ${modelName}`)
        }
        embeddings.push(values.slice(0, 768))
      }

      return embeddings
    } catch (err: any) {
      lastError = err
      console.warn(`Tentativo embedding con ${modelName} non riuscito, provo il modello successivo:`, err?.message || err)
    }
  }

  console.error("Errore critico generazione embeddings:", lastError)
  throw new Error(`Errore generazione vettori RAG con Google Gemini (${embeddingModels[0]}): ${lastError?.message || 'Servizio non disponibile'}`)
}
