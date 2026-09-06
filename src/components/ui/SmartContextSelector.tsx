'use client'

import React, { useState, useEffect } from 'react'
import { 
  ContextSelection, ContextTreeData, ContextCourseItem, 
  ContextFolderItem, ContextDocItem 
} from '@/lib/ai/context'
import { getContextTreeAction } from '@/app/(dashboard)/chat/actions'
import { 
  Folder, FolderOpen, FileText, BookOpen, Globe, 
  ChevronRight, ChevronDown, Check, Search, X, Layers
} from 'lucide-react'

interface Props {
  value: ContextSelection
  onChange: (context: ContextSelection) => void
  className?: string
  compact?: boolean
}

export default function SmartContextSelector({ value, onChange, className = '', compact = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [treeData, setTreeData] = useState<ContextTreeData>({ courses: [], allDocumentsCount: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  useEffect(() => {
    getContextTreeAction().then((data: ContextTreeData) => {
      setTreeData(data)
      setLoading(false)
      // Espandi tutti i corsi di default
      setExpandedCourses(new Set(data.courses.map((c: ContextCourseItem) => c.id)))
    })
  }, [])

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const toggleCourse = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedCourses(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      return next
    })
  }

  const handleSelect = (context: ContextSelection) => {
    onChange(context)
    setIsOpen(false)
  }

  // Label del bottone trigger
  const getDisplayLabel = () => {
    if (!value || value.type === 'all' || !value.id) {
      return 'Tutti i materiali'
    }
    if (value.type === 'course') {
      return `Corso: ${value.name}`
    }
    if (value.type === 'folder' || value.type === 'subfolder') {
      return `Cartella: ${value.name}`
    }
    if (value.type === 'doc') {
      return `Doc: ${value.name}`
    }
    return 'Seleziona materiale'
  }

  const getDisplayIcon = () => {
    if (!value || value.type === 'all' || !value.id) return <Globe className="w-3.5 h-3.5 text-black shrink-0" />
    if (value.type === 'course') return <BookOpen className="w-3.5 h-3.5 text-black shrink-0" />
    if (value.type === 'folder' || value.type === 'subfolder') return <Folder className="w-3.5 h-3.5 text-black shrink-0" />
    if (value.type === 'doc') return <FileText className="w-3.5 h-3.5 text-black shrink-0" />
    return <Layers className="w-3.5 h-3.5 text-black shrink-0" />
  }

  // Rendering ricorsivo di cartelle e sottocartelle
  const renderFolderItem = (folder: ContextFolderItem, depth: number = 1) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = (value.type === 'folder' || value.type === 'subfolder') && value.id === folder.id
    const hasChildren = folder.subfolders.length > 0 || folder.documents.length > 0

    return (
      <div key={folder.id} className="select-none font-mono">
        <div
          onClick={() => handleSelect({
            type: folder.parent_id ? 'subfolder' : 'folder',
            id: folder.id,
            name: folder.name,
            path: folder.path
          })}
          className={`flex items-center justify-between py-1.5 px-2 cursor-pointer transition-colors text-xs border-b border-zinc-100 ${
            isSelected 
              ? 'bg-black text-white font-bold' 
              : 'hover:bg-zinc-100 text-black'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleFolder(folder.id, e)}
                className={`p-0.5 hover:bg-zinc-200 rounded ${isSelected ? 'text-white' : 'text-zinc-500'}`}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-black'}`} />
            ) : (
              <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-black'}`} />
            )}
            <span className="truncate">{folder.name}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] px-1.5 py-0.5 border ${
              isSelected ? 'border-white text-white' : 'border-zinc-300 text-zinc-600 bg-zinc-50'
            }`}>
              {folder.totalDocsCount} doc
            </span>
            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
        </div>

        {/* Sottocartelle & Documenti figli */}
        {isExpanded && (
          <div className="space-y-0.5">
            {folder.subfolders.map(sub => renderFolderItem(sub, depth + 1))}
            {folder.documents.map(doc => {
              const isDocSelected = value.type === 'doc' && value.id === doc.id
              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelect({
                    type: 'doc',
                    id: doc.id,
                    name: doc.title
                  })}
                  className={`flex items-center justify-between py-1.5 px-2 cursor-pointer transition-colors text-xs border-b border-zinc-100 ${
                    isDocSelected
                      ? 'bg-black text-white font-bold'
                      : 'hover:bg-zinc-100 text-zinc-700'
                  }`}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 16}px` }}
                >
                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${isDocSelected ? 'text-white' : 'text-zinc-500'}`} />
                    <span className="truncate">{doc.title}</span>
                  </div>
                  {isDocSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Desktop Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden sm:flex items-center gap-1.5 bg-white border border-black px-2.5 py-1 text-xs font-mono font-bold text-black hover:bg-zinc-100 transition-colors shadow-[1px_1px_0px_rgba(0,0,0,1)] max-w-[240px]"
        title="Seleziona contesto didattico (corso, cartella o documento)"
      >
        {getDisplayIcon()}
        <span className="truncate font-mono">{getDisplayLabel()}</span>
        <ChevronDown className="w-3 h-3 text-black shrink-0 ml-0.5" />
      </button>

      {/* Mobile Square Trigger Button (identico a esportazione) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="sm:hidden p-1.5 border border-black bg-white hover:bg-black hover:text-white transition-colors text-black flex items-center justify-center shadow-[1px_1px_0px_rgba(0,0,0,1)]"
        title={`Contesto: ${getDisplayLabel()}`}
      >
        <Layers className="w-3.5 h-3.5" />
      </button>

      {/* Modal Selector */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] max-w-lg w-full p-0 overflow-hidden font-mono" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3.5 border-b border-black bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-black text-white border border-black">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">Seleziona Contesto Didattico</h3>
                  <p className="text-[10px] text-zinc-500">Scegli la materia, cartella o file su cui basare l&apos;AI</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 border border-black hover:bg-black hover:text-white transition-colors text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-3 border-b border-black bg-white">
              <div className="flex items-center gap-2 bg-zinc-50 border border-black px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Cerca corso, cartella o documento..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent outline-none text-black placeholder-zinc-400 font-mono text-xs"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="p-0.5 text-zinc-500 hover:text-black">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Tree Items List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1 bg-white">
              {/* Option 1: Global / Tutti i Materiali */}
              <div
                onClick={() => handleSelect({ type: 'all', name: 'Tutti i materiali' })}
                className={`flex items-center justify-between p-2.5 border cursor-pointer transition-colors text-xs ${
                  value.type === 'all' || !value.id
                    ? 'bg-black text-white border-black font-bold'
                    : 'bg-white border-zinc-200 hover:border-black text-black'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className={`w-4 h-4 shrink-0 ${value.type === 'all' || !value.id ? 'text-white' : 'text-black'}`} />
                  <div>
                    <p className="font-bold text-xs uppercase">Tutti i materiali universitari</p>
                    <p className={`text-[10px] ${value.type === 'all' || !value.id ? 'text-zinc-300' : 'text-zinc-500'}`}>Cerca trasversalmente in tutti i corsi</p>
                  </div>
                </div>
                {(value.type === 'all' || !value.id) && <Check className="w-4 h-4 text-white shrink-0" />}
              </div>

              {/* Courses & Folders Tree */}
              <div className="pt-2 space-y-2">
                {treeData.courses.map(course => {
                  const isCourseSelected = value.type === 'course' && value.id === course.id
                  const isCourseExpanded = expandedCourses.has(course.id)

                  return (
                    <div key={course.id} className="border border-black bg-zinc-50/50">
                      {/* Course Row */}
                      <div
                        className={`flex items-center justify-between p-2 cursor-pointer text-xs transition-colors ${
                          isCourseSelected ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100 text-black'
                        }`}
                        onClick={() => handleSelect({ type: 'course', id: course.id, name: course.name })}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => toggleCourse(course.id, e)}
                            className={`p-0.5 rounded shrink-0 ${isCourseSelected ? 'text-white' : 'text-zinc-600'}`}
                          >
                            {isCourseExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          <BookOpen className={`w-4 h-4 shrink-0 ${isCourseSelected ? 'text-white' : 'text-black'}`} />
                          <span className="font-bold text-xs truncate">Corso: {course.name}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 border ${
                            isCourseSelected ? 'border-white text-white' : 'border-zinc-300 bg-white text-zinc-600'
                          }`}>
                            {course.totalDocsCount} doc
                          </span>
                          {isCourseSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>

                      {/* Nested Folders & Docs in Course */}
                      {isCourseExpanded && (
                        <div className="p-1 bg-white border-t border-black space-y-0.5">
                          {course.folders.length === 0 && course.rootDocuments.length === 0 ? (
                            <p className="text-[10px] text-zinc-400 py-1.5 px-2 italic">Nessun materiale in questo corso</p>
                          ) : (
                            <>
                              {course.folders.map(folder => renderFolderItem(folder, 1))}
                              {course.rootDocuments.map(doc => {
                                const isDocSelected = value.type === 'doc' && value.id === doc.id
                                return (
                                  <div
                                    key={doc.id}
                                    onClick={() => handleSelect({
                                      type: 'doc',
                                      id: doc.id,
                                      name: doc.title
                                    })}
                                    className={`flex items-center justify-between py-1.5 px-2 cursor-pointer transition-colors text-xs border-b border-zinc-100 ${
                                      isDocSelected
                                        ? 'bg-black text-white font-bold'
                                        : 'hover:bg-zinc-100 text-zinc-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                      <FileText className={`w-3.5 h-3.5 shrink-0 ${isDocSelected ? 'text-white' : 'text-zinc-500'}`} />
                                      <span className="truncate">{doc.title}</span>
                                    </div>
                                    {isDocSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                                  </div>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-black bg-zinc-50 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-zinc-600 truncate max-w-[240px]">
                Attivo: <strong className="text-black">{getDisplayLabel()}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-black text-white text-xs uppercase font-bold border border-black hover:bg-zinc-800 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
