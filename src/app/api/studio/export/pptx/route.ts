import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import pptxgen from 'pptxgenjs'
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

    const pres = new pptxgen()

    // Formato widescreen standard 16:9
    pres.layout = 'LAYOUT_16x9'
    pres.author = 'Studio'
    pres.title = title || 'Presentazione Didattica'

    const slides = content?.slides || []

    for (let i = 0; i < slides.length; i++) {
      const s = slides[i]
      const slide = pres.addSlide()

      const isInverted = s.inverted || (s.layout === 'title' && i === 0)

      // Colore di sfondo
      slide.background = { color: isInverted ? '000000' : 'FFFFFF' }

      // Note per il relatore (compatibili con PowerPoint e Google Slides)
      if (s.notes) {
        slide.addNotes(s.notes)
      }

      // Top running indicator
      slide.addText(
        `${courseName ? courseName.toUpperCase() + '  //  ' : ''}SLIDE ${i + 1}/${slides.length}`,
        {
          x: 0.8,
          y: 0.35,
          w: 11.5,
          h: 0.3,
          fontSize: 9,
          fontFace: 'Arial',
          color: isInverted ? '888888' : '666666',
          bold: true,
        }
      )

      // Layout 1: TITOLO
      if (s.layout === 'title') {
        slide.addText((s.title || 'TITOLO').toUpperCase(), {
          x: 1.0,
          y: 2.1,
          w: 11.3,
          h: 2.2,
          fontSize: 38,
          fontFace: 'Arial',
          color: isInverted ? 'FFFFFF' : '000000',
          bold: true,
          align: 'center',
        })

        if (s.subtitle) {
          slide.addText(s.subtitle, {
            x: 1.5,
            y: 4.4,
            w: 10.3,
            h: 1.0,
            fontSize: 18,
            fontFace: 'Arial',
            color: isInverted ? 'CCCCCC' : '444444',
            align: 'center',
          })
        }

        // Linea d'accento brutalista
        slide.addShape(pres.ShapeType.rect, {
          x: 5.66,
          y: 5.4,
          w: 2.0,
          h: 0.05,
          fill: { color: isInverted ? 'FFFFFF' : '000000' },
          line: { color: isInverted ? 'FFFFFF' : '000000' },
        })

      } else if (s.layout === 'formula') {
        // Layout 2: FORMULA IN EVIDENZA
        slide.addText((s.title || '').toUpperCase(), {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 24,
          fontFace: 'Arial',
          color: isInverted ? 'FFFFFF' : '000000',
          bold: true,
        })

        // Riquadro formula con formula pulita formattata
        const readableFormula = formatLatexToReadableMath(s.formula || '')
        slide.addText(readableFormula, {
          x: 1.2,
          y: 1.9,
          w: 10.8,
          h: 1.8,
          fontSize: 24,
          fontFace: 'Cambria Math',
          color: isInverted ? 'FFFFFF' : '000000',
          bold: true,
          align: 'center',
          fill: { color: isInverted ? '1A1A1A' : 'F5F5F7' },
          line: { color: isInverted ? '444444' : '000000', width: 1.5 },
        })

        // Spiegazioni o condizioni sotto la formula
        if (s.bullets && s.bullets.length > 0) {
          const bulletObjects = s.bullets.map(b => {
            const cleanBullet = b.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
            return {
              text: cleanBullet,
              options: {
                fontSize: 15,
                fontFace: 'Arial',
                color: isInverted ? 'E0E0E0' : '222222',
                bullet: true,
                breakLine: true,
              },
            }
          })

          slide.addText(bulletObjects as any, {
            x: 1.2,
            y: 4.0,
            w: 10.8,
            h: 2.6,
          })
        }

      } else if (s.layout === 'columns') {
        // Layout 3: COLONNE COMPARATIVE
        slide.addText((s.title || '').toUpperCase(), {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 24,
          fontFace: 'Arial',
          color: isInverted ? 'FFFFFF' : '000000',
          bold: true,
        })

        const leftClean = (s.leftColumn || '').replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
        const rightClean = (s.rightColumn || '').replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)

        // Colonna Sinistra
        slide.addText(leftClean, {
          x: 0.8,
          y: 1.8,
          w: 5.6,
          h: 4.8,
          fontSize: 14,
          fontFace: 'Arial',
          color: isInverted ? 'E0E0E0' : '111111',
          fill: { color: isInverted ? '151515' : 'FBFBFB' },
          line: { color: isInverted ? '333333' : '000000', width: 1 },
          margin: 0.25,
        })

        // Colonna Destra
        slide.addText(rightClean, {
          x: 6.8,
          y: 1.8,
          w: 5.6,
          h: 4.8,
          fontSize: 14,
          fontFace: 'Arial',
          color: isInverted ? 'E0E0E0' : '111111',
          fill: { color: isInverted ? '151515' : 'FBFBFB' },
          line: { color: isInverted ? '333333' : '000000', width: 1 },
          margin: 0.25,
        })

      } else {
        // Layout 4: BULLETS (Default) o CODE
        slide.addText((s.title || '').toUpperCase(), {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 24,
          fontFace: 'Arial',
          color: isInverted ? 'FFFFFF' : '000000',
          bold: true,
        })

        if (s.bullets && s.bullets.length > 0) {
          const bulletObjects = s.bullets.map(b => {
            const clean = b.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
            return {
              text: clean,
              options: {
                fontSize: 16,
                fontFace: 'Arial',
                color: isInverted ? 'E0E0E0' : '222222',
                bullet: true,
                breakLine: true,
              },
            }
          })

          slide.addText(bulletObjects as any, {
            x: 0.8,
            y: 1.9,
            w: 11.5,
            h: 4.8,
          })
        } else if (s.code) {
          slide.addText(s.code, {
            x: 0.8,
            y: 1.9,
            w: 11.5,
            h: 4.8,
            fontSize: 13,
            fontFace: 'Courier New',
            color: isInverted ? 'FFFFFF' : '000000',
            fill: { color: isInverted ? '1A1A1A' : 'F5F5F7' },
            line: { color: isInverted ? '333333' : '000000', width: 1 },
            margin: 0.2,
          })
        }
      }
    }

    const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer
    const sanitizedTitle = (title || 'presentazione').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.pptx"`,
      },
    })
  } catch (err: any) {
    console.error("Errore generazione server PPTX:", err)
    return new Response(JSON.stringify({ error: err.message || "Errore export PPTX" }), { status: 500 })
  }
}
