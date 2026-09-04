'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { extractTextFromBuffer, chunkText, generateEmbeddings } from '@/lib/ai/extractor'
import { generateText } from 'ai'
import { getGoogleClient, resolveGeminiModelId } from '@/lib/ai/gemini-client'

export async function getUserProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  return profile
}

export async function setupUniversityProfile(university: string, degreeCourse: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  // 1. Aggiorna preferenze profilo
  const preferences = {
    university: university.trim(),
    degree_course: degreeCourse.trim(),
    onboarding_completed: true,
    setup_at: new Date().toISOString()
  }

  await admin.from('profiles').update({ preferences }).eq('id', user.id)

  // 2. Crea il corso di laurea come corso principale se non esiste
  const courseName = degreeCourse.trim()
  let courseId = null
  const { data: existingCourse } = await admin.from('courses').select('id').eq('name', courseName).eq('user_id', user.id).single()
  
  if (existingCourse) {
    courseId = existingCourse.id
  } else {
    const { data: newCourse } = await admin.from('courses').insert({
      user_id: user.id,
      name: courseName
    }).select('id').single()
    if (newCourse) courseId = newCourse.id
  }

  // 3. Crea le cartelle base (Appunti, Slide, Esercizi)
  const starterFolders = ['Appunti', 'Slide', 'Esercizi']
  for (const sub of starterFolders) {
    const folderPath = `/${courseName}/${sub}`
    const { data: existingFolder } = await admin.from('folders').select('id').eq('path', folderPath).eq('user_id', user.id).single()
    if (!existingFolder) {
      await admin.from('folders').insert({
        user_id: user.id,
        name: sub,
        path: folderPath
      })
    }
  }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function autoProcessAndClassify(
  documentId: string, 
  filePath: string, 
  fileType: string,
  userApiKey?: string | null,
  userModel?: string | null
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  try {
    // Controllo autorizzativo (Fix IDOR / BOLA): Verifica che il documento appartenga all'utente loggato
    const { data: docRecord, error: docErr } = await admin
      .from('documents')
      .select('id, user_id, file_path')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docErr || !docRecord) {
      throw new Error("Documento non trovato o accesso non autorizzato")
    }

    await admin.from('documents').update({ status: 'elaborazione...' }).eq('id', documentId).eq('user_id', user.id)

    const targetStoragePath = docRecord.file_path || filePath
    const { data: fileData, error: downloadError } = await admin.storage.from('documents').download(targetStoragePath)
    if (downloadError || !fileData) throw new Error("Impossibile scaricare il file: " + (downloadError?.message || 'File non trovato'))

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const text = await extractTextFromBuffer(buffer, fileType, userApiKey)
    if (!text || text.trim().length < 5) throw new Error("Nessun testo utile estratto dal documento")

    const textSample = text.substring(0, 2000)
    let courseName = "Generico"
    let documentType = "Appunti"

    if (userApiKey) {
      try {
        const google = getGoogleClient(userApiKey)
        const modelId = resolveGeminiModelId(userModel)
        const aiResponse = await generateText({
          model: google(`models/${modelId}`),
          system: "Sei un classificatore di documenti. Restituisci SOLO un JSON con 'materia' (string, max 4 parole) e 'tipo' (uno tra: 'Appunti', 'Slide', 'Esercizi', 'Libro'). Nessun markup.",
          prompt: `Classifica:\n\n${textSample}`
        })
        const parsed = JSON.parse(aiResponse.text.trim().replace(/```json/g, '').replace(/```/g, ''))
        if (parsed.materia && parsed.materia !== 'Sconosciuto') courseName = parsed.materia
        if (parsed.tipo) documentType = parsed.tipo
      } catch { /* fallback ai valori di default */ }
    }

    const { saveDocumentChunksSafely } = await import('@/lib/ai/chunks')
    await saveDocumentChunksSafely({
      admin,
      userId: user.id,
      documentId,
      text,
      userApiKey
    })

    let courseId = null
    const { data: existingCourse } = await admin.from('courses').select('id').eq('name', courseName).eq('user_id', user.id).single()
    if (existingCourse) { courseId = existingCourse.id }
    else {
      const { data: newCourse } = await admin.from('courses').insert({ user_id: user.id, name: courseName }).select('id').single()
      if (newCourse) courseId = newCourse.id
    }

    const folderPath = `/${courseName}/${documentType}`
    let folderId = null
    const { data: existingFolder } = await admin.from('folders').select('id').eq('path', folderPath).eq('user_id', user.id).single()
    if (existingFolder) { folderId = existingFolder.id }
    else {
      const { data: newFolder } = await admin.from('folders').insert({ user_id: user.id, name: documentType, path: folderPath }).select('id').single()
      if (newFolder) folderId = newFolder.id
    }

    await admin.from('documents').update({ status: 'organizzato', course_id: courseId, folder_id: folderId }).eq('id', documentId).eq('user_id', user.id)
    revalidatePath('/files')
    return { success: true }

  } catch (err: any) {
    await admin.from('documents').update({ status: 'fallito' }).eq('id', documentId).eq('user_id', user.id)
    console.error("Errore AutoProcess:", err)
    throw new Error(err.message || "Errore durante l'elaborazione")
  }
}

export async function createCourse(name: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { data, error } = await admin.from('courses').insert({
    user_id: user.id,
    name: name.trim()
  }).select().single()

  if (error) throw error
  revalidatePath('/files')
  revalidatePath('/tutor')
  revalidatePath('/dashboard')
  return data
}

export async function createFolder(name: string, parentPath: string = '') {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const cleanName = name.trim()
  const path = parentPath ? `${parentPath}/${cleanName}` : `/${cleanName}`
  
  const { data: existing } = await admin.from('folders').select('id').eq('path', path).eq('user_id', user.id).single()
  if (existing) throw new Error("La cartella esiste già")

  const { data, error } = await admin.from('folders').insert({
    user_id: user.id,
    name: cleanName,
    path
  }).select().single()

  if (error) throw error
  
  revalidatePath('/files')
  return data
}

export async function renameDocument(documentId: string, newTitle: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const { error } = await admin.from('documents').update({ title: newTitle.trim() }).eq('id', documentId).eq('user_id', user.id)
  if (error) throw error
  revalidatePath('/files')
  return { success: true }
}

export async function renameFolder(folderId: string, newName: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const cleanName = newName.trim()
  if (!cleanName) throw new Error("Il nome della cartella non può essere vuoto")

  // 1. Trova cartella attuale
  const { data: folder, error: getErr } = await admin.from('folders').select('*').eq('id', folderId).eq('user_id', user.id).single()
  if (getErr || !folder) throw new Error("Cartella non trovata")

  const oldPath = folder.path
  const segments = oldPath.split('/')
  segments[segments.length - 1] = cleanName
  const newPath = segments.join('/')

  // 2. Aggiorna la cartella
  const { error: updErr } = await admin.from('folders').update({ name: cleanName, path: newPath }).eq('id', folderId).eq('user_id', user.id)
  if (updErr) throw updErr

  // 3. Aggiorna eventuali sottocartelle
  const { data: subfolders } = await admin.from('folders').select('id, path').like('path', `${oldPath}/%`).eq('user_id', user.id)
  if (subfolders && subfolders.length > 0) {
    for (const sub of subfolders) {
      const updatedSubPath = sub.path.replace(oldPath, newPath)
      await admin.from('folders').update({ path: updatedSubPath }).eq('id', sub.id).eq('user_id', user.id)
    }
  }

  revalidatePath('/files')
  return { success: true }
}

export async function renameCourse(courseId: string, newName: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const cleanName = newName.trim()
  if (!cleanName) throw new Error("Il nome del corso non può essere vuoto")

  const { data: course } = await admin.from('courses').select('name').eq('id', courseId).eq('user_id', user.id).single()
  const oldCourseName = course?.name

  const { error } = await admin.from('courses').update({ name: cleanName }).eq('id', courseId).eq('user_id', user.id)
  if (error) throw error

  // Aggiorna cartelle associate al vecchio corso
  if (oldCourseName) {
    const { data: courseFolders } = await admin.from('folders').select('id, path').like('path', `/${oldCourseName}%`).eq('user_id', user.id)
    if (courseFolders && courseFolders.length > 0) {
      for (const cf of courseFolders) {
        const newPath = cf.path.replace(`/${oldCourseName}`, `/${cleanName}`)
        await admin.from('folders').update({ path: newPath }).eq('id', cf.id).eq('user_id', user.id)
      }
    }
  }

  revalidatePath('/files')
  revalidatePath('/tutor')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function moveDocumentAction(documentId: string, targetFolderId: string | null, targetCourseId?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()
  const updatePayload: any = { folder_id: targetFolderId }
  if (targetCourseId !== undefined) {
    updatePayload.course_id = targetCourseId
  }

  const { error } = await admin.from('documents').update(updatePayload).eq('id', documentId).eq('user_id', user.id)
  if (error) throw error

  // Aggiorna anche il course_id sui chunks se cambiato
  if (targetCourseId !== undefined) {
    await admin.from('chunks').update({ course_id: targetCourseId }).eq('document_id', documentId).eq('user_id', user.id)
  }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function moveFolderAction(folderId: string, targetFolderId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  if (folderId === targetFolderId) throw new Error("Impossibile spostare una cartella in se stessa")

  const admin = createAdminClient()

  // 1. Verifica ownership della cartella sorgente (Fix IDOR)
  const { data: folder, error: folderErr } = await admin
    .from('folders')
    .select('id, name, path')
    .eq('id', folderId)
    .eq('user_id', user.id)
    .single()

  if (folderErr || !folder) throw new Error("Cartella non trovata o accesso non autorizzato")

  // 2. Verifica ownership della cartella destinazione
  const { data: targetFolder, error: targetErr } = await admin
    .from('folders')
    .select('id, name, path')
    .eq('id', targetFolderId)
    .eq('user_id', user.id)
    .single()

  if (targetErr || !targetFolder) throw new Error("Cartella destinazione non trovata o accesso non autorizzato")

  const oldPath = folder.path
  const newPath = `${targetFolder.path}/${folder.name}`

  // 3. Guard: prevenzione spostamento circolare (es. A -> A/B)
  if (newPath.startsWith(oldPath + '/') || newPath === oldPath) {
    throw new Error("Impossibile spostare una cartella dentro una sua sottocartella")
  }

  // 4. Controlla che non esista già una cartella con lo stesso path nella destinazione
  const { data: existing } = await admin
    .from('folders')
    .select('id')
    .eq('path', newPath)
    .eq('user_id', user.id)
    .single()

  if (existing) throw new Error(`Esiste già una cartella "${folder.name}" in questa posizione`)

  // 5. Aggiorna la cartella spostata
  const { error: updateErr } = await admin
    .from('folders')
    .update({ path: newPath })
    .eq('id', folderId)
    .eq('user_id', user.id)

  if (updateErr) throw updateErr

  // 6. Aggiorna ricorsivamente tutte le sottocartelle
  const { data: subfolders } = await admin
    .from('folders')
    .select('id, path')
    .like('path', `${oldPath}/%`)
    .eq('user_id', user.id)

  if (subfolders && subfolders.length > 0) {
    for (const sub of subfolders) {
      const updatedSubPath = sub.path.replace(oldPath, newPath)
      await admin
        .from('folders')
        .update({ path: updatedSubPath })
        .eq('id', sub.id)
        .eq('user_id', user.id)
    }
  }

  revalidatePath('/files')
  return { success: true }
}

export async function duplicateDocumentAction(documentId: string, targetFolderId?: string | null, targetCourseId?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  // 1. Prendi il documento originale
  const { data: orig, error: origErr } = await admin.from('documents').select('*').eq('id', documentId).eq('user_id', user.id).single()
  if (origErr || !orig) throw new Error("Documento non trovato")

  // 2. Inserisci copia
  const copyTitle = orig.title.includes('(Copia)') ? orig.title : `${orig.title} (Copia)`
  const { data: newDoc, error: insErr } = await admin.from('documents').insert({
    user_id: user.id,
    course_id: targetCourseId !== undefined ? targetCourseId : orig.course_id,
    folder_id: targetFolderId !== undefined ? targetFolderId : orig.folder_id,
    title: copyTitle,
    file_path: orig.file_path,
    file_type: orig.file_type,
    size_bytes: orig.size_bytes,
    status: orig.status
  }).select().single()

  if (insErr) throw insErr

  // 3. Duplica i chunks e i vettori associati
  const { data: origChunks } = await admin.from('chunks').select('*').eq('document_id', documentId).eq('user_id', user.id)
  if (origChunks && origChunks.length > 0) {
    const newChunks = origChunks.map(c => ({
      user_id: user.id,
      document_id: newDoc.id,
      chunk_index: c.chunk_index,
      content: c.content,
      embedding: c.embedding
    }))
    const { error: insErr } = await admin.from('chunks').insert(newChunks)
    if (insErr) {
      console.warn("Errore duplicazione chunks:", insErr)
    }
  }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  return { success: true, document: newDoc }
}

export async function deleteCourse(courseId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  // 1. Trova nome corso per pulizia cartelle
  const { data: course } = await admin.from('courses').select('name').eq('id', courseId).eq('user_id', user.id).single()

  // 2. Rimuovi il corso_id dai documenti associati
  await admin.from('documents').update({ course_id: null }).eq('course_id', courseId).eq('user_id', user.id)

  // 3. Elimina sessioni tutor associate al corso
  await admin.from('tutor_sessions').delete().eq('course_id', courseId).eq('user_id', user.id)

  // 4. Elimina cartelle del corso
  if (course?.name) {
    await admin.from('folders').delete().like('path', `/${course.name}%`).eq('user_id', user.id)
  }

  // 5. Elimina il corso
  const { error } = await admin.from('courses').delete().eq('id', courseId).eq('user_id', user.id)
  if (error) throw error

  revalidatePath('/files')
  revalidatePath('/tutor')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteFolder(folderId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const admin = createAdminClient()

  // 1. Trova la cartella per verificare se ha sottocartelle
  const { data: folder } = await admin.from('folders').select('path').eq('id', folderId).eq('user_id', user.id).single()

  // 2. Rimuovi il folder_id dai documenti in questa cartella
  await admin.from('documents').update({ folder_id: null }).eq('folder_id', folderId).eq('user_id', user.id)

  // 3. Elimina eventuali sottocartelle
  if (folder?.path) {
    await admin.from('folders').delete().like('path', `${folder.path}/%`).eq('user_id', user.id)
  }

  // 4. Elimina la cartella
  const { error } = await admin.from('folders').delete().eq('id', folderId).eq('user_id', user.id)
  if (error) throw error

  revalidatePath('/files')
  return { success: true }
}

export async function ingestYouTubeVideoAction(params: {
  url: string
  courseId?: string | null
  folderId?: string | null
  customTitle?: string
  userApiKey?: string | null
  userModel?: string | null
}) {
  const { extractYouTubeVideoId, getYouTubeMetadata, getYouTubeTranscript } = await import('@/lib/ai/youtube')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  const videoId = extractYouTubeVideoId(params.url)
  if (!videoId) throw new Error("URL di YouTube non valido. Inserisci un link YouTube valido.")

  const admin = createAdminClient()

  // 1. Recupera metadati (titolo, canale, anteprima)
  const metadata = await getYouTubeMetadata(videoId)
  const title = params.customTitle?.trim() || metadata.title

  // 2. Recupera trascrizione o sintesi didattica AI
  const transcript = await getYouTubeTranscript(videoId, title, user.id, params.userApiKey, params.userModel)
  if (!transcript || transcript.length < 10) {
    throw new Error("Impossibile recuperare o analizzare il contenuto dal video YouTube.")
  }

  // 3. Se non è specificato un corso, assegna al primo corso esistente
  let targetCourseId = params.courseId || null
  if (!targetCourseId) {
    const { data: firstCourse } = await admin.from('courses').select('id').eq('user_id', user.id).limit(1).single()
    targetCourseId = firstCourse?.id || null
  }

  // 4. Inserisci il documento nel database
  const { data: doc, error: docErr } = await admin.from('documents').insert({
    user_id: user.id,
    course_id: targetCourseId,
    folder_id: params.folderId || null,
    title,
    file_path: metadata.url,
    file_type: 'youtube',
    size_bytes: Buffer.byteLength(transcript, 'utf8'),
    status: 'processed'
  }).select().single()

  if (docErr) throw docErr

  // 5. Chunking & Embeddings per la knowledge base salvati in modo sicuro
  const { saveDocumentChunksSafely } = await import('@/lib/ai/chunks')
  const { count: savedChunksCount } = await saveDocumentChunksSafely({
    admin,
    userId: user.id,
    documentId: doc.id,
    text: transcript,
    userApiKey: params.userApiKey
  })

  const { logAuditEvent } = await import('@/lib/audit')
  await logAuditEvent({
    userId: user.id,
    action: 'YOUTUBE_VIDEO_INGESTED',
    entityType: 'document',
    entityId: doc.id,
    details: { videoId, title, chunksCount: savedChunksCount }
  })

  revalidatePath('/files')
  revalidatePath('/upload')
  revalidatePath('/dashboard')
  revalidatePath('/chat')
  revalidatePath('/tutor')

  return { success: true, document: doc, chunksCount: savedChunksCount }
}

/**
 * Re-indicizza e rigenera i vettori embeddings per tutti i documenti dell'utente.
 * @param force se true (default), rigenera i vettori anche per i documenti già indicizzati.
 */
export async function reindexAllMissingEmbeddingsAction(
  userApiKey: string, 
  userModel?: string, 
  force: boolean = true
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  if (!userApiKey || !userApiKey.trim()) {
    throw new Error("CHIAVE_API_MANCANTE: Inserisci la tua API Key di Google Gemini.")
  }

  const admin = createAdminClient()
  const { data: docs, error: docsErr } = await admin
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (docsErr) {
    throw new Error(`Errore recupero documenti: ${docsErr.message}`)
  }

  if (!docs || docs.length === 0) {
    return { success: true, processedDocs: 0, totalChunks: 0, totalDocs: 0 }
  }

  let processedCount = 0
  let totalChunksCreated = 0
  const errors: { title: string; error: string }[] = []

  for (const doc of docs) {
    try {
      // 1. Controlla chunks esistenti
      const { data: existingChunks } = await admin
        .from('chunks')
        .select('id, content, embedding')
        .eq('document_id', doc.id)
        .eq('user_id', user.id)

      const hasChunks = !!(existingChunks && existingChunks.length > 0)
      const hasCorruptChunks = hasChunks && existingChunks.some(c => !c.embedding || (typeof c.embedding === 'string' && c.embedding.includes('[0,0,0,0')))

      // Se non forzato e ha già chunks validi, salta
      if (!force && hasChunks && !hasCorruptChunks) {
        continue
      }

      // 2. Estrazione testo integrale del documento
      let fullText = ""

      if (doc.file_type === 'youtube' || doc.file_path?.includes('youtube.com') || doc.file_path?.includes('youtu.be')) {
        try {
          const { extractYouTubeVideoId, getYouTubeTranscript } = await import('@/lib/ai/youtube')
          const videoId = extractYouTubeVideoId(doc.file_path) || doc.file_path
          fullText = await getYouTubeTranscript(videoId, doc.title, user.id, userApiKey, userModel)
        } catch (ytErr: any) {
          console.warn(`Impossibile ri-estrarre trascrizione YouTube per ${doc.title}:`, ytErr?.message || ytErr)
        }
      } else {
        // File memorizzato su Storage (usiamo admin.storage per garantire accesso senza blocchi RLS)
        try {
          const { data: fileData, error: dlErr } = await admin.storage.from('documents').download(doc.file_path)
          if (!dlErr && fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer())
            fullText = await extractTextFromBuffer(buffer, doc.file_type, userApiKey)
          }
        } catch (storageErr: any) {
          console.warn(`Impossibile scaricare file da storage per ${doc.title}:`, storageErr?.message || storageErr)
        }
      }

      // 3. Fallback: se il download fallisce ma il database contiene già i frammenti di testo dai vecchi chunks, riusiamo il loro contenuto
      if ((!fullText || fullText.trim().length < 5) && hasChunks) {
        fullText = existingChunks
          .filter(c => c.content && c.content.trim())
          .map(c => c.content)
          .join('\n\n')
      }

      if (!fullText || fullText.trim().length < 5) {
        throw new Error("Nessun testo o trascrizione recuperabile per questo documento.")
      }

      // 4. Salva i nuovi chunks (rimuove i vecchi ed inserisce i nuovi calcolati con gemini-embedding-2)
      await admin.from('chunks').delete().eq('document_id', doc.id).eq('user_id', user.id)

      const { saveDocumentChunksSafely } = await import('@/lib/ai/chunks')
      const { count: savedCount } = await saveDocumentChunksSafely({
        admin,
        userId: user.id,
        documentId: doc.id,
        text: fullText,
        userApiKey
      })

      totalChunksCreated += savedCount
      await admin.from('documents').update({ status: 'elaborato' }).eq('id', doc.id)
      processedCount++
    } catch (docErr: any) {
      console.error(`Errore re-indicizzazione documento "${doc.title}":`, docErr)
      errors.push({ title: doc.title, error: docErr?.message || 'Errore elaborazione vettori' })
    }
  }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  revalidatePath('/chat')
  revalidatePath('/tutor')

  return { 
    success: true, 
    processedDocs: processedCount, 
    totalChunks: totalChunksCreated,
    totalDocs: docs.length,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Re-indicizza e rigenera i vettori embeddings per un singolo documento specifico
 */
export async function reindexSingleDocumentAction(
  documentId: string, 
  userApiKey: string, 
  userModel?: string
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  if (!userApiKey || !userApiKey.trim()) {
    throw new Error("CHIAVE_API_MANCANTE: Inserisci la tua API Key di Google Gemini.")
  }

  const admin = createAdminClient()
  const { data: doc, error: docError } = await admin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()

  if (docError || !doc) {
    throw new Error("Documento non trovato")
  }

  // 1. Recupera chunks esistenti
  const { data: existingChunks } = await admin
    .from('chunks')
    .select('id, content')
    .eq('document_id', doc.id)
    .eq('user_id', user.id)

  let fullText = ""

  if (doc.file_type === 'youtube' || doc.file_path?.includes('youtube.com') || doc.file_path?.includes('youtu.be')) {
    const { extractYouTubeVideoId, getYouTubeTranscript } = await import('@/lib/ai/youtube')
    const videoId = extractYouTubeVideoId(doc.file_path) || doc.file_path
    fullText = await getYouTubeTranscript(videoId, doc.title, user.id, userApiKey, userModel)
  } else {
    const { data: fileData, error: dlErr } = await admin.storage.from('documents').download(doc.file_path)
    if (!dlErr && fileData) {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      fullText = await extractTextFromBuffer(buffer, doc.file_type, userApiKey)
    }
  }

  // Fallback se il download fallisce ma chunks esistono
  if ((!fullText || fullText.trim().length < 5) && existingChunks && existingChunks.length > 0) {
    fullText = existingChunks.filter(c => c.content && c.content.trim()).map(c => c.content).join('\n\n')
  }

  if (!fullText || fullText.trim().length < 5) {
    throw new Error("Nessun testo o trascrizione recuperabile per questo documento.")
  }

  // Rimuove vecchi chunks
  await admin.from('chunks').delete().eq('document_id', doc.id).eq('user_id', user.id)

  const { saveDocumentChunksSafely } = await import('@/lib/ai/chunks')
  const { count: savedCount } = await saveDocumentChunksSafely({
    admin,
    userId: user.id,
    documentId: doc.id,
    text: fullText,
    userApiKey
  })

  await admin.from('documents').update({ status: 'elaborato' }).eq('id', doc.id)

  revalidatePath('/files')
  revalidatePath('/dashboard')
  revalidatePath('/chat')
  revalidatePath('/tutor')

  return { success: true, chunksCount: savedCount }
}
