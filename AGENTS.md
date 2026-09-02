# AGENTS.md — Regole operative per Agente 444

## 1. Documenti da leggere

Prima di modificare il progetto, leggere:

- `docs/CONCEPTS.md`: principi e invarianti concettuali;
- `docs/CURRENT_STATE.md`: fotografia del comportamento implementato;
- `docs/CHAT_AGENT_VISION.md`: visione futura della componente conversazionale;
- `docs/BETA_BACKLOG.md`: problemi, idee, bug, audit e priorità correnti.

## 2. Gerarchia delle fonti

Per sapere cosa fa oggi l'app, il codice reale è la fonte primaria. `CURRENT_STATE.md` lo documenta, ma va verificato contro il codice quando necessario. `CONCEPTS.md` definisce principi, non prova implementazione. `CHAT_AGENT_VISION.md` descrive una funzione futura non implementata. `BETA_BACKLOG.md` raccoglie lavoro potenziale, non requisiti automaticamente approvati. Non presentare mai un'idea futura come comportamento esistente.

## 3. Distinzione obbligatoria

Separare sempre:

- concetti e invarianti;
- parametri configurabili;
- comportamento implementato;
- backlog futuro;
- ipotesi.

Pesi, percentuali, soglie, moltiplicatori e coefficienti non sono automaticamente definitivi. Non introdurre numeri magici senza origine e motivazione.

## 4. Prima di modificare il codice

Per una modifica non banale, analizzarne utilità e logica, identificare i file coinvolti e valutare impatti, regressioni, casi limite, desktop/mobile, `localStorage` e backup. Non inventare comportamenti ambigui. Se il task è chiaramente autorizzato e operativo, procedere senza richiedere conferme ridondanti.

## 5. Regole per gli algoritmi

Per ogni modifica algoritmica importante:

1. ricostruire la formula implementata;
2. definire ogni variabile;
3. indicare la provenienza dei dati;
4. mostrare almeno un esempio numerico verificabile a mano;
5. spiegare il significato del risultato;
6. verificare casi estremi;
7. verificare doppio conteggio;
8. verificare soglie arbitrarie;
9. distinguere parametri correnti e invarianti;
10. confrontare l'output con casi reali.

Se un risultato appare incoerente, ricostruire il calcolo e identificare dato, parametro o vincolo responsabile; non difendere automaticamente la formula esistente.

## 6. iCà

L'iCà è da rivalutare: non assumerne corretta la formula solo perché implementata. Benchmark noto: Falcone circa 80 contro Di Gregorio circa 71. Verificare la distinzione fra qualità individuale, valore fantacalcistico, contesto della squadra e desiderabilità d'asta. Non correggere manualmente singoli giocatori: auditare il modello.

## 7. Consiglio prezzo

Mantenere distinti limite finanziario globale, limite strategico del reparto, massimo valore/PMA e tetto consigliato. Non assumerli in un ordine numerico fisso; la UI deve rappresentarne l'ordine reale.

## 8. Chiamata consigliata

Considerare soltanto il ruolo attivo. Distinguere qualità, sostenibilità, coerenza con il reparto e opportunità di mercato. Evitare doppie penalizzazioni, mantenere compatibilità con gli obiettivi e non duplicare inutilmente Top iCà.

## 9. Portieri

I portieri hanno un dominio dedicato: non applicare automaticamente `budget ruolo / numero slot` né la stessa logica di D/C/A a P1/P2/P3. Tenere separati matrice legacy di Insights, calendario, gerarchie, piani strategici ed economia portieri.

## 10. Scarti

Gli scarti escludono soltanto dal ranking automatico: non rendono un giocatore venduto e non ne impediscono la selezione manuale. Appartengono alla singola asta, devono essere riabilitabili e non devono contaminare altre aste.

## 11. Manager, leghe e storico

L'identità permanente è il manager, non il nome squadra. Aste e divisioni devono poter mantenere stato indipendente pur condividendo i database. Non assumere che l'attuale `AppState` implementi già multi-lega o multi-asta. Storico e profili devono conservare il contesto.

## 12. AI e chatbot

La componente AI non è implementata. Prima di lavorarvi, rileggere `docs/CHAT_AGENT_VISION.md`. Applicare “registro prima dell'AI”: l'app è fonte dei fatti; l'AI interpreta, spiega e propone senza modificare autonomamente lo stato. La proattività deve essere controllata e le profilazioni validate prima della memoria permanente. Non scegliere automaticamente stack, provider o backend senza progettazione.

## 13. Database

Prima di cambiare schema, verificare file reali, intestazioni, ID, valori mancanti e tutti i consumer; preservare la compatibilità quando possibile. Non adattare il codice a database futuri non ancora disponibili.

## 14. Persistenza

Preservare `localStorage`, chiave esistente, normalizzazione dello stato e compatibilità dei backup. Ogni modifica strutturale deve prevedere compatibilità con dati precedenti, migrazione o fallback e comportamento dei backup importati.

## 15. UI/UX

L'app è usata durante aste reali: privilegiare velocità, leggibilità, pochi tap, segnali chiari, desktop, iPhone/PWA, target touch, focus visibili e reduced motion. Non aggiungere animazioni che rallentino il flusso.

## 16. Validazione tecnica

Prima di dichiarare completa una modifica:

- eseguire `npm run build` e correggere errori TypeScript/Vite;
- verificare handler e interazioni toccate;
- controllare ID duplicati quando cambia il markup;
- verificare `onclick`/event delegation quando coinvolti;
- controllare regressioni desktop e mobile;
- verificare il caricamento dello storage esistente;
- applicare controlli sintattici pertinenti a JavaScript/TypeScript generato o script esterni.

Non dichiarare superato un controllo non realmente eseguito.

## 17. Modalità di lavoro

Per task complessi: analizzare, proporre, implementare. Per task semplici e chiaramente richiesti, implementare direttamente. Non riscrivere file a memoria: lavorare sulla versione reale della repository.

## 18. Git

Prima di modifiche importanti, controllare `git status`, preservare il lavoro non committato e preferire cambi piccoli e leggibili. Non eseguire commit o push senza richiesta esplicita.

## 19. Regola finale

In caso di conflitto:

- **codice reale**: comportamento implementato;
- **`CONCEPTS.md`**: principi;
- **`CURRENT_STATE.md`**: fotografia documentata dell'implementazione;
- **`CHAT_AGENT_VISION.md`**: visione futura dell'AI;
- **`BETA_BACKLOG.md`**: lavoro da valutare e prioritizzare.

Non confondere questi livelli.
