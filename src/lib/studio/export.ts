'use client'

import { DocumentContent, PresentationContent, SlideItem } from '@/app/(dashboard)/studio/actions'

/**
 * Utility per scaricare un Blob come file nel browser
 */
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

/**
 * Converte espressioni matematiche LaTeX in testo Unicode matematico ad alta leggibilità.
 * Utilizzato per PowerPoint (.pptx) e come fallback testuale elegante in Word (.docx).
 */
export function latexToUnicode(latex: string): string {
  if (!latex) return ''
  let text = latex
  text = text.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '').trim()

  const greek: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ',
    rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ',
    phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
    Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  }
  for (const [cmd, char] of Object.entries(greek)) {
    text = text.replace(new RegExp(`\\\\${cmd}\\b`, 'g'), char)
  }

  const symbols: Record<string, string> = {
    times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
    approx: '≈', sim: '∼', equiv: '≡', infty: '∞', partial: '∂',
    nabla: '∇', sum: '∑', prod: '∏', int: '∫', iint: '∬', iiint: '∭',
    oint: '∮', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆',
    cup: '∪', cap: '∩', to: '→', rightarrow: '→', leftarrow: '←',
    Rightarrow: '⇒', Leftarrow: '⇐', iff: '⇔', leftrightarrow: '↔',
    forall: '∀', exists: '∃', neg: '¬', ldots: '…', cdots: '…',
    circ: '°', degree: '°'
  }
  for (const [cmd, char] of Object.entries(symbols)) {
    text = text.replace(new RegExp(`\\\\${cmd}\\b`, 'g'), char)
  }

  // Frazioni: \frac{a}{b} -> (a) / (b)
  text = text.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1) / ($2)')
  // Radici quadrate: \sqrt{a} -> √(a)
  text = text.replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
  // Formattazioni testuali: \text{...}, \mathbf{...}, \mathit{...}, \mathrm{...}
  text = text.replace(/\\(text|mathbf|mathit|mathrm|mathbb|mathcal)\{([^{}]+)\}/g, '$2')

  const superMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ', 't': 'ᵗ', 'k': 'ᵏ'
  }
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'n': 'ₙ', 't': 'ₜ'
  }

  text = text.replace(/\^\{([0-9a-z+\-=()]+)\}|\^([0-9a-z+\-=()])/gi, (_, g1, g2) => {
    const s = g1 || g2
    return s.split('').map((c: string) => superMap[c] || c).join('')
  })
  text = text.replace(/_\{([0-9a-z+\-=()]+)\}|_([0-9a-z+\-=()])/gi, (_, g1, g2) => {
    const s = g1 || g2
    return s.split('').map((c: string) => subMap[c] || c).join('')
  })

  // Pulizia graffe e slash residue
  text = text.replace(/[{}\\]/g, '')
  return text.trim()
}

/**
 * Tokenizzatore Markdown Inline: separa formule ($...$), grassetto (**...**),
 * corsivo (*...*), grassetto-corsivo (***...***) e codice (`...`).
 */
export interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'boldItalic' | 'code' | 'math'
  content: string
  display?: boolean
}

export function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  if (!text) return tokens

  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\*\*\*[^\*]+?\*\*\*|\*\*[^\*]+?\*\*|_[^_]+?_|\*[^\*]+?\*|`[^`]+?`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', content: text.substring(lastIndex, match.index) })
    }
    const raw = match[0]
    if (raw.startsWith('$$') && raw.endsWith('$$')) {
      tokens.push({ type: 'math', content: raw.slice(2, -2).trim(), display: true })
    } else if (raw.startsWith('$') && raw.endsWith('$')) {
      tokens.push({ type: 'math', content: raw.slice(1, -1).trim(), display: false })
    } else if (raw.startsWith('***') && raw.endsWith('***')) {
      tokens.push({ type: 'boldItalic', content: raw.slice(3, -3) })
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ type: 'bold', content: raw.slice(2, -2) })
    } else if ((raw.startsWith('*') && raw.endsWith('*')) || (raw.startsWith('_') && raw.endsWith('_'))) {
      tokens.push({ type: 'italic', content: raw.slice(1, -1) })
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ type: 'code', content: raw.slice(1, -1) })
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.substring(lastIndex) })
  }
  return tokens
}

/**
 * Trasforma una stringa con markdown inline in un array di elementi per PowerPoint (PptxGenJS TextProps)
 */
function parseInlinePptx(text: string, baseOptions: any = {}): any[] {
  const tokens = parseInlineTokens(text)
  if (tokens.length === 0) {
    return [{ text: '', options: baseOptions }]
  }

  return tokens.map(token => {
    switch (token.type) {
      case 'bold':
        return { text: token.content, options: { ...baseOptions, bold: true } }
      case 'italic':
        return { text: token.content, options: { ...baseOptions, italic: true } }
      case 'boldItalic':
        return { text: token.content, options: { ...baseOptions, bold: true, italic: true } }
      case 'code':
        return { text: ` ${token.content} `, options: { ...baseOptions, fontFace: 'Courier New' } }
      case 'math':
        return {
          text: latexToUnicode(token.content),
          options: { ...baseOptions, fontFace: 'Cambria Math', italic: true }
        }
      case 'text':
      default:
        return { text: token.content, options: { ...baseOptions } }
    }
  })
}

/**
 * 1. ESPORTAZIONE POWERPOINT (.PPTX) CON ARCHITETTURA DIRETTA STILE CLAUDE AI
 * Genera presentazioni 16:9 widescreen editoriali ad alta fedeltà con supporto
 * a formattazione inline autentica (grassetto, corsivo, codice), layout tematici
 * a schede e formule matematiche Unicode native e leggibili.
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
  const PptxGenJSModule = await import('pptxgenjs')
  const PptxGenJS = (PptxGenJSModule.default || PptxGenJSModule) as any
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9'
  pres.title = title || 'Presentazione StudyCloud'

  const slides: SlideItem[] = content.slides || []

  slides.forEach((slideItem, index) => {
    const slide = pres.addSlide()
    const isInverted = !!slideItem.inverted
    const bgCol = isInverted ? '000000' : 'FFFFFF'
    const textCol = isInverted ? 'FFFFFF' : '000000'
    const subCol = isInverted ? 'A1A1AA' : '52525B'
    const borderCol = isInverted ? '3F3F46' : '000000'
    const cardBg = isInverted ? '18181B' : 'F4F4F5'

    slide.background = { color: bgCol }

    // Header Tecnico Brutalist Identico al Sito
    slide.addText(`[ STUDYCLOUD // SLIDE ${(index + 1).toString().padStart(2, '0')} · ${slideItem.layout.toUpperCase()} ]`, {
      x: 0.8,
      y: 0.45,
      w: 8.0,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Courier New',
      color: subCol,
      bold: true
    })

    if (courseName) {
      slide.addText(courseName.toUpperCase(), {
        x: 8.0,
        y: 0.45,
        w: 4.5,
        h: 0.3,
        fontSize: 10,
        fontFace: 'Courier New',
        color: subCol,
        align: 'right',
        bold: true
      })
    }

    // Linea divisoria brutale netta
    slide.addShape(pres.ShapeType.line, {
      x: 0.8,
      y: 0.82,
      w: 11.7,
      h: 0,
      line: { color: borderCol, width: 2 }
    })

    // =========================================================================
    // LAYOUT 1: TITLE (Copertina Monumentale)
    // =========================================================================
    if (slideItem.layout === 'title') {
      slide.addText(slideItem.title.toUpperCase(), {
        x: 0.8,
        y: 2.0,
        w: 11.7,
        h: 2.2,
        fontSize: 36,
        fontFace: 'Courier New',
        color: textCol,
        bold: true,
        valign: 'middle'
      })

      if (slideItem.subtitle) {
        const subtitleRuns = parseInlinePptx(slideItem.subtitle, {
          fontSize: 18,
          fontFace: 'Arial',
          color: subCol
        })
        slide.addText(subtitleRuns, {
          x: 0.8,
          y: 4.4,
          w: 11.7,
          h: 0.8
        })
      }
    } 
    // =========================================================================
    // LAYOUT 2: COLUMNS (Confronto Schede a 2 Colonne)
    // =========================================================================
    else if (slideItem.layout === 'columns') {
      slide.addText(slideItem.title.toUpperCase(), {
        x: 0.8,
        y: 1.05,
        w: 11.7,
        h: 0.7,
        fontSize: 22,
        fontFace: 'Courier New',
        color: textCol,
        bold: true
      })

      // Box Colonna Sinistra (Analisi A)
      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.85,
        w: 5.65,
        h: 4.6,
        fill: { color: cardBg },
        line: { color: borderCol, width: 1.5 }
      })
      slide.addText('ANALISI A', {
        x: 1.1,
        y: 2.05,
        w: 5.0,
        h: 0.35,
        fontSize: 11,
        fontFace: 'Courier New',
        bold: true,
        color: subCol
      })

      const leftContent = slideItem.leftColumn || (slideItem.bullets?.slice(0, Math.ceil((slideItem.bullets?.length || 1) / 2)) || []).join('\n\n')
      const leftRuns = parseInlinePptx(leftContent, {
        fontSize: 13,
        fontFace: 'Arial',
        color: textCol
      })
      slide.addText(leftRuns, {
        x: 1.1,
        y: 2.5,
        w: 5.05,
        h: 3.7,
        valign: 'top'
      })

      // Box Colonna Destra (Analisi B)
      slide.addShape(pres.ShapeType.rect, {
        x: 6.85,
        y: 1.85,
        w: 5.65,
        h: 4.6,
        fill: { color: cardBg },
        line: { color: borderCol, width: 1.5 }
      })
      slide.addText('ANALISI B', {
        x: 7.15,
        y: 2.05,
        w: 5.0,
        h: 0.35,
        fontSize: 11,
        fontFace: 'Courier New',
        bold: true,
        color: subCol
      })

      const rightContent = slideItem.rightColumn || (slideItem.bullets?.slice(Math.ceil((slideItem.bullets?.length || 1) / 2)) || []).join('\n\n')
      const rightRuns = parseInlinePptx(rightContent, {
        fontSize: 13,
        fontFace: 'Arial',
        color: textCol
      })
      slide.addText(rightRuns, {
        x: 7.15,
        y: 2.5,
        w: 5.05,
        h: 3.7,
        valign: 'top'
      })
    } 
    // =========================================================================
    // LAYOUT 3: FORMULA (Focus LaTeX / Matematico)
    // =========================================================================
    else if (slideItem.layout === 'formula') {
      slide.addText(slideItem.title.toUpperCase(), {
        x: 0.8,
        y: 1.05,
        w: 11.7,
        h: 0.7,
        fontSize: 22,
        fontFace: 'Courier New',
        color: textCol,
        bold: true
      })

      // Box Centrale per Formula ad Alto Impatto
      slide.addShape(pres.ShapeType.rect, {
        x: 1.2,
        y: 1.9,
        w: 10.9,
        h: 2.2,
        fill: { color: cardBg },
        line: { color: borderCol, width: 2 }
      })

      const unicodeMath = latexToUnicode(slideItem.formula || slideItem.title)
      slide.addText(unicodeMath, {
        x: 1.4,
        y: 1.9,
        w: 10.5,
        h: 2.2,
        fontSize: 28,
        fontFace: 'Cambria Math',
        color: textCol,
        align: 'center',
        valign: 'middle',
        bold: true
      })

      // Elenco Punti o Spiegazioni Variabili
      if (slideItem.bullets && slideItem.bullets.length > 0) {
        const bulletBlocks = slideItem.bullets.map(b => {
          return parseInlinePptx(b, {
            fontSize: 14,
            fontFace: 'Arial',
            color: textCol
          })
        })

        // Aggiungi ciascun punto elenco formattato
        let currentY = 4.35
        bulletBlocks.forEach(runs => {
          slide.addText(runs, {
            x: 1.2,
            y: currentY,
            w: 10.9,
            h: 0.5,
            bullet: true
          })
          currentY += 0.55
        })
      }
    } 
    // =========================================================================
    // LAYOUT 4: CODE (Blocco Codice Tecnico)
    // =========================================================================
    else if (slideItem.layout === 'code') {
      slide.addText(slideItem.title.toUpperCase(), {
        x: 0.8,
        y: 1.05,
        w: 11.7,
        h: 0.7,
        fontSize: 22,
        fontFace: 'Courier New',
        color: textCol,
        bold: true
      })

      slide.addShape(pres.ShapeType.rect, {
        x: 0.8,
        y: 1.85,
        w: 11.7,
        h: 4.6,
        fill: { color: '18181B' },
        line: { color: '000000', width: 2 }
      })

      slide.addText(slideItem.code || '// Nessun codice fornito', {
        x: 1.1,
        y: 2.05,
        w: 11.1,
        h: 4.2,
        fontSize: 13,
        fontFace: 'Courier New',
        color: 'F4F4F5',
        valign: 'top'
      })
    } 
    // =========================================================================
    // LAYOUT 5: QUOTE (Citazione Monumentale)
    // =========================================================================
    else if (slideItem.layout === 'quote') {
      slide.addText(`“${slideItem.quote || slideItem.title}”`, {
        x: 1.2,
        y: 2.0,
        w: 10.8,
        h: 2.8,
        fontSize: 26,
        fontFace: 'Georgia',
        color: textCol,
        italic: true,
        align: 'center',
        valign: 'middle'
      })

      if (slideItem.quoteAuthor) {
        slide.addText(`— ${slideItem.quoteAuthor.toUpperCase()}`, {
          x: 1.2,
          y: 4.9,
          w: 10.8,
          h: 0.6,
          fontSize: 13,
          fontFace: 'Courier New',
          color: subCol,
          align: 'center',
          bold: true
        })
      }
    } 
    // =========================================================================
    // LAYOUT 6: BULLETS (Punti Chiave con Grassetto e Corsivo Reali)
    // =========================================================================
    else {
      slide.addText(slideItem.title.toUpperCase(), {
        x: 0.8,
        y: 1.05,
        w: 11.7,
        h: 0.7,
        fontSize: 24,
        fontFace: 'Courier New',
        color: textCol,
        bold: true
      })

      const rawBullets = slideItem.bullets || ['Nessun punto specificato']
      let currentY = 1.95

      rawBullets.forEach(rawBullet => {
        const runs = parseInlinePptx(rawBullet, {
          fontSize: 15,
          fontFace: 'Arial',
          color: textCol
        })

        slide.addText(runs, {
          x: 0.8,
          y: currentY,
          w: 11.7,
          h: 0.65,
          bullet: true,
          valign: 'top'
        })
        currentY += 0.75
      })
    }

    // Speaker Notes / Note del Relatore Native in PowerPoint
    if (slideItem.notes && slideItem.notes.trim()) {
      slide.addNotes(slideItem.notes.trim())
    }
  })

  const sanitizedTitle = (title || 'presentazione').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  await pres.writeFile({ fileName: `${sanitizedTitle}.pptx` })
}

/**
 * 2. ESPORTAZIONE WORD (.DOCX) CON ARCHITETTURA DIRETTA STILE CLAUDE AI
 * Produce veri documenti OpenXML Microsoft Word con:
 * - Formule matematiche native OMML (<m:oMath>) generate da KaTeX e compatibili con l'editor equazioni di Word
 * - Piena formattazione inline per grassetti (**), corsivi (*), codice (`) e formule ($...$)
 * - Gerarchia rigorosa dei titoli (H1 con bordo inferiore, H2, H3)
 * - Tabelle con righe d'intestazione ad alto contrasto e bordi neri
 * - Callout box e citazioni con barra laterale nera da 3pt
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
  const docxModule = await import('docx')
  const {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    Packer,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    Header,
    Footer,
    PageNumber,
    ImportedXmlComponent
  } = docxModule

  const katexModule = (await import('katex')).default
  const { mml2omml } = await import('mathml2omml')

  /**
   * Helper per convertire formula LaTeX in componente XML nativo OMML per Word
   */
  function convertLatexToOmmlComponent(formula: string) {
    try {
      const clean = formula.trim().replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '').trim()
      let mathml = katexModule.renderToString(clean, { output: 'mathml', throwOnError: false })
      // Rimuove tag annotation per evitare log superflui da mathml2omml
      mathml = mathml.replace(/<annotation[\s\S]*?<\/annotation>/gi, '')
      const match = mathml.match(/<math[\s\S]*?<\/math>/i)
      if (match) {
        const omml = mml2omml(match[0])
        return ImportedXmlComponent.fromXmlString(omml)
      }
    } catch (err) {
      console.warn('Conversione OMML fallita, uso fallback Unicode:', err)
    }
    // Fallback in caso di LaTeX non standard
    return new TextRun({
      text: latexToUnicode(formula),
      font: 'Cambria Math',
      italics: true,
      color: '000000'
    })
  }

  /**
   * Helper per creare TextRun e OMML per qualsiasi paragrafo con markdown inline
   */
  function createDocxInlineChildren(text: string, defaultOptions: any = {}) {
    const tokens = parseInlineTokens(text)
    const children: any[] = []

    for (const token of tokens) {
      if (token.type === 'math') {
        children.push(convertLatexToOmmlComponent(token.content))
      } else if (token.type === 'bold') {
        children.push(new TextRun({ text: token.content, bold: true, ...defaultOptions }))
      } else if (token.type === 'italic') {
        children.push(new TextRun({ text: token.content, italics: true, ...defaultOptions }))
      } else if (token.type === 'boldItalic') {
        children.push(new TextRun({ text: token.content, bold: true, italics: true, ...defaultOptions }))
      } else if (token.type === 'code') {
        children.push(new TextRun({
          text: ` ${token.content} `,
          font: 'Courier New',
          shading: { fill: 'F4F4F5' },
          color: '18181B'
        }))
      } else {
        children.push(new TextRun({ text: token.content, ...defaultOptions }))
      }
    }
    return children
  }

  const md = content.markdown || `# ${title}\n\nNessun contenuto disponibile.`
  const lines = md.split('\n')
  const paragraphs: any[] = []

  // Intestazione Titolo Monumentale Brutalist
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          font: 'Courier New',
          size: 38, // 19pt
          color: '000000'
        })
      ],
      spacing: { before: 100, after: 120 }
    })
  )

  // Metadati di Riga (Corso & Piattaforma)
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `STUDYCLOUD // KNOWLEDGE BASE ACCADEMICA`,
          bold: true,
          font: 'Courier New',
          size: 18,
          color: '52525B'
        }),
        ...(courseName ? [
          new TextRun({
            text: `  ·  CORSO: ${courseName.toUpperCase()}`,
            bold: true,
            font: 'Courier New',
            size: 18,
            color: '000000'
          })
        ] : []),
        new TextRun({
          text: `  ·  DATA: ${new Date().toLocaleDateString('it-IT')}`,
          font: 'Courier New',
          size: 18,
          color: '71717A'
        })
      ],
      spacing: { after: 200 }
    })
  )

  // Linea separatrice solida
  paragraphs.push(
    new Paragraph({
      border: {
        bottom: { color: '000000', size: 16, space: 4, style: BorderStyle.SINGLE }
      },
      spacing: { after: 280 }
    })
  )

  // Parser riga per riga del Markdown
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let inTable = false
  let tableRows: string[][] = []

  const flushTable = () => {
    if (tableRows.length > 0) {
      const docxTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows.map((row, rIdx) => 
          new TableRow({
            tableHeader: rIdx === 0,
            children: row.map(cellText => 
              new TableCell({
                shading: { fill: rIdx === 0 ? '000000' : (rIdx % 2 === 0 ? 'F9FAFB' : 'FFFFFF') },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
                },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                children: [
                  new Paragraph({
                    children: createDocxInlineChildren(cellText.trim(), {
                      bold: rIdx === 0,
                      font: rIdx === 0 ? 'Courier New' : 'Arial',
                      size: 18,
                      color: rIdx === 0 ? 'FFFFFF' : '000000'
                    }),
                    spacing: { before: 40, after: 40 }
                  })
                ]
              })
            )
          })
        )
      })
      paragraphs.push(docxTable)
      paragraphs.push(new Paragraph({ spacing: { after: 180 } }))
      tableRows = []
      inTable = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()

    // Blocco Codice
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeBuffer.join('\n'),
                font: 'Courier New',
                size: 19,
                color: '000000'
              })
            ],
            shading: { fill: 'F4F4F5' },
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            },
            spacing: { before: 120, after: 180 }
          })
        )
        codeBuffer = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine)
      continue
    }

    // Tabelle Markdown (| col 1 | col 2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      if (line.includes('---')) {
        continue // Riga divisoria markdown
      }
      inTable = true
      const cells = line.split('|').slice(1, -1)
      tableRows.push(cells)
      continue
    } else if (inTable) {
      flushTable()
    }

    // Righe vuote
    if (!line) {
      continue
    }

    // Formula a Blocco Centrale (es. $$ formula $$)
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      const formulaText = line.slice(2, -2).trim()
      const ommlComp = convertLatexToOmmlComponent(formulaText)
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [ommlComp],
          spacing: { before: 180, after: 180 }
        })
      )
      continue
    }

    // Titoli H1, H2, H3 con KeepNext per evitare titoli orfani
    if (line.startsWith('# ')) {
      const headingText = line.replace('# ', '')
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: createDocxInlineChildren(headingText.toUpperCase(), {
            bold: true,
            font: 'Courier New',
            size: 28, // 14pt
            color: '000000'
          }),
          spacing: { before: 320, after: 120 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' }
          },
          keepNext: true
        })
      )
    } else if (line.startsWith('## ')) {
      const headingText = line.replace('## ', '')
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: createDocxInlineChildren(headingText.toUpperCase(), {
            bold: true,
            font: 'Courier New',
            size: 24, // 12pt
            color: '000000'
          }),
          spacing: { before: 240, after: 100 },
          keepNext: true
        })
      )
    } else if (line.startsWith('### ')) {
      const headingText = line.replace('### ', '')
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: createDocxInlineChildren(headingText, {
            bold: true,
            font: 'Courier New',
            size: 21, // 10.5pt
            color: '27272A'
          }),
          spacing: { before: 180, after: 80 },
          keepNext: true
        })
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Elenco Puntato con Formattazione Inline (Grassetto, Corsivo, Formule)
      const bulletText = line.substring(2)
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: createDocxInlineChildren(bulletText, {
            font: 'Arial',
            size: 21,
            color: '18181B'
          }),
          spacing: { after: 60, line: 260 }
        })
      )
    } else if (/^\d+\.\s/.test(line)) {
      // Elenco Numerato
      const matchNumber = line.match(/^(\d+)\.\s(.*)$/)
      const numPrefix = matchNumber ? `${matchNumber[1]}. ` : ''
      const numContent = matchNumber ? matchNumber[2] : line
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: numPrefix, bold: true, font: 'Courier New', size: 21 }),
            ...createDocxInlineChildren(numContent, {
              font: 'Arial',
              size: 21,
              color: '18181B'
            })
          ],
          spacing: { after: 60, line: 260 }
        })
      )
    } else if (line.startsWith('> ')) {
      // Callout Box / Citazione Brutalist con barra sinistra da 3pt
      const quoteText = line.replace('> ', '')
      paragraphs.push(
        new Paragraph({
          children: createDocxInlineChildren(quoteText, {
            italics: true,
            font: 'Arial',
            size: 21,
            color: '27272A'
          }),
          border: {
            left: { style: BorderStyle.SINGLE, size: 24, color: '000000', space: 14 }
          },
          shading: { fill: 'F4F4F5' },
          spacing: { before: 140, after: 160, line: 280 }
        })
      )
    } else if (line === '---' || line === '***') {
      // Linea orizzontale separatore
      paragraphs.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D8' }
          },
          spacing: { before: 180, after: 180 }
        })
      )
    } else {
      // Paragrafo Standard con Pieno Supporto Inline (Grassetto, Corsivo, Formule)
      paragraphs.push(
        new Paragraph({
          children: createDocxInlineChildren(line, {
            font: 'Arial',
            size: 21, // 10.5pt standard editoriale
            color: '09090B'
          }),
          spacing: { after: 120, line: 276 } // 1.15x interlinea fluida
        })
      )
    }
  }

  if (inTable) {
    flushTable()
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 pollice = 25.4mm
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'STUDYCLOUD // KNOWLEDGE BASE',
                    font: 'Courier New',
                    size: 16,
                    bold: true,
                    color: '71717A'
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'PAGINA ',
                    font: 'Courier New',
                    size: 16,
                    color: '71717A'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Courier New',
                    size: 16,
                    bold: true,
                    color: '000000'
                  })
                ]
              })
            ]
          })
        },
        children: paragraphs
      }
    ]
  })

  const blob = await Packer.toBlob(doc)
  const sanitizedTitle = (title || 'dispensa').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  downloadBlob(blob, `${sanitizedTitle}.docx`)
}

/**
 * 3. ESPORTAZIONE MARKDOWN (.MD)
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
 * 4. STAMPA / SALVATAGGIO IN PDF VETTORIALE DEL BROWSER
 */
export function printArtifact() {
  if (typeof window !== 'undefined') {
    window.print()
  }
}
