'use client'

import React, { useState, useEffect } from 'react'
import { 
  UploadCloud, File as FileIcon, X, Loader2, Youtube, 
  BookOpen, Folder, Sparkles, CheckCircle2, AlertCircle, ArrowRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ingestYouTubeVideoAction, autoProcessAndClassify } from '@/app/(dashboard)/files/actions'
import { extractYouTubeVideoId, getYouTubeMetadata } from '@/lib/ai/youtube'
import SmartContextSelector from '@/components/ui/SmartContextSelector'
import { ContextSelection } from '@/lib/ai/context'
import YouTubeProgressWidget, { YouTubeProgressState } from '@/components/ui/YouTubeProgressWidget'
import { getEncryptedApiKey, getSelectedGeminiModel } from '@/lib/crypto/storage'

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  // Ingestion Mode: 'file' | 'youtube'
  const [ingestionType, setIngestionType] = useState<'file' | 'youtube'>('file')

  // File Upload State
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // YouTube Ingestion State
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [ytPreview, setYtPreview] = useState<{ title: string; author: string; thumbnailUrl: string } | null>(null)
  const [isCheckingYt, setIsCheckingYt] = useState(false)

  // Target Context (Course / Folder)
  const [contextSelection, setContextSelection] = useState<ContextSelection>({ type: 'all', name: 'Tutti i materiali' })
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  // Status
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    supabase.from('courses').select('id, name').order('name', { ascending: true }).then(res => {
      if (res.data && res.data.length > 0) {
        setCourses(res.data)
        setSelectedCourseId(res.data[0].id)
      }
    })
  }, [supabase])

  // Anteprima YouTube automatica quando si incolla il link
  useEffect(() => {
    const videoId = extractYouTubeVideoId(youtubeUrl)
    if (videoId) {
      setIsCheckingYt(true)
      getYouTubeMetadata(videoId).then(meta => {
        setYtPreview(meta)
        setIsCheckingYt(false)
      }).catch(() => setIsCheckingYt(false))
    } else {
      setYtPreview(null)
    }
  }, [youtubeUrl])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setErrorMsg('')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setErrorMsg('')
    }
  }

  // Upload File Standard
  const handleUploadFile = async () => {
    if (!file) return
    setIsUploading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utente non autenticato")

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // Upload Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw new Error(`Errore Storage: ${uploadError.message}`)

      // Salva record
      const { data: doc, error: dbError } = await supabase.from('documents').insert({
        user_id: user.id,
        course_id: selectedCourseId || null,
        title: file.name,
        file_path: filePath,
        file_type: file.type || fileExt || 'unknown',
        size_bytes: file.size,
        status: 'uploaded'
      }).select().single()

      if (dbError) throw dbError

      // Auto-processing testo ed embeddings vettoriali in background
      const userApiKey = await getEncryptedApiKey('gemini')
      const userModel = getSelectedGeminiModel()
      autoProcessAndClassify(doc.id, doc.file_path, doc.file_type, userApiKey, userModel).catch(err => console.warn("Auto-process error:", err))

      setSuccessMsg('File caricato e integrato nella knowledge base con successo!')
      setFile(null)

      setTimeout(() => router.push('/files'), 1500)
    } catch (err: any) {
      setErrorMsg(err.message || "Errore durante l'upload")
    } finally {
      setIsUploading(false)
    }
  }

  // YouTube Progress Widget State (Bottom Left)
  const [ytProgressState, setYtProgressState] = useState<YouTubeProgressState | null>(null)

  // Import Video YouTube
  const handleImportYouTube = async () => {
    if (!youtubeUrl.trim()) return
    setIsUploading(true)
    setErrorMsg('')
    setSuccessMsg('')

    const activeId = crypto.randomUUID()
    const targetTitle = customTitle.trim() || ytPreview?.title || 'Video YouTube'
    setYtProgressState({
      id: activeId,
      url: youtubeUrl.trim(),
      title: targetTitle,
      thumbnailUrl: ytPreview?.thumbnailUrl,
      step: 'metadata',
      progress: 25,
      stepMessage: 'Recupero metadati da YouTube...'
    })

    try {
      const userApiKey = await getEncryptedApiKey('gemini')
      const userModel = getSelectedGeminiModel()

      if (!userApiKey) {
        throw new Error("Chiave API Google Gemini non trovata. Inserisci la tua API Key personale nelle Impostazioni per elaborare i video.")
      }

      setTimeout(() => {
        setYtProgressState(prev => prev ? {
          ...prev,
          step: 'transcript',
          progress: 50,
          stepMessage: `Trascrizione ed elaborazione didattica con Gemini (${userModel})...`
        } : null)
      }, 500)

      const res = await ingestYouTubeVideoAction({
        url: youtubeUrl.trim(),
        courseId: selectedCourseId || null,
        customTitle: customTitle.trim() || undefined,
        userApiKey,
        userModel
      })

      setYtProgressState(prev => prev ? {
        ...prev,
        step: 'embedding',
        progress: 85,
        stepMessage: `Conversione vettoriale pgvector (${res.chunksCount} chunks)...`
      } : null)

      setTimeout(() => {
        setYtProgressState(prev => prev ? {
          ...prev,
          step: 'completed',
          progress: 100,
          stepMessage: 'Video e vettori indicizzati con successo nella Knowledge Base!',
          chunksCount: res.chunksCount
        } : null)
      }, 300)

      setSuccessMsg(`Video YouTube "${res.document.title}" importato con ${res.chunksCount} frammenti di studio!`)
      setYoutubeUrl('')
      setCustomTitle('')
      setYtPreview(null)

      setTimeout(() => router.push('/files'), 2500)
    } catch (err: any) {
      setYtProgressState(prev => prev ? {
        ...prev,
        step: 'error',
        progress: 100,
        stepMessage: 'Errore durante l\'elaborazione',
        error: err.message || 'Errore importazione YouTube'
      } : null)
      setErrorMsg(err.message || "Errore importazione YouTube")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Carica Materiale di Studio</h1>
          <p className="text-xs text-slate-500 mt-1">
            Importa slide, PDF, appunti o lezioni da YouTube per abilitare la Chat AI, il Tutor e le Flashcard.
          </p>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Ingestion Type Switcher (File vs YouTube) */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => { setIngestionType('file'); setErrorMsg('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              ingestionType === 'file'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileIcon className="w-4 h-4" />
            File dal Computer / Dispositivo
          </button>

          <button
            type="button"
            onClick={() => { setIngestionType('youtube'); setErrorMsg('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              ingestionType === 'youtube'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Youtube className="w-4 h-4" />
            Video / Lezione da YouTube
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          {/* Target Course Selector */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Assegna al Corso di Studio
            </label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs bg-white text-slate-800 outline-none focus:border-blue-500"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {courses.length === 0 && <option value="">Nessun corso creato (verrà assegnato a Generico)</option>}
            </select>
          </div>

          {/* Option A: File Upload */}
          {ingestionType === 'file' && (
            <div className="space-y-4">
              {!file ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                    dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-slate-400 bg-slate-50/30'
                  }`}
                >
                  <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.mp3,.m4a,.wav"
                  />
                  <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Trascina qui il file oppure clicca per sfogliare
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supporta PDF, dispense, slide, documenti di testo, immagini e registrazioni audio
                    </p>
                  </label>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 truncate max-w-sm">{file.name}</p>
                      <p className="text-[11px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    disabled={isUploading}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={handleUploadFile}
                disabled={!file || isUploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Caricamento e analisi in corso...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Carica Documento
                  </>
                )}
              </button>
            </div>
          )}

          {/* Option B: YouTube Ingestion */}
          {ingestionType === 'youtube' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Incolla URL Video o Lezione YouTube
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-red-500 bg-white"
                  />
                  <Youtube className="w-4 h-4 text-red-500 absolute left-3 top-3" />
                </div>
              </div>

              {isCheckingYt && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                  Verifica video in corso...
                </div>
              )}

              {ytPreview && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-4">
                  {ytPreview.thumbnailUrl && (
                    <img
                      src={ytPreview.thumbnailUrl}
                      alt="Anteprima"
                      className="w-24 h-16 object-cover rounded-lg shrink-0 border border-slate-200"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Video Rilevato</span>
                    <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{ytPreview.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Canale: {ytPreview.author}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Titolo Personalizzato (Opzionale)
                </label>
                <input
                  type="text"
                  placeholder="Es. Lezione 4 - Analisi Matematica: Limiti e Continuità"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500 bg-white"
                />
              </div>

              <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-2xl text-[11px] text-red-950 leading-relaxed">
                <span className="font-bold flex items-center gap-1 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-red-600" />
                  Elaborazione Automatica con AI:
                </span>
                Il video verrà trascritto o sintetizzato in dispense didattiche strutturate e indicizzato nel database vettoriale per essere interrogato istantaneamente da Chat, Voce e Tutor.
              </div>

              <button
                onClick={handleImportYouTube}
                disabled={!youtubeUrl.trim() || isUploading}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Estrazione e indicizzazione video in corso...
                  </>
                ) : (
                  <>
                    <Youtube className="w-4 h-4" />
                    Importa Video nella Knowledge Base
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Status Bar / Widget in Basso a Sinistra */}
      <YouTubeProgressWidget 
        state={ytProgressState} 
        onClose={() => setYtProgressState(null)} 
      />
    </div>
  )
}
