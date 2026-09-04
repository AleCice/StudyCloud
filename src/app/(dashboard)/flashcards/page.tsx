'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  getCourses, getFlashcards, generateFlashcardsForContext, 
  createCustomFlashcard, deleteFlashcard 
} from './actions'
import SmartContextSelector from '@/components/ui/SmartContextSelector'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { ContextSelection } from '@/lib/ai/context'
import { getEncryptedApiKey, getSelectedGeminiModel } from '@/lib/crypto/storage'
import { 
  Layers, Sparkles, Download, Plus, Trash2, RotateCw, 
  ChevronLeft, ChevronRight, Loader2, Check, Search, X, 
  Shuffle, RotateCcw, CheckCircle2, Bookmark, Lightbulb,
  HelpCircle, Eye, EyeOff
} from 'lucide-react'

export default function FlashcardsPage() {
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  const [contextSelection, setContextSelection] = useState<ContextSelection>({ type: 'all', name: 'Tutti i materiali' })
  const [flashcards, setFlashcards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Study card state
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [viewMode, setViewMode] = useState<'study' | 'list'>('study')
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // Dialogs
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateTopic, setGenerateTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [manualCourseId, setManualCourseId] = useState('')
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [newTag, setNewTag] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    getCourses().then(c => {
      setCourses(c)
      if (c.length > 0) {
        setManualCourseId(c[0].id)
      }
    })
  }, [])

  useEffect(() => {
    loadCards()
  }, [contextSelection])

  const loadCards = async () => {
    setLoading(true)
    const courseIdParam = contextSelection.type === 'course' ? contextSelection.id : undefined
    const cards = await getFlashcards(courseIdParam)
    setFlashcards(cards)
    setCardIndex(0)
    setIsFlipped(false)
    setLoading(false)
  }

  // Keyboard navigation for study mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showGenerateModal || showCreateModal || viewMode !== 'study') return
      
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsFlipped(prev => !prev)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleNextCard()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        handlePrevCard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cardIndex, flashcards.length, showGenerateModal, showCreateModal, viewMode])

  const handleNextCard = () => {
    if (cardIndex < flashcards.length - 1) {
      setCardIndex(prev => prev + 1)
      setIsFlipped(false)
    }
  }

  const handlePrevCard = () => {
    if (cardIndex > 0) {
      setCardIndex(prev => prev - 1)
      setIsFlipped(false)
    }
  }

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5)
    setFlashcards(shuffled)
    setCardIndex(0)
    setIsFlipped(false)
  }

  const handleRestart = () => {
    setCardIndex(0)
    setIsFlipped(false)
  }

  const handleDifficultyResponse = (type: 'again' | 'good' | 'easy') => {
    if (type === 'again') {
      const current = flashcards[cardIndex]
      const remaining = [...flashcards]
      remaining.splice(cardIndex, 1)
      const reinsertIndex = Math.min(cardIndex + 3, remaining.length)
      remaining.splice(reinsertIndex, 0, current)
      setFlashcards(remaining)
      setIsFlipped(false)
    } else {
      handleNextCard()
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const userApiKey = await getEncryptedApiKey('gemini')
      const userModel = getSelectedGeminiModel()

      if (!userApiKey) {
        alert("Chiave API Google Gemini mancante. Configurala nella pagina Impostazioni.")
        setIsGenerating(false)
        return
      }

      const res = await generateFlashcardsForContext(contextSelection, generateTopic, userApiKey, userModel)
      await loadCards()
      setShowGenerateModal(false)
      setGenerateTopic('')
      alert(`Create con successo ${res.count} nuove flashcard!`)
    } catch (err: any) {
      alert("Errore generazione flashcard: " + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateManual = async () => {
    if (!newFront.trim() || !newBack.trim()) return
    const targetCourse = manualCourseId || courses[0]?.id
    if (!targetCourse) {
      alert("Seleziona o crea prima un corso")
      return
    }

    setIsCreating(true)
    try {
      await createCustomFlashcard(targetCourse, newFront, newBack, newTag || 'Generale')
      await loadCards()
      setShowCreateModal(false)
      setNewFront('')
      setNewBack('')
      setNewTag('')
    } catch (err: any) {
      alert("Errore creazione: " + err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteCard = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm("Eliminare questa flashcard?")) return
    try {
      await deleteFlashcard(id)
      const updated = flashcards.filter(c => c.id !== id)
      setFlashcards(updated)
      if (cardIndex >= updated.length) {
        setCardIndex(Math.max(0, updated.length - 1))
      }
      setIsFlipped(false)
    } catch (err: any) {
      alert("Errore eliminazione: " + err.message)
    }
  }

  const handleExportAnki = () => {
    if (flashcards.length === 0) return
    const courseName = contextSelection.name || 'StudyCloud'

    let csv = `#separator:Semicolon\n#html:true\n#tags column:3\n`
    for (const card of flashcards) {
      const cleanFront = card.front.replace(/;/g, ',').replace(/\n/g, '<br>')
      const cleanBack = card.back.replace(/;/g, ',').replace(/\n/g, '<br>')
      const tag = (card.tags && card.tags[0]) ? card.tags[0] : courseName.replace(/\s+/g, '_')
      csv += `${cleanFront};${cleanBack};${tag}\n`
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anki_flashcards_${courseName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    flashcards.forEach(c => c.tags?.forEach((t: string) => set.add(t)))
    return Array.from(set)
  }, [flashcards])

  const filteredCards = useMemo(() => {
    return flashcards.filter(c => {
      const matchesSearch = !search || 
        c.front.toLowerCase().includes(search.toLowerCase()) || 
        c.back.toLowerCase().includes(search.toLowerCase())
      const matchesTag = !selectedTag || (c.tags && c.tags.includes(selectedTag))
      return matchesSearch && matchesTag
    })
  }, [flashcards, search, selectedTag])

  const currentCard = flashcards[cardIndex]
  const progressPercent = flashcards.length > 0 
    ? Math.round(((cardIndex + 1) / flashcards.length) * 100) 
    : 0

  return (
    <div className="flex flex-col h-full overflow-hidden select-none bg-white text-black min-h-screen font-sans">
      {/* Header Bar */}
      <div className="border-b border-black flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 shrink-0 bg-white sticky top-0 z-20 font-mono text-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="border border-black p-1.5 bg-white text-black">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-tight text-black">Flashcard // Ripasso</h1>
            </div>
          </div>

          <div className="h-4 w-px bg-black mx-1 hidden sm:block" />

          <SmartContextSelector
            value={contextSelection}
            onChange={setContextSelection}
          />
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border border-black p-0.5 bg-zinc-100 text-xs">
            <button
              onClick={() => setViewMode('study')}
              className={`px-3 py-1 font-bold uppercase transition-colors ${
                viewMode === 'study' 
                  ? 'bg-black text-white' 
                  : 'text-zinc-600 hover:text-black'
              }`}
            >
              Sessione
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 font-bold uppercase transition-colors ${
                viewMode === 'list' 
                  ? 'bg-black text-white' 
                  : 'text-zinc-600 hover:text-black'
              }`}
            >
              Tutte ({flashcards.length})
            </button>
          </div>

          {/* Action: Export Anki */}
          {flashcards.length > 0 && (
            <button
              onClick={handleExportAnki}
              className="hidden sm:flex items-center gap-1.5 border border-black bg-white hover:bg-zinc-100 px-3 py-1.5 text-xs font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
              title="Esporta file compatibile con Anki (.txt)"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Anki</span>
            </button>
          )}

          {/* Action: Manual Create */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 border border-black bg-white hover:bg-zinc-100 px-3 py-1.5 text-xs font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Plus className="w-3.5 h-3.5 text-black" />
            <span>Nuova</span>
          </button>

          {/* Action: AI Generate */}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 border border-black bg-black text-white hover:bg-zinc-800 px-3.5 py-1.5 text-xs font-bold uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-colors active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Genera AI</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 max-w-4xl w-full mx-auto">
        {loading ? (
          <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-black" />
            <span>Caricamento flashcard...</span>
          </div>
        ) : flashcards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] my-auto font-mono">
            <div className="border border-black p-3 bg-white mb-3">
              <Layers className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-base font-bold uppercase tracking-tight text-black">Nessuna Flashcard</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-md font-sans">
              Nessun elemento presente per questo contesto. Genera un mazzo con AI o crea una carta manualmente.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 bg-black text-white border border-black hover:bg-zinc-800 px-4 py-2 text-xs font-bold uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Genera con AI
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 border border-black bg-white hover:bg-zinc-100 px-4 py-2 text-xs font-bold uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Crea Manualmente
              </button>
            </div>
          </div>
        ) : viewMode === 'study' ? (
          /* Study Interactive 3D Flip Card View */
          <div className="flex-1 flex flex-col items-center justify-between py-2 max-w-2xl w-full mx-auto">
            {/* Top Deck Info & Progress Bar */}
            <div className="w-full space-y-2 font-mono">
              <div className="flex items-center justify-between text-xs text-zinc-600 px-1">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-black border border-black px-2 py-0.5 bg-zinc-50 uppercase">
                    Carta {cardIndex + 1} / {flashcards.length}
                  </span>
                  <span className="text-[11px] text-zinc-400">({progressPercent}%)</span>
                </span>

                <div className="flex items-center gap-1.5">
                  {currentCard?.tags?.map((t: string, i: number) => (
                    <span key={i} className="border border-black bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">
                      {t}
                    </span>
                  ))}
                  {currentCard?.course?.name && (
                    <span className="border border-zinc-300 px-2 py-0.5 text-[10px] truncate max-w-[140px] text-zinc-600 bg-white">
                      {currentCard.course.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Brutalist Progress Bar */}
              <div className="w-full h-2 border border-black bg-zinc-100 p-[1px]">
                <div 
                  className="h-full bg-black transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 3D Flip Card Component with KaTeX LaTeX Support */}
            <div 
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full min-h-[360px] my-4 cursor-pointer perspective-1000 group select-text font-mono"
            >
              <div 
                className={`relative w-full min-h-[360px] transition-transform duration-500 transform-style-3d border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* FRONT: Domanda / Teorema / Concetto */}
                <div className="absolute inset-0 w-full h-full bg-white text-black p-6 sm:p-8 flex flex-col justify-between backface-hidden">
                  <div className="flex items-center justify-between border-b border-black pb-2.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 bg-black text-white">
                      DOMANDA // CONCETTO
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 group-hover:text-black transition-colors font-bold uppercase">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Gira carta</span>
                    </div>
                  </div>

                  <div className="my-auto text-center px-4 py-6 overflow-y-auto max-h-[220px]">
                    <div className="text-base sm:text-lg font-bold text-black leading-relaxed">
                      <MarkdownRenderer content={currentCard?.front || ''} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-200 text-[10px] text-zinc-400 font-mono">
                    <span>Premi Spazio per girare</span>
                    <span className="font-bold text-black uppercase">Fronte</span>
                  </div>
                </div>

                {/* BACK: Risposta / Soluzione / Formule LaTeX KaTeX */}
                <div className="absolute inset-0 w-full h-full bg-black text-white p-6 sm:p-8 flex flex-col justify-between backface-hidden rotate-y-180 border-2 border-black">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 bg-white text-black">
                      RISPOSTA // SOLUZIONE
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 group-hover:text-white transition-colors font-bold uppercase">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Fronte</span>
                    </div>
                  </div>

                  <div className="my-auto text-center px-4 py-4 overflow-y-auto max-h-[200px]">
                    <div className="text-sm sm:text-base font-normal text-zinc-100 leading-relaxed font-sans">
                      <MarkdownRenderer content={currentCard?.back || ''} className="text-zinc-100" />
                    </div>
                  </div>

                  {/* Difficulty Self-Evaluation (Anki Style) */}
                  <div 
                    onClick={e => e.stopPropagation()} 
                    className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800 font-mono text-xs"
                  >
                    <button
                      onClick={() => handleDifficultyResponse('again')}
                      className="flex-1 py-1.5 px-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-white hover:text-white uppercase font-bold text-[11px] transition-colors"
                      title="Ripeti questa carta più avanti nel mazzo"
                    >
                      Ripeti
                    </button>
                    <button
                      onClick={() => handleDifficultyResponse('good')}
                      className="flex-1 py-1.5 px-2 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-white hover:text-white uppercase font-bold text-[11px] transition-colors"
                      title="Risposta corretta"
                    >
                      Buono
                    </button>
                    <button
                      onClick={() => handleDifficultyResponse('easy')}
                      className="flex-1 py-1.5 px-2 border border-white bg-white text-black hover:bg-zinc-200 uppercase font-bold text-[11px] transition-colors"
                      title="Concetto padroneggiato"
                    >
                      Facile
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Study Toolbar */}
            <div className="w-full flex items-center justify-between px-2 pt-2 gap-2 font-mono text-xs">
              {/* Previous */}
              <button
                onClick={handlePrevCard}
                disabled={cardIndex === 0}
                className="flex items-center gap-1 px-3 py-1.5 border border-black bg-white text-black hover:bg-zinc-100 disabled:opacity-30 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] font-bold uppercase"
                title="Carta precedente (Freccia Sinistra)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Precedente</span>
              </button>

              {/* Main Flip Toggle & Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`flex items-center gap-1.5 px-5 py-2 border border-black font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] ${
                    isFlipped 
                      ? 'bg-white text-black hover:bg-zinc-100' 
                      : 'bg-black text-white hover:bg-zinc-800'
                  }`}
                >
                  {isFlipped ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isFlipped ? 'Mostra Domanda' : 'Rivela Risposta'}</span>
                </button>

                <button
                  onClick={handleShuffle}
                  className="p-2 text-black bg-white border border-black hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                  title="Mescola carte"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleRestart}
                  className="p-2 text-black bg-white border border-black hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                  title="Ricomincia"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => handleDeleteCard(currentCard?.id, e)}
                  className="p-2 text-zinc-600 hover:text-black bg-white border border-black hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                  title="Elimina flashcard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Next */}
              <button
                onClick={handleNextCard}
                disabled={cardIndex === flashcards.length - 1}
                className="flex items-center gap-1 px-3 py-1.5 border border-black bg-white text-black hover:bg-zinc-100 disabled:opacity-30 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] font-bold uppercase"
                title="Carta successiva (Freccia Destra)"
              >
                <span className="hidden sm:inline">Successiva</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Table / List Grid View */
          <div className="flex-1 flex flex-col overflow-hidden bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] font-mono text-xs">
            {/* Search & Tag Filter Header */}
            <div className="p-3 border-b border-black flex flex-wrap items-center justify-between gap-2 bg-zinc-50">
              <div className="flex items-center gap-2 bg-white border border-black px-2.5 py-1.5 flex-1 min-w-[180px] max-w-md">
                <Search className="w-3.5 h-3.5 text-black" />
                <input
                  type="text"
                  placeholder="Cerca nelle domande, risposte o formule..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent outline-none text-black placeholder:text-zinc-400"
                />
              </div>

              {/* Tag filters */}
              {allTags.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto max-w-md py-1">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-2 py-0.5 border text-[10px] font-bold uppercase transition-colors ${
                      selectedTag === null ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                    }`}
                  >
                    Tutti
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={`px-2 py-0.5 border text-[10px] font-bold uppercase transition-colors shrink-0 ${
                        selectedTag === tag ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[11px] text-zinc-500 font-bold uppercase ml-auto">
                {filteredCards.length} flashcard
              </span>
            </div>

            {/* List Table with KaTeX rendering */}
            <div className="flex-1 overflow-y-auto divide-y divide-black p-0">
              {filteredCards.map((card, idx) => (
                <div 
                  key={card.id} 
                  className="p-4 hover:bg-zinc-50 transition-colors flex items-start justify-between gap-4 group"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 bg-zinc-100">
                        #{idx + 1}
                      </span>
                      {card.tags?.map((t: string, i: number) => (
                        <span key={i} className="text-[10px] border border-black bg-black text-white px-1.5 py-0.5 font-bold uppercase">
                          {t}
                        </span>
                      ))}
                      {card.course?.name && (
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">
                          {card.course.name}
                        </span>
                      )}
                    </div>

                    {/* Front Markdown (KaTeX) */}
                    <div className="text-xs font-bold text-black">
                      <MarkdownRenderer content={card.front} />
                    </div>

                    {/* Back Markdown (KaTeX) */}
                    <div className="text-xs text-zinc-700 bg-zinc-50 p-2.5 border border-zinc-200">
                      <MarkdownRenderer content={card.back} />
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteCard(card.id, e)}
                    className="p-1.5 text-zinc-400 hover:text-black border border-zinc-200 hover:border-black transition-colors"
                    title="Elimina flashcard"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Genera con AI */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 font-mono" onClick={() => setShowGenerateModal(false)}>
          <div className="bg-white border-2 border-black p-5 sm:p-6 w-full max-w-md shadow-[8px_8px_0px_rgba(0,0,0,1)] relative text-black text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-black mb-4">
              <h3 className="text-sm font-bold uppercase tracking-tight text-black">Genera Flashcard con AI</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 border border-black hover:bg-black hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
                  Contesto Didattico
                </label>
                <SmartContextSelector
                  value={contextSelection}
                  onChange={setContextSelection}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
                  Argomento Specifico (Opzionale)
                </label>
                <input
                  type="text"
                  placeholder="Es. Teorema di Gauss, formule campo elettrico..."
                  value={generateTopic}
                  onChange={e => setGenerateTopic(e.target.value)}
                  className="w-full border border-black px-2.5 py-1.5 text-xs outline-none focus:bg-zinc-50 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-black mt-4">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-3 py-1.5 text-xs font-bold uppercase border border-zinc-300 hover:bg-zinc-100 text-zinc-600"
              >
                Annulla
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-1.5 text-xs font-bold uppercase bg-black text-white border border-black hover:bg-zinc-800 flex items-center gap-1.5 disabled:opacity-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Genera Mazzo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuova Card Manuale */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100 font-mono" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white border-2 border-black p-5 sm:p-6 w-full max-w-md shadow-[8px_8px_0px_rgba(0,0,0,1)] relative text-black text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-black mb-4">
              <h3 className="text-sm font-bold uppercase tracking-tight text-black">Nuova Flashcard</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 border border-black hover:bg-black hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">Corso</label>
                <select
                  value={manualCourseId}
                  onChange={e => setManualCourseId(e.target.value)}
                  className="w-full border border-black px-2.5 py-1.5 text-xs outline-none bg-white"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">Fronte (Domanda / Formula)</label>
                <textarea
                  rows={2}
                  placeholder="Es. Formula e definizione del teorema di Gauss?"
                  value={newFront}
                  onChange={e => setNewFront(e.target.value)}
                  className="w-full border border-black p-2 text-xs outline-none focus:bg-zinc-50 resize-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">Retro (Risposta & Soluzione)</label>
                <textarea
                  rows={3}
                  placeholder="Es. $$\Phi(E) = \frac{Q_{int}}{\varepsilon_0}$$"
                  value={newBack}
                  onChange={e => setNewBack(e.target.value)}
                  className="w-full border border-black p-2 text-xs outline-none focus:bg-zinc-50 resize-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">Tag</label>
                <input
                  type="text"
                  placeholder="Es. Elettrostatica, Formule, Esame"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  className="w-full border border-black px-2.5 py-1.5 text-xs outline-none focus:bg-zinc-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-black mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs font-bold uppercase border border-zinc-300 hover:bg-zinc-100 text-zinc-600"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateManual}
                disabled={isCreating || !newFront.trim() || !newBack.trim()}
                className="px-4 py-1.5 text-xs font-bold uppercase bg-black text-white border border-black hover:bg-zinc-800 flex items-center gap-1.5 disabled:opacity-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              >
                {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva Carta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
