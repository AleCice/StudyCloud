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
    if (!value || value.type === 'all' || !value.id) return <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
    if (value.type === 'course') return <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
    if (value.type === 'folder' || value.type === 'subfolder') return <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
    if (value.type === 'doc') return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
    return <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
  }

  // Rendering ricorsivo di cartelle e sottocartelle
  const renderFolderItem = (folder: ContextFolderItem, depth: number = 1) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = (value.type === 'folder' || value.type === 'subfolder') && value.id === folder.id
    const hasChildren = folder.subfolders.length > 0 || folder.documents.length > 0

    return (
      <div key={folder.id} className="select-none">
        <div
          onClick={() => handleSelect({
            type: folder.parent_id ? 'subfolder' : 'folder',
            id: folder.id,
            name: folder.name,
            path: folder.path
          })}
          className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs ${
            isSelected 
              ? 'bg-blue-50 text-blue-900 font-semibold' 
              : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text)]'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleFolder(folder.id, e)}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-500"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{folder.name}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[var(--color-text-muted)] bg-slate-100 px-1.5 py-0.5 rounded">
              {folder.totalDocsCount} doc
            </span>
            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </div>
        </div>

        {/* Sottocartelle & Documenti figli */}
        {isExpanded && (
          <div className="space-y-0.5 mt-0.5">
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
                  className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    isDocSelected
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                  }`}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 16}px` }}
                >
                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </div>
                  {isDocSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
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
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 bg-white border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] hover:border-blue-400 transition-colors shadow-2xs max-w-[260px]"
        title="Seleziona su quale corso, cartella o documento basare l'AI"
      >
        {getDisplayIcon()}
        <span className="truncate font-medium">{getDisplayLabel()}</span>
        <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)] shrink-0 ml-0.5" />
      </button>

      {/* Modal / Popover Selector */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div 
            className="modal-content max-w-lg p-0 overflow-hidden shadow-2xl rounded-2xl" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[var(--color-border)] bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text)]">Seleziona Contesto Didattico</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Scegli la materia, la cartella o il file su cui l&apos;AI interroga i tuoi appunti</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-3 border-b border-[var(--color-border)] bg-white">
              <div className="flex items-center gap-2 bg-slate-50 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder="Cerca per corso, cartella o documento..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent outline-none text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="p-0.5 text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Tree Items List */}
            <div className="max-h-96 overflow-y-auto p-3 space-y-1 bg-white divide-y divide-slate-100">
              {/* Option 1: Global / Tutti i Materiali */}
              <div
                onClick={() => handleSelect({ type: 'all', name: 'Tutti i materiali' })}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                  value.type === 'all' || !value.id
                    ? 'bg-blue-50 text-blue-900 font-semibold'
                    : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-xs">Tutti i materiali universitari</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Cerca trasversalmente in tutti i corsi e cartelle</p>
                  </div>
                </div>
                {(value.type === 'all' || !value.id) && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
              </div>

              {/* Courses & Folders Tree */}
              <div className="pt-2 space-y-2">
                {treeData.courses.map(course => {
                  const isCourseSelected = value.type === 'course' && value.id === course.id
                  const isCourseExpanded = expandedCourses.has(course.id)

                  return (
                    <div key={course.id} className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/40">
                      {/* Course Row */}
                      <div
                        className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors ${
                          isCourseSelected ? 'bg-blue-100/70 text-blue-900 font-semibold' : 'hover:bg-slate-100/80 text-[var(--color-text)]'
                        }`}
                        onClick={() => handleSelect({ type: 'course', id: course.id, name: course.name })}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => toggleCourse(course.id, e)}
                            className="p-0.5 hover:bg-slate-200 rounded text-slate-500 shrink-0"
                          >
                            {isCourseExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="font-bold text-xs truncate">Corso: {course.name}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                            {course.totalDocsCount} doc
                          </span>
                          {isCourseSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                      </div>

                      {/* Nested Folders & Docs in Course */}
                      {isCourseExpanded && (
                        <div className="p-1.5 bg-white border-t border-slate-200/70 space-y-0.5">
                          {course.folders.length === 0 && course.rootDocuments.length === 0 ? (
                            <p className="text-[11px] text-slate-400 py-2 px-3 italic">Nessuna cartella o documento in questo corso</p>
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
                                    className={`flex items-center justify-between py-1.5 px-3 rounded-lg cursor-pointer transition-colors text-xs ${
                                      isDocSelected
                                        ? 'bg-blue-50 text-blue-900 font-semibold'
                                        : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{doc.title}</span>
                                    </div>
                                    {isDocSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
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
            <div className="p-3 border-t border-[var(--color-border)] bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-xs">
                Contesto attivo: <strong className="text-[var(--color-text)]">{getDisplayLabel()}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors shadow-2xs"
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
