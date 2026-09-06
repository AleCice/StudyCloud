'use client'

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { RotateCw, ZoomIn, ZoomOut, Layers, Search, X, Compass } from 'lucide-react'

export interface VectorNode {
  id: string
  documentId: string
  docTitle: string
  courseName?: string
  content: string
  chunkIndex: number
  x: number
  y: number
  z: number
  clusterIndex: number
}

export type NodeType = 'course_hub' | 'doc_hub' | 'chunk'

export interface ConstellationNode {
  id: string
  type: NodeType
  title: string
  subtitle?: string
  courseId: string
  courseName: string
  documentId?: string
  docTitle?: string
  content?: string
  chunkIndex?: number
  // 3D coordinates
  x: number
  y: number
  z: number
  // Radius in pixels
  radius: number
  // Metadata for hub inspection
  docsCount?: number
  chunksCount?: number
  keywords?: string[]
}

export interface ConstellationEdge {
  fromIndex: number
  toIndex: number
  type: 'hub_to_doc' | 'doc_to_chunk' | 'sequential_chunk' | 'semantic_bridge'
  weight: number
  sharedKeywords?: string[]
}

interface BackgroundStar {
  x: number
  y: number
  z: number
  size: number
  alpha: number
}

interface Props {
  chunks: Array<{
    id: string
    document_id: string
    content: string
    chunk_index: number
    docTitle?: string
    courseName?: string
    courseId?: string
  }>
  courses?: Array<{
    id: string
    name: string
  }>
  totalVectorsCount: number
}

// Stopwords italiane per estrazione parole chiave significative
const STOPWORDS = new Set([
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle',
  'quando', 'perche', 'perché', 'poiche', 'inoltre', 'allora', 'essere', 'hanno',
  'delle', 'degli', 'della', 'dello', 'nella', 'nello', 'nelle', 'negli', 'dall',
  'dalle', 'dalla', 'dallo', 'quindi', 'prima', 'dopo', 'anche', 'senza', 'dover',
  'potere', 'tutti', 'tutto', 'tutta', 'tutte', 'parte', 'stesso', 'stessa', 'stessi',
  'qualsiasi', 'alcuni', 'alcune', 'possono', 'delle', 'mentre', 'tramite', 'secondo',
  'invece', 'infatti', 'oppure', 'ovvero', 'grazie', 'presso', 'contro', 'verso'
])

function extractKeywords(text: string): string[] {
  if (!text) return []
  const clean = text.toLowerCase().replace(/[^a-zàèéìòù0-9\s]/g, ' ')
  const tokens = clean.split(/\s+/).filter(t => t.length >= 5 && !STOPWORDS.has(t))
  const freqMap = new Map<string, number>()
  tokens.forEach(t => freqMap.set(t, (freqMap.get(t) || 0) + 1))
  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
}

export default function VectorSpace3D({ chunks, courses, totalVectorsCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // HUD State
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<ConstellationNode | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [zoom, setZoom] = useState(2.2)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')

  // Camera angles & interaction refs
  const rotationRef = useRef({ x: 0.22, y: 0.40 })
  const isDraggingRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })
  const pinchDistRef = useRef<number | null>(null)

  // Graph state in refs for 60fps render loop
  const nodesRef = useRef<ConstellationNode[]>([])
  const edgesRef = useRef<ConstellationEdge[]>([])
  const starsRef = useRef<BackgroundStar[]>([])
  const activeSearchNodeIdsRef = useRef<Set<string>>(new Set())

  // Lista di tutti i corsi unici presenti
  const courseOptions = useMemo(() => {
    const map = new Map<string, string>()
    chunks.forEach(c => {
      const cId = c.courseId || 'general'
      const cName = c.courseName || 'Generale'
      map.set(cId, cName)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [chunks])

  // Calcola numero di documenti
  const docCount = useMemo(() => {
    return new Set(chunks.map(c => c.document_id)).size
  }, [chunks])

  // Aggiorna l'insieme di nodi trovati dalla ricerca
  useEffect(() => {
    if (!searchQuery.trim()) {
      activeSearchNodeIdsRef.current = new Set()
      return
    }
    const q = searchQuery.toLowerCase().trim()
    const matches = new Set<string>()
    nodesRef.current.forEach(n => {
      const inTitle = n.title.toLowerCase().includes(q)
      const inContent = n.content?.toLowerCase().includes(q)
      const inKeywords = n.keywords?.some(k => k.includes(q))
      const inCourse = n.courseName.toLowerCase().includes(q)
      if (inTitle || inContent || inKeywords || inCourse) {
        matches.add(n.id)
      }
    })
    activeSearchNodeIdsRef.current = matches
  }, [searchQuery])

  // 1. Inizializzazione Stelle di Fondo (Parallasse Cosmico)
  useEffect(() => {
    const stars: BackgroundStar[] = []
    const starCount = 20
    for (let i = 0; i < starCount; i++) {
      const u = Math.random()
      const v = Math.random()
      const theta = u * 2.0 * Math.PI
      const phi = Math.acos(2.0 * v - 1.0)
      const r = 550 + Math.random() * 250

      stars.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        size: Math.random() > 0.85 ? 2.0 : 1.2,
        alpha: 0.2 + Math.random() * 0.4
      })
    }
    starsRef.current = stars
  }, [])

  // 2. Costruzione della Struttura a Costellazione Semantica (Macro-Topic -> Sub-Hub -> Satelliti)
  useEffect(() => {
    if (!chunks || chunks.length === 0) {
      nodesRef.current = []
      edgesRef.current = []
      return
    }

    const nodes: ConstellationNode[] = []
    const edges: ConstellationEdge[] = []
    const edgeSet = new Set<string>()

    const addEdge = (
      fromIdx: number, 
      toIdx: number, 
      type: ConstellationEdge['type'], 
      weight: number = 1,
      sharedKeywords?: string[]
    ) => {
      if (fromIdx === toIdx) return
      const key = fromIdx < toIdx ? `${fromIdx}-${toIdx}` : `${toIdx}-${fromIdx}`
      if (edgeSet.has(key)) return
      edgeSet.add(key)
      edges.push({ fromIndex: fromIdx, toIndex: toIdx, type, weight, sharedKeywords })
    }

    // A. Raggruppa i dati per Corso e Documento
    const courseGroups = new Map<string, {
      courseName: string
      docs: Map<string, { docTitle: string; chunks: typeof chunks }>
    }>()

    chunks.forEach(chunk => {
      const cId = chunk.courseId || 'general'
      const cName = chunk.courseName || 'Generale'
      if (!courseGroups.has(cId)) {
        courseGroups.set(cId, { courseName: cName, docs: new Map() })
      }
      const cGroup = courseGroups.get(cId)!
      if (!cGroup.docs.has(chunk.document_id)) {
        cGroup.docs.set(chunk.document_id, {
          docTitle: chunk.docTitle || 'Documento',
          chunks: []
        })
      }
      cGroup.docs.get(chunk.document_id)!.chunks.push(chunk)
    })

    const coursesList = Array.from(courseGroups.entries())
    const totalCourses = coursesList.length

    // B. Crea i Macro-Hub dei Corsi ("Stelle Principali")
    const courseHubIndices = new Map<string, number>()
    const docHubIndices = new Map<string, number>()
    const chunkNodeIndices = new Map<string, number>()

    coursesList.forEach(([courseId, cData], cIdx) => {
      // Posiziona i corsi in orbita circolare distanziata nello spazio 3D
      let cX = 0, cY = 0, cZ = 0
      if (totalCourses > 1) {
        const angle = (2 * Math.PI * cIdx) / totalCourses
        const courseOrbitRadius = 145 + Math.min(60, totalCourses * 12)
        cX = courseOrbitRadius * Math.cos(angle)
        cZ = courseOrbitRadius * Math.sin(angle)
        cY = Math.sin(angle * 2) * 35 // Stagger verticale naturale
      }

      let totalCourseChunks = 0
      cData.docs.forEach(d => totalCourseChunks += d.chunks.length)

      const courseHubIdx = nodes.length
      courseHubIndices.set(courseId, courseHubIdx)

      nodes.push({
        id: `course-${courseId}`,
        type: 'course_hub',
        title: cData.courseName,
        courseId,
        courseName: cData.courseName,
        x: cX,
        y: cY,
        z: cZ,
        radius: 12,
        docsCount: cData.docs.size,
        chunksCount: totalCourseChunks
      })

      // C. Crea i Sub-Hub dei Documenti per questo Corso ("Pianeti")
      const docsList = Array.from(cData.docs.entries())
      const totalDocs = docsList.length

      docsList.forEach(([docId, dData], dIdx) => {
        const docAngle = (2 * Math.PI * dIdx) / Math.max(1, totalDocs)
        const docDistance = totalDocs === 1 ? 55 : 65 + (dIdx % 2) * 15
        const dX = cX + docDistance * Math.cos(docAngle)
        const dZ = cZ + docDistance * Math.sin(docAngle)
        const dY = cY + Math.sin(docAngle * 1.5) * 22

        const docHubIdx = nodes.length
        docHubIndices.set(docId, docHubIdx)

        nodes.push({
          id: `doc-${docId}`,
          type: 'doc_hub',
          title: dData.docTitle,
          subtitle: cData.courseName,
          courseId,
          courseName: cData.courseName,
          documentId: docId,
          docTitle: dData.docTitle,
          x: dX,
          y: dY,
          z: dZ,
          radius: 7,
          chunksCount: dData.chunks.length
        })

        // Connetti il Sub-Hub del documento al Macro-Hub del corso
        addEdge(courseHubIdx, docHubIdx, 'hub_to_doc', 1.0)

        // D. Crea i Satelliti dei Chunk ("Lune / Frammenti di Studio" - limitati a max 4 per documento)
        const sortedChunks = [...dData.chunks].sort((a, b) => a.chunk_index - b.chunk_index).slice(0, 4)
        let prevChunkIdx = -1

        sortedChunks.forEach((chunk, chIdx) => {
          // Distribuzione gravitazionale sferica attorno al documento
          const phi = (chIdx * 2.3999) % Math.PI
          const theta = (chIdx * 1.6180) % (2 * Math.PI)
          const chunkDist = 20 + (chIdx % 5) * 6

          const chX = dX + chunkDist * Math.sin(phi) * Math.cos(theta)
          const chY = dY + chunkDist * Math.cos(phi) * 0.85
          const chZ = dZ + chunkDist * Math.sin(phi) * Math.sin(theta)

          const keywords = extractKeywords(chunk.content)
          const chunkNodeIdx = nodes.length
          chunkNodeIndices.set(chunk.id, chunkNodeIdx)

          nodes.push({
            id: chunk.id,
            type: 'chunk',
            title: `Frammento #${chunk.chunk_index + 1}`,
            subtitle: dData.docTitle,
            courseId,
            courseName: cData.courseName,
            documentId: docId,
            docTitle: dData.docTitle,
            content: chunk.content,
            chunkIndex: chunk.chunk_index,
            x: chX,
            y: chY,
            z: chZ,
            radius: Math.max(3.2, Math.min(5.2, 3.0 + (chunk.content.length / 500))),
            keywords
          })

          // Connetti il chunk al documento di riferimento
          addEdge(docHubIdx, chunkNodeIdx, 'doc_to_chunk', 0.8)

          // Connetti in sequenza temporale di lettura col frammento precedente
          if (prevChunkIdx !== -1) {
            addEdge(prevChunkIdx, chunkNodeIdx, 'sequential_chunk', 0.5)
          }
          prevChunkIdx = chunkNodeIdx
        })
      })
    })

    // E. Genera Ponti Sinaptici Intelligenti (Cross-Topic Semantic Bridges)
    // Cerca nodi di corsi o documenti diversi che condividono parole chiave rilevanti
    const chunkNodes = nodes.filter(n => n.type === 'chunk' && n.keywords && n.keywords.length > 0)
    let bridgeCount = 0
    const MAX_BRIDGES = 35

    for (let i = 0; i < chunkNodes.length && bridgeCount < MAX_BRIDGES; i++) {
      const nA = chunkNodes[i]
      const kwA = new Set(nA.keywords || [])

      for (let j = i + 1; j < chunkNodes.length && bridgeCount < MAX_BRIDGES; j++) {
        const nB = chunkNodes[j]
        // Collega solo frammenti di documenti differenti per rivelare collegamenti tra concetti
        if (nA.documentId === nB.documentId) continue

        const shared = (nB.keywords || []).filter(k => kwA.has(k))
        if (shared.length >= 2) {
          const idxA = chunkNodeIndices.get(nA.id)
          const idxB = chunkNodeIndices.get(nB.id)
          if (idxA !== undefined && idxB !== undefined) {
            addEdge(idxA, idxB, 'semantic_bridge', 1.2, shared)
            bridgeCount++
          }
        }
      }
    }

    nodesRef.current = nodes
    edgesRef.current = edges
  }, [chunks])

  // Centra e fa zoom su un nodo o corso selezionato
  const focusOnNode = useCallback((node: ConstellationNode) => {
    setSelectedNode(node)
    // Inclinazione camera ideale per osservare il cluster
    rotationRef.current = {
      x: 0.28,
      y: Math.atan2(node.x, node.z) + 0.2
    }
  }, [])

  // Render Loop Canvas ad Alte Prestazioni (60fps) con High-DPI
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    const fov = 380

    const render = () => {
      // Rotazione automatica orbitale fluida se non c'è drag manuale
      if (autoRotate && !isDraggingRef.current) {
        rotationRef.current.y += 0.0018
        rotationRef.current.x += 0.0003
      }

      const rect = canvas.getBoundingClientRect()
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
      const width = rect.width
      const height = rect.height

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      // Background Tecnico Spaziale: Griglia Geometrica Sfumata
      ctx.strokeStyle = '#f1f1f4'
      ctx.lineWidth = 1
      const gridSize = 42
      for (let gx = 0; gx < width; gx += gridSize) {
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.lineTo(gx, height)
        ctx.stroke()
      }
      for (let gy = 0; gy < height; gy += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(width, gy)
        ctx.stroke()
      }

      // Matrici di rotazione Euleriana
      const cosX = Math.cos(rotationRef.current.x)
      const sinX = Math.sin(rotationRef.current.x)
      const cosY = Math.cos(rotationRef.current.y)
      const sinY = Math.sin(rotationRef.current.y)

      // 1. Render Stelle di Fondo (Parallasse cosmico)
      const stars = starsRef.current
      stars.forEach(st => {
        let x1 = st.x * cosY - st.z * sinY
        let z1 = st.z * cosY + st.x * sinY
        let y2 = st.y * cosX - z1 * sinX
        let z2 = z1 * cosX + st.y * sinX

        const scale = (fov * zoom) / (fov + z2 + 500)
        const px = width / 2 + x1 * scale
        const py = height / 2 + y2 * scale

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          ctx.fillStyle = `rgba(161, 161, 170, ${st.alpha * 0.6})`
          ctx.fillRect(px - st.size / 2, py - st.size / 2, st.size, st.size)
        }
      })

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const activeSearch = activeSearchNodeIdsRef.current
      const hasActiveSearch = activeSearch.size > 0
      const isFiltered = selectedCourseFilter !== 'all'

      // Proietta tutti i nodi in 2D
      const projected = nodes.map((node, index) => {
        let x1 = node.x * cosY - node.z * sinY
        let z1 = node.z * cosY + node.x * sinY
        let y2 = node.y * cosX - z1 * sinX
        let z2 = z1 * cosX + node.y * sinX

        const scale = (fov * zoom) / (fov + z2 + 380)
        const projX = width / 2 + x1 * scale
        const projY = height / 2 + y2 * scale

        // Calcola affievolimento di profondità atmosferico
        const depthFactor = Math.max(0.2, Math.min(1.0, (z2 + 320) / 480))

        const matchesFilter = !isFiltered || node.courseId === selectedCourseFilter
        const matchesSearch = !hasActiveSearch || activeSearch.has(node.id)

        return {
          index,
          node,
          projX,
          projY,
          scale,
          depth: z2,
          depthFactor,
          visible: matchesFilter,
          highlighted: matchesSearch && matchesFilter
        }
      })

      // 2. Disegna Orbite Gravitazionali attorno ai Macro-Hub dei Corsi
      nodes.forEach((n, idx) => {
        if (n.type !== 'course_hub') return
        const p = projected[idx]
        if (!p || !p.visible) return

        const orbitRadiusPx = 68 * p.scale
        ctx.beginPath()
        ctx.ellipse(p.projX, p.projY, orbitRadiusPx, orbitRadiusPx * 0.45, rotationRef.current.y * 0.5, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(212, 212, 216, ${0.45 * p.depthFactor})`
        ctx.lineWidth = 1
        ctx.setLineDash([4, 6])
        ctx.stroke()
        ctx.setLineDash([])
      })

      // 3. Disegna Connessioni e Ponti Sinaptici
      edges.forEach(edge => {
        const pA = projected[edge.fromIndex]
        const pB = projected[edge.toIndex]
        if (!pA || !pB || !pA.visible || !pB.visible) return

        const isHoveredEdge = 
          hoveredNode && (hoveredNode.id === pA.node.id || hoveredNode.id === pB.node.id)
        const isSelectedEdge = 
          selectedNode && (selectedNode.id === pA.node.id || selectedNode.id === pB.node.id)

        ctx.beginPath()
        ctx.moveTo(pA.projX, pA.projY)
        ctx.lineTo(pB.projX, pB.projY)

        const avgDepth = (pA.depthFactor + pB.depthFactor) / 2

        if (isHoveredEdge || isSelectedEdge) {
          // Connessione attiva evidenziata
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 2.4
          ctx.setLineDash([])
          ctx.stroke()
        } else if (edge.type === 'semantic_bridge') {
          // Ponte sinaptico semantico tra materie/documenti diversi (tratteggiato cosmico)
          ctx.strokeStyle = `rgba(17, 24, 39, ${0.65 * avgDepth})`
          ctx.lineWidth = 1.4
          ctx.setLineDash([3, 4])
          ctx.stroke()
          ctx.setLineDash([])
        } else if (edge.type === 'hub_to_doc') {
          // Connessione da corso a documento
          ctx.strokeStyle = `rgba(113, 113, 122, ${0.45 * avgDepth})`
          ctx.lineWidth = 1.2
          ctx.setLineDash([])
          ctx.stroke()
        } else {
          // Filamento sequenziale tra frammenti
          ctx.strokeStyle = `rgba(161, 161, 170, ${0.35 * avgDepth})`
          ctx.lineWidth = 0.8
          ctx.setLineDash([])
          ctx.stroke()
        }
      })

      // 4. Ordina i nodi per profondità Z (dal più lontano al più vicino)
      const sorted = [...projected]
        .filter(p => p.visible)
        .sort((a, b) => b.depth - a.depth)

      // 5. Disegna Nodi (Macro-Hub, Sub-Hub, Satelliti)
      sorted.forEach(({ node, projX, projY, scale, depthFactor, highlighted }) => {
        const isHovered = hoveredNode?.id === node.id
        const isSelected = selectedNode?.id === node.id
        const isParentOfSelected = selectedNode?.documentId === node.documentId || selectedNode?.courseId === node.courseId

        const baseSize = node.radius * scale
        const renderSize = isHovered || isSelected ? baseSize * 1.5 : baseSize
        const half = renderSize / 2

        const opacity = hasActiveSearch && !highlighted ? 0.2 : depthFactor

        ctx.globalAlpha = opacity

        // A. NODO MACRO-HUB CORSO ("Stella Madre")
        if (node.type === 'course_hub') {
          // Alone orbitale
          ctx.beginPath()
          ctx.arc(projX, projY, renderSize * 1.3, 0, Math.PI * 2)
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 1.5
          ctx.stroke()

          // Nucleo centrale a diamante/quadrato inclinato
          ctx.save()
          ctx.translate(projX, projY)
          ctx.rotate(Math.PI / 4)
          ctx.fillStyle = '#000000'
          ctx.fillRect(-half, -half, renderSize, renderSize)
          // Punto luce centrale
          ctx.fillStyle = '#ffffff'
          const coreDot = Math.max(2, renderSize * 0.35)
          ctx.fillRect(-coreDot / 2, -coreDot / 2, coreDot, coreDot)
          ctx.restore()

          // ETICHETTA 3D FLUTTUANTE (Visibile solo se hovered o selected)
          if (isHovered || isSelected) {
            ctx.save()
            const labelText = `${node.title.toUpperCase()} · ${node.chunksCount} CHUNKS`
            ctx.font = 'bold 10px monospace'
            const textMetrics = ctx.measureText(labelText)
            const padX = 7
            const labelWidth = textMetrics.width + padX * 2
            const labelHeight = 18

            // Linea guida dal nodo all'etichetta
            ctx.beginPath()
            ctx.moveTo(projX, projY - half - 2)
            ctx.lineTo(projX, projY - 18)
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 1
            ctx.stroke()

            // Badge etichetta
            ctx.fillStyle = '#000000'
            ctx.fillRect(projX - labelWidth / 2, projY - 26, labelWidth, labelHeight)
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 1.2
            ctx.strokeRect(projX - labelWidth / 2, projY - 26, labelWidth, labelHeight)

            ctx.fillStyle = '#ffffff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(labelText, projX, projY - 17)
            ctx.restore()
          }
        } 
        // B. NODO SUB-HUB DOCUMENTO ("Pianeta")
        else if (node.type === 'doc_hub') {
          ctx.beginPath()
          ctx.arc(projX, projY, renderSize / 2, 0, Math.PI * 2)
          ctx.fillStyle = isHovered || isSelected ? '#000000' : isParentOfSelected ? '#27272a' : '#52525b'
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.2
          ctx.stroke()

          // Piccolo cerchio orbitale esterno
          ctx.beginPath()
          ctx.arc(projX, projY, renderSize * 0.8, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
          ctx.lineWidth = 0.8
          ctx.stroke()
        } 
        // C. NODO SATELLITE CHUNK ("Frammento di Conoscenza")
        else {
          if (isHovered || isSelected) {
            ctx.fillStyle = '#000000'
            ctx.fillRect(projX - half, projY - half, renderSize, renderSize)
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1
            ctx.strokeRect(projX - half, projY - half, renderSize, renderSize)
          } else if (highlighted && hasActiveSearch) {
            // Risultato ricerca: nodo ingrandito e pulsante
            ctx.fillStyle = '#000000'
            ctx.fillRect(projX - half * 1.3, projY - half * 1.3, renderSize * 1.3, renderSize * 1.3)
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 1.5
            ctx.strokeRect(projX - half * 1.6, projY - half * 1.6, renderSize * 1.6, renderSize * 1.6)
          } else {
            // Frammento standard
            ctx.fillStyle = '#71717a'
            ctx.fillRect(projX - half, projY - half, renderSize, renderSize)
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 0.8
            ctx.strokeRect(projX - half, projY - half, renderSize, renderSize)
          }
        }

        ctx.globalAlpha = 1.0
      })

      ctx.restore()
      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [autoRotate, zoom, hoveredNode, selectedNode, selectedCourseFilter])

  // ZOOM MOUSE WHEEL (con isolamento dallo scroll della pagina)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const factor = e.deltaY < 0 ? 1.09 : 0.91
      setZoom(prev => Math.max(0.4, Math.min(4.2, prev * factor)))
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleNativeWheel)
    }
  }, [])

  // GESTIONE TOUCH PINCH ZOOM & ROTAZIONE MOBILE
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      pinchDistRef.current = dist
    } else if (e.touches.length === 1) {
      isDraggingRef.current = true
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const ratio = dist / pinchDistRef.current
      setZoom(prev => Math.max(0.4, Math.min(4.2, prev * ratio)))
      pinchDistRef.current = dist
    } else if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - lastMousePosRef.current.x
      const dy = e.touches[0].clientY - lastMousePosRef.current.y
      rotationRef.current.y += dx * 0.007
      rotationRef.current.x -= dy * 0.007
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchEnd = () => {
    isDraggingRef.current = false
    pinchDistRef.current = null
  }

  // GESTIONE MOUSE ROTAZIONE ORBITALE
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true
    lastMousePosRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x
      const dy = e.clientY - lastMousePosRef.current.y
      rotationRef.current.y += dx * 0.007
      rotationRef.current.x -= dy * 0.007
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }
      return
    }

    // Raycasting sul nodo più vicino
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const cosX = Math.cos(rotationRef.current.x)
    const sinX = Math.sin(rotationRef.current.x)
    const cosY = Math.cos(rotationRef.current.y)
    const sinY = Math.sin(rotationRef.current.y)
    const fov = 380

    let closest: ConstellationNode | null = null
    let minDistance = 22

    nodesRef.current.forEach(node => {
      if (selectedCourseFilter !== 'all' && node.courseId !== selectedCourseFilter) return

      let x1 = node.x * cosY - node.z * sinY
      let z1 = node.z * cosY + node.x * sinY
      let y2 = node.y * cosX - z1 * sinX
      let z2 = z1 * cosX + node.y * sinX

      const scale = (fov * zoom) / (fov + z2 + 380)
      const px = rect.width / 2 + x1 * scale
      const py = rect.height / 2 + y2 * scale

      const dist = Math.hypot(mouseX - px, mouseY - py)
      if (dist < minDistance) {
        minDistance = dist
        closest = node
      }
    })

    setHoveredNode(closest)
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  const handleClick = () => {
    if (hoveredNode) {
      setSelectedNode(prev => prev?.id === hoveredNode.id ? null : hoveredNode)
    } else {
      setSelectedNode(null)
    }
  }

  const activeInspectNode = hoveredNode || selectedNode

  return (
    <div 
      ref={containerRef}
      style={{ overscrollBehavior: 'contain' }}
      className="border border-black bg-white relative overflow-hidden flex flex-col h-[340px] sm:h-[500px] select-none font-mono"
    >
      {/* 1. HUD TOP BAR: Titolo, Ricerca Rapida e Filtro Costellazione */}
      <div className="min-h-10 border-b border-black bg-white flex flex-wrap items-center justify-between px-3 py-1 text-[11px] shrink-0 z-10 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-black inline-block animate-pulse" />
          <span className="font-bold tracking-wider uppercase text-black">
            Costellazione Semantica // AI Knowledge
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Barra di ricerca nei nodi della mente */}
          <div className="flex items-center border border-black px-2 py-0.5 bg-zinc-50 text-[11px]">
            <Search className="w-3 h-3 text-zinc-500 mr-1.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca concetto..."
              className="bg-transparent text-black outline-none w-24 sm:w-32 text-[11px] placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-black ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtro Selettore Corso / Costellazione */}
          {courseOptions.length > 1 && (
            <div className="flex items-center border border-black px-2 py-0.5 bg-white text-[11px]">
              <Compass className="w-3 h-3 text-black mr-1 shrink-0" />
              <select
                value={selectedCourseFilter}
                onChange={e => setSelectedCourseFilter(e.target.value)}
                className="bg-transparent text-black font-bold outline-none cursor-pointer pr-1 max-w-[120px] truncate"
              >
                <option value="all">Tutte le Materie</option>
                {courseOptions.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* KPI Badge */}
          <div className="hidden sm:flex items-center gap-2 text-zinc-600">
            <span className="border border-zinc-300 px-1.5 py-0.5 bg-zinc-50">
              Corsi: <strong className="text-black">{courseOptions.length}</strong>
            </span>
            <span className="border border-zinc-300 px-1.5 py-0.5 bg-zinc-50">
              Doc: <strong className="text-black">{docCount}</strong>
            </span>
            <span className="border border-black px-1.5 py-0.5 bg-black text-white font-bold">
              {nodesRef.current.length} Nodi
            </span>
          </div>
        </div>
      </div>

      {/* 2. AREA CANVAS 3D */}
      <div 
        style={{ overscrollBehavior: 'contain' }}
        className="flex-1 relative cursor-grab active:cursor-grabbing bg-zinc-50/50 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          className="w-full h-full block touch-none"
        />

        {/* HUD Controls Bottom Left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={() => setAutoRotate(prev => !prev)}
            className={`px-2.5 py-1 border border-black text-[11px] font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] ${
              autoRotate ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
            }`}
            title="Attiva/Disattiva rotazione automatica"
          >
            ORBIT: {autoRotate ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setZoom(z => Math.min(4.2, z * 1.25))}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Zoom Avanti"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.4, z * 0.8))}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Zoom Indietro"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              rotationRef.current = { x: 0.22, y: 0.40 }
              setZoom(2.2)
              setSelectedCourseFilter('all')
              setSearchQuery('')
            }}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Ripristina Vista Globale"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tooltip / Inspector HUD Card in Alto a Destra */}
        {activeInspectNode && (
          <div className="absolute top-3 right-3 max-w-xs sm:max-w-sm bg-white border-2 border-black p-3.5 shadow-[5px_5px_0px_rgba(0,0,0,1)] z-20 animate-in fade-in duration-100 text-xs">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-200 pb-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] bg-black text-white px-1.5 py-0.5 uppercase font-bold tracking-widest block w-max">
                    {activeInspectNode.type === 'course_hub' ? '★ MACRO-TOPIC' : activeInspectNode.type === 'doc_hub' ? '● DOCUMENTO' : `CHUNK #${(activeInspectNode.chunkIndex || 0) + 1}`}
                  </span>
                  {activeInspectNode.courseName && (
                    <span className="text-[9px] border border-black px-1.5 py-0.5 text-zinc-700 truncate max-w-[120px]">
                      {activeInspectNode.courseName}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-[13px] text-black truncate">
                  {activeInspectNode.title}
                </h4>
                {activeInspectNode.subtitle && (
                  <p className="text-[10px] text-zinc-500 truncate">
                    {activeInspectNode.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Contenuto o Statistiche in base al tipo di nodo */}
            {activeInspectNode.type === 'course_hub' ? (
              <div className="space-y-1.5 text-[11px] text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 p-2">
                <div className="flex justify-between">
                  <span>Documenti associati:</span>
                  <strong className="text-black">{activeInspectNode.docsCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Frammenti vettoriali:</span>
                  <strong className="text-black">{activeInspectNode.chunksCount}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCourseFilter(activeInspectNode.courseId)}
                  className="w-full mt-2 border border-black bg-black text-white py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
                >
                  Isola questa Materia
                </button>
              </div>
            ) : activeInspectNode.type === 'doc_hub' ? (
              <div className="space-y-1 text-[11px] text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 p-2">
                <div className="flex justify-between">
                  <span>Frammenti RAG estratti:</span>
                  <strong className="text-black">{activeInspectNode.chunksCount}</strong>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  I frammenti gravitano attorno a questo documento e formano la catena di lettura.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-[11px] text-zinc-700 leading-relaxed font-sans line-clamp-4 bg-zinc-50 border border-zinc-200 p-2 mb-2">
                  &quot;{activeInspectNode.content}&quot;
                </div>
                {activeInspectNode.keywords && activeInspectNode.keywords.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-zinc-400 uppercase font-mono">Chiavi:</span>
                    {activeInspectNode.keywords.map((kw, i) => (
                      <span key={i} className="text-[9px] bg-zinc-100 border border-zinc-300 px-1 py-0.2 text-zinc-700">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State se non ci sono vettori */}
        {(!chunks || chunks.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/95">
            <Layers className="w-10 h-10 text-zinc-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-black uppercase mb-1">Nessun Vettore Generato</p>
            <p className="text-xs text-zinc-500 max-w-sm font-sans mb-3">
              Carica dispense o video YouTube per generare la costellazione della conoscenza dell&apos;IA.
            </p>
          </div>
        )}
      </div>

      {/* 3. HUD BOTTOM STATUS BAR */}
      <div className="h-7 border-t border-black bg-zinc-50 flex items-center justify-between px-3 text-[10px] text-zinc-600">
        <span>Trascina per ruotare · Rotellina/Pinch per zoomare</span>
        <span className="hidden sm:inline">Clicca un Macro-Topic o un frammento per ispezionare</span>
      </div>
    </div>
  )
}
