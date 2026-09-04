import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { DocumentContent } from '@/app/(dashboard)/studio/actions'
import { formatLatexToReadableMath } from '@/lib/studio/math-converter'

export async function POST(req: NextRequest) {
  try {
    // 1. Controllo Autenticazione Utente
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Accesso non autorizzato. Effettua il login." }, { status: 401 })
    }

    // 2. Controllo DoS su dimensione payload (max 5MB)
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Dimensione payload eccessiva (max 5MB)." }, { status: 413 })
    }

    const { title, content, courseName }: { title: string; content: DocumentContent; courseName?: string } = await req.json()

    const pdfDoc = await PDFDocument.create()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold)

    const [pageWidth, pageHeight] = PageSizes.A4 // 595.28 x 841.89
    const margin = 50
    const contentWidth = pageWidth - margin * 2 // ~495.28

    let currentPage = pdfDoc.addPage(PageSizes.A4)
    let y = pageHeight - margin

    const checkNewPage = (neededHeight: number) => {
      if (y - neededHeight < margin + 40) {
        currentPage = pdfDoc.addPage(PageSizes.A4)
        y = pageHeight - margin
        // Header pagina successiva
        drawRunningHeader()
      }
    }

    const drawRunningHeader = () => {
      currentPage.drawText(
        `${(courseName || 'STUDYCLOUD').toUpperCase()}  //  DISPENSA DIDATTICA`,
        { x: margin, y: pageHeight - 35, size: 8, font: fontMono, color: rgb(0.4, 0.4, 0.4) }
      )
      currentPage.drawLine({
        start: { x: margin, y: pageHeight - 42 },
        end: { x: pageWidth - margin, y: pageHeight - 42 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
      y = pageHeight - 65
    }

    const wrapText = (text: string, maxWidth: number, font: any, fontSize: number): string[] => {
      const words = text.split(/\s+/)
      const lines: string[] = []
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)
        if (textWidth <= maxWidth) {
          currentLine = testLine
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines
    }

    // 1. Intestazione Prima Pagina
    currentPage.drawText(
      `${(courseName || 'STUDYCLOUD').toUpperCase()}  //  DOCUMENTO DIDATTICO ACCADEMICO`,
      { x: margin, y, size: 8.5, font: fontMono, color: rgb(0.3, 0.3, 0.3) }
    )
    y -= 20

    // Titolo Documento
    const titleLines = wrapText((title || 'DOCUMENTO').toUpperCase(), contentWidth, fontBold, 18)
    for (const tLine of titleLines) {
      currentPage.drawText(tLine, { x: margin, y, size: 18, font: fontBold, color: rgb(0, 0, 0) })
      y -= 24
    }

    // Linea divisoria spessa brutalista
    y -= 5
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1.5,
      color: rgb(0, 0, 0),
    })
    y -= 25

    // 2. Abstract se presente
    if (content?.abstract) {
      const abstractLines = wrapText(content.abstract, contentWidth - 25, fontItalic, 9.5)
      const boxHeight = abstractLines.length * 14 + 20

      checkNewPage(boxHeight + 20)

      // Riquadro grigio con bordo sinistro nero spesso
      currentPage.drawRectangle({
        x: margin,
        y: y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: rgb(0.96, 0.96, 0.96),
      })
      currentPage.drawLine({
        start: { x: margin, y },
        end: { x: margin, y: y - boxHeight },
        thickness: 3,
        color: rgb(0, 0, 0),
      })

      let textY = y - 16
      currentPage.drawText('ABSTRACT:', { x: margin + 12, y: textY, size: 8.5, font: fontBold, color: rgb(0, 0, 0) })
      textY -= 14

      for (const aLine of abstractLines) {
        currentPage.drawText(aLine, { x: margin + 12, y: textY, size: 9.5, font: fontItalic, color: rgb(0.15, 0.15, 0.15) })
        textY -= 14
      }

      y = y - boxHeight - 25
    }

    // 3. Elaborazione Sezioni del Documento
    const renderSectionBlocks = (title: string, bodyText: string, keyPoints?: string[]) => {
      // Titolo Sezione H2
      checkNewPage(45)
      currentPage.drawText(title.toUpperCase(), { x: margin, y, size: 12, font: fontBold, color: rgb(0, 0, 0) })
      y -= 6
      currentPage.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.8,
        color: rgb(0.2, 0.2, 0.2),
      })
      y -= 18

      // Paragrafi del contenuto
      const lines = bodyText.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Formula isolata ($$...$$)
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
          const readableMath = formatLatexToReadableMath(trimmed)
          checkNewPage(50)

          const boxH = 34
          currentPage.drawRectangle({
            x: margin,
            y: y - boxH,
            width: contentWidth,
            height: boxH,
            color: rgb(0.97, 0.97, 0.97),
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
          })

          const mathW = fontMono.widthOfTextAtSize(readableMath, 11)
          const mathX = Math.max(margin + 15, margin + (contentWidth - mathW) / 2)
          currentPage.drawText(readableMath, {
            x: mathX,
            y: y - boxH / 2 - 4,
            size: 11,
            font: fontMono,
            color: rgb(0, 0, 0),
          })

          y = y - boxH - 16
          continue
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-*]\s+/, '')
          const mathClean = itemText.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
          const bulletLines = wrapText(mathClean, contentWidth - 25, fontRegular, 9.5)

          checkNewPage(bulletLines.length * 14 + 6)

          // Disegna pallino quadrato brutalista
          currentPage.drawRectangle({
            x: margin + 4,
            y: y - 8,
            width: 4,
            height: 4,
            color: rgb(0, 0, 0),
          })

          for (let bIdx = 0; bIdx < bulletLines.length; bIdx++) {
            currentPage.drawText(bulletLines[bIdx], {
              x: margin + 18,
              y: y - 10,
              size: 9.5,
              font: fontRegular,
              color: rgb(0.1, 0.1, 0.1),
            })
            y -= 14
          }
          continue
        }

        // Paragrafo normale con formule inline
        const mathClean = trimmed.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
        const wrappedParagraph = wrapText(mathClean, contentWidth, fontRegular, 9.5)

        checkNewPage(wrappedParagraph.length * 14 + 8)

        for (const pLine of wrappedParagraph) {
          currentPage.drawText(pLine, {
            x: margin,
            y,
            size: 9.5,
            font: fontRegular,
            color: rgb(0.1, 0.1, 0.1),
          })
          y -= 14
        }
        y -= 6
      }

      // Punti chiave della sezione
      if (keyPoints && keyPoints.length > 0) {
        checkNewPage(keyPoints.length * 16 + 30)
        y -= 6
        currentPage.drawText("PUNTI CHIAVE D'ESAME:", { x: margin, y, size: 8.5, font: fontBold, color: rgb(0, 0, 0) })
        y -= 14

        for (const kp of keyPoints) {
          const kpLines = wrapText(kp, contentWidth - 25, fontRegular, 9)
          checkNewPage(kpLines.length * 13 + 4)

          currentPage.drawRectangle({ x: margin + 4, y: y - 7, width: 3.5, height: 3.5, color: rgb(0, 0, 0) })
          for (const kLine of kpLines) {
            currentPage.drawText(kLine, { x: margin + 16, y: y - 8, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) })
            y -= 13
          }
        }
        y -= 10
      }

      y -= 15
    }

    if (content?.sections && content.sections.length > 0) {
      for (const s of content.sections) {
        renderSectionBlocks(s.title, s.content, s.keyPoints)
      }
    } else if (content?.markdown) {
      renderSectionBlocks('Trattazione', content.markdown)
    }

    // 4. Glossario
    if (content?.glossary && content.glossary.length > 0) {
      checkNewPage(60)
      currentPage.drawText('GLOSSARIO DEI TERMINI ACCADEMICI', { x: margin, y, size: 12, font: fontBold, color: rgb(0, 0, 0) })
      y -= 6
      currentPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.8, color: rgb(0, 0, 0) })
      y -= 18

      for (const g of content.glossary) {
        const termLine = `${g.term}: ${g.definition}`
        const wrappedG = wrapText(termLine, contentWidth - 15, fontRegular, 9)
        checkNewPage(wrappedG.length * 13 + 8)

        currentPage.drawText(`${g.term}: `, { x: margin, y, size: 9, font: fontBold, color: rgb(0, 0, 0) })
        const termWidth = fontBold.widthOfTextAtSize(`${g.term}: `, 9)
        
        // Prima riga
        const firstLineDef = wrapText(g.definition, contentWidth - termWidth, fontRegular, 9)
        if (firstLineDef.length > 0) {
          currentPage.drawText(firstLineDef[0], { x: margin + termWidth, y, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) })
          y -= 13
          for (let i = 1; i < firstLineDef.length; i++) {
            currentPage.drawText(firstLineDef[i], { x: margin + 15, y, size: 9, font: fontRegular, color: rgb(0.15, 0.15, 0.15) })
            y -= 13
          }
        }
        y -= 4
      }
    }

    // 5. Aggiunta piè di pagina con numerazione reale "Pagina X di Y" a tutte le pagine
    const totalPages = pdfDoc.getPageCount()
    const allPages = pdfDoc.getPages()
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const p = allPages[pIdx]
      p.drawLine({
        start: { x: margin, y: 38 },
        end: { x: pageWidth - margin, y: 38 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      })
      p.drawText(
        `${title || 'Dispensa'}  |  Pagina ${pIdx + 1} di ${totalPages}`,
        {
          x: pageWidth - margin - 140,
          y: 26,
          size: 8,
          font: fontRegular,
          color: rgb(0.4, 0.4, 0.4),
        }
      )
    }

    const pdfBytes = await pdfDoc.save()
    const sanitizedTitle = (title || 'dispensa').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error("Errore generazione PDF documento:", err)
    return new Response(JSON.stringify({ error: err.message || "Errore export PDF" }), { status: 500 })
  }
}
