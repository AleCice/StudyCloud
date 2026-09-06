'use client'

import React, { useState } from 'react'
import { 
  Youtube, Check, Loader2, 
  ChevronUp, ChevronDown, X, Sparkles, Brain, FileText, Database
} from 'lucide-react'

export interface YouTubeProgressState {
  id: string
  url: string
  title: string
  thumbnailUrl?: string
  step: 'metadata' | 'transcript' | 'chunking' | 'embedding' | 'completed' | 'error'
  progress: number // 0 to 100
  stepMessage: string
  chunksCount?: number
  error?: string
}

interface Props {
  state: YouTubeProgressState | null
  onClose: () => void
}

export default function YouTubeProgressWidget({ state, onClose }: Props) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!state) return null

  const isComplete = state.step === 'completed'
  const isError = state.step === 'error'
  const inProgress = !isComplete && !isError

  const stepsList = [
    { key: 'metadata', label: 'Metadati & Copertina', icon: Youtube },
    { key: 'transcript', label: 'Trascrizione & Sintesi AI', icon: Sparkles },
    { key: 'chunking', label: 'Suddivisione Chunks', icon: FileText },
    { key: 'embedding', label: 'Conversione Vettori pgvector', icon: Brain },
    { key: 'completed', label: 'Indicizzato nella Knowledge Base', icon: Database }
  ]

  const getCurrentStepIndex = () => {
    switch (state.step) {
      case 'metadata': return 0
      case 'transcript': return 1
      case 'chunking': return 2
      case 'embedding': return 3
      case 'completed': return 4
      default: return 0
    }
  }

  const currentIdx = getCurrentStepIndex()

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 sm:w-96 bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] overflow-hidden select-none font-mono text-xs text-black">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black text-white border-b border-black">
        <div className="flex items-center gap-2 min-w-0">
          <div className="border border-white p-0.5 bg-black text-white shrink-0">
            <Youtube className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase truncate block tracking-tight">
              {isComplete ? 'Video Indicizzato' : isError ? 'Errore Elaborazione' : 'Ingestione YouTube'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-zinc-300 hover:text-white transition-colors"
            title={isMinimized ? "Espandi dettagli" : "Riduci a icona"}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-zinc-300 hover:text-white transition-colors"
            title="Chiudi avviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full bg-zinc-100 h-2 border-b border-black p-[1px]">
        <div 
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${Math.max(5, state.progress)}%` }}
        />
      </div>

      {/* Expanded Content */}
      {!isMinimized && (
        <div className="p-3.5 space-y-3 bg-white">
          {/* Video Title & Thumbnail */}
          <div className="flex items-start gap-3 pb-2.5 border-b border-black">
            {state.thumbnailUrl && (
              <img
                src={state.thumbnailUrl}
                alt="Thumbnail"
                className="w-14 h-10 object-cover shrink-0 border border-black"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold uppercase text-xs truncate leading-tight">{state.title || 'Video YouTube'}</p>
              <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 font-sans">
                {inProgress && <Loader2 className="w-3 h-3 animate-spin text-black shrink-0" />}
                <span className="truncate">{state.stepMessage}</span>
              </p>
            </div>
          </div>

          {/* Steps Pipeline Checklist */}
          <div className="space-y-1 py-1">
            {stepsList.map((st, idx) => {
              const isPast = idx < currentIdx || isComplete
              const isCurrent = idx === currentIdx && !isComplete && !isError
              const Icon = st.icon

              return (
                <div 
                  key={st.key}
                  className={`flex items-center justify-between px-2 py-1.5 border transition-colors ${
                    isCurrent 
                      ? 'bg-zinc-100 border-black font-bold' 
                      : isPast 
                      ? 'border-transparent text-zinc-600' 
                      : 'border-transparent opacity-40 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[11px] uppercase tracking-tight">
                      {st.label}
                    </span>
                  </div>

                  {isPast ? (
                    <div className="w-4 h-4 bg-black text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </div>
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-black animate-spin shrink-0" />
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Error message */}
          {state.error && (
            <div className="p-2 border border-black bg-zinc-100 text-black text-[11px] font-bold uppercase">
              [ERRORE]: {state.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
