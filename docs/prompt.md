Sei un senior full-stack engineer, software architect e product engineer esperto in applicazioni cloud-first, PWA, Next.js, Supabase, PostgreSQL, pgvector, sistemi RAG, knowledge base, sincronizzazione multi-device, interfacce desktop/web responsive, integrazione AI, chat AI, tutor AI e interazioni vocali in tempo reale.

Il tuo compito è progettare e implementare un’applicazione completa, cloud-first, personale, sicura e a costo minimo, destinata a un singolo utente universitario che vuole sincronizzare e organizzare i propri materiali su PC, iPhone e iPad.

L’app deve essere accessibile come sito web responsive e installabile come PWA su:
- PC desktop
- iPhone
- iPad

Non creare app native separate per iOS, iPadOS o desktop nella prima versione. Usa un’unica codebase web/PWA. Se in futuro servirà un wrapper desktop nativo, dovrà essere fatto tramite Tauri o tecnologia simile, ma non ora. Non usare Electron nella prima versione.

====================================================
OBIETTIVO PRINCIPALE
====================================================

Costruisci un sistema personale chiamato, in mancanza di altro nome, "StudyCloud".

Il sistema deve permettere di:

1. Caricare file da PC, iPhone e iPad.
2. Sincronizzare tutti i file e lo stato su cloud.
3. Organizzare automaticamente i file processati in cartelle cloud ben specifiche.
4. Avere una dashboard della knowledge base e del database vettoriale.
5. Avere un file explorer di tutti i file caricati.
6. Avere un assistente AI per ripetizioni.
7. Avere una chat AI.
8. Avere una sezione impostazioni.
9. Avere una modalità assistente vocale con interazione simile a una conversazione persona-a-persona.
10. Avere sia interfaccia vocale sia interfaccia chat testuale.
11. Essere utilizzabile da browser e come PWA installabile.
12. Mantenere costo minimo, architettura semplice e nessuna complessità prematura.

====================================================
STACK TECNOLOGICO OBBLIGATORIO
====================================================

Usa questo stack:

Frontend:
- Next.js App Router
- TypeScript strict
- Tailwind CSS
- PWA installabile
- Design responsive mobile/tablet/desktop
- UI in italiano

Backend:
- Next.js API routes o Server Actions
- Nessun server locale personale sempre acceso
- Nessun backend separato complesso nella prima versione

Database:
- Supabase Postgres
- Row Level Security attiva
- pgvector per embeddings

Storage:
- Supabase Storage privato
- Upload diretto dal client verso Supabase Storage quando possibile
- I file non devono passare pesantemente attraverso il server Next.js

Auth:
- Supabase Auth
- Login personale
- Sessione protetta
- Nessun endpoint pubblico che esponga dati privati

AI:
- Integrazione AI tramite adapter configurabile
- Modelli configurabili via environment variables
- Non hardcodare nomi di modelli nel codice se non come fallback documentato
- Supporto per:
  - chat/testo
  - embedding
  - classificazione/estrazione metadata
  - speech-to-text
  - text-to-speech
  - eventuale voce real-time se disponibile

Deploy:
- Vercel o piattaforma equivalente serverless
- HTTPS automatico
- Environment variables gestite in modo sicuro

====================================================
PRINCIPI DI COSTO MINIMO
====================================================

L’app deve essere progettata per ridurre al minimo i costi.

Regole obbligatorie:

1. Non processare automaticamente con AI ogni file caricato, salvo job leggeri e necessari.
2. L’AI costosa deve partire solo quando l’utente lo richiede o quando è strettamente necessario.
3. Preferisci estrazione testo economica o gratuita quando possibile.
4. Non usare modelli grandi/proibitivi come default.
5. Il modello economico deve essere il default.
6. Il modello potente deve essere usato solo se:
   - l’utente lo richiede esplicitamente
   - il task fallisce con modello economico
   - il task è classificato come complesso
7. Ogni chiamata AI deve essere loggata con:
   - user_id
   - feature
   - model
   - input_tokens
   - output_tokens
   - estimated_cost
   - timestamp
8. Implementa limiti di utilizzo giornalieri e mensili configurabili.
9. Aggiungi un budget massimo mensile configurabile.
10. Se il budget viene superato, blocca le operazioni AI non essenziali.
11. Usa cache quando possibile.
12. Usa deduplicazione di file, chunk e risposte quando possibile.
13. Non fare embedding multimodali pesanti nella prima versione.
14. Inizia con RAG text-only.
15. Non creare knowledge graph complessi nella prima versione.
16. Non creare un sistema di raccomandazione complesso nella prima versione.
17. Non usare servizi esterni non necessari.
18. Non usare più provider AI contemporaneamente nella prima versione, a meno che non sia necessario per voce/testo/embedding e sia astratto dietro adapter.

====================================================
FUNZIONALITÀ: UPLOAD E SINCRONIZZAZIONE
====================================================

Crea una schermata Upload.

Requisiti:

- Deve funzionare da PC, iPhone e iPad.
- Deve permettere caricamento file tramite:
  - file picker
  - drag and drop su desktop
  - fotocamera su mobile
  - registrazione audio
- Deve supportare almeno:
  - PDF
  - immagini
  - file di testo
  - markdown
  - audio
- Prima dell’upload, l’utente può selezionare:
  - corso/materia
  - tipo documento
  - data
  - note
- Il sistema deve calcolare:
  - hash del contenuto
  - dimensione
  - MIME type
  - nome file
- Se un file con stesso hash esiste già, non duplicarlo:
  - chiedi se sostituire, versionare o annullare
- L’upload deve avvenire direttamente verso Supabase Storage quando possibile.
- Il backend deve salvare metadata su Postgres.
- Lo stato del file deve essere tracciato:
  - uploaded
  - queued
  - extracting
  - organizing
  - processed
  - embedded
  - failed
- Mostra progresso, errori e stato.
- Non salvare i file solo localmente.
- Tutti i file devono essere disponibili sugli altri dispositivi dopo il caricamento.

====================================================
FUNZIONALITÀ: ORGANIZZAZIONE CLOUD DEI FILE
====================================================

Il sistema deve organizzare i file processati in cartelle cloud ben specifiche.

L’organizzazione deve essere basata su metadata, non necessariamente su AI.

Struttura consigliata:

/user_id/inbox/
/user_id/organized/{course_slug}/{academic_year}/{document_type}/{YYYY-MM}/
/user_id/processed/{document_id}/
/user_id/audio_transcripts/
/user_id/extracted_text/
/user_id/summaries/
/user_id/flashcards/
/user_id/archive/

Regole:

1. Appena un file è caricato, finisce logicamente in inbox.
2. Quando il file viene processato, il sistema deve assegnargli una cartella finale.
3. La classificazione può usare:
   - nome file
   - testo estratto
   - metadata inserita dall’utente
   - corso selezionato
   - data
   - tipo documento
4. Usa AI leggera solo per classificazione opzionale, non come unico metodo.
5. Se la classificazione è incerta, lascia il file in una cartella "unclassified" o "inbox" e chiedi conferma all’utente.
6. Ogni spostamento/organizzazione deve essere:
   - idempotente
   - loggato
   - reversibile o almeno tracciato
7. Il database deve essere la fonte di verità.
8. Le cartelle cloud sono una rappresentazione ordinata, ma la vera struttura dati sta in Postgres.
9. Non riorganizzare silenziosamente file già embeddati senza aggiornare riferimenti, chunk e metadati.
10. Se un file viene rinominato o spostato, aggiorna:
   - documents
   - chunks
   - embeddings metadata
   - audit log
   - storage path

====================================================
FUNZIONALITÀ: FILE EXPLORER
====================================================

Crea una pagina File Explorer.

Requisiti:

- Mostrare tutti i file caricati dall’utente.
- Vista lista e vista griglia.
- Breadcrumb delle cartelle.
- Filtri per:
  - corso
  - tipo documento
  - stato processing
  - data
  - embedded/non embedded
- Ricerca per:
  - nome file
  - testo contenuto, se disponibile
  - tag
- Anteprima quando possibile:
  - immagine
  - PDF
  - testo
  - audio
- Dettagli file:
  - nome
  - corso
  - tipo
  - dimensione
  - data
  - stato
  - path cloud
  - numero chunk
  - embedding status
  - ultimo aggiornamento
- Azioni:
  - apri
  - scarica
  - rinomina
  - sposta
  - classifica
  - processa testo
  - genera embeddings
  - elimina
  - vedi chunk
  - vedi citazioni
- L’eliminazione deve essere sicura:
  - soft delete iniziale consigliato
  - eliminazione definitiva con conferma
  - cascade su chunks/embeddings/metadata
- Non mostrare file di altri utenti.
- Ogni azione deve rispettare RLS e permessi.

====================================================
FUNZIONALITÀ: DASHBOARD KNOWLEDGE BASE E DB VETTORIALE
====================================================

Crea una dashboard tecnica e una dashboard utente.

Dashboard utente:

- Numero totale file
- Numero documenti processati
- Numero chunk
- Numero embeddings
- Copertura per corso
- Ultimi file caricati
- File non embeddati
- File falliti
- Utilizzo storage stimato
- Utilizzo AI giornaliero/mensile
- Stato sincronizzazione
- Prossimi esami/scadenze se presenti

Dashboard knowledge base:

- Totale documenti
- Totale chunk
- Totale embeddings
- Dimensioni embedding usate
- Modello embedding corrente
- Embedding mancanti
- Documenti senza testo estratto
- Documenti con processing fallito
- Corsi con più materiale
- Corsi senza materiale
- Ricerche recenti
- Query RAG recenti
- Costo AI stimato per feature

Dashboard vector DB:

- Stato pgvector
- Numero vettori
- Dimensione media vettori
- Indice presente o no
- Query di esempio per debug
- Health check
- Warning se embeddings mancano o sono obsolete
- Possibilità di re-embeddare un documento
- Possibilità di vedere chunk di esempio senza esporre dati sensibili inutilmente

Non esporre vettori grezzi all’utente normale se non in modalità debug esplicita.

====================================================
FUNZIONALITÀ: CHAT AI
====================================================

Crea una pagina Chat AI.

Requisiti:

- Chat conversazionale in italiano.
- Deve poter usare la knowledge base privata dell’utente.
- Deve supportare RAG.
- Deve permettere di selezionare contesto:
  - tutti i corsi
  - un corso specifico
  - un documento specifico
  - una cartella specifica
- Deve recuperare chunk pertinenti da pgvector.
- Deve usare solo chunk appartenenti all’utente autenticato.
- Deve mostrare citazioni verificabili.
- Ogni citazione deve includere:
  - nome documento
  - pagina o posizione
  - corso
  - data
  - link/apertura documento se possibile
- Se non trova informazioni sufficienti, deve dirlo chiaramente.
- Non deve inventare fonti.
- Deve avere limiti di token configurabili.
- Deve loggare costo e token.
- Deve supportare risposte brevi o dettagliate.
- Deve permettere di salvare risposte utili.
- Deve permettere di esportare la conversazione.
- La cronologia chat deve essere sincronizzata su cloud.
- Non salvare la chat solo localmente.

Prompt interno della chat:

- L’assistente deve rispondere in italiano.
- Deve usare solo i frammenti forniti quando è in modalità RAG.
- Deve citare le fonti.
- Deve essere conciso ma utile.
- Deve evitare allucinazioni.
- Deve dire quando non ha abbastanza contesto.

====================================================
FUNZIONALITÀ: ASSISTENTE PER RIPETIZIONI
====================================================

Crea una sezione Tutor/Assistente per ripetizioni.

Requisiti:

- Modalità ripetizione orale/scritta.
- L’utente può scegliere:
  - corso
  - argomento
  - documento
  - livello di difficoltà
  - numero di domande
  - modalità socratica
- L’assistente può:
  - fare domande
  - correggere risposte
  - spiegare errori
  - generare esercizi
  - generare quiz
  - creare flashcards
  - suggerire materiale da ripassare dalla knowledge base
- Deve usare RAG quando possibile.
- Deve citare fonti quando usa materiale dell’utente.
- Deve tracciare:
  - domande fatte
  - risposte utente
  - errori
  - argomenti deboli
  - sessioni di ripetizione
- Gli argomenti deboli possono essere salvati in una tabella "weak_topics".
- Le flashcards possono essere esportate in CSV compatibile con Anki.
- Non costruire un motore di spaced repetition complesso nella prima versione.
- Non creare un clone completo di Anki.

====================================================
FUNZIONALITÀ: VOCE REAL-TIME E INTERFACCIA PERSONA-A-PERSONA
====================================================

Crea una modalità Assistente Vocale.

Requisiti:

- Deve esistere una interfaccia chat testuale.
- Deve esistere una interfaccia vocale.
- La modalità vocale deve sembrare una conversazione persona-a-persona.
- L’interfaccia vocale deve includere:
  - pulsante avvia/termina
  - indicatore visivo di ascolto
  - indicatore visivo di risposta
  - trascrizione visibile
  - sottotitoli live
  - pulsante mute
  - pulsante interrompi
  - stato connessione
  - stato modello
  - fallback a chat testuale

Implementazione voce:

1. Se il provider AI supporta voce real-time streaming, usa quella strada.
2. Se non è disponibile, implementa fallback robusto:
   - registrazione audio browser
   - speech-to-text
   - invio testo al modello
   - risposta testo
   - text-to-speech
3. La modalità real-time completa deve essere opzionale e dietro feature flag.
4. Non bloccare l’app se la voce real-time non è disponibile.
5. La voce deve funzionare almeno in modalità push-to-talk o turn-based.
6. L’audio deve essere catturato solo dopo consenso esplicito dell’utente.
7. Mostra sempre quando il microfono è attivo.
8. Non registrare audio raw di default se non necessario.
9. Salva almeno:
   - trascrizione utente
   - risposta assistente
   - durata sessione
   - modello usato
   - costo stimato
10. L’audio raw può essere eliminato dopo trascrizione per risparmiare storage.
11. Aggiungi impostazioni per:
   - voce assistente
   - velocità voce
   - lingua
   - attivazione vocale
   - salvataggio audio raw
   - modalità bassa latenza
   - limite durata sessione

Interfaccia persona-a-persona:

- Deve essere semplice, pulita, mobile-friendly.
- Può mostrare un avatar minimale, onda audio o stato conversazione.
- Non creare avatar 3D complessi nella prima versione.
- Non usare deepfake o voci non chiare nella provenienza.
- L’utente deve capire quando l’AI sta ascoltando, pensando o parlando.

====================================================
FUNZIONALITÀ: IMPOSTAZIONI
====================================================

Crea una pagina Impostazioni.

Deve includere:

Profilo:
- nome utente
- email
- preferenze lingua

AI:
- modello chat default
- modello tutor default
- modello economico
- modello potente
- modello embedding
- modello speech-to-text
- modello text-to-speech
- modello voce real-time se disponibile
- temperatura/max token/limiti

Knowledge base:
- dimensione embedding
- modello embedding
- re-embedding manuale
- gestione chunk
- documenti esclusi dal RAG

Voce:
- voce TTS
- velocità
- lingua
- salva audio raw
- trascrizione visibile
- modalità push-to-talk o continua

Costi:
- budget giornaliero
- budget mensile
- alert soglia
- blocco automatico
- storico utilizzo

Organizzazione:
- regole cartelle
- naming automatico
- corso predefinito
- anno accademico
- comportamento su file duplicati

Dati:
- export dati
- export conversazioni
- export knowledge base metadata
- elimina account
- elimina tutti i dati
- richiedi conferma per azioni distruttive

Sicurezza:
- cambio password
- sessioni attive se supportato
- logout da tutti i dispositivi se possibile

====================================================
ARCHITETTURA DATI MINIMA
====================================================

Crea almeno queste tabelle, con RLS attiva:

profiles
courses
folders
documents
document_versions
chunks
embeddings o chunks.embedding
jobs
ai_usage
audit_log
chat_sessions
chat_messages
tutor_sessions
tutor_questions
tutor_answers
weak_topics
flashcards
voice_sessions
user_settings
usage_limits

Requisiti:

- Ogni tabella utente deve avere user_id.
- RLS deve garantire accesso solo ai dati dell’utente autenticato.
- Le policy devono essere testate.
- Nessun dato deve essere accessibile anonimanente.
- Le API server-side possono usare service role key solo lato server.
- La service role key non deve mai arrivare al browser.
- Le chiavi AI non devono mai arrivare al browser.

====================================================
REGOLE DI SICUREZZA
====================================================

Obbligatorio:

1. Tutto il traffico deve essere HTTPS.
2. Storage privato.
3. Nessun bucket pubblico.
4. RLS attiva su tutte le tabelle utente.
5. Nessun endpoint pubblico che esponga dati privati.
6. API keys solo server-side.
7. Supabase anon key può essere pubblica, service role no.
8. Validazione input con Zod o simile.
9. Sanitizzazione output quando necessario.
10. Limitazione dimensione upload.
11. Controllo MIME type/estensione.
12. Prevenzione path traversal nei nomi file/cartelle.
13. Firmare URL di download con scadenza breve.
14. Audit log per azioni importanti.
15. Nessun segreto in repository.
16. .env.example senza valori reali.
17. Non loggare token API, password, chiavi private.
18. Non esporre log interni all’utente finale.
19. Le azioni distruttive devono richiedere conferma.
20. L’eliminazione dati deve essere cascante o tracciata.

====================================================
REGOLE DI PERFORMANCE E COSTO
====================================================

1. Non inviare interi documenti al modello se non necessario.
2. Usa chunk piccoli/medi per RAG.
3. Top-k consigliato: 4-8 chunk.
4. Max output chat: 700-1000 token default.
5. Max output tutor: 800-1200 token default.
6. Usa filtri per corso/documento prima della ricerca.
7. Usa cache per:
   - statistiche dashboard
   - risposte frequenti
   - embeddings non modificate
   - metadata documenti
8. Non re-embeddare chunk invariati.
9. Non ri-processare file identici.
10. Usa job asincroni per operazioni lunghe.
11. Le operazioni AI costose devono mostrare stima o warning.
12. La voce real-time deve avere timeout e limiti di durata.
13. Aggiungi fallback quando un modello AI non risponde.
14. Aggiungi retry con backoff solo dove sicuro.
15. Non fare polling pesante continuo.

====================================================
COSA NON DEVI FARE
====================================================

Non devi fare:

1. Non creare un’app nativa iOS separata.
2. Non creare un’app nativa Android separata.
3. Non creare un’app Electron nella prima versione.
4. Non usare un PC locale come server sempre acceso.
5. Non creare sincronizzazione P2P.
6. Non usare iCloud Drive, Google Drive o Dropbox come storage primario nella prima versione.
7. Non creare un sistema multi-tenant complesso se non tramite user_id e RLS.
8. Non usare più database separati senza necessità.
9. Non usare Pinecone, Qdrant, Weaviate o altri vector DB esterni nella prima versione.
10. Non usare MongoDB nella prima versione.
11. Non creare microservizi separati nella prima versione.
12. Non usare Docker/Kubernetes se non strettamente necessario.
13. Non installare dipendenze pesanti senza motivo.
14. Non usare librerie UI complesse se Tailwind e componenti semplici bastano.
15. Non usare LangChain o framework agenti complessi nella prima versione.
16. Non creare un knowledge graph complesso.
17. Non creare spaced repetition avanzata nella prima versione.
18. Non creare notifiche push nella prima versione.
19. Non creare automazioni AI aggressive su ogni upload.
20. Non usare modelli costosi come default.
21. Non salvare audio raw illimitato.
22. Non esporre embeddings grezzi all’utente normale.
23. Non permettere modifica diretta di vettori o chunk senza validazione.
24. Non fare training/fine-tuning nella prima versione.
25. Non scrivere codice finto, placeholder non funzionanti o TODO estesi senza implementazione.
26. Non generare risposte lunghe senza prima verificare i requisiti.
27. Non modificare lo schema database in modo distruttivo senza migration.
28. Non rompere la sincronizzazione multi-device.
29. Non salvare dati privati solo in localStorage.
30. Non commitare segreti, chiavi o file .env locali.

====================================================
REQUISITI PWA
====================================================

L’app deve essere installabile come PWA.

Requisiti:

- manifest.json valido
- icone per mobile e desktop
- theme color
- standalone display
- service worker
- cache statica dell’app shell
- fallback offline minimale
- meta tag per iOS/iPadOS
- Add to Home Screen supportato
- Non cachare dati privati sensibili offline senza necessità.
- La sincronizzazione dati deve avvenire da rete quando disponibile.

====================================================
REQUISITI UX/UI
====================================================

Design:

- Pulito
- Moderno
- Responsive
- Mobile-first
- Ottimo su iPhone/iPad
- Utilizzabile su desktop
- Navigazione semplice
- Tema chiaro e scuro se possibile

Pagine principali:

/login
/register se necessario
/dashboard
/upload
/files
/assistant
/chat
/tutor
/voice
/settings

Navigazione:

- Sidebar su desktop
- Bottom navigation su mobile
- Header con stato sync e budget AI
- Stato globale di caricamento/errore

Accessibilità:

- Contrasto sufficiente
- Pulsanti grandi su mobile
- Focus states
- Label visibili
- Supporto tastiera
- Messaggi di errore chiari

====================================================
OUTPUT RICHIESTO ALL’AI
====================================================

Quando ricevi questo prompt, devi lavorare in modo ordinato.

Prima di scrivere codice:

1. Riassumi brevemente il progetto.
2. Elenca eventuali ambiguità critiche.
3. Se ci sono ambiguità bloccanti, fai massimo 3 domande.
4. Se non ci sono ambiguità bloccanti, procedi con assunzioni minime e documentale.
5. Proponi un piano a milestone.
6. Proponi la struttura del repository.
7. Proponi lo schema database iniziale.
8. Proponi le environment variables necessarie.
9. Implementa il codice milestone per milestone.
10. Non dumpare tutto il progetto in modo disordinato.
11. Per ogni milestone, fornisci:
   - file creati/modificati
   - dipendenze aggiunte
   - comandi da eseguire
   - test manuali da fare
   - eventuali limiti noti

====================================================
MILESTONE CONSIGLIATE
====================================================

Milestone 0: Setup e specifiche
- README
- docs/SPEC.md
- docs/TASKS.md
- docs/ARCHITECTURE.md
- docs/COST-GUARDRAILS.md
- .env.example
- struttura repository

Milestone 1: Base app
- Next.js
- Tailwind
- layout
- PWA base
- pagina health
- pagina login placeholder

Milestone 2: Auth Supabase
- login
- logout
- protezione route
- sessione
- profilo base

Milestone 3: Upload e sincronizzazione
- upload diretto Supabase
- metadata documenti
- stato upload
- lista file
- sync base

Milestone 4: File explorer
- cartelle logiche
- filtri
- ricerca
- dettagli file
- download
- delete

Milestone 5: Organizzazione cloud
- folder rules
- classificazione leggera
- organizzazione automatica
- audit log spostamenti

Milestone 6: Knowledge base e vector DB dashboard
- schema chunks
- embeddings
- dashboard stats
- pagina debug knowledge base

Milestone 7: Chat RAG
- retrieval
- prompt
- citazioni
- chat sessions
- chat history sync

Milestone 8: Tutor/ripetizioni
- sessioni tutor
- domande
- correzioni
- weak topics
- flashcards export

Milestone 9: Voce
- voice settings
- push-to-talk
- STT
- TTS
- trascrizioni
- fallback chat

Milestone 10: Voce real-time opzionale
- integrazione realtime se provider disponibile
- UI conversazionale
- limiti/costi
- fallback

Milestone 11: Hardening
- budget limits
- audit log
- error handling
- test
- ottimizzazioni
- deploy production

====================================================
DEFINIZIONE DI DONE
====================================================

Una milestone è completa quando:

1. Il codice compila.
2. `pnpm lint` passa o non mostra errori bloccanti.
3. `pnpm build` passa.
4. TypeScript non dà errori.
5. Le route protette richiedono login.
6. I dati sono isolati per utente.
7. Nessun segreto è nel codice.
8. Le API validano input.
9. L’app è responsive su mobile/tablet/desktop.
10. Le feature implementate sono testabili manualmente.
11. I costi AI sono loggati.
12. Non sono state aggiunte feature fuori scope.
13. Eventuali assunzioni sono documentate.

====================================================
REGOLE FINALI DI COMPORTAMENTO
====================================================

- Non essere vago.
- Non proporre architetture enormi.
- Non aggiungere feature non richieste.
- Non usare servizi esterni non necessari.
- Preferisci soluzioni semplici, manutenibili e verificabili.
- Se devi scegliere tra feature avanzata e costo minimo, scegli costo minimo.
- Se devi scegliere tra complessità e robustezza ragionevole, scegli robustezza ragionevole.
- Se un requisito è impossibile con lo stack scelto, spiega perché e proponi l’alternativa più semplice.
- Mantieni il codice leggibile.
- Usa componenti riutilizzabili ma senza over-engineering.
- Ogni volta che introduci una chiamata AI, aggiungi logging e limite.
- Ogni volta che introduci storage, aggiungi sincronizzazione e metadata.
- Ogni volta che introduci voce, aggiungi stato, errore, fallback e consenso.

Inizia ora producendo:

1. Architettura consigliata.
2. Struttura del repository.
3. Schema database iniziale.
4. Environment variables necessarie.
5. Piano milestone.
6. Primo codice per Milestone 0 e Milestone 1.