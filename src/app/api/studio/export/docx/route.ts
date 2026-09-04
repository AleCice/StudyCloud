import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  Table, TableRow, TableCell, WidthType, BorderStyle, 
  AlignmentType, Header, Footer, PageNumber 
} from 'docx'
import { DocumentContent } from '@/app/(dashboard)/studio/actions'
import { formatLatexToReadableMath } from '@/lib/studio/math-converter'

export async function POST(req: NextRequest) {
  try {
    // 1. Controllo Autenticazione Utente (Anti-Abuse / Rate Guardrail)
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

    const children: any[] = []

    // 1. Tag Corso & Intestazione Superiore
    if (courseName) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: courseName.toUpperCase() + ' // DISPENSA DIDATTICA',
              bold: true,
              size: 19, // ~9.5pt
              color: '555555',
              font: 'Arial',
            }),
          ],
          spacing: { after: 100 },
        })
      )
    }

    // 2. Titolo Monumentale del Documento
    children.push(
      new Paragraph({
        text: (title || 'DOCUMENTO').toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 160, before: 60 },
        children: [
          new TextRun({
            text: (title || 'DOCUMENTO').toUpperCase(),
            bold: true,
            size: 38, // 19pt
            font: 'Arial',
            color: '000000',
          }),
        ],
      })
    )

    // Separatore orizzontale spesso (stile brutalista)
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '_______________________________________________________________________________',
            color: '000000',
            bold: true,
            size: 16,
          }),
        ],
        spacing: { after: 260 },
      })
    )

    // 3. Abstract se presente (in riquadro formattato)
    if (content?.abstract) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.SINGLE, size: 24, color: '000000' },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: 'F7F7F7' },
                  margins: { top: 140, bottom: 140, left: 200, right: 140 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'ABSTRACT: ',
                          bold: true,
                          size: 20,
                          font: 'Arial',
                          color: '000000',
                        }),
                        new TextRun({
                          text: content.abstract,
                          italics: true,
                          size: 20,
                          font: 'Calibri',
                          color: '333333',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      )

      children.push(new Paragraph({ spacing: { after: 200 } }))
    }

    // Funzione helper per parsare testo con formule inline o isolate
    const createParagraphsForBlock = (text: string) => {
      const paras: any[] = []
      const lines = text.split('\n')

      for (let line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Formula isolata ($$...$$)
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
          const readableMath = formatLatexToReadableMath(trimmed)
          paras.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.SINGLE, size: 20, color: '000000' },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      shading: { fill: 'FAFAFA' },
                      margins: { top: 120, bottom: 120, left: 180, right: 120 },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: readableMath,
                              bold: true,
                              size: 24, // 12pt
                              font: 'Cambria Math',
                              color: '000000',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          )
          continue
        }

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-*]\s+/, '')
          const mathClean = itemText.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
          paras.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [
                new TextRun({
                  text: mathClean,
                  size: 22,
                  font: 'Calibri',
                  color: '222222',
                }),
              ],
              spacing: { after: 80 },
            })
          )
          continue
        }

        // Paragrafo normale con sostituzione formule inline $...$
        const mathClean = trimmed.replace(/\$([^\$]+)\$/g, (_, eq) => ` ${formatLatexToReadableMath(eq)} `)
        paras.push(
          new Paragraph({
            children: [
              new TextRun({
                text: mathClean,
                size: 22, // 11pt
                font: 'Calibri',
                color: '111111',
              }),
            ],
            spacing: { after: 120, line: 270 },
          })
        )
      }

      return paras
    }

    // 4. Sezioni Strutturate o Markdown
    if (content?.sections && content.sections.length > 0) {
      for (const sec of content.sections) {
        // Titolo sezione H2
        children.push(
          new Paragraph({
            text: sec.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 340, after: 120 },
            children: [
              new TextRun({
                text: sec.title.toUpperCase(),
                bold: true,
                size: 26, // 13pt
                font: 'Arial',
                color: '000000',
              }),
            ],
          })
        )

        // Contenuto sezione
        const blocks = createParagraphsForBlock(sec.content || '')
        children.push(...blocks)

        // Punti chiave
        if (sec.keyPoints && sec.keyPoints.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'PUNTI CHIAVE D\'ESAME:',
                  bold: true,
                  size: 19,
                  font: 'Arial',
                  color: '000000',
                }),
              ],
              spacing: { before: 140, after: 60 },
            })
          )
          for (const kp of sec.keyPoints) {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: kp,
                    bold: true,
                    size: 21,
                    font: 'Calibri',
                    color: '111111',
                  }),
                ],
                spacing: { after: 60 },
              })
            )
          }
        }
      }
    } else if (content?.markdown) {
      const blocks = createParagraphsForBlock(content.markdown)
      children.push(...blocks)
    }

    // 5. Glossario
    if (content?.glossary && content.glossary.length > 0) {
      children.push(
        new Paragraph({
          text: 'GLOSSARIO DEI TERMINI',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 140 },
          children: [
            new TextRun({
              text: 'GLOSSARIO DEI TERMINI',
              bold: true,
              size: 26,
              font: 'Arial',
              color: '000000',
            }),
          ],
        })
      )

      for (const g of content.glossary) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${g.term}: `,
                bold: true,
                size: 22,
                font: 'Arial',
                color: '000000',
              }),
              new TextRun({
                text: g.definition,
                size: 22,
                font: 'Calibri',
                color: '222222',
              }),
            ],
            spacing: { after: 90 },
          })
        )
      }
    }

    // 6. Costruzione Documento con Margini Accademici e Piè di Pagina (Pagina X di Y)
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `${title || 'Dispensa'}  |  Pagina `,
                      size: 18,
                      font: 'Arial',
                      color: '777777',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                      font: 'Arial',
                      color: '777777',
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const sanitizedTitle = (title || 'dispensa').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.docx"`,
      },
    })
  } catch (err: any) {
    console.error("Errore generazione server DOCX:", err)
    return new Response(JSON.stringify({ error: err.message || "Errore export DOCX" }), { status: 500 })
  }
}
