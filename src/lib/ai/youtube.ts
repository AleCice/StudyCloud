import { generateText } from 'ai'
import { getGoogleClient, resolveGeminiModelId } from './gemini-client'
import { logAiUsage } from './usage'

/**
 * Estrae il videoId da qualsiasi formato di URL YouTube
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const clean = url.trim()
  
  // Formati supportati:
  // - https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // - https://youtu.be/dQw4w9WgXcQ
  // - https://www.youtube.com/embed/dQw4w9WgXcQ
  // - https://www.youtube.com/shorts/dQw4w9WgXcQ
  // - https://music.youtube.com/watch?v=dQw4w9WgXcQ
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/
  const match = clean.match(regExp)
  
  return (match && match[2].length === 11) ? match[2] : null
}

/**
 * Recupera titolo, autore e thumbnail da oEmbed YouTube (gratuito, nessun token richiesto)
 */
export async function getYouTubeMetadata(videoId: string): Promise<{
  title: string
  author: string
  thumbnailUrl: string
  url: string
}> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  try {
    const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`
    const res = await fetch(oembedUrl, { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      return {
        title: data.title || `Video YouTube (${videoId})`,
        author: data.author_name || 'YouTube',
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        url: videoUrl
      }
    }
  } catch (err) {
    console.warn("Avviso oEmbed YouTube:", err)
  }

  return {
    title: `Video YouTube (${videoId})`,
    author: 'YouTube',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    url: videoUrl
  }
}

/**
 * Recupera i sottotitoli o trascrizione di un video YouTube
 */
export async function getYouTubeTranscript(
  videoId: string, 
  videoTitle: string, 
  userId?: string,
  userApiKey?: string | null,
  userModel?: string | null
): Promise<string> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  
  // 1. Tenta estrazione sottotitoli diretti dalla pagina YouTube
  try {
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    })

    if (res.ok) {
      const html = await res.text()
      // Cerca il blocco timedtext / captionTracks
      const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/)
      if (captionMatch && captionMatch[1]) {
        const tracks = JSON.parse(captionMatch[1])
        if (Array.isArray(tracks) && tracks.length > 0) {
          // Cerca prima traccia in italiano, poi inglese, altrimenti la prima disponibile
          const selectedTrack = tracks.find((t: any) => t.languageCode === 'it') ||
                                tracks.find((t: any) => t.languageCode === 'en') ||
                                tracks[0]

          if (selectedTrack?.baseUrl) {
            // Validazione anti-SSRF: assicura che il dominio appartenga a YouTube/Google e usi HTTPS
            const parsedUrl = new URL(selectedTrack.baseUrl)
            const isGoogleDomain = 
              parsedUrl.protocol === 'https:' && (
                parsedUrl.hostname === 'youtube.com' ||
                parsedUrl.hostname.endsWith('.youtube.com') ||
                parsedUrl.hostname === 'googlevideo.com' ||
                parsedUrl.hostname.endsWith('.googlevideo.com')
              )
            if (!isGoogleDomain) {
              throw new Error("URL sottotitoli YouTube non attendibile")
            }

            const transcriptRes = await fetch(selectedTrack.baseUrl)
            if (transcriptRes.ok) {
              const xml = await transcriptRes.text()
              const segments: { start: number; text: string }[] = []
              const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi
              let match: RegExpExecArray | null
              while ((match = regex.exec(xml)) !== null) {
                const startSec = Math.floor(parseFloat(match[1]))
                const rawText = match[3]
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/<[^>]+>/g, '')
                  .replace(/\n/g, ' ')
                  .trim()
                if (rawText) segments.push({ start: startSec, text: rawText })
              }

              if (segments.length > 0) {
                // Raggruppa in blocchi logici temporali (ogni ~60 secondi di video o ~500 caratteri)
                const formattedBlocks: string[] = []
                let currentBlockTexts: string[] = []
                let blockStartSec = segments[0].start

                const flushBlock = (endSec: number) => {
                  if (currentBlockTexts.length === 0) return
                  const formatTime = (s: number) => {
                    const m = Math.floor(s / 60).toString().padStart(2, '0')
                    const sec = (s % 60).toString().padStart(2, '0')
                    return `${m}:${sec}`
                  }
                  const header = `### [${formatTime(blockStartSec)} - ${formatTime(endSec)}] ${videoTitle}`
                  formattedBlocks.push(`${header}\n${currentBlockTexts.join(' ')}`)
                  currentBlockTexts = []
                }

                for (let i = 0; i < segments.length; i++) {
                  const seg = segments[i]
                  currentBlockTexts.push(seg.text)

                  // Se sono passati più di 60 secondi o abbiamo superato 450 caratteri
                  if (seg.start - blockStartSec >= 60 || currentBlockTexts.join(' ').length >= 450) {
                    flushBlock(seg.start)
                    blockStartSec = seg.start
                  }
                }
                flushBlock(segments[segments.length - 1].start + 10)

                return formattedBlocks.join('\n\n')
              }
            }
          }
        }
      }
    }
  } catch (transcriptErr) {
    console.warn("Estrazione sottotitoli nativi non riuscita, procedo con sintesi didattica AI:", transcriptErr)
  }

  // 2. Se i sottotitoli automatici non sono disponibili e abbiamo la chiave utente, usa Gemini
  const effectiveKey = userApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (effectiveKey) {
    try {
      const google = getGoogleClient(effectiveKey)
      const modelId = resolveGeminiModelId(userModel)
      const prompt = `Sei un docente universitario e autore di testi scientifici. Uno studente ha importato questa lezione/video accademico per il suo archivio di studio:
Titolo Lezione: "${videoTitle}"
URL: ${videoUrl}

Fornisci una dispensa di studio rigorosa, esaustiva e didatticamente impeccabile.
ORGANIZZAZIONE DEL TESTO:
- Suddividi il testo in sezioni logiche numerate (es. "## 1. Introduzione ed Enunciato Fondamentale", "## 2. Derivazione Matematica e Formule", "## 3. Applicazioni Pratiche ed Esempi").
- Ogni paragrafo deve essere chiaro, autonomo e focalizzato sui concetti chiave.
- Esprimi tutte le formule in LaTeX rigoroso ($...$ per inline, $$...$$ per formule in evidenza).
- Evita introduzioni generiche e concentrati sul contenuto didattico effettivo.`

      const aiRes = await generateText({
        model: google(`models/${modelId}`),
        system: "Sei un elaboratore di dispense didattiche universitarie. Genera testi strutturati in paragrafi ordinati, formule LaTeX e concetti chiave.",
        prompt
      })

      if (userId) {
        await logAiUsage({
          userId,
          feature: 'extraction',
          model: `models/${modelId}`,
          inputTokens: Math.round(prompt.length / 4),
          outputTokens: Math.round(aiRes.text.length / 4)
        })
      }

      return aiRes.text
    } catch (aiErr) {
      console.error("Errore sintesi video AI:", aiErr)
    }
  }

  return `Video didattico: ${videoTitle}\nURL: ${videoUrl}\nMateriale importato per lo studio.`
}
