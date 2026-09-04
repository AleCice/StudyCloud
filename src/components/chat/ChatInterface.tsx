'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  createChatSession, deleteChatSession, getChatMessages, 
  getChatSessions, updateChatSessionContext 
} from '@/app/(dashboard)/chat/actions'
import { 
  MessageSquare, Plus, Trash2, Send, Loader2, Copy, Check, 
  Download, Square, ChevronDown, Key, ExternalLink, Sparkles, X 
} from 'lucide-react'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import SmartContextSelector from '@/components/ui/SmartContextSelector'
import { ContextSelection } from '@/lib/ai/context'
import { getEncryptedApiKey, getSelectedGeminiModel, setSelectedGeminiModel, saveEncryptedApiKey } from '@/lib/crypto/storage'
import { GEMINI_MODELS } from '@/lib/ai/models'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatSessionItem {
  id: string
  title: string
  context_filter?: ContextSelection
  created_at: string
  updated_at: string
}

interface Props {
  initialSessions: ChatSessionItem[]
}

export default function ChatInterface({ initialSessions }: Props) {
  const [sessions, setSessions] = useState<ChatSessionItem[]>(initialSessions)
  const [activeId, setActiveId] = useState<string | null>(initialSessions[0]?.id || null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showMobileSessions, setShowMobileSessions] = useState(false)
  
  // Model & Key State
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite')
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false)
  const [apiKeyInput, setApiKeyInput] = useState<string>('')
  const [savingKey, setSavingKey] = useState<boolean>(false)

  // Context Selection (Specifico per la chat attiva)
  const [contextSelection, setContextSelection] = useState<ContextSelection>(
    initialSessions[0]?.context_filter || { type: 'all', name: 'Tutti i materiali' }
  )

  useEffect(() => {
    const m = getSelectedGeminiModel()
    if (m) setSelectedModel(m)
  }, [])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAutoScrollEnabled = useRef(true)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const typewriterFrameRef = useRef<number | null>(null)
  const targetTextRef = useRef('')
  const displayedTextRef = useRef('')

  // Scroll istantaneo stabile senza conflitti di animazione
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

  // Quando si cambia chat, carica i messaggi e fa scroll istantaneo in basso
  useEffect(() => {
    if (activeId) {
      getChatMessages(activeId).then(h => {
        setMessages(h as ChatMessage[])
        isAutoScrollEnabled.current = true
        setTimeout(() => scrollToBottom('auto'), 40)
      })
      const session = sessions.find(s => s.id === activeId)
      if (session?.context_filter) {
        setContextSelection(session.context_filter)
      } else {
        setContextSelection({ type: 'all', name: 'Tutti i materiali' })
      }
    } else {
      setMessages([])
    }
  }, [activeId])

  // Modifica del contesto per la chat attiva (persiste su quella specifica sessione)
  const handleContextChange = (newContext: ContextSelection) => {
    setContextSelection(newContext)
    if (activeId) {
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, context_filter: newContext } : s))
      updateChatSessionContext(activeId, newContext)
    }
  }

  const newChat = async (title?: string) => {
    const s = await createChatSession(title || 'Nuova conversazione', contextSelection)
    setSessions([s, ...sessions])
    setActiveId(s.id)
    setMessages([])
    return s.id
  }

  const deleteChat = async (id: string) => {
    await deleteChatSession(id)
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    if (activeId === id) setActiveId(updated[0]?.id || null)
  }

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

  const send = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    let sid = activeId
    if (!sid) sid = await newChat(text.slice(0, 40))

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const newMsgList = [...messages, userMsg]
    setMessages(newMsgList)
    setInput('')
    setIsLoading(true)

    // Messaggio placeholder assistant
    const assistantMsgId = crypto.randomUUID()
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }])
    setStreamingMessageId(assistantMsgId)

    targetTextRef.current = ''
    displayedTextRef.current = ''
    isAutoScrollEnabled.current = true
    setTimeout(() => scrollToBottom('auto'), 20)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const userGeminiKey = await getEncryptedApiKey('gemini')

      if (!userGeminiKey) {
        setShowApiKeyModal(true)
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
        setStreamingMessageId(null)
        setIsLoading(false)
        abortRef.current = null
        return
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-key': userGeminiKey,
          'x-gemini-model': selectedModel
        },
        body: JSON.stringify({
          messages: newMsgList.map(m => ({ role: m.role, content: m.content })),
          sessionId: sid,
          contextFilter: contextSelection
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        if (res.status === 401) {
          setShowApiKeyModal(true)
        }
        const errText = await res.text()
        throw new Error(errText || "Errore nella risposta del server")
      }

      if (!res.body) throw new Error("Stream non disponibile")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let streamFinished = false

      // Loop di battitura adattivo e stabile: elimina sfarfallii e saliscendi
      let lastUpdateTime = 0
      const runTypewriter = (time: number) => {
        // Regolazione del passo di emissione (cadenza fluida ogni ~22ms)
        if (time - lastUpdateTime >= 22) {
          lastUpdateTime = time

          if (displayedTextRef.current.length < targetTextRef.current.length) {
            const diff = targetTextRef.current.length - displayedTextRef.current.length
            // Se accumulato molto buffer, recupera più velocemente ma senza strappi
            const step = diff > 90 ? 10 : diff > 40 ? 6 : diff > 15 ? 3 : 2
            const nextLen = Math.min(displayedTextRef.current.length + step, targetTextRef.current.length)
            displayedTextRef.current = targetTextRef.current.slice(0, nextLen)
            const currentText = displayedTextRef.current

            setMessages(prev =>
              prev.map(m => m.id === assistantMsgId ? { ...m, content: currentText } : m)
            )

            // Auto-scroll istantaneo ancorato sul fondo: nessun rimbalzo o lotta tra animazioni
            if (isAutoScrollEnabled.current && scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
            }
          }
        }

        if (!streamFinished || displayedTextRef.current.length < targetTextRef.current.length) {
          typewriterFrameRef.current = requestAnimationFrame(runTypewriter)
        } else {
          // Conclusione generazione: flush istantaneo del testo finale
          const finalText = targetTextRef.current
          setMessages(prev =>
            prev.map(m => m.id === assistantMsgId ? { ...m, content: finalText } : m)
          )
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

      // Ricarica la lista sessioni per aggiornare il titolo se generato
      getChatSessions().then(s => setSessions(s))
    } catch (err: any) {
      if (typewriterFrameRef.current) {
        cancelAnimationFrame(typewriterFrameRef.current)
        typewriterFrameRef.current = null
      }
      setStreamingMessageId(null)
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m => m.id === assistantMsgId ? { ...m, content: `⚠️ **Errore:** ${err.message || 'Impossibile completare la risposta.'}` } : m)
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

  const exportChat = () => {
    if (messages.length === 0) return
    let text = `# Studio - Conversazione AI\nData: ${new Date().toLocaleString()}\n\n`
    messages.forEach(m => {
      text += `### ${m.role === 'user' ? 'Studente' : 'Assistente'}:\n${m.content}\n\n---\n\n`
    })
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat_export_${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-white relative font-sans text-black">
      {/* 1. SIDEBAR DESKTOP (fissa per schermi >= md) */}
      <div className="hidden md:flex w-64 border-r border-black bg-zinc-50 flex-col shrink-0">
        <div className="p-3 border-b border-black">
          <button
            onClick={() => newChat()}
            className="w-full flex items-center justify-center gap-2 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors py-2 text-xs font-mono font-bold uppercase tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuova Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex items-center justify-between px-3 py-2 cursor-pointer text-xs font-mono transition-colors border ${
                activeId === s.id 
                  ? 'bg-black text-white font-bold border-black' 
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-300'
              }`}
            >
              <span className="truncate flex-1">{s.title}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteChat(s.id) }}
                className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${
                  activeId === s.id ? 'text-zinc-300 hover:text-white' : 'text-zinc-500 hover:text-black'
                }`}
                title="Elimina conversazione"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. DRAWER MOBILE PER SESSIONI CHAT (a comparsa su smartphone) */}
      {showMobileSessions && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 flex">
          <div className="w-[85vw] max-w-xs bg-white h-full border-r border-black flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-black mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-black" />
                <span className="font-mono font-bold text-xs uppercase tracking-wider text-black">Le tue chat</span>
              </div>
              <button 
                onClick={() => setShowMobileSessions(false)}
                className="p-1 border border-black hover:bg-black hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => { newChat(); setShowMobileSessions(false) }}
              className="w-full flex items-center justify-center gap-2 bg-black text-white border border-black py-2.5 text-xs font-bold uppercase font-mono tracking-wider mb-3 hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuova chat
            </button>

            <div className="flex-1 overflow-y-auto space-y-1">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setActiveId(s.id); setShowMobileSessions(false) }}
                  className={`flex items-center justify-between p-2.5 cursor-pointer text-xs font-mono transition-colors border ${
                    activeId === s.id 
                      ? 'bg-black text-white font-bold border-black' 
                      : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-300'
                  }`}
                >
                  <span className="truncate flex-1">{s.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteChat(s.id) }}
                    className="p-1 text-zinc-400 hover:text-black"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowMobileSessions(false)} />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
        {/* Header con Filtro Contesto, Selettore Modello e Azioni */}
        <div className="h-[var(--header-height)] border-b border-black flex items-center justify-between px-3 md:px-6 shrink-0 bg-white gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMobileSessions(true)}
              className="md:hidden flex items-center gap-1.5 px-2 py-1 border border-black text-xs font-mono font-bold uppercase bg-zinc-50"
            >
              <MessageSquare className="w-3.5 h-3.5 text-black" />
              <span>Chat ({sessions.length})</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 font-mono">
              <span className="w-2 h-2 bg-black"></span>
              <h1 className="text-xs font-bold uppercase tracking-wider text-black">Chat AI // RAG Engine</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Model Selector Dropdown */}
            <div className="flex items-center gap-1 bg-white border border-black px-2 py-1 text-xs font-mono">
              <Sparkles className="w-3 h-3 text-black shrink-0" />
              <select
                value={selectedModel}
                onChange={e => {
                  const m = e.target.value
                  setSelectedModel(m)
                  setSelectedGeminiModel(m)
                }}
                className="bg-transparent text-black font-bold outline-none cursor-pointer text-xs pr-1 max-w-[110px] sm:max-w-none truncate"
                title="Seleziona modello Google Gemini"
              >
                {GEMINI_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Context Selector (Corsi, Cartelle, Sottocartelle, File) */}
            <SmartContextSelector
              value={contextSelection}
              onChange={handleContextChange}
            />

            {/* Export Button */}
            {messages.length > 0 && (
              <button
                onClick={exportChat}
                className="p-1.5 border border-black bg-white hover:bg-black hover:text-white transition-colors text-black"
                title="Esporta chat in Markdown"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages Stream */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 relative"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 font-mono">
              <div className="border border-black p-3 bg-zinc-50 mb-3">
                <MessageSquare className="w-8 h-8 text-black" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-black mb-1">
                Inizia una nuova sessione di studio
              </p>
              <p className="text-[11px] text-zinc-500 max-w-sm">
                Fai domande sui tuoi appunti, richiedi spiegazioni di formule matematiche o chiarimenti su qualsiasi materia d&apos;esame.
              </p>
            </div>
          ) : (
            messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${m.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 bg-black text-white flex items-center justify-center shrink-0 text-[10px] font-mono font-bold border border-black">
                    AI
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
                      /* Indicatore di pensiero minimale e ad alta tecnologia */
                      <div className="flex items-center gap-2.5 py-1 px-0.5 font-mono text-xs">
                        <span className="w-2.5 h-2.5 bg-black animate-pulse" />
                        <span className="font-mono uppercase tracking-widest text-[11px] font-bold text-black">
                          GENERAZIONE RISPOSTA...
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
              </div>
            ))
          )}

          {/* Pulsante Flottante per tornare al fondo se l'utente ha scrollato in alto */}
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
        <div className="p-4 border-t border-black bg-white">
          <form onSubmit={send} className="max-w-3xl mx-auto flex items-end gap-2 bg-white border border-black p-2 transition-colors focus-within:ring-1 focus-within:ring-black">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chiedi qualcosa sui tuoi materiali..."
              rows={1}
              className="flex-1 max-h-32 bg-transparent text-[13px] text-black placeholder-zinc-400 outline-none resize-none px-2 py-1.5 font-sans"
            />

            {/* Send / Stop Action */}
            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className="p-2 bg-black hover:bg-zinc-800 text-white border border-black transition-colors"
                title="Interrompi generazione"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-black hover:bg-zinc-800 disabled:opacity-40 text-white border border-black transition-colors"
                title="Invia messaggio"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Modal Inserimento Chiave API Gemini */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 text-black">
                <div className="w-9 h-9 border border-black bg-zinc-100 text-black flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-black">
                    Chiave API Google Gemini Richiesta
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">Nessuna chiave configurata</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-1 border border-black hover:bg-black hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-700 leading-relaxed mb-4">
              Per interagire con i modelli Gemini e i tuoi documenti, inserisci la tua API Key di Google. La chiave viene memorizzata esclusivamente nel tuo browser con crittografia client-side AES-GCM.
            </p>

            <div className="space-y-3 mb-5">
              <input
                type="password"
                placeholder="Incolla qui la chiave (AIzaSy...)"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                className="w-full border border-black px-3.5 py-2.5 text-xs bg-zinc-50 focus:bg-white text-black outline-none font-mono"
              />

              <div className="flex items-center justify-between text-[11px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-black hover:underline flex items-center gap-1 font-semibold font-mono"
                >
                  Ottieni chiave gratuita su Google AI Studio
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 text-xs font-mono uppercase font-bold text-zinc-600 hover:bg-zinc-100 border border-black transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={!apiKeyInput.trim() || savingKey}
                onClick={async () => {
                  if (!apiKeyInput.trim()) return
                  setSavingKey(true)
                  try {
                    await saveEncryptedApiKey('gemini', apiKeyInput.trim())
                    setShowApiKeyModal(false)
                    setApiKeyInput('')
                    // Riprova l'invio se c'è testo
                    if (input.trim()) {
                      send()
                    }
                  } catch (err) {
                    alert("Errore salvataggio chiave")
                  } finally {
                    setSavingKey(false)
                  }
                }}
                className="px-5 py-2 bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-mono uppercase font-bold border border-black transition-colors flex items-center gap-1.5"
              >
                {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva e Continua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
