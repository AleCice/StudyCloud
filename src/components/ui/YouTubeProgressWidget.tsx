'use client'

import React, { useState } from 'react'
import { 
  Youtube, CheckCircle2, AlertCircle, Loader2, 
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
    <div className="fixed bottom-4 left-4 z-50 w-84 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 bg-red-600 rounded-md shrink-0">
            <Youtube className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold truncate block">
              {isComplete ? 'Video Indicizzato con Successo' : isError ? 'Errore Elaborazione' : 'Elaborazione Video YouTube'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            title={isMinimized ? "Espandi dettagli" : "Riduci a icona"}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-red-400 rounded transition-colors"
            title="Chiudi avviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            isError ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-red-600'
          }`}
          style={{ width: `${Math.max(5, state.progress)}%` }}
        />
      </div>

      {/* Expanded Content */}
      {!isMinimized && (
        <div className="p-4 space-y-3 text-xs bg-white">
          {/* Video Title & Thumbnail */}
          <div className="flex items-start gap-3 pb-2 border-b border-slate-100">
            {state.thumbnailUrl && (
              <img
                src={state.thumbnailUrl}
                alt="Thumbnail"
                className="w-14 h-10 object-cover rounded-lg shrink-0 border border-slate-200"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 truncate leading-tight">{state.title || 'Video YouTube'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                {inProgress && <Loader2 className="w-3 h-3 animate-spin text-red-600 shrink-0" />}
                <span className="truncate">{state.stepMessage}</span>
              </p>
            </div>
          </div>

          {/* Steps Pipeline Checklist */}
          <div className="space-y-1.5 py-1">
            {stepsList.map((st, idx) => {
              const isPast = idx < currentIdx || isComplete
              const isCurrent = idx === currentIdx && !isComplete && !isError
              const isFuture = idx > currentIdx

              const Icon = st.icon

              return (
                <div 
                  key={st.key}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                    isCurrent ? 'bg-red-50/70 border border-red-200' : isPast ? 'bg-slate-50/50' : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-red-600 animate-pulse' : isPast ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={`text-[11px] font-medium ${isCurrent ? 'text-red-950 font-bold' : isPast ? 'text-slate-800' : 'text-slate-400'}`}>
                      {st.label}
                    </span>
                  </div>

                  {isPast ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-red-600 animate-spin shrink-0" />
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Error Message */}
          {isError && state.error && (
            <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Success summary badge */}
          {isComplete && (
            <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-[11px] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Vettori pgvector salvati!</span>
              </div>
              {state.chunksCount && (
                <span className="bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {state.chunksCount} frammenti
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
