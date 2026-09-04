-- ==========================================
-- Milestone 6: RAG, Embeddings e Vector DB
-- ==========================================

-- 1. Assicurati che pgvector sia abilitato
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Creazione della tabella per i frammenti di testo (Chunks)
-- Usiamo vector(768) perché il modello text-embedding-004 di Gemini restituisce vettori a 768 dimensioni.
CREATE TABLE IF NOT EXISTS public.chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  chunk_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Indice per velocizzare la ricerca per similarità (HNSW o IVFFlat)
-- Usiamo HNSW (Hierarchical Navigable Small World) che è ottimale su pgvector recente
CREATE INDEX ON public.chunks USING hnsw (embedding vector_cosine_ops);

-- 4. RLS Policy per Chunks
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti possono vedere solo i propri chunks" 
ON public.chunks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Utenti possono inserire i propri chunks" 
ON public.chunks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utenti possono eliminare i propri chunks" 
ON public.chunks FOR DELETE USING (auth.uid() = user_id);

-- 5. Funzione per ricerca vettoriale (Similarity Search)
-- Questa funzione prende l'embedding della query (fatta dall'utente) e restituisce i chunk più simili
CREATE OR REPLACE FUNCTION public.match_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid,
  p_course_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  JOIN public.documents d ON c.document_id = d.id
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    AND c.user_id = p_user_id
    -- Filtro opzionale per corso (se l'utente vuole studiare un corso specifico)
    AND (p_course_id IS NULL OR d.course_id = p_course_id)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
