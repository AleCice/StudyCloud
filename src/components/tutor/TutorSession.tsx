'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Square, Copy, Check, ChevronDown } from 'lucide-react'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { ContextSelection } from '@/lib/ai/context'
import { getEncryptedApiKey, getSelectedGeminiModel } from '@/lib/crypto/storage'
import { getTutorMessages } from '@/app/(dashboard)/tutor/actions'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  sessionId: string
  courseId: string
  contextFilter?: ContextSelection
  difficulty: string
}

export default function TutorSession({ sessionId, courseId, contextFilter, difficulty }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAutoScrollEnabled = useRef(true)
  const typewriterFrameRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const targetTextRef = useRef('')
  const displayedTextRef = useRef('')
  const hasInitializedSessionRef = useRef<string | null>(null)

  // Scroll istantaneo senza rimbalzi o conflitti
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    if (!scrollContainerRef.current) return
    if (behavior === 'auto') {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    } else {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const isNearBottom = distanceFromBottom < 60
    isAutoScrollEnabled.current = isNearBottom
    setShowScrollBottomBtn(!isNearBottom)
  }

  // Cleanup typewriter e fetch all'unmount
  useEffect(() => {
    return () => {
      if (typewriterFrameRef.current) {
        cancelAnimationFrame(typewriterFrameRef.current)
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  // Inizializzazione protetta da doppia chiamata (Fix stream duplicato / testo concatenato)
  useEffect(() => {
    if (!sessionId) return

    // Se abbiamo già inizializzato questa sessione nel ciclo di vita del componente, non ripetere
    if (hasInitializedSessionRef.current === sessionId) return
    hasInitializedSessionRef.current = sessionId

    // Interrompi eventuali stream pendenti da precedenti sessioni
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    let isCancelled = false

    async function initSession() {
      try {
        const history = await getTutorMessages(sessionId)
        if (isCancelled) return

        if (history && history.length > 0) {
          // La sessione ha già messaggi: mostrali senza ricominciare
          setMessages(history.map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content
          })))
          setTimeout(() => scrollToBottom('auto'), 40)
        } else {
          // Sessione nuova: avvia la prima domanda una sola volta
          setMessages([])
          sendMessage("Inizia", true)
        }
      } catch (err) {
        console.warn("Errore caricamento storico tutor:", err)
        if (!isCancelled) {
          setMessages([])
          sendMessage("Inizia", true)
        }
      }
    }

    initSession()

    return () => {
      isCancelled = true
    }
  }, [sessionId])

  const stop = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (typewriterFrameRef.current) {
      cancelAnimationFrame(typewriterFrameRef.current)
      typewriterFrameRef.current = null
    }
    setStreamingMessageId(null)
    setIsLoading(false)
  }

  const sendMessage = async (text: string, auto = false) => {
    if (!text.trim() || isLoading) return
    setIsLoading(true)

    // Se c'è una richiesta in corso, interrompila
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    let all = [...messages]
    if (!auto) { 
      all.push(userMsg)
      setMessages(all)
      setInput('') 
    }

    const aId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: aId, role: 'assistant', content: '' }])
    setStreamingMessageId(aId)

    targetTextRef.current = ''
    displayedTextRef.current = ''
    isAutoScrollEnabled.current = true
    setTimeout(() => scrollToBottom('auto'), 20)

    try {
      const userGeminiKey = await getEncryptedApiKey('gemini')
      const userModel = getSelectedGeminiModel()

      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(userGeminiKey ? { 'x-gemini-key': userGeminiKey } : {}),
          'x-gemini-model': userModel
        },
        body: JSON.stringify({ 
          messages: auto ? [userMsg] : all, 
          sessionId, 
          courseId, 
          contextFilter,
          difficulty 
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || "Errore nella comunicazione con il tutor.")
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let streamFinished = false

      if (reader) {
        let lastUpdateTime = 0
        const runTypewriter = (time: number) => {
          // Cadenza fluida a 22ms con avanzamento a blocchi adattivi
          if (time - lastUpdateTime >= 22) {
            lastUpdateTime = time

            if (displayedTextRef.current.length < targetTextRef.current.length) {
              const diff = targetTextRef.current.length - displayedTextRef.current.length
              const step = diff > 90 ? 10 : diff > 40 ? 6 : diff > 15 ? 3 : 2
              const nextLen = Math.min(displayedTextRef.current.length + step, targetTextRef.current.length)
              displayedTextRef.current = targetTextRef.current.slice(0, nextLen)
              const currentText = displayedTextRef.current

              setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: currentText } : m))

              if (isAutoScrollEnabled.current && scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
              }
            }
          }

          if (!streamFinished || displayedTextRef.current.length < targetTextRef.current.length) {
            typewriterFrameRef.current = requestAnimationFrame(runTypewriter)
          } else {
            // Flush finale
            const finalText = targetTextRef.current
            setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: finalText } : m))
            setStreamingMessageId(null)
            typewriterFrameRef.current = null
            if (isAutoScrollEnabled.current && scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
            }
          }
        }

        typewriterFrameRef.current = requestAnimationFrame(runTypewriter)

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          targetTextRef.current += decoder.decode(value, { stream: true })
        }
        streamFinished = true
      }
    } catch (err: any) {
      if (typewriterFrameRef.current) {
        cancelAnimationFrame(typewriterFrameRef.current)
        typewriterFrameRef.current = null
      }
      setStreamingMessageId(null)
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m => m.id === aId ? { ...m, content: `⚠️ **Errore:** ${err.message || 'Impossibile completare la risposta del tutor.'}` } : m)
        )
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white text-black font-sans">
      {/* Messages Stream */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative"
      >
        {messages.filter(m => !(m.role === 'user' && m.content === 'Inizia')).map(m => (
          <div
            key={m.id}
            className={`flex gap-3 max-w-3xl ${m.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 bg-black text-white flex items-center justify-center shrink-0 text-[10px] font-mono font-bold border border-black">
                T
              </div>
            )}

            <div
              className={`relative group px-4 py-3 text-[13px] leading-relaxed max-w-[88%] sm:max-w-[85%] border border-black ${
                m.role === 'user'
                  ? 'bg-black text-white'
                  : 'bg-white text-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {m.role === 'assistant' ? (
                m.content ? (
                  <div>
                    <MarkdownRenderer content={m.content} />
                    {streamingMessageId === m.id && (
                      <span className="inline-block w-2 h-4 ml-1 bg-black animate-cursor align-middle" />
                    )}
                  </div>
                ) : (
                  /* Indicatore di elaborazione terminale - geometrico e minimale */
                  <div className="flex items-center gap-2.5 py-1 px-0.5 font-mono text-xs">
                    <span className="w-2.5 h-2.5 bg-black animate-pulse" />
                    <span className="font-mono uppercase tracking-widest text-[11px] font-bold text-black">
                      ELABORAZIONE RISPOSTA TUTOR...
                    </span>
                  </div>
                )
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}

              {/* Copy Button */}
              {m.role === 'assistant' && m.content && streamingMessageId !== m.id && (
                <button
                  onClick={() => handleCopy(m.content, m.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-white border border-black text-black hover:bg-black hover:text-white transition-all shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                  title="Copia risposta"
                >
                  {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>

            {m.role === 'user' && (
              <div className="w-7 h-7 bg-white text-black flex items-center justify-center shrink-0 text-[10px] font-mono font-bold border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]">
                TU
              </div>
            )}
          </div>
        ))}

        {/* Pulsante Flottante per tornare al fondo */}
        {showScrollBottomBtn && (
          <div className="sticky bottom-2 flex justify-center z-20 pointer-events-none">
            <button
              type="button"
              onClick={() => {
                isAutoScrollEnabled.current = true
                scrollToBottom('auto')
                setShowScrollBottomBtn(false)
              }}
              className="pointer-events-auto flex items-center gap-1.5 bg-white text-black border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all hover:bg-black hover:text-white"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Scorri in basso</span>
            </button>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-black bg-white shrink-0">
        <form 
          onSubmit={e => { e.preventDefault(); sendMessage(input) }} 
          className="max-w-3xl mx-auto flex items-end gap-2 bg-white border border-black p-2 transition-colors focus-within:ring-1 focus-within:ring-black"
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Formula la tua risposta all'interrogazione..."
            rows={1}
            className="flex-1 max-h-32 bg-transparent text-[13px] text-black placeholder-zinc-400 outline-none resize-none px-2 py-1.5 font-sans"
            onKeyDown={e => { 
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault()
                sendMessage(input) 
              } 
            }}
            disabled={isLoading}
          />

          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="p-2 bg-black hover:bg-zinc-800 text-white border border-black transition-colors"
              title="Interrompi risposta"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 bg-black hover:bg-zinc-800 disabled:opacity-40 text-white border border-black transition-colors"
              title="Invia risposta"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
