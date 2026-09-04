-- ==========================================
-- Milestone 12: Studio Documenti & Presentazioni
-- ==========================================

-- Tabella per documenti didattici e presentazioni a slide generate e personalizzate
CREATE TABLE IF NOT EXISTS public.studio_artifacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('document', 'presentation')),
  subtype text NOT NULL DEFAULT 'summary', -- 'summary', 'cheatsheet', 'report', 'slides_exam', 'slides_quick', 'weak_topics'
  content jsonb NOT NULL DEFAULT '{}'::jsonb, -- Dati slide o testo markdown/sezioni
  source_doc_ids uuid[] DEFAULT '{}',
  theme text NOT NULL DEFAULT 'monochrome',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.studio_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti gestiscono i propri artefatti di studio"
ON public.studio_artifacts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_studio_artifacts_user ON public.studio_artifacts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_artifacts_course ON public.studio_artifacts(course_id);
