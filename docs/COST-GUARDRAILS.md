# Linee Guida per Contenimento Costi AI

- Usare pdf-parse e parser client-side quando possibile per i PDF nativi per evitare costi OCR/VLM.
- Default chat model: Modello economico (es. Gemini 1.5 Flash o GPT-4o-mini).
- Chiamate costose (es. GPT-4o, Gemini 1.5 Pro) solo su richiesta esplicita.
- Chunking intelligente e deduplicazione embeddings.
- Tracciamento token obbligatorio ad ogni inferenza in `ai_usage`.
- Budget setting e alert system.
