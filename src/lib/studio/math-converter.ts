/**
 * Utility per convertire formule LaTeX in notazione matematica pulita e leggibile
 * compatibile con Microsoft Word, Google Documenti, PowerPoint e PDF nativi.
 */
export function formatLatexToReadableMath(latex: string): string {
  if (!latex) return ''

  let s = latex.trim()

  // Rimuovi delimitatori $$ o $
  if (s.startsWith('$$') && s.endsWith('$$')) s = s.slice(2, -2).trim()
  if (s.startsWith('$') && s.endsWith('$')) s = s.slice(1, -1).trim()

  // Sostituzioni di frazioni: \frac{num}{den} -> (num) / (den)
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) / ($2)')
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) / ($2)') // Secondo passaggio per annidati

  // Radici quadrate: \sqrt{x} -> √(x)
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')

  // Vettori e grassetto: \mathbf{E} -> E, \vec{E} -> E⃗, \vec E -> E⃗
  s = s.replace(/\\mathbf\{([^{}]+)\}/g, '$1')
  s = s.replace(/\\boldsymbol\{([^{}]+)\}/g, '$1')
  s = s.replace(/\\vec\{([^{}]+)\}/g, '$1⃗')
  s = s.replace(/\\vec\s+([a-zA-Z])/g, '$1⃗')

  // Notazione differenziale e derivate
  s = s.replace(/\\nabla/g, '∇')
  s = s.replace(/\\partial/g, '∂')
  s = s.replace(/\\cdot/g, ' · ')
  s = s.replace(/\\times/g, ' × ')

  // Operatori logici e relazionali
  s = s.replace(/\\approx/g, '≈')
  s = s.replace(/\\neq/g, '≠')
  s = s.replace(/\\leq/g, '≤')
  s = s.replace(/\\geq/g, '≥')
  s = s.replace(/\\pm/g, '±')
  s = s.replace(/\\mp/g, '∓')
  s = s.replace(/\\to/g, '→')
  s = s.replace(/\\rightarrow/g, '→')
  s = s.replace(/\\leftarrow/g, '←')
  s = s.replace(/\\implies/g, '⇒')
  s = s.replace(/\\iff/g, '⇔')
  s = s.replace(/\\in/g, '∈')
  s = s.replace(/\\forall/g, '∀')
  s = s.replace(/\\exists/g, '∃')

  // Integrali e sommatorie
  s = s.replace(/\\iint/g, '∬')
  s = s.replace(/\\iiint/g, '∭')
  s = s.replace(/\\oint/g, '∮')
  s = s.replace(/\\int/g, '∫')
  s = s.replace(/\\sum/g, '∑')
  s = s.replace(/\\prod/g, '∏')
  s = s.replace(/\\infty/g, '∞')

  // Lettere Greche minuscole
  s = s.replace(/\\alpha/g, 'α')
  s = s.replace(/\\beta/g, 'β')
  s = s.replace(/\\gamma/g, 'γ')
  s = s.replace(/\\delta/g, 'δ')
  s = s.replace(/\\varepsilon/g, 'ε')
  s = s.replace(/\\epsilon/g, 'ε')
  s = s.replace(/\\zeta/g, 'ζ')
  s = s.replace(/\\eta/g, 'η')
  s = s.replace(/\\theta/g, 'θ')
  s = s.replace(/\\vartheta/g, 'ϑ')
  s = s.replace(/\\iota/g, 'ι')
  s = s.replace(/\\kappa/g, 'κ')
  s = s.replace(/\\lambda/g, 'λ')
  s = s.replace(/\\mu/g, 'μ')
  s = s.replace(/\\nu/g, 'ν')
  s = s.replace(/\\xi/g, 'ξ')
  s = s.replace(/\\pi/g, 'π')
  s = s.replace(/\\rho/g, 'ρ')
  s = s.replace(/\\sigma/g, 'σ')
  s = s.replace(/\\tau/g, 'τ')
  s = s.replace(/\\upsilon/g, 'υ')
  s = s.replace(/\\phi/g, 'φ')
  s = s.replace(/\\varphi/g, 'ϕ')
  s = s.replace(/\\chi/g, 'χ')
  s = s.replace(/\\psi/g, 'ψ')
  s = s.replace(/\\omega/g, 'ω')

  // Lettere Greche maiuscole
  s = s.replace(/\\Gamma/g, 'Γ')
  s = s.replace(/\\Delta/g, 'Δ')
  s = s.replace(/\\Theta/g, 'Θ')
  s = s.replace(/\\Lambda/g, 'Λ')
  s = s.replace(/\\Xi/g, 'Ξ')
  s = s.replace(/\\Pi/g, 'Π')
  s = s.replace(/\\Sigma/g, 'Σ')
  s = s.replace(/\\Upsilon/g, 'Υ')
  s = s.replace(/\\Phi/g, 'Φ')
  s = s.replace(/\\Psi/g, 'Ψ')
  s = s.replace(/\\Omega/g, 'Ω')

  // Apici e pedici comuni
  s = s.replace(/\^2/g, '²')
  s = s.replace(/\^3/g, '³')
  s = s.replace(/\^0/g, '⁰')
  s = s.replace(/\^1/g, '¹')
  s = s.replace(/\^n/g, 'ⁿ')
  s = s.replace(/\^\{([^}]+)\}/g, '^($1)')
  s = s.replace(/_0/g, '₀')
  s = s.replace(/_1/g, '₁')
  s = s.replace(/_2/g, '₂')
  s = s.replace(/_3/g, '₃')
  s = s.replace(/_\{([^}]+)\}/g, '_($1)')

  // Spaziature LaTeX
  s = s.replace(/\\quad/g, '   ')
  s = s.replace(/\\qquad/g, '      ')
  s = s.replace(/\\,/g, ' ')
  s = s.replace(/\\;/g, ' ')
  s = s.replace(/\\:/g, ' ')
  s = s.replace(/\\!/g, '')

  // Rimuovi eventuali parentesi o comandi rimasti
  s = s.replace(/\\left\(/g, '(')
  s = s.replace(/\\right\)/g, ')')
  s = s.replace(/\\left\[/g, '[')
  s = s.replace(/\\right\]/g, ']')
  s = s.replace(/\\text\{([^{}]+)\}/g, '$1')

  return s.trim()
}
