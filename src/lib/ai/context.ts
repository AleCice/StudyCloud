import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ContextSelection {
  type: 'all' | 'course' | 'folder' | 'subfolder' | 'doc'
  id?: string
  name?: string
  path?: string
  courseName?: string
}

export interface ContextDocItem {
  id: string
  title: string
  folder_id?: string | null
  course_id?: string | null
}

export interface ContextFolderItem {
  id: string
  name: string
  path: string
  parent_id?: string | null
  course_id?: string | null
  subfolders: ContextFolderItem[]
  documents: ContextDocItem[]
  totalDocsCount: number
}

export interface ContextCourseItem {
  id: string
  name: string
  folders: ContextFolderItem[]
  rootDocuments: ContextDocItem[]
  totalDocsCount: number
}

export interface ContextTreeData {
  courses: ContextCourseItem[]
  allDocumentsCount: number
}

/**
 * Recupera l'albero gerarchico completo: Corsi -> Cartelle -> Sottocartelle -> Documenti
 */
export async function getHierarchicalContextTree(): Promise<ContextTreeData> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { courses: [], allDocumentsCount: 0 }

  const admin = createAdminClient()

  const [coursesRes, foldersRes, docsRes] = await Promise.all([
    admin.from('courses').select('id, name').eq('user_id', user.id).order('name', { ascending: true }),
    admin.from('folders').select('id, name, path, parent_id').eq('user_id', user.id).order('path', { ascending: true }),
    admin.from('documents').select('id, title, course_id, folder_id').eq('user_id', user.id).order('title', { ascending: true })
  ])

  const courses = coursesRes.data || []
  const folders = foldersRes.data || []
  const docs = docsRes.data || []

  // Mappa delle cartelle per id
  const folderMap = new Map<string, ContextFolderItem>()
  for (const f of folders) {
    folderMap.set(f.id, {
      id: f.id,
      name: f.name,
      path: f.path,
      parent_id: f.parent_id,
      subfolders: [],
      documents: [],
      totalDocsCount: 0
    })
  }

  // Assegna documenti alle cartelle
  const unassignedDocs: ContextDocItem[] = []
  for (const doc of docs) {
    if (doc.folder_id && folderMap.has(doc.folder_id)) {
      const f = folderMap.get(doc.folder_id)!
      f.documents.push(doc)
      f.totalDocsCount++
    } else {
      unassignedDocs.push(doc)
    }
  }

  // Costruisci albero gerarchico per ciascun corso
  const courseTrees: ContextCourseItem[] = []

  for (const course of courses) {
    const courseFolders: ContextFolderItem[] = []
    
    // Trova le cartelle che appartengono a questo corso (tramite path /NomeCorso o parentela)
    for (const f of folders) {
      if (f.path.startsWith(`/${course.name}/`) || f.path === `/${course.name}`) {
        const item = folderMap.get(f.id)!
        if (!f.parent_id || !folderMap.has(f.parent_id)) {
          courseFolders.push(item)
        } else {
          const parent = folderMap.get(f.parent_id)
          if (parent && !parent.subfolders.some(s => s.id === item.id)) {
            parent.subfolders.push(item)
          }
        }
      }
    }

    // Calcola il conteggio ricorsivo dei documenti
    const calculateCounts = (f: ContextFolderItem): number => {
      let count = f.documents.length
      for (const sub of f.subfolders) {
        count += calculateCounts(sub)
      }
      f.totalDocsCount = count
      return count
    }

    let courseTotal = 0
    for (const cf of courseFolders) {
      courseTotal += calculateCounts(cf)
    }

    // Documenti diretti del corso senza cartella specifica
    const directDocs = unassignedDocs.filter(d => d.course_id === course.id)
    courseTotal += directDocs.length

    courseTrees.push({
      id: course.id,
      name: course.name,
      folders: courseFolders,
      rootDocuments: directDocs,
      totalDocsCount: courseTotal
    })
  }

  return {
    courses: courseTrees,
    allDocumentsCount: docs.length
  }
}

/**
 * Risolve la lista di document IDs ammessi per un dato ContextSelection
 */
export async function resolveContextDocIds(
  userId: string,
  context?: ContextSelection | null
): Promise<{ docIds: string[] | null; courseId: string | null; description: string }> {
  if (!context || context.type === 'all' || !context.id) {
    return { docIds: null, courseId: null, description: 'Tutti i materiali' }
  }

  const admin = createAdminClient()

  if (context.type === 'doc') {
    return { docIds: [context.id], courseId: null, description: `Documento: ${context.name || 'Selezionato'}` }
  }

  if (context.type === 'course') {
    const { data: courseDocs } = await admin
      .from('documents')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', context.id)

    const docIds = courseDocs?.map(d => d.id) || []
    return { docIds, courseId: context.id, description: `Corso: ${context.name || 'Selezionato'}` }
  }

  if (context.type === 'folder' || context.type === 'subfolder') {
    // 1. Recupera il path della cartella selezionata
    const { data: targetFolder } = await admin
      .from('folders')
      .select('id, path, name')
      .eq('id', context.id)
      .eq('user_id', userId)
      .single()

    if (!targetFolder) {
      return { docIds: [], courseId: null, description: `Cartella: ${context.name || 'Selezionata'}` }
    }

    // 2. Trova tutte le sottocartelle discendenti (il cui path inizia con il path della cartella genitore)
    const { data: descendantFolders } = await admin
      .from('folders')
      .select('id')
      .eq('user_id', userId)
      .or(`id.eq.${targetFolder.id},path.like.${targetFolder.path}/%`)

    const folderIds = descendantFolders?.map(f => f.id) || [targetFolder.id]

    // 3. Trova tutti i documenti appartenenti a queste cartelle
    const { data: folderDocs } = await admin
      .from('documents')
      .select('id, course_id')
      .eq('user_id', userId)
      .in('folder_id', folderIds)

    const docIds = folderDocs?.map(d => d.id) || []
    const firstCourseId = folderDocs?.[0]?.course_id || null

    return { 
      docIds, 
      courseId: firstCourseId, 
      description: `Cartella: ${targetFolder.name}` 
    }
  }

  return { docIds: null, courseId: null, description: 'Tutti i materiali' }
}
