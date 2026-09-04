-- ==========================================
-- Schema Database Iniziale: StudyCloud
-- ==========================================

-- Abilita estensione pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 1. Tabelle Base
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Funzione per creare automaticamente un profilo alla registrazione
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger che scatta quando un utente si registra
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE public.courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  size_bytes bigint NOT NULL,
  status text DEFAULT 'uploaded' NOT NULL, -- uploaded, processing, processed, failed
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Configurazione Row Level Security (RLS)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gli utenti possono vedere il proprio profilo" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Gli utenti possono aggiornare il proprio profilo" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Gli utenti possono vedere solo i propri corsi" 
ON public.courses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono inserire i propri corsi" 
ON public.courses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono vedere solo i propri documenti" 
ON public.documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono inserire i propri documenti" 
ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono aggiornare i propri documenti" 
ON public.documents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Gli utenti possono eliminare i propri documenti" 
ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- Storage (Assicurati di creare un bucket chiamato "documents" nella dashboard Supabase)
-- (Le policy di storage si applicano solitamente dall'interfaccia UI di Supabase,
-- ma ecco un esempio di policy SQL per Storage):
-- CREATE POLICY "User can upload to their own folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
