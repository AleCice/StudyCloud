'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Presentation, FileText, Sparkles, Plus, Trash2, Clock, 
  Layers, ChevronRight, GraduationCap, Play, BookOpen, AlertCircle
} from 'lucide-react'
import { 
  getStudioArtifacts, 
  deleteStudioArtifact, 
  saveStudioArtifact,
  StudioArtifact, 
  ArtifactType 
} from './actions'
import { createClient } from '@/lib/supabase/client'
import GenerateArtifactModal from '@/components/studio/GenerateArtifactModal'

export default function StudioPage() {
  const router = useRouter()
  const supabase = createClient()

  const [artifacts, setArtifacts] = useState<StudioArtifact[]>([])
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'presentation' | 'document'>('all')
  const [loading, setLoading] = useState(true)
  
  // Modal Generazione AI
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [generateInitialType, setGenerateInitialType] = useState<ArtifactType>('presentation')

  const loadData = async () => {
    setLoading(true)
    try {
      const courseFilter = selectedCourseId === 'all' ? undefined : selectedCourseId
      const [items, { data: coursesData }] = await Promise.all([
        getStudioArtifacts(courseFilter),
        supabase.from('courses').select('id, name').order('name', { ascending: true })
      ])
      setArtifacts(items)
      setCourses(coursesData || [])
    } catch (err) {
      console.error("Errore caricamento studio:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedCourseId])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm("Eliminare definitivamente questo documento/presentazione?")) return
    await deleteStudioArtifact(id)
    setArtifacts(prev => prev.filter(a => a.id !== id))
  }

  const handleCreateEmpty = async (type: ArtifactType) => {
    const isPres = type === 'presentation'
    const newArt = await saveStudioArtifact({
      title: isPres ? 'Nuova Presentazione' : 'Nuova Dispensa',
      type,
      subtype: isPres ? 'slides_exam' : 'summary',
      course_id: selectedCourseId !== 'all' ? selectedCourseId : null,
      content: isPres ? {
        slides: [
          { id: '1', title: 'TITOLO PRESENTAZIONE', subtitle: 'Sottotitolo della lezione', layout: 'title', inverted: true },
          { id: '2', title: 'Introduzione', layout: 'bullets', bullets: ['Primo concetto chiave', 'Secondo concetto da dimostrare'] }
        ]
      } : {
        markdown: `# Titolo del Documento\n\n## 1.0 Introduzione\n\nInserisci qui il testo o genera i contenuti dalle dispense caricate...`
      }
    })

    router.push(`/studio/${newArt.id}`)
  }

  const filteredArtifacts = artifacts.filter(a => {
    if (activeTab === 'all') return true
    return a.type === activeTab
  })

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white text-black min-h-full">
      {/* Top Header */}
      <div className="border-b border-black px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white sticky top-0 z-20">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-black font-mono uppercase">
            Studio // Documenti & Slide
          </h1>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <button
            onClick={() => {
              setGenerateInitialType('presentation')
              setIsGenerateModalOpen(true)
            }}
            className="flex items-center gap-1.5 bg-black text-white hover:bg-zinc-800 px-3 py-1.5 text-xs font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] border border-black"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Genera AI</span>
          </button>

          <button
            onClick={() => handleCreateEmpty('presentation')}
            className="flex items-center gap-1.5 border border-black bg-white hover:bg-zinc-100 text-black px-2.5 py-1.5 text-xs font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nuove Slide</span>
          </button>

          <button
            onClick={() => handleCreateEmpty('document')}
            className="flex items-center gap-1.5 border border-black bg-white hover:bg-zinc-100 text-black px-2.5 py-1.5 text-xs font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nuovo Doc</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* KPI Quick Stats - Compatto su mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono">
          <div className="border border-black p-2 sm:p-3.5 bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block mb-0.5 truncate">Lavori Totali</span>
            <p className="text-lg sm:text-2xl font-bold">{artifacts.length}</p>
          </div>

          <div className="border border-black p-2 sm:p-3.5 bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block mb-0.5 truncate">Slide</span>
            <p className="text-lg sm:text-2xl font-bold">{artifacts.filter(a => a.type === 'presentation').length}</p>
          </div>

          <div className="border border-black p-2 sm:p-3.5 bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-zinc-500 block mb-0.5 truncate">Dispense</span>
            <p className="text-lg sm:text-2xl font-bold">{artifacts.filter(a => a.type === 'document').length}</p>
          </div>
        </div>

        {/* Filters & Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black pb-3 font-mono text-[11px] sm:text-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 border font-bold uppercase transition-colors ${
                activeTab === 'all' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
              }`}
            >
              Tutti ({artifacts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('presentation')}
              className={`px-3 py-1.5 border font-bold uppercase transition-colors flex items-center gap-1.5 ${
                activeTab === 'presentation' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              Presentazioni ({artifacts.filter(a => a.type === 'presentation').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('document')}
              className={`px-3 py-1.5 border font-bold uppercase transition-colors flex items-center gap-1.5 ${
                activeTab === 'document' ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black bg-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Documenti ({artifacts.filter(a => a.type === 'document').length})
            </button>
          </div>

          {/* Course Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 uppercase">Corso:</span>
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              className="border border-black px-2.5 py-1 text-xs font-mono bg-white outline-none"
            >
              <option value="all">Tutti i Corsi</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Grid */}
        {loading ? (
          <div className="p-12 text-center font-mono text-xs text-zinc-500">
            Caricamento progetti Studio...
          </div>
        ) : filteredArtifacts.length === 0 ? (
          <div className="border border-black p-10 text-center bg-white space-y-3 font-mono">
            <Layers className="w-10 h-10 mx-auto text-zinc-300 stroke-[1.5]" />
            <h3 className="font-bold text-sm uppercase text-black">Nessun Progetto</h3>
            <p className="text-xs text-zinc-500 font-sans max-w-sm mx-auto">
              Nessun documento o presentazione creato per questa selezione.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setGenerateInitialType('presentation')
                  setIsGenerateModalOpen(true)
                }}
                className="px-4 py-2 bg-black text-white text-xs font-bold uppercase hover:bg-zinc-800 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Genera con AI
              </button>
              <button
                type="button"
                onClick={() => handleCreateEmpty('presentation')}
                className="px-4 py-2 border border-black text-black text-xs font-bold uppercase hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              >
                + Nuova Slide
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredArtifacts.map(art => {
              const isPres = art.type === 'presentation'
              const presContent = art.content as any
              const slideCount = presContent?.slides?.length || 0

              return (
                <Link
                  key={art.id}
                  href={`/studio/${art.id}`}
                  className="border-2 border-black bg-white p-5 hover:bg-zinc-50 transition-all flex flex-col justify-between shadow-[4px_4px_0px_rgba(0,0,0,1)] group"
                >
                  <div>
                    {/* Top Type & Course Tag */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-2.5 mb-3 font-mono">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-black text-white">
                        {isPres ? 'SLIDE 16:9' : 'DISPENSA A4'}
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[140px] font-bold">
                        {art.course?.name || 'Generale'}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-base font-mono uppercase tracking-tight text-black group-hover:underline line-clamp-2 mb-2">
                      {art.title}
                    </h3>

                    {/* Metadata / Details */}
                    <div className="text-xs text-zinc-600 font-mono mt-2">
                      {isPres ? (
                        <p className="flex items-center gap-1.5 text-[11px]">
                          <Presentation className="w-3.5 h-3.5 text-black" />
                          <span>{slideCount} Slide</span>
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-[11px]">
                          <FileText className="w-3.5 h-3.5 text-black" />
                          <span>Dispensa A4 · Markdown / DOCX</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-4 mt-4 border-t border-zinc-200 flex items-center justify-between font-mono text-xs">
                    <span className="text-[10px] text-zinc-400">
                      {new Date(art.updated_at).toLocaleDateString('it-IT')}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => handleDelete(art.id, e)}
                        className="p-1 border border-zinc-300 hover:border-black hover:bg-zinc-100 text-zinc-600 hover:text-black transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <span className="px-2 py-1 bg-black text-white font-bold uppercase text-[10px] flex items-center gap-1 group-hover:translate-x-[2px] transition-transform">
                        Apri <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

      </div>

      {/* Generate Artifact Modal */}
      <GenerateArtifactModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        initialType={generateInitialType}
        initialCourseId={selectedCourseId !== 'all' ? selectedCourseId : null}
      />
    </div>
  )
}
