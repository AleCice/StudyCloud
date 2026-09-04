# Architettura StudyCloud

- **Frontend**: Next.js App Router (React, Tailwind CSS)
- **Database**: PostgreSQL su Supabase, pgvector
- **Autenticazione**: Supabase Auth (RLS abilitato)
- **AI**: Vercel AI SDK per LLM routing (OpenAI, Gemini)

## Flusso Dati
- L'utente carica un file su Supabase Storage.
- Il frontend salva un record su `documents`.
- Un background worker/webhook estrae il testo, genera chunks ed embeddings.
- Le chiamate chat usano i chunks per fare RAG.
