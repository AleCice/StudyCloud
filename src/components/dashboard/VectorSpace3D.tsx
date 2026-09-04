'use client'

import React, { useRef, useEffect, useState, useMemo } from 'react'
import { RotateCw, ZoomIn, ZoomOut, Layers } from 'lucide-react'

export interface VectorNode {
  id: string
  documentId: string
  docTitle: string
  courseName?: string
  content: string
  chunkIndex: number
  // 3D coordinates in normalized space (-140 to 140)
  x: number
  y: number
  z: number
  clusterIndex: number
}

interface SynapseEdge {
  fromIndex: number
  toIndex: number
  weight: number
  isInterCluster: boolean
}

interface SignalPulse {
  edgeIndex: number
  progress: number // 0 to 1
  speed: number
  direction: 1 | -1
}

interface Props {
  chunks: Array<{
    id: string
    document_id: string
    content: string
    chunk_index: number
    docTitle?: string
    courseName?: string
  }>
  totalVectorsCount: number
}

export default function VectorSpace3D({ chunks, totalVectorsCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<VectorNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<VectorNode | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [zoom, setZoom] = useState(1.1)

  // Camera angles
  const rotationRef = useRef({ x: 0.25, y: 0.45 })
  const isDraggingRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })
  const pinchDistRef = useRef<number | null>(null)

  // Calcola numero di cluster reali
  const clusterCount = useMemo(() => {
    return new Set(chunks.map(c => c.document_id)).size
  }, [chunks])

  // Graph state in refs for 60fps render loop
  const nodesRef = useRef<VectorNode[]>([])
  const edgesRef = useRef<SynapseEdge[]>([])
  const signalsRef = useRef<SignalPulse[]>([])

  // Genera coordinate 3D della Rete Neurale e le Connessioni Sinaptiche
  useEffect(() => {
    if (!chunks || chunks.length === 0) {
      nodesRef.current = []
      edgesRef.current = []
      signalsRef.current = []
      return
    }

    // 1. Raggruppa per document_id
    const docMap = new Map<string, number>()
    let currentCluster = 0
    chunks.forEach(c => {
      if (!docMap.has(c.document_id)) {
        docMap.set(c.document_id, currentCluster++)
      }
    })

    const totalClusters = Math.max(1, docMap.size)
    const goldenRatio = (1 + Math.sqrt(5)) / 2

    // Calcola posizione 3D per ogni neurone
    const generatedNodes: VectorNode[] = chunks.map((c) => {
      const clusterIdx = docMap.get(c.document_id) || 0
      
      // Posizione centrale del cluster/strato
      const clusterPhi = Math.acos(1 - (2 * (clusterIdx + 0.5)) / totalClusters)
      const clusterTheta = (2 * Math.PI * (clusterIdx + 0.5)) / goldenRatio
      const clusterRadius = 135

      const cX = clusterRadius * Math.sin(clusterPhi) * Math.cos(clusterTheta)
      const cY = clusterRadius * Math.cos(clusterPhi) * 0.75
      const cZ = clusterRadius * Math.sin(clusterPhi) * Math.sin(clusterTheta)

      // Distribuzione locale dei neuroni all'interno del nucleo
      const localPhi = (c.chunk_index * 1.618) % Math.PI
      const localTheta = (c.chunk_index * 2.399) % (2 * Math.PI)
      const localRadius = 24 + (c.chunk_index % 6) * 8

      const x = cX + localRadius * Math.sin(localPhi) * Math.cos(localTheta)
      const y = cY + localRadius * Math.cos(localPhi)
      const z = cZ + localRadius * Math.sin(localPhi) * Math.sin(localTheta)

      return {
        id: c.id,
        documentId: c.document_id,
        docTitle: c.docTitle || 'Documento',
        courseName: c.courseName || 'Generale',
        content: c.content,
        chunkIndex: c.chunk_index,
        clusterIndex: clusterIdx,
        x,
        y,
        z
      }
    })

    nodesRef.current = generatedNodes

    // 2. Costruisci il Grafo Sinaptico (Rete Neurale Connessa)
    const edges: SynapseEdge[] = []
    const edgeSet = new Set<string>()

    const addEdge = (i: number, j: number, isInterCluster: boolean) => {
      if (i === j) return
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (edgeSet.has(key)) return
      edgeSet.add(key)

      const dist = Math.hypot(
        generatedNodes[i].x - generatedNodes[j].x,
        generatedNodes[i].y - generatedNodes[j].y,
        generatedNodes[i].z - generatedNodes[j].z
      )
      const weight = Math.max(0.2, Math.min(1, 120 / (dist + 1)))
      edges.push({ fromIndex: i, toIndex: j, weight, isInterCluster })
    }

    // A. Connessioni intra-cluster (neuroni dello stesso documento legati a stella/catena sequenziale e vicini)
    for (let i = 0; i < generatedNodes.length; i++) {
      const nA = generatedNodes[i]
      // Collega al successivo nel documento (catena di lettura)
      if (i + 1 < generatedNodes.length && generatedNodes[i + 1].documentId === nA.documentId) {
        addEdge(i, i + 1, false)
      }

      // Trova i 2 nodi più vicini nello stesso cluster
      const localNeighbors = generatedNodes
        .map((nB, idxB) => ({ idx: idxB, dist: Math.hypot(nA.x - nB.x, nA.y - nB.y, nA.z - nB.z), sameDoc: nB.documentId === nA.documentId }))
        .filter(item => item.idx !== i && item.sameDoc)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2)

      localNeighbors.forEach(nbr => addEdge(i, nbr.idx, false))
    }

    // B. Connessioni inter-cluster (ponti sinaptici tra argomenti/documenti differenti)
    for (let cA = 0; cA < totalClusters; cA++) {
      for (let cB = cA + 1; cB < totalClusters; cB++) {
        // Trova la coppia di nodi più vicina tra i due cluster
        let bestI = -1, bestJ = -1, minCrossDist = Infinity
        for (let i = 0; i < generatedNodes.length; i++) {
          if (generatedNodes[i].clusterIndex !== cA) continue
          for (let j = 0; j < generatedNodes.length; j++) {
            if (generatedNodes[j].clusterIndex !== cB) continue
            const d = Math.hypot(
              generatedNodes[i].x - generatedNodes[j].x,
              generatedNodes[i].y - generatedNodes[j].y,
              generatedNodes[i].z - generatedNodes[j].z
            )
            if (d < minCrossDist) {
              minCrossDist = d
              bestI = i
              bestJ = j
            }
          }
        }
        if (bestI !== -1 && bestJ !== -1) {
          addEdge(bestI, bestJ, true)
        }
      }
    }

    edgesRef.current = edges

    // 3. Inizializza impulsi di trasmissione dati (Action Potentials)
    const pulses: SignalPulse[] = []
    const pulseCount = Math.min(14, Math.max(4, edges.length))
    for (let p = 0; p < pulseCount; p++) {
      pulses.push({
        edgeIndex: Math.floor(Math.random() * edges.length),
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.008,
        direction: Math.random() > 0.5 ? 1 : -1
      })
    }
    signalsRef.current = pulses

  }, [chunks])

  // Canvas render loop ad alte prestazioni
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    const fov = 340 // Field of view

    const render = () => {
      if (autoRotate && !isDraggingRef.current) {
        rotationRef.current.y += 0.0025
        rotationRef.current.x += 0.0004
      }

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      // Background grid tecnica geometrica
      ctx.strokeStyle = '#f4f4f5'
      ctx.lineWidth = 1
      const gridSize = 40
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

      const nodes = nodesRef.current
      const edges = edgesRef.current
      const signals = signalsRef.current

      // Proietta nodi 3D -> 2D
      const projected = nodes.map((node, index) => {
        let x1 = node.x * cosY - node.z * sinY
        let z1 = node.z * cosY + node.x * sinY
        let y2 = node.y * cosX - z1 * sinX
        let z2 = z1 * cosX + node.y * sinX

        // Applicazione zoom focale
        const scale = (fov * zoom) / (fov + z2 + 320)
        const projX = width / 2 + x1 * scale
        const projY = height / 2 + y2 * scale

        return {
          index,
          node,
          projX,
          projY,
          scale,
          depth: z2
        }
      })

      // 1. Disegna le Sinapsi della Rete Neurale
      edges.forEach((edge, edgeIdx) => {
        const pA = projected[edge.fromIndex]
        const pB = projected[edge.toIndex]
        if (!pA || !pB) return

        const isHoveredEdge = 
          hoveredNode && (hoveredNode.id === pA.node.id || hoveredNode.id === pB.node.id)
        const isSelectedEdge = 
          selectedNode && (selectedNode.id === pA.node.id || selectedNode.id === pB.node.id)

        ctx.beginPath()
        ctx.moveTo(pA.projX, pA.projY)
        ctx.lineTo(pB.projX, pB.projY)

        if (isHoveredEdge || isSelectedEdge) {
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 2.2
          ctx.setLineDash([])
          ctx.stroke()
        } else if (edge.isInterCluster) {
          // Ponte inter-sinaptico tra cluster
          ctx.strokeStyle = 'rgba(161, 161, 170, 0.45)'
          ctx.lineWidth = 1
          ctx.setLineDash([3, 4])
          ctx.stroke()
          ctx.setLineDash([])
        } else {
          // Sinapsi standard intra-cluster
          const alpha = Math.max(0.18, Math.min(0.65, edge.weight * 0.7))
          ctx.strokeStyle = `rgba(39, 39, 42, ${alpha})`
          ctx.lineWidth = Math.max(0.7, 1.2 * ((pA.scale + pB.scale) / 2))
          ctx.setLineDash([])
          ctx.stroke()
        }
      })

      // 2. Disegna gli Impulsi Elettrici / Segnali Sinaptici
      signals.forEach((sig) => {
        sig.progress += sig.speed * sig.direction
        if (sig.progress > 1) {
          sig.progress = 0
          sig.edgeIndex = Math.floor(Math.random() * edges.length)
        } else if (sig.progress < 0) {
          sig.progress = 1
          sig.edgeIndex = Math.floor(Math.random() * edges.length)
        }

        const edge = edges[sig.edgeIndex]
        if (!edge) return
        const pA = projected[edge.fromIndex]
        const pB = projected[edge.toIndex]
        if (!pA || !pB) return

        // Posizione interpolata lungo la sinapsi
        const sigX = pA.projX + (pB.projX - pA.projX) * sig.progress
        const sigY = pA.projY + (pB.projY - pA.projY) * sig.progress

        // Disegna impulso come piccolo quadratino ad alta energia
        const pulseSize = 3
        ctx.fillStyle = '#000000'
        ctx.fillRect(sigX - pulseSize / 2, sigY - pulseSize / 2, pulseSize, pulseSize)
      })

      // 3. Ordina per profondità Z per resa corretta
      const sorted = [...projected].sort((a, b) => b.depth - a.depth)

      // 4. Disegna i Somi / Neuroni (Nodi Squadrati)
      sorted.forEach(({ node, projX, projY, scale }) => {
        const isHovered = hoveredNode?.id === node.id
        const isSelected = selectedNode?.id === node.id
        const isClusterActive = 
          hoveredNode?.documentId === node.documentId || selectedNode?.documentId === node.documentId

        const baseSize = Math.max(3.5, 7.5 * scale)
        const size = isHovered || isSelected ? baseSize * 2.2 : isClusterActive ? baseSize * 1.4 : baseSize
        const half = size / 2

        if (isHovered || isSelected) {
          // Bordo sinaptico esterno
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 2
          ctx.strokeRect(projX - half - 4, projY - half - 4, size + 8, size + 8)

          // Nucleo attivo pieno
          ctx.fillStyle = '#000000'
          ctx.fillRect(projX - half, projY - half, size, size)

          // Punto centrale bianco
          ctx.fillStyle = '#ffffff'
          const dot = Math.max(2, size * 0.3)
          ctx.fillRect(projX - dot / 2, projY - dot / 2, dot, dot)
        } else if (isClusterActive) {
          ctx.fillStyle = '#18181b'
          ctx.fillRect(projX - half, projY - half, size, size)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          ctx.strokeRect(projX - half, projY - half, size, size)
        } else {
          // Neurone a riposo nello spazio latente
          ctx.fillStyle = '#52525b'
          ctx.fillRect(projX - half, projY - half, size, size)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          ctx.strokeRect(projX - half, projY - half, size, size)
        }
      })

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [autoRotate, zoom, hoveredNode, selectedNode])

  // ZOOM MOUSE WHEEL - Gestisce lo zoom del canvas 3D e previene lo scroll del sito quando il cursore è dentro il componente
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNativeWheel = (e: WheelEvent) => {
      // PREVIENE LO SCROLL DELLA PAGINA DEL SITO QUANDO IL CURSORE È ALL'INTERNO DEL COMPONENTE
      e.preventDefault()
      e.stopPropagation()

      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91
      setZoom(prev => Math.max(0.35, Math.min(4.5, prev * zoomFactor)))
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleNativeWheel)
    }
  }, [])

  // TOUCH PINCH ZOOM (Smartphone & Tablet)
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
      setZoom(prev => Math.max(0.35, Math.min(4.5, prev * ratio)))
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

  // Gestione Mouse Drag per Rotazione 3D Orbitale
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

    // Raycasting sul nodo più vicino al cursore
    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width)
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height)

    const fov = 340
    const cosX = Math.cos(rotationRef.current.x)
    const sinX = Math.sin(rotationRef.current.x)
    const cosY = Math.cos(rotationRef.current.y)
    const sinY = Math.sin(rotationRef.current.y)

    let closest: VectorNode | null = null
    let minDistance = 16

    nodesRef.current.forEach(node => {
      let x1 = node.x * cosY - node.z * sinY
      let z1 = node.z * cosY + node.x * sinY
      let y2 = node.y * cosX - z1 * sinX
      let z2 = z1 * cosX + node.y * sinX

      const scale = (fov * zoom) / (fov + z2 + 320)
      const px = canvas.width / 2 + x1 * scale
      const py = canvas.height / 2 + y2 * scale

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

  // Dimensionamento reattivo del canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect && rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)

    const parent = canvas.parentElement
    let ro: ResizeObserver | null = null
    if (parent && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateSize)
      ro.observe(parent)
    }

    return () => {
      window.removeEventListener('resize', updateSize)
      ro?.disconnect()
    }
  }, [])

  return (
    <div 
      ref={containerRef} 
      style={{ overscrollBehavior: 'contain' }}
      className="border border-black bg-white relative overflow-hidden flex flex-col h-[500px] select-none font-mono"
    >
      {/* HUD Top Bar */}
      <div className="h-9 border-b border-black bg-white flex items-center justify-between px-3 text-[11px] shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-black inline-block animate-pulse" />
          <span className="font-bold tracking-wider uppercase text-black">
            Rete Neurale 3D
          </span>
        </div>
        <div className="flex items-center gap-3 text-zinc-600">
          <span className="border border-zinc-300 px-1.5 py-0.5 bg-zinc-50">
            Cluster: <strong className="text-black">{clusterCount}</strong>
          </span>
          <span className="hidden sm:inline border border-zinc-300 px-1.5 py-0.5 bg-zinc-50">
            Nodi: <strong className="text-black">{nodesRef.current.length}</strong>
          </span>
          <span className="hidden md:inline border border-zinc-300 px-1.5 py-0.5 bg-zinc-50">
            Connessioni: <strong className="text-black">{edgesRef.current.length}</strong>
          </span>
          <span className="border border-black px-1.5 py-0.5 bg-black text-white font-bold">
            ZOOM: {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas Area con Wheel Zoom nativo isolato e Drag */}
      <div 
        style={{ overscrollBehavior: 'contain' }}
        className="flex-1 relative cursor-grab active:cursor-grabbing bg-zinc-50/60 overflow-hidden"
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

        {/* HUD Controls - Pulsanti Geometrici Spigolosi */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={() => setAutoRotate(prev => !prev)}
            className={`px-2.5 py-1 border border-black text-[11px] font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] ${
              autoRotate ? 'bg-black text-white' : 'bg-white text-black hover:bg-zinc-100'
            }`}
            title="Attiva/disattiva rotazione automatica"
          >
            ORBIT: {autoRotate ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setZoom(z => Math.min(4.5, z * 1.25))}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Zoom Avanti"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.35, z * 0.8))}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Zoom Indietro"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              rotationRef.current = { x: 0.25, y: 0.45 }
              setZoom(1.1)
            }}
            className="p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Ripristina Vista e Zoom"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tooltip / Inspector HUD Card */}
        {(hoveredNode || selectedNode) && (
          <div className="absolute top-3 right-3 max-w-xs sm:max-w-sm bg-white border-2 border-black p-3.5 shadow-[5px_5px_0px_rgba(0,0,0,1)] z-20 animate-in fade-in duration-100 text-xs">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-200 pb-2 mb-2">
              <div className="min-w-0">
                <span className="text-[9px] bg-black text-white px-1.5 py-0.5 uppercase font-bold tracking-widest block w-max mb-1">
                  CHUNK #{((hoveredNode || selectedNode)?.chunkIndex || 0) + 1}
                </span>
                <h4 className="font-bold text-[13px] text-black truncate">
                  {(hoveredNode || selectedNode)?.docTitle}
                </h4>
                <p className="text-[10px] text-zinc-500 truncate">
                  {(hoveredNode || selectedNode)?.courseName}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-zinc-700 leading-relaxed font-sans line-clamp-4 bg-zinc-50 border border-zinc-200 p-2">
              &quot;{(hoveredNode || selectedNode)?.content}&quot;
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!chunks || chunks.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/90">
            <Layers className="w-10 h-10 text-zinc-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-black uppercase mb-1">Nessun Vettore Generato</p>
            <p className="text-xs text-zinc-500 max-w-sm font-sans mb-3">
              Carica un video YouTube o una dispensa per visualizzare la rete neurale.
            </p>
          </div>
        )}
      </div>

      {/* HUD Bottom Status bar */}
      <div className="h-7 border-t border-black bg-zinc-50 flex items-center justify-between px-3 text-[10px] text-zinc-600">
        <span>Trascina per ruotare · Rotellina per zoomare</span>
        <span className="hidden sm:inline">Clicca un nodo per i dettagli</span>
      </div>
    </div>
  )
}
