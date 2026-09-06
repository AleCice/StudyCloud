'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  FileText, Download, Trash2, Search, Folder, FolderPlus, 
  ChevronRight, Loader2, Upload, Pencil, FileIcon, GraduationCap, 
  School, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, X, Youtube, 
  ExternalLink, Copy, Scissors, Clipboard, CopyPlus, Sparkles, Laptop,
  MoreVertical, Info
} from 'lucide-react'
import { 
  autoProcessAndClassify, createFolder, createCourse, renameDocument, 
  renameFolder, renameCourse, moveDocumentAction, moveFolderAction, duplicateDocumentAction,
  deleteCourse, deleteFolder, getUserProfile, setupUniversityProfile,
  ingestYouTubeVideoAction, reindexAllMissingEmbeddingsAction, reindexSingleDocumentAction
} from './actions'
import YouTubeProgressWidget, { YouTubeProgressState } from '@/components/ui/YouTubeProgressWidget'
import { getEncryptedApiKey, getSelectedGeminiModel } from '@/lib/crypto/storage'

type Doc = {
  id: string; title: string; file_path: string; file_type: string;
  size_bytes: number; created_at: string; status: string;
  folder_id: string | null; course_id: string | null;
}
type FolderType = { id: string; name: string; path: string }
type CourseType = { id: string; name: string }

interface UploadItem {
  id: string
  file: File
  name: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

interface ClipboardState {
  action: 'copy' | 'cut'
  type: 'file' | 'folder'
  item: Doc | FolderType
}

export default function FilesPage() {
  const supabase = createClient()
  const [files, setFiles] = useState<Doc[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [courses, setCourses] = useState<CourseType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Navigation state
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string; type: 'root' | 'course' | 'folder' }[]>([
    { id: null, name: 'Tutti i file', type: 'root' }
  ])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Clipboard (Copy / Cut / Paste)
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Drag & Drop
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'file' | 'folder'; title: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // Multi-upload & Floating widget state
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
  const [showUploadWidget, setShowUploadWidget] = useState(false)
  const [isUploadWidgetMinimized, setIsUploadWidgetMinimized] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Onboarding modal
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingUni, setOnboardingUni] = useState('')
  const [onboardingDegree, setOnboardingDegree] = useState('')
  const [onboardingLoading, setOnboardingLoading] = useState(false)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: 'file' | 'folder' | 'bg' | 'course'; item?: any } | null>(null)
  
  // Dialogs: 'newFolder' | 'newCourse' | 'renameFile' | 'renameFolder' | 'renameCourse'
  const [dialog, setDialog] = useState<{ 
    type: 'newFolder' | 'newCourse' | 'renameFile' | 'renameFolder' | 'renameCourse'
    value: string
    targetId?: string 
  } | null>(null)

  // Upload Modal State (Dispositivo o YouTube) & Progress Widget
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadModalTab, setUploadModalTab] = useState<'choose' | 'youtube'>('choose')
  const [ytUrl, setYtUrl] = useState('')
  const [ytTitle, setYtTitle] = useState('')
  const [ytLoading, setYtLoading] = useState(false)
  const [ytError, setYtError] = useState('')
  const [ytProgressState, setYtProgressState] = useState<YouTubeProgressState | null>(null)

  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedDocIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  useEffect(() => {
    checkOnboardingAndFetch()
  }, [])

  useEffect(() => {
    fetchData()
  }, [currentFolder, currentCourseId])

  // Close context menu on any click
  useEffect(() => {
    const close = () => setCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const checkOnboardingAndFetch = async () => {
    try {
      const profile = await getUserProfile()
      const prefs = profile?.preferences as any
      if (!prefs || !prefs.onboarding_completed) {
        setShowOnboarding(true)
      }
    } catch (e) {
      console.error("Errore check onboarding:", e)
    }
    await fetchData()
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: filesData } = await supabase
      .from('documents').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const { data: foldersData } = await supabase
      .from('folders').select('*').eq('user_id', user.id)

    const { data: coursesData } = await supabase
      .from('courses').select('id, name').eq('user_id', user.id)
      .order('name', { ascending: true })

    setFiles(filesData || [])
    setFolders(foldersData || [])
    setCourses(coursesData || [])
    setLoading(false)
  }

  const currentCourse = courses.find(c => c.id === currentCourseId)
  const currentFolderObj = folders.find(f => f.id === currentFolder)

  // Determine which files to show based on current position
  const currentFiles = files.filter(f => {
    if (search) return f.title.toLowerCase().includes(search.toLowerCase())
    if (currentFolder) {
      return f.folder_id === currentFolder
    }
    if (currentCourseId) {
      return f.course_id === currentCourseId && !f.folder_id
    }
    return !f.course_id && !f.folder_id
  })

  // Determine which folders to show
  const childFolders = (() => {
    if (search) return []
    if (currentFolder && currentFolderObj) {
      const parentPath = currentFolderObj.path
      return folders.filter(f => {
        return f.path.startsWith(parentPath + '/') && f.path.split('/').length === parentPath.split('/').length + 1
      })
    }
    if (currentCourseId && currentCourse) {
      const coursePrefix = `/${currentCourse.name}/`
      return folders.filter(f => {
        if (!f.path.startsWith(coursePrefix)) return false
        const rest = f.path.slice(coursePrefix.length)
        return !rest.includes('/')
      })
    }
    const courseNames = new Set(courses.map(c => c.name))
    return folders.filter(f => {
      const parts = f.path.split('/').filter(Boolean)
      if (parts.length === 1 && !courseNames.has(parts[0])) return true
      return false
    })
  })()

  const showCourses = !currentFolder && !currentCourseId && !search

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onboardingUni.trim() || !onboardingDegree.trim()) return
    setOnboardingLoading(true)
    try {
      await setupUniversityProfile(onboardingUni, onboardingDegree)
      setShowOnboarding(false)
      await fetchData()
    } catch (err: any) {
      alert("Errore configurazione: " + err.message)
    } finally {
      setOnboardingLoading(false)
    }
  }

  const openCourse = (course: CourseType) => {
    setCurrentCourseId(course.id)
    setCurrentFolder(null)
    setBreadcrumb([
      { id: null, name: 'Tutti i file', type: 'root' },
      { id: course.id, name: course.name, type: 'course' }
    ])
    setSelectedId(null)
  }

  const openFolder = (folder: FolderType) => {
    setCurrentFolder(folder.id)
    const folderDisplayName = folder.name.split('/').pop() || folder.name
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folderDisplayName, type: 'folder' }])
    setSelectedId(null)
  }

  const navigateBreadcrumb = (index: number) => {
    const target = breadcrumb[index]
    if (target.type === 'root') {
      setCurrentFolder(null)
      setCurrentCourseId(null)
      setBreadcrumb([{ id: null, name: 'Tutti i file', type: 'root' }])
    } else if (target.type === 'course') {
      setCurrentFolder(null)
      setCurrentCourseId(target.id)
      setBreadcrumb(breadcrumb.slice(0, index + 1))
    } else {
      setCurrentFolder(target.id)
      setBreadcrumb(breadcrumb.slice(0, index + 1))
    }
    setSelectedId(null)
  }

  /* =========================================================================
     CLIPBOARD SYSTEM: COPY, CUT, PASTE, DUPLICATE
     ========================================================================= */

  const handleCopy = (item: Doc | FolderType, type: 'file' | 'folder') => {
    setClipboard({ action: 'copy', type, item })
    const title = 'title' in item ? item.title : item.name
    showToast(`Copiato: "${title}"`)
  }

  const handleCut = (item: Doc | FolderType, type: 'file' | 'folder') => {
    setClipboard({ action: 'cut', type, item })
    const title = 'title' in item ? item.title : item.name
    showToast(`Tagliato: "${title}"`)
  }

  const handlePaste = async () => {
    if (!clipboard) return
    try {
      if (clipboard.type === 'file') {
        const fileItem = clipboard.item as Doc
        if (clipboard.action === 'cut') {
          await moveDocumentAction(fileItem.id, currentFolder, currentCourseId)
          showToast(`Spostato "${fileItem.title}" nella cartella corrente`)
          setClipboard(null)
        } else {
          // Copy -> Duplicate
          await duplicateDocumentAction(fileItem.id, currentFolder, currentCourseId)
          showToast(`Incollata copia di "${fileItem.title}"`)
        }
      }
      await fetchData()
    } catch (err: any) {
      alert("Errore durante Incolla: " + err.message)
    }
  }

  const handleDuplicate = async (file: Doc) => {
    try {
      await duplicateDocumentAction(file.id, currentFolder, currentCourseId)
      showToast(`Duplicato "${file.title}"`)
      await fetchData()
    } catch (err: any) {
      alert("Errore duplicazione: " + err.message)
    }
  }

  /* =========================================================================
     DRAG & DROP SPOSTAMENTO FILE & CARTELLE
     ========================================================================= */

  const handleItemDragStart = (e: React.DragEvent, item: Doc | FolderType, type: 'file' | 'folder') => {
    e.stopPropagation()
    const title = 'title' in item ? item.title : item.name
    setDraggedItem({ id: item.id, type, title })
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, type }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleItemDragOver = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedItem && draggedItem.id !== targetFolderId) {
      setDragOverFolderId(targetFolderId)
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleItemDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
  }

  const handleItemDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
    if (!draggedItem) return
    if (draggedItem.id === targetFolderId) return

    try {
      if (draggedItem.type === 'file') {
        await moveDocumentAction(draggedItem.id, targetFolderId, currentCourseId)
        showToast(`File "${draggedItem.title}" spostato`)
      } else if (draggedItem.type === 'folder') {
        await moveFolderAction(draggedItem.id, targetFolderId)
        showToast(`Cartella "${draggedItem.title}" spostata`)
      }
      setDraggedItem(null)
      await fetchData()
    } catch (err: any) {
      alert("Errore spostamento: " + err.message)
    }
  }

  /* =========================================================================
     KEYBOARD SHORTCUTS (Ctrl+C, Ctrl+X, Ctrl+V, F2, Delete)
     ========================================================================= */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se siamo in un input / textarea / modale
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (dialog || showUploadModal || showOnboarding) return

      const selectedFile = files.find(f => f.id === selectedId)
      const selectedFolder = folders.find(f => f.id === selectedId)
      const activeItem = selectedFile || selectedFolder
      const activeType = selectedFile ? 'file' : selectedFolder ? 'folder' : null

      // Ctrl + C (Copia)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && activeItem && activeType) {
        e.preventDefault()
        handleCopy(activeItem, activeType)
      }

      // Ctrl + X (Taglia)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && activeItem && activeType) {
        e.preventDefault()
        handleCut(activeItem, activeType)
      }

      // Ctrl + V (Incolla)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboard) {
        e.preventDefault()
        handlePaste()
      }

      // F2 (Rinomina)
      if (e.key === 'F2' && activeItem && activeType) {
        e.preventDefault()
        if (activeType === 'file') {
          setDialog({ type: 'renameFile', value: (activeItem as Doc).title, targetId: activeItem.id })
        } else {
          setDialog({ type: 'renameFolder', value: (activeItem as FolderType).name, targetId: activeItem.id })
        }
      }

      // Delete (Elimina)
      if (e.key === 'Delete' && activeItem && activeType) {
        e.preventDefault()
        if (activeType === 'file') handleDelete(activeItem as Doc)
        else handleDeleteFolder(activeItem.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, files, folders, clipboard, dialog, showUploadModal, showOnboarding])

  /* =========================================================================
     MULTI-FILE UPLOAD & QUEUE MANAGEMENT
     ========================================================================= */

  const processFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Devi essere autenticato per caricare file")
      return
    }

    const newQueueItems: UploadItem[] = selectedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending'
    }))

    setUploadQueue(prev => [...newQueueItems, ...prev])
    setShowUploadWidget(true)
    setIsUploadWidgetMinimized(false)

    // Process all files
    for (const item of newQueueItems) {
      setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 30 } : i))

      try {
        const fileExt = item.file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, item.file)
        if (uploadError) throw new Error(uploadError.message)

        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: 55 } : i))

        const { data: doc, error: dbError } = await supabase.from('documents').insert({
          user_id: user.id,
          title: item.file.name,
          file_path: filePath,
          file_type: item.file.type || 'unknown',
          size_bytes: item.file.size,
          status: 'elaborazione...',
          course_id: currentCourseId,
          folder_id: currentFolder
        }).select().single()

        if (dbError) throw new Error(dbError.message)

        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', progress: 80 } : i))

        const userApiKey = await getEncryptedApiKey('gemini')
        const userModel = getSelectedGeminiModel()
        await autoProcessAndClassify(doc.id, filePath, doc.file_type, userApiKey, userModel)

        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100 } : i))
        await fetchData()

      } catch (err: any) {
        console.error("Errore caricamento:", err)
        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message || 'Errore caricamento' } : i))
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleDelete = async (file: Doc) => {
    if (!confirm(`Eliminare definitivamente "${file.title}"?`)) return
    try {
      await supabase.storage.from('documents').remove([file.file_path])
      await supabase.from('documents').delete().eq('id', file.id)
      setFiles(prev => prev.filter(f => f.id !== file.id))
      setSelectedId(null)
      showToast(`File eliminato`)
    } catch (e: any) { alert(e.message) }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Eliminare questo corso? I documenti associati verranno conservati.')) return
    try {
      await deleteCourse(courseId)
      setCourses(prev => prev.filter(c => c.id !== courseId))
      if (currentCourseId === courseId) {
        setCurrentCourseId(null)
        setCurrentFolder(null)
        setBreadcrumb([{ id: null, name: 'Tutti i file', type: 'root' }])
      }
      await fetchData()
    } catch (e: any) { alert(e.message) }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Eliminare questa cartella? I file contenuti verranno conservati.')) return
    try {
      await deleteFolder(folderId)
      setFolders(prev => prev.filter(f => f.id !== folderId))
      if (currentFolder === folderId) {
        navigateBreadcrumb(breadcrumb.length - 2 >= 0 ? breadcrumb.length - 2 : 0)
      }
      await fetchData()
      showToast(`Cartella eliminata`)
    } catch (e: any) { alert(e.message) }
  }

  const handleDownload = async (file: Doc) => {
    if (file.file_path.startsWith('http')) {
      window.open(file.file_path, '_blank')
      return
    }
    const { data } = await supabase.storage.from('documents').createSignedUrl(file.file_path, 60)
    if (data) {
      const a = document.createElement('a')
      a.href = data.signedUrl; a.download = file.title
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder' | 'bg' | 'course', item?: any) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, type, item })
    if (item) setSelectedId(item.id)
  }

  const handleExecuteDialog = async () => {
    if (!dialog || !dialog.value.trim()) return
    const val = dialog.value.trim()
    try {
      if (dialog.type === 'newCourse') {
        await createCourse(val)
        showToast(`Corso "${val}" creato`)
      } else if (dialog.type === 'newFolder') {
        let parentPath = ''
        if (currentFolderObj) parentPath = currentFolderObj.path
        else if (currentCourse) parentPath = `/${currentCourse.name}`
        await createFolder(val, parentPath)
        showToast(`Cartella "${val}" creata`)
      } else if (dialog.type === 'renameFile' && dialog.targetId) {
        await renameDocument(dialog.targetId, val)
        showToast(`File rinominato in "${val}"`)
      } else if (dialog.type === 'renameFolder' && dialog.targetId) {
        await renameFolder(dialog.targetId, val)
        showToast(`Cartella rinominata in "${val}"`)
      } else if (dialog.type === 'renameCourse' && dialog.targetId) {
        await renameCourse(dialog.targetId, val)
        showToast(`Corso rinominato in "${val}"`)
      }
      setDialog(null)
      await fetchData()
    } catch (e: any) {
      alert("Errore: " + e.message)
    }
  }

  // Import YouTube Video
  const handleImportYouTube = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ytUrl.trim()) return
    setYtLoading(true)
    setYtError('')

    const activeUrl = ytUrl.trim()
    const activeTitle = ytTitle.trim() || 'Video YouTube'
    const activeId = crypto.randomUUID()

    // Chiude il modal e attiva la status bar in basso a sinistra
    setShowUploadModal(false)
    setYtUrl('')
    setYtTitle('')

    setYtProgressState({
      id: activeId,
      url: activeUrl,
      title: activeTitle,
      step: 'metadata',
      progress: 25,
      stepMessage: 'Recupero metadati da YouTube...'
    })

    try {
      const userApiKey = await getEncryptedApiKey('gemini')
      const userModel = getSelectedGeminiModel()

      if (!userApiKey) {
        throw new Error("Chiave API Google Gemini non trovata. Inseriscila nelle Impostazioni.")
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
        url: activeUrl,
        courseId: currentCourseId,
        folderId: currentFolder,
        customTitle: activeTitle !== 'Video YouTube' ? activeTitle : undefined,
        userApiKey,
        userModel
      })

      setYtProgressState(prev => prev ? {
        ...prev,
        title: res.document.title,
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

      await fetchData()
    } catch (err: any) {
      setYtProgressState(prev => prev ? {
        ...prev,
        step: 'error',
        progress: 100,
        stepMessage: 'Errore elaborazione video',
        error: err.message || "Errore importazione YouTube"
      } : null)
    } finally {
      setYtLoading(false)
    }
  }

  // Rigenerazione di tutti i vettori per video o documenti
  const [isReindexing, setIsReindexing] = useState(false)
  const handleReindexAllVectors = async () => {
    const userApiKey = await getEncryptedApiKey('gemini')
    const userModel = getSelectedGeminiModel()
    if (!userApiKey) {
      alert("Chiave API Google Gemini mancante. Inserisci la tua API Key nelle Impostazioni per rigenerare i vettori.")
      return
    }

    setIsReindexing(true)
    showToast("Rigenerazione vettori pgvector per tutti i documenti e video...")
    try {
      const res = await reindexAllMissingEmbeddingsAction(userApiKey, userModel, true)
      if (res.processedDocs === 0 && res.totalDocs === 0) {
        showToast("Nessun documento o video trovato da indicizzare.")
      } else if (res.processedDocs === 0 && res.errors && res.errors.length > 0) {
        alert(`Errore rigenerazione: ${res.errors.map(e => `${e.title}: ${e.error}`).join('\n')}`)
      } else {
        showToast(`Operazione completata: ${res.totalChunks} vettori rigenerati con successo per ${res.processedDocs} documenti!`)
      }
      await fetchData()
    } catch (err: any) {
      alert("Errore rigenerazione vettori: " + err.message)
    } finally {
      setIsReindexing(false)
    }
  }

  const handleReindexSingleDocument = async (file: Doc) => {
    const userApiKey = await getEncryptedApiKey('gemini')
    const userModel = getSelectedGeminiModel()
    if (!userApiKey) {
      alert("Chiave API Google Gemini mancante. Inserisci la tua API Key nelle Impostazioni.")
      return
    }

    showToast(`Rigenerazione vettori per "${file.title}"...`)
    try {
      const res = await reindexSingleDocumentAction(file.id, userApiKey, userModel)
      showToast(`Vettori rigenerati con successo (${res.chunksCount} chunk creati) per "${file.title}"!`)
      await fetchData()
    } catch (err: any) {
      alert(`Errore rigenerazione vettori per "${file.title}": ${err.message}`)
    }
  }

  const formatSize = (b: number) => {
    if (b < 1024) return b + ' B'
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1024 / 1024).toFixed(2) + ' MB'
  }

  const activeUploads = uploadQueue.filter(i => i.status === 'uploading' || i.status === 'processing')
  const completedUploads = uploadQueue.filter(i => i.status === 'completed')
  const overallProgress = uploadQueue.length > 0 
    ? Math.round(uploadQueue.reduce((acc, curr) => acc + curr.progress, 0) / uploadQueue.length)
    : 0

  const selectedFileObj = files.find(f => f.id === selectedId)

  return (
    <div 
      className="flex flex-col h-full bg-white select-none relative overflow-hidden font-mono"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        ref={fileInputRef} 
        type="file" 
        multiple
        className="hidden" 
        onChange={handleFileInputChange} 
      />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-black text-white text-xs font-mono font-bold uppercase px-4 py-2.5 border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Full-Screen Drag-Over Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-black/85 border-4 border-dashed border-white z-50 flex flex-col items-center justify-center font-mono text-white pointer-events-none animate-in fade-in duration-150">
          <div className="w-16 h-16 border-2 border-white bg-black flex items-center justify-center mb-3 shadow-[4px_4px_0px_rgba(255,255,255,1)]">
            <Upload className="w-8 h-8 text-white animate-bounce" />
          </div>
          <p className="text-sm font-bold uppercase tracking-widest">Rilascia qui per caricare i file</p>
          <p className="text-xs text-zinc-300 mt-1">Verranno analizzati e indicizzati automaticamente nella cartella corrente</p>
        </div>
      )}

      {/* Top Toolbar Responsive */}
      <div className="min-h-12 border-b border-black flex items-center px-3 sm:px-4 py-2 gap-2 bg-white shrink-0 flex-wrap justify-between font-mono">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px] text-xs overflow-x-auto no-scrollbar py-0.5">
          {breadcrumb.map((bc, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              {i > 0 && <span className="text-zinc-400 font-bold">/</span>}
              <button 
                onClick={() => navigateBreadcrumb(i)}
                className={`px-2 py-1 border text-xs uppercase font-mono font-bold transition-colors whitespace-nowrap ${
                  i === breadcrumb.length - 1 
                    ? 'bg-black text-white border-black shadow-[1px_1px_0px_rgba(0,0,0,1)]' 
                    : 'bg-white text-black border-zinc-300 hover:border-black hover:bg-zinc-50'
                }`}
              >
                {bc.name}
              </button>
            </div>
          ))}
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          {/* Quick Toolbar: Copy / Cut / Paste */}
          <div className="flex items-center gap-1 bg-zinc-50 p-1 border border-black shrink-0 font-mono">
            <button
              onClick={() => {
                const item = files.find(f => f.id === selectedId) || folders.find(f => f.id === selectedId)
                if (item) handleCopy(item, files.some(f => f.id === selectedId) ? 'file' : 'folder')
              }}
              disabled={!selectedId}
              className="p-1.5 border border-black text-black bg-white hover:bg-black hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black transition-colors"
              title="Copia elemento selezionato (Ctrl+C)"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                const item = files.find(f => f.id === selectedId) || folders.find(f => f.id === selectedId)
                if (item) handleCut(item, files.some(f => f.id === selectedId) ? 'file' : 'folder')
              }}
              disabled={!selectedId}
              className="p-1.5 border border-black text-black bg-white hover:bg-black hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black transition-colors"
              title="Taglia elemento selezionato (Ctrl+X)"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handlePaste}
              disabled={!clipboard}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase border border-black transition-colors ${
                clipboard ? 'bg-black text-white hover:bg-zinc-800 shadow-[1px_1px_0px_rgba(0,0,0,1)]' : 'text-zinc-400 opacity-40 cursor-not-allowed bg-zinc-100'
              }`}
              title={clipboard ? `Incolla "${'title' in clipboard.item ? clipboard.item.title : clipboard.item.name}" (Ctrl+V)` : "Nessun elemento negli appunti"}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Incolla</span>
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center bg-white border border-black px-2.5 py-1.5 flex-1 sm:w-44 sm:flex-none focus-within:bg-zinc-50 transition-colors">
            <Search className="w-3.5 h-3.5 text-black mr-1.5 shrink-0" />
            <input 
              type="text" placeholder="Cerca..." 
              className="w-full text-xs font-mono bg-transparent outline-none text-black placeholder-zinc-400"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <button 
            onClick={() => {
              setUploadModalTab('choose')
              setShowUploadModal(true)
            }}
            className="flex items-center gap-1.5 bg-black text-white hover:bg-zinc-800 px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] shrink-0 border border-black"
            title="Carica dal tuo dispositivo o da YouTube"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Carica</span>
          </button>

          <button 
            onClick={handleReindexAllVectors}
            disabled={isReindexing}
            className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-black border border-black px-2.5 py-1.5 text-xs font-mono font-medium transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] disabled:opacity-50 shrink-0 active:translate-x-[1px] active:translate-y-[1px]"
            title="Rigenera tutti i vettori e chunks mancanti per documenti e video YouTube"
          >
            {isReindexing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-black" />
            )}
            <span className="hidden md:inline">{isReindexing ? 'Rigenerazione...' : 'Sincronizza RAG'}</span>
          </button>

          <button 
            onClick={() => setDialog({ type: 'newFolder', value: '' })}
            className="flex items-center gap-1.5 border border-black bg-white hover:bg-zinc-100 px-2.5 py-1.5 text-xs font-mono font-medium text-black transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0 active:translate-x-[1px] active:translate-y-[1px]"
            title="Crea una sottocartella"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cartella</span>
          </button>

          {!currentCourseId && !currentFolder && (
            <button 
              onClick={() => setDialog({ type: 'newCourse', value: '' })}
              className="flex items-center gap-1.5 border border-black bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-black hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0 active:translate-x-[1px] active:translate-y-[1px]"
              title="Aggiungi un nuovo corso universitario"
            >
              <GraduationCap className="w-3.5 h-3.5 text-black" />
              <span>Corso</span>
            </button>
          )}
        </div>
      </div>

      {/* Main File Table View */}
      <div 
        className="flex-1 overflow-auto"
        onContextMenu={e => handleContextMenu(e, 'bg')}
        onClick={() => setSelectedId(null)}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-black font-mono text-xs uppercase tracking-wider">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Caricamento...
          </div>
        ) : (childFolders.length === 0 && currentFiles.length === 0 && (!showCourses || courses.length === 0)) ? (
          <div className="flex flex-col items-center justify-center h-full font-mono text-center p-8">
            <div className="border-2 border-black p-3 bg-zinc-50 mb-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <Folder className="w-8 h-8 text-black" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-black">Questa cartella è vuota</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-sm">Trascina qui i tuoi documenti o clicca su Carica per importare file o video YouTube.</p>
          </div>
        ) : (
          <>
            {/* 1. DESKTOP TABLE VIEW (Visibile solo da schermo tablet/desktop md:table) */}
            <table className="hidden md:table w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b-2 border-black text-black text-[11px] font-bold uppercase bg-zinc-50 sticky top-0 z-10">
                  <th className="py-2.5 pl-6 pr-3 font-mono">Nome</th>
                  <th className="py-2.5 px-3 font-mono w-44">Ultima modifica</th>
                  <th className="py-2.5 px-3 font-mono w-36">Tipo</th>
                  <th className="py-2.5 px-3 font-mono w-28">Dimensione</th>
                  <th className="py-2.5 px-3 pr-6 font-mono w-36">Stato AI</th>
                </tr>
              </thead>
              <tbody>
                {/* Courses (at root level) */}
                {showCourses && courses.map(course => {
                  const isSelected = selectedId === course.id
                  return (
                    <tr 
                      key={course.id}
                      onDoubleClick={() => openCourse(course)}
                      onContextMenu={e => handleContextMenu(e, 'course', course)}
                      onClick={e => { e.stopPropagation(); setSelectedId(course.id) }}
                      className={`cursor-pointer border-b border-zinc-200 transition-colors ${
                        isSelected ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100 text-black'
                      }`}
                    >
                      <td className="py-2.5 pl-6 pr-3 flex items-center gap-3">
                        <div className={`p-1 border border-black shrink-0 ${isSelected ? 'bg-white text-black' : 'bg-black text-white'}`}>
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs truncate">{course.name}</span>
                      </td>
                      <td className={`py-2.5 px-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>—</td>
                      <td className="py-2.5 px-3">
                        <span className={`border px-1.5 py-0.5 text-[10px] uppercase font-mono ${
                          isSelected ? 'border-white text-white' : 'border-black text-black bg-zinc-50'
                        }`}>
                          Corso
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>—</td>
                      <td className={`py-2.5 px-3 pr-6 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>—</td>
                    </tr>
                  )
                })}

                {/* Folders */}
                {childFolders.map(folder => {
                  const folderDisplayName = folder.name.split('/').pop() || folder.name
                  const isCut = clipboard?.action === 'cut' && clipboard.item.id === folder.id
                  const isDropTarget = dragOverFolderId === folder.id
                  const isSelected = selectedId === folder.id

                  return (
                    <tr 
                      key={folder.id}
                      draggable
                      onDragStart={e => handleItemDragStart(e, folder, 'folder')}
                      onDragOver={e => handleItemDragOver(e, folder.id)}
                      onDragLeave={handleItemDragLeave}
                      onDrop={e => handleItemDropOnFolder(e, folder.id)}
                      onDoubleClick={() => openFolder(folder)}
                      onContextMenu={e => handleContextMenu(e, 'folder', folder)}
                      onClick={e => { e.stopPropagation(); setSelectedId(folder.id) }}
                      className={`cursor-pointer border-b border-zinc-200 transition-colors ${
                        isSelected ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100 text-black'
                      } ${isCut ? 'opacity-40 border-dashed border-black' : ''} ${
                        isDropTarget ? 'bg-zinc-200 border-2 border-black' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-6 pr-3 flex items-center gap-3">
                        <div className={`p-1 border border-black shrink-0 ${isSelected ? 'bg-white text-black' : 'bg-zinc-100 text-black'}`}>
                          <Folder className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-xs truncate">{folderDisplayName}</span>
                        {isCut && <span className="text-[10px] italic">(Tagliato)</span>}
                      </td>
                      <td className={`py-2.5 px-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>—</td>
                      <td className="py-2.5 px-3">
                        <span className={`border px-1.5 py-0.5 text-[10px] uppercase font-mono ${
                          isSelected ? 'border-white text-white' : 'border-zinc-300 text-zinc-600 bg-white'
                        }`}>
                          Cartella
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>—</td>
                      <td className={`py-2.5 px-3 pr-6 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>—</td>
                    </tr>
                  )
                })}

                {/* Files */}
                {currentFiles.map(f => {
                  const isCut = clipboard?.action === 'cut' && clipboard.item.id === f.id
                  const isSelected = selectedId === f.id
                  const isYt = f.file_type === 'youtube' || f.file_type.includes('youtube') || f.file_path.startsWith('http')

                  return (
                    <tr 
                      key={f.id}
                      draggable
                      onDragStart={e => handleItemDragStart(e, f, 'file')}
                      onContextMenu={e => handleContextMenu(e, 'file', f)}
                      onClick={e => { e.stopPropagation(); setSelectedId(f.id) }}
                      className={`cursor-pointer border-b border-zinc-200 transition-colors ${
                        isSelected ? 'bg-black text-white font-bold' : 'hover:bg-zinc-100 text-black'
                      } ${isCut ? 'opacity-40 border-dashed border-black' : ''}`}
                    >
                      <td className="py-2.5 pl-6 pr-3 flex items-center gap-3">
                        <div className={`p-1 border border-black shrink-0 ${isSelected ? 'bg-white text-black' : 'bg-zinc-100 text-black'}`}>
                          {isYt ? (
                            <Youtube className="w-4 h-4" />
                          ) : f.file_type.includes('pdf') ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <FileIcon className="w-4 h-4" />
                          )}
                        </div>
                        <span className="truncate font-medium">{f.title}</span>
                        {isCut && <span className="text-[10px] italic">(Tagliato)</span>}
                      </td>
                      <td className={`py-2.5 px-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        {new Date(f.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`border px-1.5 py-0.5 text-[10px] uppercase font-mono font-bold ${
                          isSelected ? 'border-white text-white' : isYt ? 'border-black bg-black text-white' : 'border-black text-black bg-zinc-50'
                        }`}>
                          {isYt ? 'YOUTUBE' : f.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>{formatSize(f.size_bytes)}</td>
                      <td className="py-2.5 px-3 pr-6">
                        <div className="flex items-center gap-1.5">
                          {f.status.includes('elaborazione') && (
                            <Loader2 className={`w-3 h-3 animate-spin ${isSelected ? 'text-white' : 'text-black'}`} />
                          )}
                          <span className={`border px-1.5 py-0.5 text-[10px] uppercase font-mono ${
                            isSelected 
                              ? 'border-white text-white' 
                              : f.status === 'organizzato' 
                              ? 'border-black text-black font-bold bg-zinc-50' 
                              : 'border-zinc-300 text-zinc-500'
                          }`}>
                            {f.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* 2. MOBILE VERTICAL LIST VIEW (Con dettagli nascosti ed espandibili via tastino) */}
            <div className="md:hidden p-2.5 space-y-2">
              {/* Courses on Mobile */}
              {showCourses && courses.map(course => (
                <div
                  key={course.id}
                  onClick={() => openCourse(course)}
                  onContextMenu={e => handleContextMenu(e, 'course', course)}
                  className="flex items-center justify-between p-3 border border-black bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 border border-black bg-zinc-50 shrink-0">
                      <GraduationCap className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-xs uppercase truncate text-black block">{course.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Corso di Laurea</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </div>
              ))}

              {/* Folders on Mobile */}
              {childFolders.map(folder => {
                const folderDisplayName = folder.name.split('/').pop() || folder.name
                const isCut = clipboard?.action === 'cut' && clipboard.item.id === folder.id
                return (
                  <div
                    key={folder.id}
                    onClick={() => openFolder(folder)}
                    onContextMenu={e => handleContextMenu(e, 'folder', folder)}
                    className={`flex items-center justify-between p-2.5 border border-black bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] ${
                      isCut ? 'opacity-40 border-dashed' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-1.5 border border-black bg-zinc-50 shrink-0">
                        <Folder className="w-4 h-4 text-black" />
                      </div>
                      <span className="font-mono font-bold text-xs truncate text-black">{folderDisplayName}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'folder', folder); }}
                        className="p-1.5 border border-black text-black hover:bg-black hover:text-white transition-colors"
                        title="Opzioni cartella"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </div>
                )
              })}

              {/* Files on Mobile (Lista verticale con dettagli nascosti ed apribili con tastino) */}
              {currentFiles.map(f => {
                const isExpanded = expandedDocIds.has(f.id)
                const isSelected = selectedId === f.id
                const isCut = clipboard?.action === 'cut' && clipboard.item.id === f.id

                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    onContextMenu={e => handleContextMenu(e, 'file', f)}
                    className={`border border-black bg-white transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] ${
                      isSelected ? 'bg-zinc-50 ring-1 ring-black' : ''
                    } ${isCut ? 'opacity-40 border-dashed' : ''}`}
                  >
                    {/* Riga principale: Icona, Titolo, Tastino Dettagli e Tastino Azioni */}
                    <div className="flex items-center justify-between p-2.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1.5 border border-black bg-zinc-50 shrink-0">
                          {f.file_type === 'youtube' || f.file_type.includes('youtube') || f.file_path.startsWith('http') ? (
                            <Youtube className="w-3.5 h-3.5 text-black" />
                          ) : f.file_type.includes('pdf') ? (
                            <FileText className="w-3.5 h-3.5 text-black" />
                          ) : (
                            <FileIcon className="w-3.5 h-3.5 text-black" />
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold text-black truncate">{f.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* TASTINO DETTAGLI (Mostra/Nasconde i dettagli tecnici) */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(f.id); }}
                          className={`p-1.5 border border-black transition-colors flex items-center justify-center ${
                            isExpanded ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100 text-black'
                          }`}
                          title={isExpanded ? "Nascondi dettagli" : "Mostra dettagli"}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        {/* TASTINO AZIONI RAPIDE */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'file', f); }}
                          className="p-1.5 border border-black bg-white hover:bg-black hover:text-white text-black transition-colors"
                          title="Opzioni file"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* DETTAGLI NASCOSTI - VISIBILI SOLO SE ESPANSI CON IL TASTINO */}
                    {isExpanded && (
                      <div className="border-t border-zinc-200 bg-zinc-50 p-2.5 text-[11px] font-mono space-y-1.5 animate-in fade-in duration-100">
                        <div className="flex justify-between text-zinc-600">
                          <span>Data:</span>
                          <span className="text-black font-semibold">
                            {new Date(f.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Dimensione:</span>
                          <span className="text-black font-semibold">{formatSize(f.size_bytes)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Tipo:</span>
                          <span className="text-black font-semibold uppercase">{f.file_type.split('/')[1] || f.file_type}</span>
                        </div>
                        <div className="flex justify-between text-zinc-600 items-center">
                          <span>Stato RAG AI:</span>
                          <div className="flex items-center gap-1 text-black font-semibold">
                            {f.status.includes('elaborazione') && <Loader2 className="w-3 h-3 animate-spin text-black" />}
                            <span className={f.status === 'organizzato' ? 'text-emerald-700 font-bold' : ''}>{f.status}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-black flex items-center px-4 text-xs font-mono font-bold text-black shrink-0 bg-zinc-50 justify-between uppercase tracking-wider">
        <div className="flex items-center gap-4">
          <span>{(showCourses ? courses.length : 0) + childFolders.length + currentFiles.length} elementi</span>
          {clipboard && (
            <span className="text-black font-bold flex items-center gap-1.5 border border-black px-2 py-0.5 bg-white shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              <Clipboard className="w-3 h-3" />
              Appunti: {clipboard.action === 'cut' ? 'Tagliato' : 'Copiato'} &quot;{'title' in clipboard.item ? clipboard.item.title : clipboard.item.name}&quot;
            </span>
          )}
        </div>
        {currentCourse && <span className="text-zinc-600 font-normal">Corso: {currentCourse.name}</span>}
      </div>

      {/* FLOATING MULTI-UPLOAD PROGRESS WIDGET (Bottom-Right) */}
      {showUploadWidget && uploadQueue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] font-mono overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-50 border-b border-black">
            <div className="flex items-center gap-2 min-w-0">
              {activeUploads.length > 0 ? (
                <Loader2 className="w-4 h-4 text-black animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-black truncate">
                {activeUploads.length > 0
                  ? `Caricamento (${overallProgress}%)`
                  : `${completedUploads.length} di ${uploadQueue.length} caricati`}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => setIsUploadWidgetMinimized(!isUploadWidgetMinimized)} 
                className="p-1 border border-black text-black hover:bg-zinc-100 transition-colors"
                title={isUploadWidgetMinimized ? "Espandi dettagli" : "Riduci a icona"}
              >
                {isUploadWidgetMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => { setShowUploadWidget(false); setUploadQueue([]) }} 
                className="p-1 border border-black text-black hover:bg-black hover:text-white transition-colors"
                title="Chiudi pannello"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress Bar Line */}
          <div className="w-full bg-zinc-200 h-2 border-b border-black">
            <div 
              className="h-2 bg-black transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Collapsible File List */}
          {!isUploadWidgetMinimized && (
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-200 px-1 py-1 bg-white font-mono">
              {uploadQueue.map(item => (
                <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1 border border-black bg-zinc-100 shrink-0">
                      {item.name.endsWith('.pdf') ? (
                        <FileText className="w-3.5 h-3.5 text-black" />
                      ) : (
                        <FileIcon className="w-3.5 h-3.5 text-black" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-black truncate">{item.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {item.status === 'uploading' ? 'Caricamento Storage...' :
                         item.status === 'processing' ? 'Estrazione pgvector AI...' :
                         item.status === 'completed' ? 'Completato' :
                         item.error ? item.error : 'In attesa...'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {item.status === 'uploading' && (
                      <span className="text-[10px] font-mono text-black font-bold">{item.progress}%</span>
                    )}
                    {item.status === 'processing' && (
                      <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                    )}
                    {item.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-black" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-3.5 h-3.5 text-black" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          {ctxMenu.type === 'bg' && (
            <>
              {clipboard && (
                <div className="context-menu-item font-semibold text-blue-600" onClick={() => { handlePaste(); setCtxMenu(null) }}>
                  <Clipboard className="w-4 h-4" /> Incolla ({clipboard.action === 'cut' ? 'Sposta' : 'Copia'})
                </div>
              )}
              <div 
                className="context-menu-item" 
                onClick={() => { 
                  setUploadModalTab('choose')
                  setShowUploadModal(true)
                  setCtxMenu(null) 
                }}
              >
                <Upload className="w-4 h-4" /> Carica materiale (File o YouTube)
              </div>
              <div className="context-menu-item" onClick={() => { setDialog({ type: 'newFolder', value: '' }); setCtxMenu(null) }}>
                <FolderPlus className="w-4 h-4" /> Nuova cartella
              </div>
              {!currentCourseId && !currentFolder && (
                <div className="context-menu-item" onClick={() => { setDialog({ type: 'newCourse', value: '' }); setCtxMenu(null) }}>
                  <GraduationCap className="w-4 h-4 text-black" /> Nuovo Corso
                </div>
              )}
            </>
          )}

          {ctxMenu.type === 'course' && ctxMenu.item && (
            <>
              <div className="context-menu-item" onClick={() => { openCourse(ctxMenu.item); setCtxMenu(null) }}>
                <Folder className="w-4 h-4" /> Apri corso
              </div>
              <div className="context-menu-item" onClick={() => { setDialog({ type: 'renameCourse', value: ctxMenu.item.name, targetId: ctxMenu.item.id }); setCtxMenu(null) }}>
                <Pencil className="w-4 h-4" /> Rinomina corso
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={() => { handleDeleteCourse(ctxMenu.item.id); setCtxMenu(null) }}>
                <Trash2 className="w-4 h-4" /> Elimina corso
              </div>
            </>
          )}

          {ctxMenu.type === 'folder' && ctxMenu.item && (
            <>
              <div className="context-menu-item" onClick={() => { openFolder(ctxMenu.item); setCtxMenu(null) }}>
                <Folder className="w-4 h-4" /> Apri cartella
              </div>
              <div className="context-menu-item" onClick={() => { handleCopy(ctxMenu.item, 'folder'); setCtxMenu(null) }}>
                <Copy className="w-4 h-4" /> Copia cartella
              </div>
              <div className="context-menu-item" onClick={() => { handleCut(ctxMenu.item, 'folder'); setCtxMenu(null) }}>
                <Scissors className="w-4 h-4" /> Taglia cartella
              </div>
              {clipboard && (
                <div className="context-menu-item font-bold" onClick={() => { openFolder(ctxMenu.item); handlePaste(); setCtxMenu(null) }}>
                  <Clipboard className="w-4 h-4" /> Incolla all&apos;interno
                </div>
              )}
              <div className="context-menu-item" onClick={() => { setDialog({ type: 'renameFolder', value: ctxMenu.item.name, targetId: ctxMenu.item.id }); setCtxMenu(null) }}>
                <Pencil className="w-4 h-4" /> Rinomina
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={() => { handleDeleteFolder(ctxMenu.item.id); setCtxMenu(null) }}>
                <Trash2 className="w-4 h-4" /> Elimina cartella
              </div>
            </>
          )}

          {ctxMenu.type === 'file' && ctxMenu.item && (
            <>
              {ctxMenu.item.file_type === 'youtube' ? (
                <a href={ctxMenu.item.file_path} target="_blank" rel="noopener noreferrer" className="context-menu-item text-red-600" onClick={() => setCtxMenu(null)}>
                  <ExternalLink className="w-4 h-4" /> Guarda su YouTube
                </a>
              ) : (
                <div className="context-menu-item" onClick={() => { handleDownload(ctxMenu.item); setCtxMenu(null) }}>
                  <Download className="w-4 h-4" /> Scarica
                </div>
              )}
              <div className="context-menu-item" onClick={() => { handleCopy(ctxMenu.item, 'file'); setCtxMenu(null) }}>
                <Copy className="w-4 h-4" /> Copia (Ctrl+C)
              </div>
              <div className="context-menu-item" onClick={() => { handleCut(ctxMenu.item, 'file'); setCtxMenu(null) }}>
                <Scissors className="w-4 h-4" /> Taglia (Ctrl+X)
              </div>
              <div className="context-menu-item" onClick={() => { handleDuplicate(ctxMenu.item); setCtxMenu(null) }}>
                <CopyPlus className="w-4 h-4" /> Duplica
              </div>
              <div className="context-menu-item" onClick={() => { setDialog({ type: 'renameFile', value: ctxMenu.item.title, targetId: ctxMenu.item.id }); setCtxMenu(null) }}>
                <Pencil className="w-4 h-4" /> Rinomina (F2)
              </div>
              <div className="context-menu-item font-bold" onClick={() => { handleReindexSingleDocument(ctxMenu.item); setCtxMenu(null) }}>
                <Sparkles className="w-4 h-4 text-black" /> Rigenera Vettori RAG
              </div>
              <div className="context-menu-separator" />
              <div className="context-menu-item danger" onClick={() => { handleDelete(ctxMenu.item); setCtxMenu(null) }}>
                <Trash2 className="w-4 h-4" /> Elimina file (Del)
              </div>
            </>
          )}
        </div>
      )}

      {/* Generic Unified Dialog (New Course, New Folder, Rename File/Folder/Course) */}
      {dialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100" onClick={() => setDialog(null)}>
          <div className="bg-white border-2 border-black p-5 sm:p-6 w-full max-w-sm shadow-[6px_6px_0px_rgba(0,0,0,1)] font-mono text-black" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-black mb-1">
              {dialog.type === 'newCourse' && 'Nuovo Corso Universitario'}
              {dialog.type === 'newFolder' && 'Nuova Cartella'}
              {dialog.type === 'renameFile' && 'Rinomina File'}
              {dialog.type === 'renameFolder' && 'Rinomina Cartella'}
              {dialog.type === 'renameCourse' && 'Rinomina Corso'}
            </h3>
            
            <p className="text-[11px] text-zinc-500 mb-3">
              {dialog.type === 'newCourse' 
                ? 'Inserisci il nome della materia o corso universitario.' 
                : dialog.type === 'newFolder' 
                ? 'Inserisci il nome della cartella o modulo.' 
                : 'Inserisci il nuovo nome da assegnare all\'elemento.'}
            </p>

            <input 
              autoFocus
              type="text"
              placeholder={dialog.type === 'newCourse' ? 'Es. Analisi Matematica 1' : dialog.type === 'newFolder' ? 'Es. Esercitazioni' : 'Nuovo nome'}
              value={dialog.value}
              onChange={e => setDialog({ ...dialog, value: e.target.value })}
              onKeyDown={e => { 
                if (e.key === 'Enter') handleExecuteDialog()
              }}
              className="w-full border border-black px-3 py-2 text-xs font-mono outline-none focus:bg-zinc-50 mb-4 bg-white"
            />
            
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setDialog(null)} 
                className="px-3.5 py-1.5 text-xs font-bold uppercase border border-black hover:bg-zinc-100 transition-colors text-black"
              >
                Annulla
              </button>
              <button 
                onClick={handleExecuteDialog}
                className="px-4 py-1.5 text-xs font-bold uppercase bg-black text-white border border-black hover:bg-zinc-800 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)]"
              >
                {dialog.type.startsWith('rename') ? 'Salva' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-Time Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-mono">
          <div className="bg-white border-2 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_rgba(0,0,0,1)] text-black font-mono" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 border border-black bg-black text-white flex items-center justify-center mb-4">
              <School className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold uppercase tracking-wider text-black mb-1">
              Configura il tuo spazio universitario
            </h3>
            <p className="text-xs text-zinc-600 mb-5">
              Inserisci la tua università e il tuo corso di studi. Creeremo automaticamente l&apos;albero delle cartelle per organizzare i tuoi corsi.
            </p>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-black block mb-1">
                  Quale università frequenti?
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Es. Politecnico di Milano, Università di Bologna..."
                  value={onboardingUni}
                  onChange={e => setOnboardingUni(e.target.value)}
                  className="w-full border border-black px-3 py-2 text-xs font-mono outline-none focus:bg-zinc-50 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-black block mb-1">
                  Quale corso di laurea frequenti?
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Es. Ingegneria Informatica, Economia Aziendale..."
                  value={onboardingDegree}
                  onChange={e => setOnboardingDegree(e.target.value)}
                  className="w-full border border-black px-3 py-2 text-xs font-mono outline-none focus:bg-zinc-50 bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowOnboarding(false)} 
                  className="px-3.5 py-1.5 text-xs font-bold uppercase border border-black hover:bg-zinc-100 transition-colors text-black"
                >
                  Più tardi
                </button>
                <button 
                  type="submit"
                  disabled={onboardingLoading || !onboardingUni.trim() || !onboardingDegree.trim()}
                  className="px-5 py-2 text-xs uppercase font-bold bg-black text-white border border-black hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  {onboardingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Crea Spazio Studio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Upload Modal (Dispositivo o YouTube) */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100"
          onClick={() => setShowUploadModal(false)}
        >
          <div 
            className="bg-white border-2 border-black p-5 sm:p-6 w-full max-w-lg shadow-[8px_8px_0px_rgba(0,0,0,1)] relative font-sans text-black"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-black pb-3 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5 inline-block mb-1">
                  CARICA MATERIALE
                </span>
                <h3 className="text-base font-bold font-mono uppercase tracking-tight text-black">
                  {uploadModalTab === 'choose' ? 'Scegli Origine Materiale' : 'Importa da YouTube'}
                </h3>
                <p className="text-xs text-zinc-500 font-sans mt-0.5">
                  Destinazione: <span className="font-semibold text-black">{currentFolderObj ? currentFolderObj.name : currentCourse ? currentCourse.name : 'Tutti i file (Root)'}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 border border-black text-black hover:bg-black hover:text-white transition-colors"
                title="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            {uploadModalTab === 'choose' ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-600 font-sans mb-3">
                  Seleziona se caricare un file memorizzato sul tuo dispositivo o importare i contenuti da un video YouTube:
                </p>

                {/* Option 1: Dispositivo */}
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    fileInputRef.current?.click()
                  }}
                  className="w-full text-left p-4 border border-black hover:bg-zinc-50 transition-all flex items-start gap-4 group shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <div className="p-3 border border-black bg-black text-white group-hover:bg-white group-hover:text-black transition-colors shrink-0">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm font-mono uppercase text-black">
                        Dal tuo dispositivo
                      </h4>
                      <span className="text-[10px] font-mono border border-zinc-300 px-1 py-0.5 text-zinc-600 group-hover:border-black group-hover:text-black">
                        FILE LOCALE
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1 font-sans leading-relaxed">
                      Carica dispense, slide di lezioni, note universitarie, registrazioni vocali o file PDF direttamente dal computer.
                    </p>
                  </div>
                </button>

                {/* Option 2: YouTube */}
                <button
                  type="button"
                  onClick={() => setUploadModalTab('youtube')}
                  className="w-full text-left p-4 border border-black hover:bg-zinc-50 transition-all flex items-start gap-4 group shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <div className="p-3 border border-black bg-white text-black group-hover:bg-black group-hover:text-white transition-colors shrink-0">
                    <Youtube className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm font-mono uppercase text-black">
                        Video da YouTube
                      </h4>
                      <span className="text-[10px] font-mono border border-zinc-300 px-1 py-0.5 text-zinc-600 group-hover:border-black group-hover:text-black">
                        LINK VIDEO
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1 font-sans leading-relaxed">
                      Incolla il link di una videolezione, conferenza o tutorial YouTube per trascriverla e indicizzarla automaticamente nel RAG.
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              /* YouTube Form */
              <form onSubmit={handleImportYouTube} className="space-y-4 text-xs font-mono">
                {ytError && (
                  <div className="p-3 border border-black bg-zinc-100 text-black text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-black" />
                    <span>{ytError}</span>
                  </div>
                )}

                <div>
                  <label className="font-bold uppercase tracking-wider block mb-1.5 text-black">
                    URL Video YouTube *
                  </label>
                  <input
                    type="url"
                    required
                    autoFocus
                    placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                    value={ytUrl}
                    onChange={e => setYtUrl(e.target.value)}
                    className="w-full border border-black px-3 py-2 text-xs font-mono outline-none focus:bg-zinc-50 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider block mb-1.5 text-black">
                    Titolo Personalizzato <span className="text-zinc-500 font-normal">(Opzionale)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Lezione 4 - Campi Elettromagnetici"
                    value={ytTitle}
                    onChange={e => setYtTitle(e.target.value)}
                    className="w-full border border-black px-3 py-2 text-xs font-mono outline-none focus:bg-zinc-50 bg-white"
                  />
                </div>

                <div className="p-3 border border-black bg-zinc-50 text-[11px] text-zinc-700 leading-relaxed font-sans">
                  Il video verrà analizzato, trascritto ed elaborato in vettori <strong>Gemini</strong>, venendo salvato come materiale didattico interrogabile in Chat e Tutor.
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setUploadModalTab('choose')}
                    className="px-3 py-1.5 border border-black text-xs font-bold uppercase hover:bg-zinc-100 transition-colors"
                  >
                    ← Indietro
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-3 py-1.5 border border-zinc-300 text-xs font-bold uppercase hover:bg-zinc-100 transition-colors text-zinc-600"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={ytLoading || !ytUrl.trim()}
                      className="px-4 py-1.5 font-bold uppercase bg-black text-white border border-black hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
                    >
                      {ytLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Importa
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* YouTube Floating Progress Widget (In basso a sinistra) */}
      <YouTubeProgressWidget
        state={ytProgressState}
        onClose={() => setYtProgressState(null)}
      />

    </div>
  )
}
