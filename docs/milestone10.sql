-- ==========================================
-- Milestone 10: Assistente Vocale Persona-a-Persona & Sessioni Vocali
-- ==========================================

CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  duration_seconds int DEFAULT 0 NOT NULL,
  messages_count int DEFAULT 0 NOT NULL,
  transcript jsonb DEFAULT '[]'::jsonb,
  model text DEFAULT 'models/gemini-3.7-flash',
  voice_name text DEFAULT 'Bella',
  estimated_cost numeric(10, 6) DEFAULT 0.0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono vedere le proprie sessioni vocali"
ON public.voice_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono inserire le proprie sessioni vocali"
ON public.voice_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utenti possono eliminare le proprie sessioni vocali"
ON public.voice_sessions FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON public.voice_sessions (user_id, created_at DESC);
