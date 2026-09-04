import { createAdminClient } from '@/lib/supabase/admin'

export interface LogUsageParams {
  userId: string
  feature: 'chat' | 'tutor' | 'flashcards' | 'extraction' | 'embeddings'
  model: string
  inputTokens?: number
  outputTokens?: number
  estimatedCost?: number
  metadata?: Record<string, any>
}

// Costi di riferimento stimati per token (in USD)
const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'models/gemini-3.5-flash-lite': { inputPerMillion: 0.035, outputPerMillion: 0.15 },
  'models/gemini-3.7-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  'models/gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  'gemini-embedding-001': { inputPerMillion: 0.02, outputPerMillion: 0.0 },
  'models/gemini-embedding-001': { inputPerMillion: 0.02, outputPerMillion: 0.0 },
  'gemini-embedding-2': { inputPerMillion: 0.02, outputPerMillion: 0.0 },
  'models/gemini-embedding-2': { inputPerMillion: 0.02, outputPerMillion: 0.0 },
  'gemini-embedding-2-preview': { inputPerMillion: 0.02, outputPerMillion: 0.0 },
  'models/gemini-embedding-2-preview': { inputPerMillion: 0.02, outputPerMillion: 0.0 },
}

/**
 * Calcola e registra il consumo di token e il costo stimato per una chiamata AI
 */
export async function logAiUsage(params: LogUsageParams): Promise<void> {
  try {
    const admin = createAdminClient()
    const input = params.inputTokens || 0
    const output = params.outputTokens || 0

    let cost = params.estimatedCost || 0
    if (!cost && (input > 0 || output > 0)) {
      const pricing = MODEL_PRICING[params.model] || { inputPerMillion: 0.10, outputPerMillion: 0.40 }
      cost = (input / 1_000_000) * pricing.inputPerMillion + (output / 1_000_000) * pricing.outputPerMillion
    }

    await admin.from('ai_usage').insert({
      user_id: params.userId,
      feature: params.feature,
      model: params.model,
      input_tokens: input,
      output_tokens: output,
      estimated_cost: cost,
      metadata: params.metadata || {}
    })
  } catch (err) {
    // Non bloccare l'applicazione se il logging non va a buon fine
    console.warn("Errore logAiUsage:", err)
  }
}

/**
 * Controlla se l'utente ha superato il budget mensile configurato
 */
export async function checkBudgetGuardrail(userId: string): Promise<{
  allowed: boolean
  currentSpend: number
  monthlyBudget: number
  message?: string
}> {
  try {
    const admin = createAdminClient()

    // 1. Recupera budget mensile dal profilo (default 5.00 €/$)
    const { data: profile } = await admin
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .single()

    const monthlyBudget = Number(profile?.preferences?.monthly_budget) || 5.00

    // 2. Calcola spesa totale del mese corrente
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: usage } = await admin
      .from('ai_usage')
      .select('estimated_cost')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    const currentSpend = (usage || []).reduce((acc, row) => acc + (Number(row.estimated_cost) || 0), 0)

    if (currentSpend >= monthlyBudget) {
      return {
        allowed: false,
        currentSpend,
        monthlyBudget,
        message: `Budget mensile di spesa AI (${monthlyBudget.toFixed(2)}$) superato. Puoi aumentare il limite nella sezione Impostazioni.`
      }
    }

    return {
      allowed: true,
      currentSpend,
      monthlyBudget
    }
  } catch (err) {
    console.warn("Errore checkBudgetGuardrail:", err)
    return { allowed: true, currentSpend: 0, monthlyBudget: 5.00 }
  }
}

/**
 * Recupera statistiche complete di utilizzo AI per la dashboard e impostazioni
 */
export async function getAiUsageAnalytics(userId: string) {
  try {
    const admin = createAdminClient()

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: usage } = await admin
      .from('ai_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    const allRows = usage || []
    const monthRows = allRows.filter(r => new Date(r.created_at) >= startOfMonth)

    const totalSpendMonth = monthRows.reduce((acc, r) => acc + (Number(r.estimated_cost) || 0), 0)
    const totalTokensMonth = monthRows.reduce((acc, r) => acc + (r.input_tokens || 0) + (r.output_tokens || 0), 0)

    // Ripartizione per feature
    const featureBreakdown: Record<string, { calls: number; cost: number; tokens: number }> = {
      chat: { calls: 0, cost: 0, tokens: 0 },
      tutor: { calls: 0, cost: 0, tokens: 0 },
      flashcards: { calls: 0, cost: 0, tokens: 0 },
      extraction: { calls: 0, cost: 0, tokens: 0 },
      embeddings: { calls: 0, cost: 0, tokens: 0 }
    }

    for (const r of monthRows) {
      const f = featureBreakdown[r.feature] || { calls: 0, cost: 0, tokens: 0 }
      f.calls += 1
      f.cost += Number(r.estimated_cost) || 0
      f.tokens += (r.input_tokens || 0) + (r.output_tokens || 0)
      featureBreakdown[r.feature] = f
    }

    return {
      totalSpendMonth,
      totalTokensMonth,
      totalCallsMonth: monthRows.length,
      featureBreakdown,
      recentUsage: allRows.slice(0, 15)
    }
  } catch (err) {
    console.error("Errore recupero analytics AI:", err)
    return {
      totalSpendMonth: 0,
      totalTokensMonth: 0,
      totalCallsMonth: 0,
      featureBreakdown: {},
      recentUsage: []
    }
  }
}
