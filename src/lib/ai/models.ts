/**
 * Catalogo dei modelli Google Gemini disponibili per StudyCloud
 */

export interface GeminiModelInfo {
  id: string
  name: string
  version: string
  category: 'frontier' | 'standard' | 'reasoning'
  description: string
  badge: string
  speed: 'ultra' | 'fast' | 'deep'
  contextWindow: string
  isDefault?: boolean
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    version: '3.5',
    category: 'frontier',
    description: 'Ultra-rapido e ad altissima efficienza. Ideale per risposte istantanee in chat e basso consumo di quota.',
    badge: 'Consigliato • Ultra-Veloce',
    speed: 'ultra',
    contextWindow: '1M token',
    isDefault: true
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    version: '3.5',
    category: 'frontier',
    description: 'Bilanciamento ideale tra velocità e accuratezza per spiegazioni accademiche e flashcard strutturate.',
    badge: 'Frontier • Bilanciato',
    speed: 'fast',
    contextWindow: '1M token'
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    version: '3.7',
    category: 'frontier',
    description: 'Modello ad alte prestazioni con capacità di pensiero dinamico e risposta ultra-reattiva.',
    badge: 'Frontier • Massima Reattività',
    speed: 'ultra',
    contextWindow: '1M token'
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    version: '3.8',
    category: 'frontier',
    description: 'Nuovissimo modello con latenza minima, massima precisione scientifica e ragionamento rapido.',
    badge: 'Novità • Ultra-Reattivo',
    speed: 'ultra',
    contextWindow: '1M token'
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    version: '3.1',
    category: 'reasoning',
    description: 'Massima capacità di ragionamento scientifico, dimostrazioni matematiche e analisi teorica rigorosa.',
    badge: 'Top Reasoning • Accademico',
    speed: 'deep',
    contextWindow: '2M token'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    version: '2.5',
    category: 'standard',
    description: 'Modello consolidato ad alte prestazioni per sessioni continue di studio e tutoring.',
    badge: 'Stabile • Produzione',
    speed: 'fast',
    contextWindow: '1M token'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    version: '2.5',
    category: 'standard',
    description: 'Versione leggera e compatta per generazioni rapide a basso impatto.',
    badge: 'Economico',
    speed: 'ultra',
    contextWindow: '1M token'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    version: '2.5',
    category: 'reasoning',
    description: 'Profondità logica e ampia finestra di contesto per analizzare interi manuali universitari.',
    badge: 'Large Context Pro',
    speed: 'deep',
    contextWindow: '2M token'
  }
]

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

export function getGeminiModelInfo(modelId?: string): GeminiModelInfo {
  const found = GEMINI_MODELS.find(m => m.id === modelId)
  return found || GEMINI_MODELS[0]
}
