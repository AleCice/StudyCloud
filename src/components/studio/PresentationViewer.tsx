'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Play, Pause, 
  RotateCcw, Clock, FileText, LayoutGrid, X, Sparkles, Layers, Quote,
  FileDown, Printer
} from 'lucide-react'
import { SlideItem, PresentationContent } from '@/app/(dashboard)/studio/actions'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { exportPresentationToPptx, exportPresentationToPdf } from '@/lib/studio/export'

interface Props {
  content: PresentationContent
  title: string
  onEditSlide?: (index: number) => void
  isEditable?: boolean
}

export default function PresentationViewer({ content, title, onEditSlide, isEditable = false }: Props) {
  const slides = content.slides || []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [exportingPptx, setExportingPptx] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  
  // Timer d'esame / Cronometro
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timerPreset, setTimerPreset] = useState<number | null>(null) // null = stopwatch up, number = countdown
  const containerRef = useRef<HTMLDivElement>(null)

  const currentSlide: SlideItem | undefined = slides[currentIndex]

  const handlePptxExport = async () => {
    setExportingPptx(true)
    try {
      await exportPresentationToPptx({ title, content })
    } catch (err) {
      console.error("Errore export PPTX:", err)
      alert("Impossibile esportare in formato PPTX.")
    } finally {
      setExportingPptx(false)
    }
  }

  const handlePdfExport = async () => {
    setExportingPdf(true)
    try {
      await exportPresentationToPdf({ title, content })
    } catch (err) {
      console.error("Errore export PDF:", err)
      alert("Impossibile generare il PDF delle slide.")
    } finally {
      setExportingPdf(false)
    }
  }

  // Navigazione tastiera (Frecce, Spazio, F per Fullscreen, Esc per Griglia/Note)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se siamo in un input o textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        setCurrentIndex(prev => Math.min(slides.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setCurrentIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentIndex(slides.length - 1)
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes(prev => !prev)
      } else if (e.key.toLowerCase() === 'g') {
        setShowGrid(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [slides.length])

  // Gestione Timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (timerPreset !== null) {
            if (prev <= 1) {
              setIsTimerRunning(false)
              return 0
            }
            return prev - 1
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timerPreset])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const setExamTimer = (minutes: number) => {
    setTimerPreset(minutes * 60)
    setTimerSeconds(minutes * 60)
    setIsTimerRunning(false)
  }

  const resetStopwatch = () => {
    setTimerPreset(null)
    setTimerSeconds(0)
    setIsTimerRunning(false)
  }

  if (!slides || slides.length === 0) {
    return (
      <div className="border border-black p-12 text-center bg-white text-black font-mono">
        <Layers className="w-10 h-10 mx-auto mb-3 stroke-[1.5] text-zinc-400" />
        <p className="font-bold text-sm uppercase">Nessuna slide presente</p>
        <p className="text-xs text-zinc-500 font-sans mt-1">Genera o aggiungi una slide per iniziare.</p>
      </div>
    )
  }

  const isInverted = currentSlide?.inverted

  return (
    <div 
      ref={containerRef}
      className={`relative flex flex-col select-none border border-black transition-colors ${
        isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'w-full bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]'
      }`}
    >
      {/* Top HUD Bar */}
      <div className="h-10 border-b border-black bg-white flex items-center justify-between px-3 text-xs font-mono shrink-0 z-20 text-black">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold uppercase tracking-wider truncate max-w-[200px] sm:max-w-xs">
            {title}
          </span>
          <span className="hidden sm:inline border border-black px-1.5 py-0.5 text-[10px] font-bold bg-zinc-50">
            {currentIndex + 1} / {slides.length}
          </span>
        </div>

        {/* HUD Controls */}
        <div className="flex items-center gap-2">
          {/* Timer Widget */}
          <div className="flex items-center gap-1.5 border border-black px-2 py-0.5 bg-zinc-50 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-black" />
            <span className={`font-bold tabular-nums ${timerPreset && timerSeconds <= 60 ? 'text-red-600 animate-pulse' : 'text-black'}`}>
              {formatTime(timerSeconds)}
            </span>
            <button
              type="button"
              onClick={() => setIsTimerRunning(prev => !prev)}
              className="p-0.5 hover:text-zinc-600"
              title={isTimerRunning ? "Pausa" : "Avvia timer"}
            >
              {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={resetStopwatch}
              className="p-0.5 hover:text-zinc-600"
              title="Azzera cronometro"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Preset rapidi esame */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExamTimer(5)}
              className="border border-zinc-300 px-1.5 py-0.5 text-[10px] hover:border-black"
              title="Timer esame: 5 minuti"
            >
              5m
            </button>
            <button
              type="button"
              onClick={() => setExamTimer(10)}
              className="border border-zinc-300 px-1.5 py-0.5 text-[10px] hover:border-black"
              title="Timer esame: 10 minuti"
            >
              10m
            </button>
          </div>

          {/* Export PPTX */}
          <button
            type="button"
            onClick={handlePptxExport}
            disabled={exportingPptx}
            className="px-2 py-1 border border-black bg-white text-black hover:bg-zinc-100 text-[10px] font-bold uppercase transition-colors flex items-center gap-1 shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Scarica presentazione in formato PowerPoint (.pptx)"
          >
            <FileDown className="w-3 h-3" />
            <span className="hidden sm:inline">{exportingPptx ? 'Export...' : 'PPTX'}</span>
          </button>

          {/* Export PDF (Generazione nativa da zero) */}
          <button
            type="button"
            onClick={handlePdfExport}
            disabled={exportingPdf}
            className="px-2 py-1 border border-black bg-black text-white hover:bg-zinc-800 text-[10px] font-bold uppercase transition-colors flex items-center gap-1 shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Genera file PDF da zero con 1 pagina 16:9 per slide"
          >
            <Printer className="w-3 h-3" />
            <span className="hidden sm:inline">{exportingPdf ? 'PDF...' : 'PDF'}</span>
          </button>

          {/* Note Oratore Toggle */}
          <button
            type="button"
            onClick={() => setShowNotes(prev => !prev)}
            className={`px-2 py-1 border border-black text-[10px] font-bold uppercase transition-colors flex items-center gap-1 ${
              showNotes ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
            }`}
            title="Note relatore (Tasto N)"
          >
            <FileText className="w-3 h-3" />
            <span className="hidden sm:inline">Note</span>
          </button>

          {/* Griglia Slide */}
          <button
            type="button"
            onClick={() => setShowGrid(prev => !prev)}
            className={`p-1.5 border border-black transition-colors ${
              showGrid ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
            }`}
            title="Panoramica slide (Tasto G)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors"
            title="Schermo intero (Tasto F)"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Slide 16:9 Viewport */}
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-zinc-100 min-h-[360px] sm:min-h-[500px]">
        {/* Aspect Ratio 16:9 Box */}
        <div 
          className={`w-full max-w-5xl aspect-[16/9] border-2 border-black flex flex-col justify-between p-6 sm:p-12 transition-all relative overflow-hidden shadow-[6px_6px_0px_rgba(0,0,0,1)] ${
            isInverted ? 'bg-black text-white' : 'bg-white text-black'
          }`}
        >
          {/* Header slide: Tag / Categoria */}
          <div className="flex items-center justify-between border-b border-current/20 pb-3">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-2 py-0.5 border border-current">
              {`${currentSlide.layout.toUpperCase()} // SLIDE ${currentIndex + 1}`}
            </span>
            <span className="text-[10px] font-mono uppercase opacity-60">
              SLIDE
            </span>
          </div>

          {/* Body Slide in base al layout */}
          <div className="my-auto py-4">
            {/* Layout 1: TITLE (Copertina o Transizione Monumentale) */}
            {currentSlide.layout === 'title' && (
              <div className="space-y-4 text-center max-w-3xl mx-auto">
                <h2 className="text-3xl sm:text-5xl font-black font-mono uppercase tracking-tight leading-tight">
                  {currentSlide.title}
                </h2>
                {currentSlide.subtitle && (
                  <p className="text-sm sm:text-lg opacity-80 font-sans font-medium">
                    {currentSlide.subtitle}
                  </p>
                )}
                <div className="w-16 h-1 bg-current mx-auto mt-6" />
              </div>
            )}

            {/* Layout 2: BULLETS (Punti Chiave Spigolosi) */}
            {currentSlide.layout === 'bullets' && (
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-4xl font-bold font-mono uppercase tracking-tight">
                  {currentSlide.title}
                </h2>
                <ul className="space-y-3 sm:space-y-4 font-sans text-sm sm:text-lg">
                  {currentSlide.bullets?.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-2.5 h-2.5 bg-current mt-2 shrink-0" />
                      <div className="flex-1">
                        <MarkdownRenderer content={bullet} className="text-inherit" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Layout 3: COLUMNS (Confronto a 2 Colonne) */}
            {currentSlide.layout === 'columns' && (
              <div className="space-y-5">
                <h2 className="text-2xl sm:text-3xl font-bold font-mono uppercase tracking-tight">
                  {currentSlide.title}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-2">
                  <div className={`p-4 sm:p-6 border border-current ${isInverted ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider mb-2 border-b border-current/30 pb-1">
                      Analisi A
                    </h3>
                    <div className="text-xs sm:text-sm font-sans">
                      <MarkdownRenderer content={currentSlide.leftColumn || ''} className="text-inherit" />
                    </div>
                  </div>
                  <div className={`p-4 sm:p-6 border border-current ${isInverted ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider mb-2 border-b border-current/30 pb-1">
                      Analisi B
                    </h3>
                    <div className="text-xs sm:text-sm font-sans">
                      <MarkdownRenderer content={currentSlide.rightColumn || ''} className="text-inherit" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout 4: FORMULA (Focus LaTeX KaTeX) */}
            {currentSlide.layout === 'formula' && (
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold font-mono uppercase tracking-tight">
                  {currentSlide.title}
                </h2>
                {currentSlide.formula && (
                  <div className={`p-6 sm:p-8 border-2 border-current text-center my-4 ${isInverted ? 'bg-zinc-900' : 'bg-zinc-50'}`}>
                    <MarkdownRenderer content={currentSlide.formula} className="text-lg sm:text-2xl font-bold" />
                  </div>
                )}
                {currentSlide.bullets && currentSlide.bullets.length > 0 && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans text-xs sm:text-sm">
                    {currentSlide.bullets.map((b, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-current mt-1.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Layout 5: CODE (Blocco Codice Tecnico) */}
            {currentSlide.layout === 'code' && (
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold font-mono uppercase tracking-tight">
                  {currentSlide.title}
                </h2>
                <div className={`p-4 border border-current font-mono text-xs sm:text-sm overflow-x-auto ${isInverted ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
                  <pre className="text-inherit">
                    <code>{currentSlide.code || currentSlide.bullets?.join('\n')}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Layout 6: QUOTE (Teorema o Citazione) */}
            {currentSlide.layout === 'quote' && (
              <div className="space-y-6 max-w-3xl mx-auto text-center py-4">
                <Quote className="w-8 h-8 sm:w-12 sm:h-12 mx-auto opacity-30 stroke-[1.5]" />
                <blockquote className="text-xl sm:text-3xl font-medium font-serif italic leading-relaxed">
                  &ldquo;{currentSlide.quote || currentSlide.title}&rdquo;
                </blockquote>
                {currentSlide.quoteAuthor && (
                  <p className="text-xs sm:text-sm font-mono uppercase tracking-wider opacity-70">
                    — {currentSlide.quoteAuthor}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer Slide: Progresso */}
          <div className="flex items-center justify-between border-t border-current/20 pt-3 text-[10px] font-mono">
            <span>{content.meta?.courseName || 'Accademico'}</span>
            <div className="flex items-center gap-1">
              {slides.map((_, i) => (
                <span 
                  key={i} 
                  className={`inline-block h-1.5 transition-all ${
                    i === currentIndex ? 'w-6 bg-current' : 'w-2 bg-current/30'
                  }`} 
                />
              ))}
            </div>
            <span>{currentIndex + 1}/{slides.length}</span>
          </div>
        </div>

        {/* Floating Navigation Arrows */}
        <button
          type="button"
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 border border-black bg-white hover:bg-black hover:text-white disabled:opacity-20 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          title="Slide precedente (Freccia Sinistra)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setCurrentIndex(prev => Math.min(slides.length - 1, prev + 1))}
          disabled={currentIndex === slides.length - 1}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 border border-black bg-white hover:bg-black hover:text-white disabled:opacity-20 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          title="Slide successiva (Freccia Destra / Spazio)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Presenter Notes Drawer (Note Oratore) */}
      {showNotes && (
        <div className="border-t-2 border-black bg-white p-4 font-mono text-xs z-20 animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Note del Relatore (Slide {currentIndex + 1})
            </span>
            <button
              type="button"
              onClick={() => setShowNotes(false)}
              className="text-zinc-500 hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3 bg-zinc-50 border border-zinc-200 text-zinc-800 font-sans leading-relaxed text-sm">
            {currentSlide.notes ? (
              <MarkdownRenderer content={currentSlide.notes} />
            ) : (
              <p className="text-zinc-400 italic">Nessuna nota per questa slide.</p>
            )}
          </div>
        </div>
      )}

      {/* Grid Overview Modal */}
      {showGrid && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xs p-6 z-30 overflow-auto animate-in fade-in duration-100 font-mono">
          <div className="flex items-center justify-between mb-6 border-b border-black pb-3">
            <h3 className="font-bold uppercase text-sm">
              Panoramica Slide ({slides.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowGrid(false)}
              className="p-1 border border-black hover:bg-black hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {slides.map((s, idx) => (
              <button
                key={s.id || idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx)
                  setShowGrid(false)
                }}
                className={`text-left border p-3 transition-all flex flex-col justify-between aspect-[16/9] ${
                  idx === currentIndex ? 'border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] ring-2 ring-black' : 'border-zinc-300 hover:border-black'
                } ${s.inverted ? 'bg-black text-white' : 'bg-white text-black'}`}
              >
                <span className="text-[9px] uppercase font-bold opacity-60">
                  Slide {idx + 1}
                </span>
                <p className="font-bold text-xs line-clamp-2 uppercase">
                  {s.title}
                </p>
                <span className="text-[9px] opacity-60 font-mono">
                  {s.layout}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
