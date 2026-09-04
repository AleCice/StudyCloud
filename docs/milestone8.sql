-- ==========================================
-- Milestone 8: Tutor/Ripetizioni AI
-- ==========================================

-- 1. Tabella delle sessioni di ripetizione
CREATE TABLE public.tutor_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL, -- Opzionale: se l'utente vuole ripassare solo un documento
  difficulty text DEFAULT 'Medium', -- 'Easy', 'Medium', 'Hard'
  status text DEFAULT 'in_progress', -- 'in_progress', 'completed'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabella dei messaggi all'interno di una sessione di ripetizione
CREATE TABLE public.tutor_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.tutor_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL, -- 'user', 'assistant'
  content text NOT NULL,
  feedback text, -- Feedback opzionale del tutor (es. "Corretto!", "Quasi, ma ti sei dimenticato X")
  is_correct boolean, -- Valutazione booleana opzionale per le statistiche
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabella per tracciare gli argomenti deboli
CREATE TABLE public.weak_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  topic_name text NOT NULL,
  description text,
  occurrences integer DEFAULT 1,
  status text DEFAULT 'active', -- 'active', 'reviewed', 'mastered'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabella per le Flashcards
CREATE TABLE public.flashcards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  tags text[],
  next_review timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurazione RLS per le nuove tabelle
ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weak_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Policy tutor_sessions
CREATE POLICY "Gli utenti possono vedere le proprie sessioni tutor" ON public.tutor_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono inserire le proprie sessioni tutor" ON public.tutor_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono aggiornare le proprie sessioni tutor" ON public.tutor_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono eliminare le proprie sessioni tutor" ON public.tutor_sessions FOR DELETE USING (auth.uid() = user_id);

-- Policy tutor_messages
CREATE POLICY "Gli utenti possono vedere i propri messaggi tutor" ON public.tutor_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono inserire i propri messaggi tutor" ON public.tutor_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono aggiornare i propri messaggi tutor" ON public.tutor_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono eliminare i propri messaggi tutor" ON public.tutor_messages FOR DELETE USING (auth.uid() = user_id);

-- Policy weak_topics
CREATE POLICY "Gli utenti possono vedere i propri argomenti deboli" ON public.weak_topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono inserire i propri argomenti deboli" ON public.weak_topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono aggiornare i propri argomenti deboli" ON public.weak_topics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono eliminare i propri argomenti deboli" ON public.weak_topics FOR DELETE USING (auth.uid() = user_id);

-- Policy flashcards
CREATE POLICY "Gli utenti possono vedere le proprie flashcard" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono inserire le proprie flashcard" ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono aggiornare le proprie flashcard" ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Gli utenti possono eliminare le proprie flashcard" ON public.flashcards FOR DELETE USING (auth.uid() = user_id);
