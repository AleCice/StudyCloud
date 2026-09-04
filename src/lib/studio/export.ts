'use client'

import { DocumentContent, PresentationContent } from '@/app/(dashboard)/studio/actions'

/**
 * Esporta il documento didattico in formato Microsoft Word (.docx) nativo
 * delegando la generazione al backend Node.js
 */
export async function exportDocumentToDocx({
  title,
  content,
  courseName,
}: {
  title: string
  content: DocumentContent
  courseName?: string
}) {
  const response = await fetch('/api/studio/export/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, courseName }),
  })

  if (!response.ok) {
    throw new Error(`Errore durante l'esportazione DOCX: ${response.statusText}`)
  }

  const blob = await response.blob()
  const sanitizedTitle = (title || 'dispensa').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  downloadBlob(blob, `${sanitizedTitle}.docx`)
}

/**
 * Esporta il documento didattico in formato PDF A4 generato da zero con pdf-lib
 */
export async function exportDocumentToPdf({
  title,
  content,
  courseName,
}: {
  title: string
  content: DocumentContent
  courseName?: string
}) {
  const response = await fetch('/api/studio/export/pdf/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, courseName }),
  })

  if (!response.ok) {
    throw new Error(`Errore durante la generazione PDF: ${response.statusText}`)
  }

  const blob = await response.blob()
  const sanitizedTitle = (title || 'dispensa').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  downloadBlob(blob, `${sanitizedTitle}.pdf`)
}

/**
 * Esporta il documento in formato Markdown (.md) direttamente nel client
 */
export function exportDocumentToMarkdown({
  title,
  content,
}: {
  title: string
  content: DocumentContent
}) {
  let md = content.markdown
  if (!md) {
    md = `# ${title}\n\n`
    if (content.abstract) {
      md += `> ${content.abstract}\n\n---\n\n`
    }
    if (content.sections) {
      for (const s of content.sections) {
        md += `## ${s.title}\n\n${s.content}\n\n`
        if (s.keyPoints && s.keyPoints.length > 0) {
          md += `**Punti chiave:**\n`
          for (const kp of s.keyPoints) {
            md += `- ${kp}\n`
          }
          md += `\n`
        }
      }
    }
    if (content.glossary && content.glossary.length > 0) {
      md += `\n## Glossario\n\n`
      for (const g of content.glossary) {
        md += `- **${g.term}**: ${g.definition}\n`
      }
    }
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const sanitizedTitle = (title || 'dispensa').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  downloadBlob(blob, `${sanitizedTitle}.md`)
}

/**
 * Esporta la presentazione in formato Microsoft PowerPoint (.pptx) nativo
 * delegando la generazione al backend Node.js
 */
export async function exportPresentationToPptx({
  title,
  content,
  courseName,
}: {
  title: string
  content: PresentationContent
  courseName?: string
}) {
  const response = await fetch('/api/studio/export/pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, courseName }),
  })

  if (!response.ok) {
    throw new Error(`Errore durante l'esportazione PPTX: ${response.statusText}`)
  }

  const blob = await response.blob()
  const sanitizedTitle = (title || 'presentazione').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  downloadBlob(blob, `${sanitizedTitle}.pptx`)
}

/**
 * Esporta la presentazione in formato PDF 16:9 generato da zero con pdf-lib (1 pagina per slide)
 */
export async function exportPresentationToPdf({
  title,
  content,
  courseName,
}: {
  title: string
  content: PresentationContent
  courseName?: string
}) {
  const response = await fetch('/api/studio/export/pdf/presentation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, courseName }),
  })

  if (!response.ok) {
    throw new Error(`Errore durante la generazione PDF delle slide: ${response.statusText}`)
  }

  const blob = await response.blob()
  const sanitizedTitle = (title || 'presentazione').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  downloadBlob(blob, `${sanitizedTitle}.pdf`)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
