-- ==========================================
-- Milestone 5: Organizzazione Cloud & Audit
-- ==========================================

-- 1. Creazione Tabella Folders
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Creazione Tabella Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL, 
  entity_type text NOT NULL, 
  entity_id uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Aggiunta colonna folder_id alla tabella documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- 4. RLS Policy per Folders
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono vedere solo i propri folders" 
ON public.folders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono creare i propri folders" 
ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utenti possono modificare i propri folders" 
ON public.folders FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono eliminare i propri folders" 
ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- 5. RLS Policy per Audit Log (solo insert e select per l'utente)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono leggere i propri log" 
ON public.audit_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono inserire i propri log" 
ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);
