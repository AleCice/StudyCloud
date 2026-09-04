import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  MessageSquare, 
  GraduationCap, 
  FolderClosed, 
  Upload, 
  Layers, 
  BookOpen, 
  ArrowUpRight, 
  CheckCircle2,
  Presentation
} from 'lucide-react'
import VectorSpace3D from '@/components/dashboard/VectorSpace3D'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // 1. Fetch counts
  const [
    { count: docsCount },
    { count: chunksCount },
    { count: coursesCount },
    { count: flashcardsCount },
  ] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('chunks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('flashcards').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  // 2. Fetch courses
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  const coursesMap = new Map<string, string>()
  courses?.forEach(c => coursesMap.set(c.id, c.name))

  // 3. Fetch recent documents
  const { data: recentDocs } = await supabase
    .from('documents')
    .select('id, title, file_type, size_bytes, status, created_at, course_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(6)

  // 4. Fetch chunks for the 3D Vector Space
  const { data: rawChunks } = await supabase
    .from('chunks')
    .select('id, document_id, content, chunk_index')
    .eq('user_id', user.id)
    .order('chunk_index', { ascending: true })
    .limit(200)

  // 5. Document metadata mapping for chunks
  const docIds = Array.from(new Set((rawChunks || []).map(c => c.document_id)))
  const { data: docsForChunks } = docIds.length > 0 ? await supabase
    .from('documents')
    .select('id, title, course_id')
    .in('id', docIds) : { data: [] }

  const docsMap = new Map<string, { title: string; courseId?: string }>()
  docsForChunks?.forEach(d => docsMap.set(d.id, { title: d.title, courseId: d.course_id }))

  // Prepare normalized chunks for 3D visualizer
  const vectorChunks = (rawChunks || []).map(c => {
    const doc = docsMap.get(c.document_id)
    return {
      id: c.id,
      document_id: c.document_id,
      content: c.content || '',
      chunk_index: c.chunk_index,
      docTitle: doc?.title || 'Documento',
      courseName: doc?.courseId ? coursesMap.get(doc.courseId) || 'Generale' : 'Generale'
    }
  })

  // Calcola distribuzione per corso
  const courseDocCount = new Map<string, number>()
  recentDocs?.forEach(d => {
    const cName = d.course_id ? (coursesMap.get(d.course_id) || 'Non assegnato') : 'Non assegnato'
    courseDocCount.set(cName, (courseDocCount.get(cName) || 0) + 1)
  })

  return (
    <div className="flex-1 overflow-auto bg-white text-black min-h-screen">
      {/* Top Header */}
      <div className="border-b border-black px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-black font-mono uppercase">
            Dashboard
          </h1>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/files"
            className="border border-black bg-white hover:bg-black hover:text-white transition-colors px-3 py-1.5 text-xs font-mono font-bold uppercase flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Carica File
          </Link>

          <Link
            href="/chat"
            className="border border-black bg-black text-white hover:bg-zinc-800 transition-colors px-3 py-1.5 text-xs font-mono font-bold uppercase flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Nuova Chat
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Documenti */}
          <div className="border border-black p-4 bg-white hover:bg-zinc-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-zinc-600">Documenti</span>
              <div className="border border-black p-1 bg-white text-black">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-3xl font-mono font-bold tracking-tight text-black">{docsCount || 0}</p>
          </div>

          {/* Card 2: Frammenti RAG */}
          <div className="border border-black p-4 bg-white hover:bg-zinc-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-zinc-600">Frammenti RAG</span>
              <div className="border border-black p-1 bg-black text-white">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-3xl font-mono font-bold tracking-tight text-black">{chunksCount || 0}</p>
          </div>

          {/* Card 3: Corsi */}
          <div className="border border-black p-4 bg-white hover:bg-zinc-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-zinc-600">Corsi</span>
              <div className="border border-black p-1 bg-white text-black">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-3xl font-mono font-bold tracking-tight text-black">{coursesCount || 0}</p>
          </div>

          {/* Card 4: Flashcards */}
          <div className="border border-black p-4 bg-white hover:bg-zinc-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase font-bold text-zinc-600">Flashcard</span>
              <div className="border border-black p-1 bg-white text-black">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-3xl font-mono font-bold tracking-tight text-black">{flashcardsCount || 0}</p>
          </div>
        </div>

        {/* 3D Vector Space */}
        <VectorSpace3D chunks={vectorChunks} totalVectorsCount={chunksCount || 0} />

        {/* Two-Column Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Recent Uploads Table (7 Cols) */}
          <div className="lg:col-span-7 border border-black bg-white flex flex-col">
            <div className="border-b border-black px-4 py-3 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-black" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-black">
                  Documenti Recenti
                </h3>
              </div>
              <Link 
                href="/files" 
                className="text-[11px] font-mono font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
              >
                Tutti i file <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-0 flex-1 overflow-x-auto">
              {recentDocs && recentDocs.length > 0 ? (
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-black bg-zinc-100 text-zinc-700">
                      <th className="p-3 font-bold uppercase text-[10px]">Titolo</th>
                      <th className="p-3 font-bold uppercase text-[10px]">Corso</th>
                      <th className="p-3 font-bold uppercase text-[10px]">Dimensione</th>
                      <th className="p-3 font-bold uppercase text-[10px]">Stato</th>
                      <th className="p-3 font-bold uppercase text-[10px] text-right">Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDocs.map((doc) => {
                      const courseName = doc.course_id ? (coursesMap.get(doc.course_id) || 'Generale') : 'Generale'
                      const sizeKb = doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : 'N/D'

                      return (
                        <tr key={doc.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                          <td className="p-3 font-bold text-black flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-black"></span>
                            <span className="truncate max-w-[180px] sm:max-w-[220px]" title={doc.title}>
                              {doc.title}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-600">
                            <span className="border border-zinc-300 px-1.5 py-0.5 text-[10px] bg-white">
                              {courseName}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-500">{sizeKb}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 text-[10px] border border-black bg-black text-white px-1.5 py-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {doc.status || 'pronto'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/chat?doc=${doc.id}`}
                              className="border border-black bg-white hover:bg-black hover:text-white px-2 py-1 text-[10px] font-bold uppercase transition-colors"
                            >
                              Interroga
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center font-mono">
                  <p className="text-zinc-500 text-xs mb-3">Nessun documento caricato.</p>
                  <Link
                    href="/files"
                    className="border border-black bg-black text-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-zinc-800"
                  >
                    Carica file
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Knowledge Clusters (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="border border-black bg-white">
              <div className="border-b border-black px-4 py-3 bg-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-black" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-black">
                    Documenti per Corso
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  {courses?.length || 0} corsi
                </span>
              </div>

              <div className="p-4 space-y-3 font-mono text-xs">
                {courses && courses.length > 0 ? (
                  courses.map(c => {
                    const count = courseDocCount.get(c.name) || 0
                    const total = docsCount || 1
                    const pct = Math.round((count / total) * 100)

                    return (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-black">{c.name}</span>
                          <span className="text-zinc-500">{count} doc ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 border border-black bg-zinc-100 p-[1px]">
                          <div 
                            className="h-full bg-black transition-all" 
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-zinc-500 text-[11px]">Nessun corso configurato.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Launch Action Tiles */}
        <div className="border border-black bg-white">
          <div className="border-b border-black px-4 py-2.5 bg-zinc-50">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-black">
              Sezioni Rapide
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-black">
            {/* Tile 1: Chat AI */}
            <Link 
              href="/chat"
              className="p-5 hover:bg-black hover:text-white transition-colors group block"
            >
              <div className="border border-black group-hover:border-white p-2 w-fit mb-3 transition-colors bg-white text-black">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm mb-1 uppercase tracking-tight flex items-center justify-between font-mono">
                Chat AI
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-600 group-hover:text-zinc-300 font-sans">
                Fai domande e approfondisci le dispense.
              </p>
            </Link>

            {/* Tile 2: Tutor */}
            <Link 
              href="/tutor"
              className="p-5 hover:bg-black hover:text-white transition-colors group block"
            >
              <div className="border border-black group-hover:border-white p-2 w-fit mb-3 transition-colors bg-white text-black">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm mb-1 uppercase tracking-tight flex items-center justify-between font-mono">
                Tutor AI
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-600 group-hover:text-zinc-300 font-sans">
                Simula un esame orale con domande progressive.
              </p>
            </Link>

            {/* Tile 3: Studio */}
            <Link 
              href="/studio"
              className="p-5 hover:bg-black hover:text-white transition-colors group block"
            >
              <div className="border border-black group-hover:border-white p-2 w-fit mb-3 transition-colors bg-white text-black">
                <Presentation className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm mb-1 uppercase tracking-tight flex items-center justify-between font-mono">
                Studio
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-600 group-hover:text-zinc-300 font-sans">
                Crea slide per esami e dispense accademiche.
              </p>
            </Link>

            {/* Tile 4: Flashcards */}
            <Link 
              href="/flashcards"
              className="p-5 hover:bg-black hover:text-white transition-colors group block"
            >
              <div className="border border-black group-hover:border-white p-2 w-fit mb-3 transition-colors bg-white text-black">
                <BookOpen className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm mb-1 uppercase tracking-tight flex items-center justify-between font-mono">
                Flashcard
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-600 group-hover:text-zinc-300 font-sans">
                Esercitati con le domande e verifica le risposte.
              </p>
            </Link>

            {/* Tile 5: File Explorer */}
            <Link 
              href="/files"
              className="p-5 hover:bg-black hover:text-white transition-colors group block"
            >
              <div className="border border-black group-hover:border-white p-2 w-fit mb-3 transition-colors bg-white text-black">
                <FolderClosed className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm mb-1 uppercase tracking-tight flex items-center justify-between font-mono">
                File Explorer
                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-zinc-600 group-hover:text-zinc-300 font-sans">
                Gestisci e carica i tuoi materiali di studio.
              </p>
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
