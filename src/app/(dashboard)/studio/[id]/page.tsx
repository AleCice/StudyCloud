'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, Save, Play, Plus, Trash2, Layout, FileText, 
  Presentation, Check, Clock, Eye, Edit3, ArrowUp, ArrowDown, 
  Sparkles, Layers, Code, Quote, Hash, Printer, Split, Loader2
} from 'lucide-react'
import { 
  getStudioArtifact, 
  saveStudioArtifact, 
  StudioArtifact, 
  SlideItem,
  PresentationContent,
  DocumentContent 
} from '../actions'
import PresentationViewer from '@/components/studio/PresentationViewer'
import DocumentViewer from '@/components/studio/DocumentViewer'

export default function StudioDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [artifact, setArtifact] = useState<StudioArtifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Modalità: 'preview' (visualizzatore interattivo) o 'edit' (editor split-screen)
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')
  
  // Editor Slide State
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)

  useEffect(() => {
    if (!id) return

    getStudioArtifact(id).then(art => {
      if (art) {
        setArtifact(art)
        setIsDirty(false)
      } else {
        router.push('/studio')
      }
      setLoading(false)
    })
  }, [id, router])

  const handleSave = async (updated?: Partial<StudioArtifact>) => {
    if (!artifact) return
    setSaving(true)
    try {
      const payload: StudioArtifact = {
        ...artifact,
        ...updated,
        updated_at: new Date().toISOString()
      }
      const res = await saveStudioArtifact(payload)
      setArtifact(res)
      setIsDirty(false)
    } catch (err) {
      console.error("Errore salvataggio:", err)
    } finally {
      setSaving(false)
    }
  }

  // --- Slide Operations ---
  const handleUpdateSlide = (slideIndex: number, fields: Partial<SlideItem>) => {
    if (!artifact || artifact.type !== 'presentation') return
    const content = artifact.content as PresentationContent
    const updatedSlides = [...(content.slides || [])]
    updatedSlides[slideIndex] = {
      ...updatedSlides[slideIndex],
      ...fields
    }
    const updated = {
      content: {
        ...content,
        slides: updatedSlides
      }
    }
    setArtifact(prev => prev ? { ...prev, ...updated } : prev)
    setIsDirty(true)
  }

  const handleAddSlide = () => {
    if (!artifact || artifact.type !== 'presentation') return
    const content = artifact.content as PresentationContent
    const newSlide: SlideItem = {
      id: crypto.randomUUID(),
      title: 'Nuova Slide',
      layout: 'bullets',
      bullets: ['Primo concetto chiave'],
      notes: ''
    }
    const updatedSlides = [...(content.slides || []), newSlide]
    const updated = {
      content: {
        ...content,
        slides: updatedSlides
      }
    }
    setArtifact(prev => prev ? { ...prev, ...updated } : prev)
    setSelectedSlideIndex(updatedSlides.length - 1)
    setIsDirty(true)
  }

  const handleDeleteSlide = (slideIndex: number) => {
    if (!artifact || artifact.type !== 'presentation') return
    const content = artifact.content as PresentationContent
    const updatedSlides = content.slides.filter((_, i) => i !== slideIndex)
    const updated = {
      content: {
        ...content,
        slides: updatedSlides
      }
    }
    setArtifact(prev => prev ? { ...prev, ...updated } : prev)
    setSelectedSlideIndex(prev => Math.max(0, Math.min(updatedSlides.length - 1, prev)))
    setIsDirty(true)
  }

  const handleMoveSlide = (slideIndex: number, direction: 'up' | 'down') => {
    if (!artifact || artifact.type !== 'presentation') return
    const content = artifact.content as PresentationContent
    const slides = [...content.slides]
    const targetIndex = direction === 'up' ? slideIndex - 1 : slideIndex + 1
    if (targetIndex < 0 || targetIndex >= slides.length) return

    const temp = slides[slideIndex]
    slides[slideIndex] = slides[targetIndex]
    slides[targetIndex] = temp

    const updated = {
      content: {
        ...content,
        slides
      }
    }
    setArtifact(prev => prev ? { ...prev, ...updated } : prev)
    setSelectedSlideIndex(targetIndex)
    setIsDirty(true)
  }

  // --- Document Operations ---
  const handleUpdateMarkdown = (newMarkdown: string) => {
    if (!artifact || artifact.type !== 'document') return
    const content = artifact.content as DocumentContent
    setArtifact(prev => prev ? {
      ...prev,
      content: {
        ...content,
        markdown: newMarkdown
      }
    } : prev)
    setIsDirty(true)
  }

  if (loading || !artifact) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 font-mono text-xs text-zinc-500">
        Caricamento progetto Studio...
      </div>
    )
  }

  const isPres = artifact.type === 'presentation'
  const presContent = artifact.content as PresentationContent
  const docContent = artifact.content as DocumentContent
  const activeSlide: SlideItem | undefined = presContent.slides?.[selectedSlideIndex]

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white text-black min-h-full flex flex-col font-sans">
      {/* Top Studio Action Bar */}
      <div className="border-b border-black px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-white sticky top-0 z-30 font-mono text-xs print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/studio"
            className="p-1.5 border border-black hover:bg-black hover:text-white transition-colors"
            title="Torna allo Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-black text-white">
                {isPres ? 'SLIDE DECK 16:9' : 'DISPENSA A4'}
              </span>
              {artifact.course?.name && (
                <span className="text-[10px] text-zinc-500 hidden sm:inline truncate">
                  {artifact.course.name}
                </span>
              )}
            </div>
            <input
              type="text"
              value={artifact.title}
              onChange={e => {
                setArtifact({ ...artifact, title: e.target.value })
                setIsDirty(true)
              }}
              placeholder="Titolo del progetto..."
              className="font-bold text-sm sm:text-base font-mono uppercase tracking-tight text-black bg-transparent outline-none border-b border-transparent hover:border-zinc-300 focus:border-black w-full max-w-sm sm:max-w-md truncate"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Toggle Modalità: Presenta/Leggi vs Modifica */}
          <div className="flex items-center border border-black p-0.5 bg-zinc-100">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1 font-bold uppercase flex items-center gap-1.5 transition-colors ${
                viewMode === 'preview' ? 'bg-black text-white' : 'hover:text-zinc-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isPres ? 'Presenta' : 'Anteprima'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 font-bold uppercase flex items-center gap-1.5 transition-colors ${
                viewMode === 'edit' ? 'bg-black text-white' : 'hover:text-zinc-600'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modifica</span>
            </button>
          </div>

          {/* Salvataggio con indicatore stato cloud */}
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || !isDirty}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 border border-black font-bold uppercase transition-colors text-xs ${
              saving
                ? 'bg-black text-white opacity-70 cursor-wait'
                : isDirty
                ? 'bg-black text-white hover:bg-zinc-800 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]'
                : 'bg-zinc-100 text-black border-black cursor-default'
            }`}
            title={isDirty ? 'Ci sono modifiche non salvate nel cloud' : 'Tutte le modifiche sono sincronizzate nel cloud'}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Salvataggio...</span>
              </>
            ) : isDirty ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Salva</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Salvato</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full print:p-0 print:max-w-none">
        {/* =========================================================================
            PRESENTATION MODE
            ========================================================================= */}
        {isPres && (
          viewMode === 'preview' ? (
            /* Visualizzatore Slide Interattivo Fullscreen */
            <div className="space-y-4">
              <PresentationViewer 
                content={presContent} 
                title={artifact.title} 
                courseName={artifact.course?.name}
              />
            </div>
          ) : (
            /* Editor Slide a Doppio Pannello (Filmstrip a sinistra + Editor Slide a destra) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Filmstrip Slide Thumbnails (4 Cols) */}
              <div className="lg:col-span-4 border border-black bg-white flex flex-col max-h-[75vh]">
                <div className="border-b border-black p-3 bg-zinc-50 flex items-center justify-between font-mono text-xs font-bold uppercase">
                  <span>Slide ({presContent.slides?.length || 0})</span>
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="p-1 border border-black bg-white hover:bg-black hover:text-white transition-colors"
                    title="Aggiungi slide"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {presContent.slides?.map((slide, idx) => (
                    <div
                      key={slide.id || idx}
                      onClick={() => setSelectedSlideIndex(idx)}
                      className={`p-2.5 border cursor-pointer transition-all flex items-start justify-between gap-2 font-mono ${
                        idx === selectedSlideIndex 
                          ? 'border-2 border-black bg-zinc-100 shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                          : 'border-zinc-300 hover:border-black bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase mb-0.5">
                          <span>#{idx + 1}</span>
                          <span>·</span>
                          <span>{slide.layout}</span>
                          {slide.inverted && <span className="bg-black text-white px-1 text-[8px]">DARK</span>}
                        </div>
                        <p className="font-bold text-xs truncate text-black uppercase">
                          {slide.title || 'Senza Titolo'}
                        </p>
                      </div>

                      {/* Reorder / Delete Controls */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 hover:text-black text-zinc-400 disabled:opacity-20"
                          title="Sposta su"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, 'down')}
                          disabled={idx === presContent.slides.length - 1}
                          className="p-0.5 hover:text-black text-zinc-400 disabled:opacity-20"
                          title="Sposta giù"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(idx)}
                          className="p-0.5 hover:text-red-600 text-zinc-400"
                          title="Elimina slide"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Slide Editor Form (8 Cols) */}
              <div className="lg:col-span-8 border border-black bg-white p-5 space-y-4 font-mono text-xs">
                {activeSlide ? (
                  <>
                    <div className="flex items-center justify-between border-b border-black pb-3">
                      <h3 className="font-bold uppercase text-sm">
                        Modifica Slide #{selectedSlideIndex + 1}
                      </h3>

                      {/* Toggle Inverted Dark Slide */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!activeSlide.inverted}
                          onChange={e => handleUpdateSlide(selectedSlideIndex, { inverted: e.target.checked })}
                          className="w-4 h-4 accent-black"
                        />
                        <span className="font-bold uppercase text-[11px]">Tema Invertito (Nero)</span>
                      </label>
                    </div>

                    {/* Layout Selector */}
                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1.5">
                        Layout Slide
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {(['title', 'bullets', 'columns', 'formula', 'code', 'quote'] as const).map(lay => (
                          <button
                            key={lay}
                            type="button"
                            onClick={() => handleUpdateSlide(selectedSlideIndex, { layout: lay })}
                            className={`p-2 border text-center font-bold uppercase text-[10px] transition-colors ${
                              activeSlide.layout === lay ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                            }`}
                          >
                            {lay}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Titolo e Sottotitolo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold uppercase tracking-wider block mb-1">
                          Titolo Slide
                        </label>
                        <input
                          type="text"
                          value={activeSlide.title}
                          onChange={e => handleUpdateSlide(selectedSlideIndex, { title: e.target.value })}
                          className="w-full border border-black px-3 py-2 text-xs font-mono outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="font-bold uppercase tracking-wider block mb-1">
                          Sottotitolo / Info
                        </label>
                        <input
                          type="text"
                          value={activeSlide.subtitle || ''}
                          onChange={e => handleUpdateSlide(selectedSlideIndex, { subtitle: e.target.value })}
                          className="w-full border border-black px-3 py-2 text-xs font-mono outline-none bg-white"
                        />
                      </div>
                    </div>

                    {/* Campi specifici per layout */}
                    {activeSlide.layout === 'bullets' && (
                      <div>
                        <label className="font-bold uppercase tracking-wider block mb-1">
                          Punti Elenco (uno per riga)
                        </label>
                        <textarea
                          rows={5}
                          value={activeSlide.bullets?.join('\n') || ''}
                          onChange={e => handleUpdateSlide(selectedSlideIndex, { bullets: e.target.value.split('\n') })}
                          placeholder="Punto chiave 1&#10;Punto chiave 2..."
                          className="w-full border border-black p-3 text-xs font-mono outline-none bg-white"
                        />
                      </div>
                    )}

                    {activeSlide.layout === 'columns' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold uppercase tracking-wider block mb-1">
                            Colonna Sinistra
                          </label>
                          <textarea
                            rows={6}
                            value={activeSlide.leftColumn || ''}
                            onChange={e => handleUpdateSlide(selectedSlideIndex, { leftColumn: e.target.value })}
                            className="w-full border border-black p-2.5 text-xs font-mono outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="font-bold uppercase tracking-wider block mb-1">
                            Colonna Destra
                          </label>
                          <textarea
                            rows={6}
                            value={activeSlide.rightColumn || ''}
                            onChange={e => handleUpdateSlide(selectedSlideIndex, { rightColumn: e.target.value })}
                            className="w-full border border-black p-2.5 text-xs font-mono outline-none bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {activeSlide.layout === 'formula' && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-bold uppercase tracking-wider block mb-1">
                            Formula LaTeX (KaTeX)
                          </label>
                          <input
                            type="text"
                            value={activeSlide.formula || ''}
                            onChange={e => handleUpdateSlide(selectedSlideIndex, { formula: e.target.value })}
                            placeholder="Es. $$E = mc^2$$"
                            className="w-full border border-black px-3 py-2 text-xs font-mono outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="font-bold uppercase tracking-wider block mb-1">
                            Spiegazione Parametri (uno per riga)
                          </label>
                          <textarea
                            rows={3}
                            value={activeSlide.bullets?.join('\n') || ''}
                            onChange={e => handleUpdateSlide(selectedSlideIndex, { bullets: e.target.value.split('\n') })}
                            className="w-full border border-black p-2 text-xs font-mono outline-none bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Note Oratore (Presenter Notes) */}
                    <div>
                      <label className="font-bold uppercase tracking-wider block mb-1 text-zinc-600">
                        Note dell&apos;Oratore (Cosa dire all&apos;orale)
                      </label>
                      <textarea
                        rows={3}
                        value={activeSlide.notes || ''}
                        onChange={e => handleUpdateSlide(selectedSlideIndex, { notes: e.target.value })}
                        placeholder="Promemoria e argomentazioni da esporre a voce..."
                        className="w-full border border-zinc-300 p-2.5 text-xs font-mono outline-none bg-zinc-50 focus:border-black"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-zinc-500">Seleziona una slide dalla lista a sinistra.</p>
                )}
              </div>
            </div>
          )
        )}

        {/* =========================================================================
            DOCUMENT MODE
            ========================================================================= */}
        {!isPres && (
          viewMode === 'preview' ? (
            /* Visualizzatore Documento Accademico con Stampa PDF */
            <DocumentViewer 
              content={docContent} 
              title={artifact.title} 
              courseName={artifact.course?.name} 
              subtype={artifact.subtype} 
            />
          ) : (
            /* Editor Split-Screen: Markdown a sinistra + Live Preview a destra */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Column: Markdown Editor */}
              <div className="border border-black bg-white flex flex-col">
                <div className="border-b border-black p-3 bg-zinc-50 flex items-center justify-between font-mono text-xs font-bold uppercase">
                  <span>Sorgente Markdown / LaTeX</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateMarkdown((docContent.markdown || '') + '\n\n$$\\nabla \\cdot \\vec{E} = \\frac{\\rho}{\\epsilon_0}$$\n')}
                      className="border border-zinc-300 px-2 py-0.5 text-[10px] hover:border-black"
                      title="Inserisci formula"
                    >
                      + Formula
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateMarkdown((docContent.markdown || '') + '\n\n| Parametro | Unità | Definizione |\n|---|---|---|\n| E | V/m | Campo elettrico |\n')}
                      className="border border-zinc-300 px-2 py-0.5 text-[10px] hover:border-black"
                      title="Inserisci tabella"
                    >
                      + Tabella
                    </button>
                  </div>
                </div>

                <textarea
                  rows={26}
                  value={docContent.markdown || ''}
                  onChange={e => handleUpdateMarkdown(e.target.value)}
                  className="w-full p-4 font-mono text-xs outline-none resize-y leading-relaxed bg-white border-none"
                  placeholder="# Scrivi o incolla qui il markdown..."
                />
              </div>

              {/* Right Column: Live Document Preview */}
              <div className="sticky top-20">
                <DocumentViewer 
                  content={{ ...docContent, markdown: docContent.markdown }} 
                  title={artifact.title} 
                  courseName={artifact.course?.name} 
                  subtype={artifact.subtype} 
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
