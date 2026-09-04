'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, Sparkles, Presentation, FileText, Check, Loader2, AlertCircle, 
  FileCode, FileDown, Layers
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  generateStudioArtifactAction, 
  ArtifactType, 
  ArtifactSubtype 
} from '@/app/(dashboard)/studio/actions'
import { getEncryptedApiKey, getSelectedGeminiModel } from '@/lib/crypto/storage'

interface Props {
  isOpen: boolean
  onClose: () => void
  initialCourseId?: string | null
  initialType?: ArtifactType
}

export default function GenerateArtifactModal({ isOpen, onClose, initialCourseId, initialType = 'presentation' }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [type, setType] = useState<ArtifactType>(initialType)
  const [subtype, setSubtype] = useState<ArtifactSubtype>('slides_exam')
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '')
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  
  // Opzioni avanzate di personalizzazione
  const [depth, setDepth] = useState<'short' | 'standard' | 'deep'>('standard')
  const [formatStyle, setFormatStyle] = useState<'academic' | 'schematic' | 'qa'>('academic')
  const [targetExport, setTargetExport] = useState<'pdf' | 'docx' | 'markdown' | 'pptx'>('pdf')
  const [includeFormulas, setIncludeFormulas] = useState(true)
  const [includeTables, setIncludeTables] = useState(true)
  const [includeGlossary, setIncludeGlossary] = useState(false)

  // Documenti sorgente RAG
  const [availableDocs, setAvailableDocs] = useState<Array<{ id: string; title: string; course_id: string | null }>>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  
  const [topicPrompt, setTopicPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Caricamento corsi e documenti
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: coursesData }, { data: docsData }] = await Promise.all([
        supabase.from('courses').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
        supabase.from('documents').select('id, title, course_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
      ])

      setCourses(coursesData || [])
      setAvailableDocs(docsData || [])

      if (!selectedCourseId && coursesData && coursesData.length > 0) {
        setSelectedCourseId(coursesData[0].id)
      }
    }

    loadData()
  }, [isOpen, supabase])

  // Coerenza formato export e subtype al cambio tipo
  useEffect(() => {
    if (type === 'presentation') {
      if (!['slides_exam', 'slides_quick', 'weak_topics'].includes(subtype)) {
        setSubtype('slides_exam')
      }
      if (targetExport !== 'pptx' && targetExport !== 'pdf') {
        setTargetExport('pptx')
      }
    } else {
      if (!['summary', 'cheatsheet', 'report'].includes(subtype)) {
        setSubtype('summary')
      }
      if (targetExport === 'pptx') {
        setTargetExport('docx')
      }
    }
  }, [type])

  if (!isOpen) return null

  const filteredDocs = availableDocs.filter(d => !selectedCourseId || d.course_id === selectedCourseId)

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const userApiKey = await getEncryptedApiKey('gemini')
      const userModel = getSelectedGeminiModel()

      if (!userApiKey) {
        throw new Error("Chiave API Google Gemini non configurata. Inseriscila nelle Impostazioni.")
      }

      const artifact = await generateStudioArtifactAction({
        type,
        subtype,
        courseId: selectedCourseId || null,
        sourceDocIds: selectedDocIds,
        topicPrompt: topicPrompt.trim() || undefined,
        depth,
        formatStyle,
        includeFormulas,
        includeTables,
        includeGlossary,
        targetExport,
        userApiKey,
        userModel
      })

      onClose()
      router.push(`/studio/${artifact.id}`)
    } catch (err: any) {
      console.error("Errore generazione Studio:", err)
      setError(err.message || "Errore durante la generazione.")
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-100 font-mono"
      onClick={onClose}
    >
      <div 
        className="bg-white border-2 border-black p-5 sm:p-6 w-full max-w-2xl shadow-[8px_8px_0px_rgba(0,0,0,1)] relative text-black max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header pulito senza testi pomposi */}
        <div className="flex items-start justify-between border-b border-black pb-3 mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-white px-1.5 py-0.5 inline-block mb-1">
              STUDIO // GENERAZIONE
            </span>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-tight text-black">
              Nuovo Progetto Didattico
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 border border-black hover:bg-black hover:text-white transition-colors"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 border border-black bg-zinc-100 text-xs flex items-center gap-2 mb-4 font-sans text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          
          {/* 1. Tipo Principale */}
          <div>
            <label className="font-bold uppercase tracking-wider block mb-1.5 text-[11px]">
              1. Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('presentation')}
                className={`p-2.5 border text-left flex items-center gap-2.5 transition-all ${
                  type === 'presentation'
                    ? 'border-2 border-black bg-black text-white font-bold'
                    : 'border-zinc-300 hover:border-black bg-white text-black'
                }`}
              >
                <Presentation className="w-4 h-4 shrink-0" />
                <div>
                  <span className="uppercase block text-xs">Slide 16:9</span>
                  <span className={`text-[10px] block ${type === 'presentation' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    Esami e presentazioni
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('document')}
                className={`p-2.5 border text-left flex items-center gap-2.5 transition-all ${
                  type === 'document'
                    ? 'border-2 border-black bg-black text-white font-bold'
                    : 'border-zinc-300 hover:border-black bg-white text-black'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <div>
                  <span className="uppercase block text-xs">Dispensa A4</span>
                  <span className={`text-[10px] block ${type === 'document' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    Formulari e schemi
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. File Type / Formato di Esportazione Target */}
          <div>
            <label className="font-bold uppercase tracking-wider block mb-1.5 text-[11px]">
              2. Formato Esportazione
            </label>
            <div className="flex flex-wrap gap-2">
              {type === 'document' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTargetExport('docx')}
                    className={`px-3 py-1.5 border text-xs uppercase font-bold flex items-center gap-1.5 transition-colors ${
                      targetExport === 'docx' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                    }`}
                  >
                    <span>Word (.docx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetExport('pdf')}
                    className={`px-3 py-1.5 border text-xs uppercase font-bold flex items-center gap-1.5 transition-colors ${
                      targetExport === 'pdf' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                    }`}
                  >
                    <span>Stampa A4 (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetExport('markdown')}
                    className={`px-3 py-1.5 border text-xs uppercase font-bold flex items-center gap-1.5 transition-colors ${
                      targetExport === 'markdown' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                    }`}
                  >
                    <span>Markdown (.md)</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setTargetExport('pptx')}
                    className={`px-3 py-1.5 border text-xs uppercase font-bold flex items-center gap-1.5 transition-colors ${
                      targetExport === 'pptx' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                    }`}
                  >
                    <span>PowerPoint (.pptx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetExport('pdf')}
                    className={`px-3 py-1.5 border text-xs uppercase font-bold flex items-center gap-1.5 transition-colors ${
                      targetExport === 'pdf' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
                    }`}
                  >
                    <span>Slide PDF 16:9</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3. Personalizzazione Struttura & Lunghezza */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Profondità / Quantità */}
            <div>
              <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
                {type === 'presentation' ? 'Numero Slide' : 'Estensione'}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDepth('short')}
                  className={`py-1.5 px-2 border text-center font-bold ${
                    depth === 'short' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'
                  }`}
                >
                  {type === 'presentation' ? '5 Slide' : 'Breve'}
                </button>
                <button
                  type="button"
                  onClick={() => setDepth('standard')}
                  className={`py-1.5 px-2 border text-center font-bold ${
                    depth === 'standard' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'
                  }`}
                >
                  {type === 'presentation' ? '8 Slide' : 'Media'}
                </button>
                <button
                  type="button"
                  onClick={() => setDepth('deep')}
                  className={`py-1.5 px-2 border text-center font-bold ${
                    depth === 'deep' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'
                  }`}
                >
                  {type === 'presentation' ? '12 Slide' : 'Estesa'}
                </button>
              </div>
            </div>

            {/* Stile di Trattazione */}
            <div>
              <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
                Stile Trattazione
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormatStyle('academic')}
                  className={`py-1.5 px-2 border text-center font-bold ${
                    formatStyle === 'academic' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'
                  }`}
                >
                  Accademico
                </button>
                <button
                  type="button"
                  onClick={() => setFormatStyle('schematic')}
                  className={`py-1.5 px-2 border text-center font-bold ${
                    formatStyle === 'schematic' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'
                  }`}
                >
                  Schemi
                </button>
                <button
                  type="button"
                  onClick={() => setFormatStyle('qa')}
                  className={`py-1.5 px-2 border text-center font-bold ${
                    formatStyle === 'qa' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'
                  }`}
                >
                  Q&A Orale
                </button>
              </div>
            </div>
          </div>

          {/* 4. Opzioni Contenuto Rapide (Checkbox puliti) */}
          <div>
            <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
              Contenuto Tecnico
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px]">
                <input
                  type="checkbox"
                  checked={includeFormulas}
                  onChange={e => setIncludeFormulas(e.target.checked)}
                  className="accent-black w-3.5 h-3.5"
                />
                <span>Formule KaTeX ($$)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px]">
                <input
                  type="checkbox"
                  checked={includeTables}
                  onChange={e => setIncludeTables(e.target.checked)}
                  className="accent-black w-3.5 h-3.5"
                />
                <span>Tabelle di sintesi</span>
              </label>

              {type === 'document' && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px]">
                  <input
                    type="checkbox"
                    checked={includeGlossary}
                    onChange={e => setIncludeGlossary(e.target.checked)}
                    className="accent-black w-3.5 h-3.5"
                  />
                  <span>Glossario definizioni</span>
                </label>
              )}
            </div>
          </div>

          {/* 5. Corso */}
          <div>
            <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
              Corso
            </label>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="w-full border border-black px-2.5 py-1.5 text-xs font-mono bg-white outline-none"
            >
              <option value="">Generale (Nessun corso specifico)</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 6. Selezione Fonti RAG */}
          {filteredDocs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold uppercase tracking-wider text-[11px]">
                  Fonti Knowledge Base ({selectedDocIds.length} selezionati)
                </label>
                {selectedDocIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds([])}
                    className="text-[10px] text-zinc-500 hover:text-black underline"
                  >
                    Deseleziona
                  </button>
                )}
              </div>
              <div className="max-h-24 overflow-y-auto border border-black p-1.5 space-y-1 bg-zinc-50 text-[11px]">
                {filteredDocs.map(doc => {
                  const isChecked = selectedDocIds.includes(doc.id)
                  return (
                    <div 
                      key={doc.id}
                      onClick={() => toggleDocSelection(doc.id)}
                      className={`p-1 flex items-center justify-between cursor-pointer border transition-colors ${
                        isChecked ? 'border-black bg-black text-white font-bold' : 'border-transparent hover:bg-white text-zinc-800'
                      }`}
                    >
                      <span className="truncate pr-2">{doc.title}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 7. Focus / Istruzioni specifiche */}
          <div>
            <label className="font-bold uppercase tracking-wider block mb-1 text-[11px]">
              Focus / Argomento specifico (Opzionale)
            </label>
            <input
              type="text"
              placeholder="Es. Teorema di Gauss, polarizzazione e condizioni al contorno"
              value={topicPrompt}
              onChange={e => setTopicPrompt(e.target.value)}
              className="w-full border border-black px-3 py-1.5 text-xs font-mono outline-none bg-white focus:bg-zinc-50"
            />
          </div>

          {/* Pulsanti Footer */}
          <div className="pt-3 border-t border-black flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-zinc-300 text-xs font-bold uppercase hover:bg-zinc-100 transition-colors text-zinc-600"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-1.5 bg-black text-white border border-black font-bold uppercase hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Elaborazione in corso...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Genera</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
