-- ==========================================
-- Milestone 11: Hardening, Cost Guardrails & AI Usage Tracking
-- ==========================================

-- 1. Tabella ai_usage per il tracciamento dei costi e token di ogni feature
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL, -- 'chat', 'tutor', 'voice', 'flashcards', 'extraction', 'embeddings'
  model text NOT NULL,
  input_tokens int DEFAULT 0 NOT NULL,
  output_tokens int DEFAULT 0 NOT NULL,
  estimated_cost numeric(10, 6) DEFAULT 0.0 NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS per ai_usage
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono visualizzare i propri consumi AI"
ON public.ai_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono registrare consumi AI"
ON public.ai_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Indici per aggregazioni e query rapide su statistiche e budget
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage (user_id, feature);

-- 2. Audit Log (se non già creata)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL, 
  entity_type text NOT NULL, 
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono leggere i propri log di audit"
ON public.audit_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono inserire log di audit"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);
