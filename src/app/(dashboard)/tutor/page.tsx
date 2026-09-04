'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  createTutorSession, getTutorSessions, deleteTutorSession,
  getWeakTopics, updateWeakTopicStatus, deleteWeakTopic
} from './actions'
import TutorSession from '@/components/tutor/TutorSession'
import SmartContextSelector from '@/components/ui/SmartContextSelector'
import { ContextSelection } from '@/lib/ai/context'
import { 
  GraduationCap, Plus, MessageSquare, Trash2, AlertTriangle, 
  CheckCircle2, BookOpen
} from 'lucide-react'

export default function TutorPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [contextSelection, setContextSelection] = useState<ContextSelection>({ type: 'all', name: 'Tutti i materiali' })
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medio')
  const [topicInput, setTopicInput] = useState('')

  // Current active tab
  const [activeTab, setActiveTab] = useState<'session' | 'weakTopics'>('session')

  // Weak Topics state
  const [weakTopics, setWeakTopics] = useState<any[]>([])
  const [weakLoading, setWeakLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('courses').select('id, name').order('name', { ascending: true })
      if (c) { 
        setCourses(c)
      }
      const s = await getTutorSessions()
      if (s) setSessions(s)
    }
    load()
  }, [supabase])

  // Load weak topics when switching to that tab
  useEffect(() => {
    if (activeTab === 'weakTopics') {
      setWeakLoading(true)
      const courseIdParam = contextSelection.type === 'course' ? contextSelection.id : undefined
      getWeakTopics(courseIdParam).then(res => {
        setWeakTopics(res)
        setWeakLoading(false)
      })
    }
  }, [activeTab, contextSelection])

  const startSession = async () => {
    try {
      const courseIdToUse = contextSelection.type === 'course' && contextSelection.id ? contextSelection.id : (courses[0]?.id || null)
      const session = await createTutorSession(courseIdToUse, null, selectedDifficulty, topicInput)
      setActiveSession({ 
        ...session, 
        courseId: courseIdToUse, 
        contextFilter: contextSelection,
        difficulty: selectedDifficulty 
      })
      const s = await getTutorSessions()
      if (s) setSessions(s)
    } catch (err) {
      console.error(err)
      alert("Errore nella creazione della sessione")
    }
  }

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteTutorSession(id)
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    if (activeSession?.id === id) setActiveSession(null)
  }

  const handleStatusChange = async (topicId: string, newStatus: 'active' | 'reviewed' | 'mastered') => {
    await updateWeakTopicStatus(topicId, newStatus)
    setWeakTopics(prev => prev.map(t => t.id === topicId ? { ...t, status: newStatus } : t))
  }

  const handleDeleteTopic = async (topicId: string) => {
    await deleteWeakTopic(topicId)
    setWeakTopics(prev => prev.filter(t => t.id !== topicId))
  }

  return (
    <div className="flex h-full overflow-hidden bg-white text-black font-sans">
      {/* Sidebar Sessioni */}
      <div className="w-64 border-r border-black bg-zinc-50 flex flex-col shrink-0">
        <div className="p-3 border-b border-black">
          <button
            onClick={() => { setActiveSession(null); setActiveTab('session') }}
            className="w-full flex items-center justify-center gap-2 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors py-2 text-xs font-mono font-bold uppercase tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuova Interrogazione
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => { setActiveSession({ id: s.id, courseId: s.course_id, difficulty: s.difficulty }); setActiveTab('session') }}
              className={`group flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors border ${
                activeSession?.id === s.id && activeTab === 'session' 
                  ? 'bg-black text-white font-bold border-black' 
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{s.course?.name || 'Sessione'}</span>
              </div>
              <button
                onClick={(e) => handleDeleteSession(s.id, e)}
                className={`opacity-0 group-hover:opacity-100 p-1 transition-all ${
                  activeSession?.id === s.id && activeTab === 'session' ? 'text-zinc-300 hover:text-white' : 'text-zinc-500 hover:text-black'
                }`}
                title="Elimina sessione"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-[11px] text-zinc-500 px-3 py-2">Nessuna sessione salvata</p>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header Tabs & Smart Context */}
        <div className="h-[var(--header-height)] border-b border-black flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white gap-2">
          <div className="flex items-center gap-1 border border-black p-0.5 bg-zinc-100 text-xs font-mono">
            <button
              onClick={() => setActiveTab('session')}
              className={`px-3 py-1 font-bold uppercase transition-colors ${
                activeTab === 'session' ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              Interrogazione AI
            </button>
            <button
              onClick={() => setActiveTab('weakTopics')}
              className={`px-3 py-1 font-bold uppercase transition-colors flex items-center gap-1.5 ${
                activeTab === 'weakTopics' ? 'bg-black text-white' : 'text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Concetti Deboli
            </button>
          </div>

          {/* Smart Context Selector */}
          <div className="flex items-center gap-2">
            <SmartContextSelector
              value={contextSelection}
              onChange={setContextSelection}
            />
          </div>
        </div>

        {/* Tab 1: Ripetizioni / Sessione */}
        {activeTab === 'session' && (
          !activeSession ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto py-8 font-mono">
              <div className="border border-black p-4 bg-zinc-50 mb-3 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                <GraduationCap className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-black mb-1">
                Interrogazione Orale Universitaria
              </h2>
              <p className="text-xs text-zinc-500 mb-6 max-w-md text-center font-sans">
                Seleziona insegnamento, cartella o dispensa. Il docente virtuale condurrà un esame orale simulato ponendo domande progressive e registrando le tue lacune.
              </p>
              
              <div className="w-full max-w-md space-y-4 bg-white border-2 border-black p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black block mb-1.5">
                    Materiale di Studio (Corso / Cartella / File)
                  </label>
                  <SmartContextSelector
                    value={contextSelection}
                    onChange={setContextSelection}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black block mb-1.5">
                    Argomento o Capitolo Specifico (Opzionale)
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Campo Elettrico, Legge di Gauss..."
                    value={topicInput}
                    onChange={e => setTopicInput(e.target.value)}
                    className="w-full border border-black p-2.5 text-xs outline-none bg-zinc-50 focus:bg-white text-black font-sans"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-black block mb-1.5">
                    Livello di Rigore Accademico
                  </label>
                  <div className="flex border border-black divide-x divide-black">
                    {['Facile', 'Medio', 'Difficile'].map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setSelectedDifficulty(l)}
                        className={`flex-1 py-2 text-xs font-bold uppercase transition-colors ${
                          selectedDifficulty === l ? 'bg-black text-white' : 'bg-white text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={startSession}
                  className="w-full bg-black text-white py-3 text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors border border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  Inizia Interrogazione Orale
                </button>
              </div>
            </div>
          ) : (
            <TutorSession 
              sessionId={activeSession.id} 
              courseId={activeSession.courseId} 
              contextFilter={activeSession.contextFilter || contextSelection}
              difficulty={activeSession.difficulty} 
            />
          )
        )}

        {/* Tab 2: Argomenti Deboli (Weak Topics) */}
        {activeTab === 'weakTopics' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto font-mono">
            <div className="flex items-center justify-between mb-6 border-b border-black pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-black" />
                  Registro Concetti e Argomenti Deboli
                </h2>
                <p className="text-xs text-zinc-500 font-sans mt-0.5">
                  Riepilogo delle nozioni in cui sono emerse lacune durante le interrogazioni simulate
                </p>
              </div>
            </div>

            {weakLoading ? (
              <p className="text-xs text-zinc-500 py-4">Caricamento registro concetti...</p>
            ) : weakTopics.length === 0 ? (
              <div className="text-center py-12 border border-black bg-zinc-50 p-8 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                <CheckCircle2 className="w-8 h-8 text-black mx-auto mb-2" />
                <p className="text-xs font-bold uppercase text-black">Nessun punto debole registrato</p>
                <p className="text-xs text-zinc-500 mt-1 font-sans">
                  Ottimo lavoro! Svolgi una sessione di interrogazione per verificare la preparazione.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {weakTopics.map(topic => (
                  <div key={topic.id} className="p-4 bg-white border border-black flex items-start justify-between gap-4 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-xs uppercase text-black">{topic.topic}</span>
                        <span className="text-[10px] px-2 py-0.5 border border-black bg-zinc-100 text-black font-bold">
                          {topic.status === 'active' ? 'DA RIPASSARE' : topic.status === 'reviewed' ? 'IN REVISIONE' : 'ASSIMILATO'}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Errori riscontrati: {topic.mistake_count}
                        </span>
                      </div>
                      {topic.notes && (
                        <p className="text-xs text-zinc-700 mt-2 font-sans leading-relaxed bg-zinc-50 p-2.5 border border-zinc-300">
                          {topic.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleStatusChange(topic.id, topic.status === 'mastered' ? 'active' : 'mastered')}
                        className={`p-1.5 border border-black text-xs transition-colors ${
                          topic.status === 'mastered' ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
                        }`}
                        title={topic.status === 'mastered' ? 'Segna come non assimilato' : 'Segna come assimilato'}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="p-1.5 border border-black text-black hover:bg-black hover:text-white transition-colors"
                        title="Rimuovi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
