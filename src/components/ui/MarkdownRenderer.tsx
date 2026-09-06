'use client'

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface Props {
  content: string
  className?: string
}

/**
 * Normalizza e corregge le espressioni matematiche LaTeX prima del parsing KaTeX
 */
function preprocessMath(text: string): string {
  if (!text) return ''

  let processed = text

  // 1. Converte caratteri di controllo ASCII generati da cattivo escaping JSON degli LLM
  processed = processed
    .replace(/\x0Crac\{/g, '\\frac{')
    .replace(/\x0Crac\b/g, '\\frac')
    .replace(/\x08egin\{/g, '\\begin{')
    .replace(/\x08eta\b/g, '\\beta')
    .replace(/\x08ar\{/g, '\\bar{')
    .replace(/\x08mathbf\{/g, '\\mathbf{')

  // 2. Converte \[ formula \] in $$ formula $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')

  // 3. Converte \( formula \) in $ formula $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')

  // 4. Se ambienti LaTeX nudi (\begin{aligned}, cases, etc.) non sono racchiusi in $$, racchiudili in $$...$$
  processed = processed.replace(
    /(?<!\$\$)\s*(\\begin\{(aligned|equation\*?|cases|matrix|pmatrix|bmatrix|vmatrix|gather\*?)\}[\s\S]*?\\end\{\2\})\s*(?!\$\$)/g,
    '\n\n$$$$\n$1\n$$$$\n\n'
  )

  // 5. Corregge spazi all'inizio o alla fine delle formule inline ($ \vec{E} $ -> $\vec{E}$)
  processed = processed.replace(/(?<!\$)\$\s+([^\$\n]+?)\s+\$(?!\$)/g, '$$$1$$')
  processed = processed.replace(/(?<!\$)\$\s+([^\$\n]+?)\$(?!\$)/g, '$$$1$$')
  processed = processed.replace(/(?<!\$)\$([^\$\n]+?)\s+\$(?!\$)/g, '$$$1$$')

  // 6. Corregge indici e sommatorie malformati dagli LLM
  processed = processed
    .replace(/\\vec\{([A-Za-z]+)\}([a-zA-Z0-9]+)/g, '\\vec{$1}_{$2}')
    .replace(/\\sum\{([^}]+)\}/g, '\\sum_{$1}')
    .replace(/\\int\{([^}]+)\}/g, '\\int_{$1}')

  return processed
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  const processedContent = useMemo(() => preprocessMath(content), [content])

  return (
    <div className={`markdown-content text-[13.5px] leading-relaxed text-[var(--color-text)] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, href, children, ...props }: any) => {
            const isSafe = href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/'))
            return (
              <a
                href={isSafe ? href : '#'}
                target={isSafe && href?.startsWith('http') ? '_blank' : undefined}
                rel={isSafe && href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-black font-semibold underline hover:text-zinc-600 transition-colors"
                {...props}
              >
                {children}
              </a>
            )
          },
          h1: ({ node, ...props }) => (
            <h1 className="text-lg font-bold mt-4 mb-2 text-[var(--color-text)] border-b border-black pb-1 font-mono uppercase tracking-tight" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-base font-bold mt-3.5 mb-1.5 text-[var(--color-text)] font-mono uppercase tracking-tight" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-[14px] font-semibold mt-3 mb-1 text-black font-mono" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-[13px] font-semibold mt-2.5 mb-1 text-[var(--color-text)] font-mono" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2.5 last:mb-0" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-black" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-zinc-800" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 mb-2.5 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 mb-2.5 space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-black pl-3 my-2.5 text-zinc-700 italic bg-zinc-100 py-1.5" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-black" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-zinc-100 text-black text-[12px] font-mono px-1.5 py-0.5 border border-zinc-300" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <pre className="bg-zinc-950 text-zinc-100 text-[12px] font-mono p-3 border border-black overflow-x-auto my-2.5">
                <code {...props}>{children}</code>
              </pre>
            )
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-xs border border-[var(--color-border)] rounded-lg overflow-hidden" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-slate-100 border-b border-[var(--color-border)] text-[var(--color-text)] font-semibold" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-[var(--color-border)] bg-white" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-slate-50 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-[var(--color-text-secondary)]" {...props} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
