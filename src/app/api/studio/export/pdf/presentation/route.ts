import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { PresentationContent } from '@/app/(dashboard)/studio/actions'
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

    const { title, content, courseName }: { title: string; content: PresentationContent; courseName?: string } = await req.json()

    const pdfDoc = await PDFDocument.create()
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold)

    // Dimensioni widescreen 16:9 in punti
    const width = 960
    const height = 540

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

    const slides = content?.slides || []

    for (let i = 0; i < slides.length; i++) {
      const s = slides[i]
      const page = pdfDoc.addPage([width, height])
      const isInverted = s.inverted || (s.layout === 'title' && i === 0)

      const bgColor = isInverted ? rgb(0, 0, 0) : rgb(1, 1, 1)
      const textColor = isInverted ? rgb(1, 1, 1) : rgb(0, 0, 0)
      const subtleTextColor = isInverted ? rgb(0.75, 0.75, 0.75) : rgb(0.4, 0.4, 0.4)

      // Sfondo intera pagina
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: bgColor,
      })

      // Header della slide (non mostrato sulla copertina grande se titolo)
      if (s.layout !== 'title' || i > 0) {
        page.drawText(
          `${courseName ? courseName.toUpperCase() + '  //  ' : ''}SLIDE ${i + 1}/${slides.length}`,
          { x: 50, y: height - 40, size: 9, font: fontMono, color: subtleTextColor }
        )
        page.drawLine({
          start: { x: 50, y: height - 48 },
          end: { x: width - 50, y: height - 48 },
          thickness: 0.8,
          color: isInverted ? rgb(0.3, 0.3, 0.3) : rgb(0.85, 0.85, 0.85),
        })
      }

      // 1. Layout TITOLO
      if (s.layout === 'title') {
        const titleLines = wrapText((s.title || 'TITOLO').toUpperCase(), 800, fontBold, 30)
        let titleY = height / 2 + (titleLines.length * 18)

        for (const tLine of titleLines) {
          const tW = fontBold.widthOfTextAtSize(tLine, 30)
          page.drawText(tLine, {
            x: (width - tW) / 2,
            y: titleY,
            size: 30,
            font: fontBold,
            color: textColor,
          })
          titleY -= 38
        }

        if (s.subtitle) {
          const subLines = wrapText(s.subtitle, 700, fontRegular, 15)
          let subY = titleY - 10
          for (const sLine of subLines) {
            const sW = fontRegular.widthOfTextAtSize(sLine, 15)
            page.drawText(sLine, {
              x: (width - sW) / 2,
              y: subY,
              size: 15,
              font: fontRegular,
              color: subtleTextColor,
            })
            subY -= 20
          }
        }

        // Linea accentata centrale
        page.drawRectangle({
          x: (width - 100) / 2,
          y: 70,
          width: 100,
          height: 3,
          color: textColor,
        })

      } else if (s.layout === 'formula') {
        // 2. Layout FORMULA
        const titleLines = wrapText((s.title || '').toUpperCase(), 860, fontBold, 22)
        let tY = height - 85
        for (const t of titleLines) {
          page.drawText(t, { x: 50, y: tY, size: 22, font: fontBold, color: textColor })
          tY -= 28
        }

        // Box Formula grande
        const readableMath = formatLatexToReadableMath(s.formula || '')
        const boxW = 860
        const boxH = 90
        const boxY = tY - 105

        page.drawRectangle({
          x: 50,
          y: boxY,
          width: boxW,
          height: boxH,
          color: isInverted ? rgb(0.12, 0.12, 0.12) : rgb(0.96, 0.96, 0.96),
          borderColor: textColor,
          borderWidth: 1.5,
        })

        const mathW = fontMono.widthOfTextAtSize(readableMath, 20)
        page.drawText(readableMath, {
          x: Math.max(70, 50 + (boxW - mathW) / 2),
          y: boxY + boxH / 2 - 7,
          size: 20,
          font: fontMono,
          color: textColor,
        })

        // Bullets sotto la formula
        if (s.bullets && s.bullets.length > 0) {
          let bY = boxY - 35
          for (const bullet of s.bullets) {
            const clean = bullet.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
            const wrappedB = wrapText(clean, 820, fontRegular, 13)

            page.drawRectangle({ x: 55, y: bY - 6, width: 5, height: 5, color: textColor })
            for (const bLine of wrappedB) {
              page.drawText(bLine, { x: 70, y: bY - 8, size: 13, font: fontRegular, color: textColor })
              bY -= 19
            }
            bY -= 6
          }
        }

      } else if (s.layout === 'columns') {
        // 3. Layout COLONNE
        const titleLines = wrapText((s.title || '').toUpperCase(), 860, fontBold, 22)
        let tY = height - 85
        for (const t of titleLines) {
          page.drawText(t, { x: 50, y: tY, size: 22, font: fontBold, color: textColor })
          tY -= 28
        }

        const colW = 415
        const colH = 350
        const colY = 50

        // Colonna Sinistra
        page.drawRectangle({
          x: 50,
          y: colY,
          width: colW,
          height: colH,
          color: isInverted ? rgb(0.08, 0.08, 0.08) : rgb(0.98, 0.98, 0.98),
          borderColor: textColor,
          borderWidth: 1,
        })

        const leftClean = (s.leftColumn || '').replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
        const leftLines = wrapText(leftClean, colW - 30, fontRegular, 12)
        let lY = colY + colH - 30
        for (const line of leftLines) {
          page.drawText(line, { x: 65, y: lY, size: 12, font: fontRegular, color: textColor })
          lY -= 18
          if (lY < colY + 15) break
        }

        // Colonna Destra
        page.drawRectangle({
          x: 495,
          y: colY,
          width: colW,
          height: colH,
          color: isInverted ? rgb(0.08, 0.08, 0.08) : rgb(0.98, 0.98, 0.98),
          borderColor: textColor,
          borderWidth: 1,
        })

        const rightClean = (s.rightColumn || '').replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
        const rightLines = wrapText(rightClean, colW - 30, fontRegular, 12)
        let rY = colY + colH - 30
        for (const line of rightLines) {
          page.drawText(line, { x: 510, y: rY, size: 12, font: fontRegular, color: textColor })
          rY -= 18
          if (rY < colY + 15) break
        }

      } else {
        // 4. Layout BULLETS (Default)
        const titleLines = wrapText((s.title || '').toUpperCase(), 860, fontBold, 22)
        let tY = height - 85
        for (const t of titleLines) {
          page.drawText(t, { x: 50, y: tY, size: 22, font: fontBold, color: textColor })
          tY -= 28
        }

        let bY = tY - 25
        if (s.bullets && s.bullets.length > 0) {
          for (const bullet of s.bullets) {
            const clean = bullet.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
            const wrapped = wrapText(clean, 820, fontRegular, 14)

            page.drawRectangle({ x: 55, y: bY - 7, width: 6, height: 6, color: textColor })
            for (const line of wrapped) {
              page.drawText(line, { x: 72, y: bY - 9, size: 14, font: fontRegular, color: textColor })
              bY -= 22
            }
            bY -= 8
          }
        } else if (s.code) {
          page.drawRectangle({
            x: 50,
            y: 60,
            width: 860,
            height: 330,
            color: isInverted ? rgb(0.1, 0.1, 0.1) : rgb(0.96, 0.96, 0.96),
            borderColor: textColor,
            borderWidth: 1,
          })
          const codeLines = s.code.split('\n')
          let cY = 360
          for (const cLine of codeLines) {
            page.drawText(cLine, { x: 70, y: cY, size: 11, font: fontMono, color: textColor })
            cY -= 16
            if (cY < 70) break
          }
        }
      }
    }

    const pdfBytes = await pdfDoc.save()
    const sanitizedTitle = (title || 'presentazione').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error("Errore generazione PDF presentazione:", err)
    return new Response(JSON.stringify({ error: err.message || "Errore export PDF" }), { status: 500 })
  }
}
