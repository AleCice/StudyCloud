'use client'

import React, { useState } from 'react'
import { 
  Printer, Download, BookOpen, Layers, CheckSquare, 
  ListTree, FileText, ChevronRight, Copy, Check, FileDown, Loader2
} from 'lucide-react'
import { DocumentContent } from '@/app/(dashboard)/studio/actions'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { exportDocumentToMarkdown, exportDocumentToDocx } from '@/lib/studio/export'

interface Props {
  content: DocumentContent
  title: string
  courseName?: string
  subtype?: string
}

export default function DocumentViewer({ content, title, courseName, subtype }: Props) {
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'a4' | 'fluid'>('a4')
  const [exportingDocx, setExportingDocx] = useState(false)

  const handleMarkdownExport = () => {
    exportDocumentToMarkdown({ title, content })
  }

  const handleDocxExport = async () => {
    setExportingDocx(true)
    try {
      await exportDocumentToDocx({ title, content, courseName })
    } catch (err) {
      console.error("Errore esportazione DOCX:", err)
      alert("Errore durante la generazione del file DOCX.")
    } finally {
      setExportingDocx(false)
    }
  }

  const handleCopyMarkdown = () => {
    const text = content.markdown || ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="w-full flex flex-col space-y-4 font-sans text-black">
      {/* Action Header Bar (Nascosta durante la stampa PDF) */}
      <div className="print:hidden border border-black bg-white p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <span className="bg-black text-white px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]">
            {subtype ? subtype.toUpperCase() : 'DISPENSA'}
          </span>
          {courseName && (
            <span className="border border-black px-1.5 py-0.5 text-zinc-700 text-[11px] font-bold">
              {courseName}
            </span>
          )}
        </div>

        {/* Action Buttons: Esportazioni NATIVE Brutalist */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Toggle Vista A4 / Fluido */}
          <div className="hidden lg:flex items-center border border-black p-0.5 bg-zinc-100 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('a4')}
              className={`px-2 py-0.5 font-bold uppercase ${viewMode === 'a4' ? 'bg-black text-white' : 'hover:text-zinc-600'}`}
            >
              A4
            </button>
            <button
              type="button"
              onClick={() => setViewMode('fluid')}
              className={`px-2 py-0.5 font-bold uppercase ${viewMode === 'fluid' ? 'bg-black text-white' : 'hover:text-zinc-600'}`}
            >
              Fluido
            </button>
          </div>

          {/* Stampa / Salva in PDF Vettoriale */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-black bg-white hover:bg-black hover:text-white text-black font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Stampa o Salva in PDF vettoriale con testo selezionabile e formule nitide"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Stampa / PDF</span>
          </button>

          {/* Export Word (.docx) Nativo */}
          <button
            type="button"
            onClick={handleDocxExport}
            disabled={exportingDocx}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-black bg-white hover:bg-black hover:text-white text-black font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50"
            title="Scarica documento Word nativo (.docx) con stili brutalist e formattazione OpenXML"
          >
            {exportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            <span>.DOCX</span>
          </button>

          {/* Export Markdown (.md) */}
          <button
            type="button"
            onClick={handleMarkdownExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-black bg-white hover:bg-zinc-100 text-black font-bold uppercase transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
            title="Scarica file Markdown sorgente (.md)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.MD</span>
          </button>

          {/* Copia MD */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="p-1.5 border border-zinc-300 hover:border-black bg-white text-black transition-colors"
            title="Copia Markdown negli appunti"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Document Body (Print-optimized) */}
      <div className={`mx-auto w-full transition-all ${
        viewMode === 'a4' 
          ? 'max-w-4xl bg-white border-2 border-black p-6 sm:p-14 shadow-[8px_8px_0px_rgba(0,0,0,1)] print:border-none print:shadow-none print:p-0' 
          : 'max-w-5xl bg-white border border-black p-6 sm:p-8'
      }`}>
        {/* Document Header */}
        <header className="border-b-2 border-black pb-5 mb-6">
          <div className="flex items-center justify-between mb-2 text-xs font-mono">
            <span className="font-bold tracking-widest uppercase text-zinc-500">
              DOCUMENTO DIDATTICO // KNOWLEDGE BASE
            </span>
            <span className="text-zinc-500 uppercase font-bold">
              {courseName || 'Accademico'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black font-mono uppercase tracking-tight text-black leading-tight mb-2">
            {title}
          </h1>

          {content.abstract && (
            <div className="p-3 border border-black bg-zinc-50 text-xs sm:text-sm font-serif italic text-zinc-800 leading-relaxed mt-3">
              <strong>Abstract:</strong> {content.abstract}
            </div>
          )}
        </header>

        {/* Content Render: Sezioni o Markdown */}
        <article className="space-y-8 font-sans">
          {content.markdown ? (
            <div className="academic-prose">
              <MarkdownRenderer content={content.markdown} />
            </div>
          ) : (
            content.sections?.map((sec, idx) => (
              <section key={sec.id || idx} className="space-y-4 print:break-inside-avoid">
                <h2 className="text-lg sm:text-xl font-bold font-mono uppercase tracking-tight border-b border-black pb-1.5 text-black">
                  {sec.title}
                </h2>
                <div className="text-sm sm:text-base leading-relaxed text-zinc-900 font-serif">
                  <MarkdownRenderer content={sec.content} />
                </div>
                {sec.keyPoints && sec.keyPoints.length > 0 && (
                  <div className="border border-black p-3.5 bg-zinc-50 font-mono text-xs">
                    <span className="font-bold uppercase tracking-wider block mb-1.5 text-black">
                      Punti Chiave:
                    </span>
                    <ul className="space-y-1">
                      {sec.keyPoints.map((kp, kIdx) => (
                        <li key={kIdx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-black mt-1.5 shrink-0" />
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))
          )}

          {/* Glossario Finale se presente */}
          {content.glossary && content.glossary.length > 0 && (
            <section className="border-t-2 border-black pt-6 mt-10 print:break-inside-avoid">
              <h3 className="text-base font-bold font-mono uppercase tracking-tight mb-4">
                Glossario dei Termini Accademici
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {content.glossary.map((g, idx) => (
                  <div key={idx} className="border border-black p-2.5 bg-zinc-50">
                    <strong className="block text-black uppercase">{g.term}</strong>
                    <span className="text-zinc-600 font-sans text-[11px] leading-snug">{g.definition}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Document Print Footer */}
        <footer className="border-t border-black/30 pt-4 mt-12 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>Generato con StudyCloud Studio</span>
          <span>Design System Monocromatico // OpenXML Native</span>
        </footer>
      </div>
    </div>
  )
}
