# Agente 444 — Stato corrente implementato

## Stato del documento

Questo documento descrive esclusivamente il comportamento osservabile nel codice attualmente presente nella repository.

La ricognizione è riferita al commit `72f550e` del branch `main` (12 settembre 2026), analizzato il 9 ottobre 2026. La versione precedente del documento descriveva il commit `e550c19` del 2 settembre 2026.

Il documento non definisce requisiti futuri e non trasforma i valori numerici correnti in invarianti. I principi di prodotto e gli invarianti concettuali sono descritti separatamente in [`docs/CONCEPTS.md`](./CONCEPTS.md). Quando il codice contiene commenti su sviluppi futuri, tali commenti sono riportati soltanto come indicazione di una parte incompleta, non come funzionalità disponibile.

In sintesi, la repository contiene una SPA client-side per la gestione di un'asta Fantacalcio, utilizzabile localmente e distribuita tramite GitHub Pages. Lo stato operativo è salvato nel browser e tutti i calcoli sono eseguiti nel client. I dati dei giocatori provengono, quando raggiungibile, dal servizio esterno **FLDA** (`fantalab-data-agent`, progetto separato) tramite API HTTP; se FLDA non risponde, l'app ricade sui CSV inclusi nel bundle (modalità "legacy"). Non risultano implementati backend proprio, autenticazione, sincronizzazione remota dello stato o integrazione con un modello AI.

### Principali cambiamenti rispetto alla ricognizione del 2 settembre

- integrazione FLDA: client HTTP, repository giocatori con cache, mappatura identità legacy ↔ FLDA, pannello di stato/aggiornamento in Import/Export;
- assegnazioni identificate con UUID FLDA (`fldaPlayerId`), con compatibilità per i record legacy;
- iCà V2 (da storico FLDA) come indice mostrato in Players, Asta e schede;
- pagina Players riscritta su dati FLDA; nuova pagina "scheda completa giocatore";
- indicatori della rosa (`rosterMetrics`) e prezzo storico d'asta 2025/26 nella pagina Asta;
- configurazione PMA (`pmaConfiguration`: Classic/Mantra, partecipanti, modificatore);
- nuovi pesi della Chiamata consigliata;
- suite di test con `npm test`;
- script di avvio locale (`run-local.ps1`, `run-mac`).

---

## 1. Stack e struttura generale

### Stack effettivo

- TypeScript `~6.0.2`.
- Vite `^8.2.2`.
- Moduli ECMAScript (`"type": "module"`).
- HTML e CSS senza framework UI.
- Rendering tramite stringhe HTML assegnate a `innerHTML` e binding diretto degli eventi DOM.
- Persistenza tramite `window.localStorage`.
- Import dei CSV come testo tramite query Vite `?raw`.
- Chiamate HTTP al servizio FLDA tramite `fetch` nativo (`src/services/flda.ts`).
- Test con il runner nativo di Node (`node --test`), che esegue direttamente i file `.ts`.

Le sole dipendenze dichiarate sono TypeScript e Vite, entrambe in `devDependencies` (`package.json`). Non risultano librerie runtime esterne, framework frontend, librerie client HTTP, SDK AI o librerie di stato.

### Struttura

| Percorso | Responsabilità implementata |
| --- | --- |
| `index.html` | Shell HTML con elemento `#app` e caricamento di `src/main.ts`. |
| `src/main.ts` | Bootstrap, stato in memoria, rendering globale, navigazione e ciclo di vita dell'asta. |
| `src/app/` | Stato, persistenza, router in memoria, motion degli overlay e favicon dinamica. |
| `src/pages/` | Rendering e interazioni delle sei pagine di navigazione e della pagina "scheda completa giocatore". |
| `src/components/` | Navigazione, snapshot giocatore in overlay e funzioni di rendering condivise dei dati giocatore. |
| `src/data/` | Parsing e indicizzazione dei CSV incorporati. |
| `src/domain/` | Modello del giocatore e algoritmi deterministici. |
| `src/services/` | Client FLDA, repository giocatori con cache, identità legacy ↔ FLDA, risoluzione dei giocatori in asta e adattatore verso gli algoritmi. |
| `src/styles/` e `src/style.css` | Stili globali, per pagina e responsive. |
| `database/` | Sette file CSV inclusi nella build (fonte legacy e dati Insights/portieri). |
| `public/` | Favicon e sprite SVG. |
| `tests/` | Dieci file di test (`*.test.ts`). |
| `.env.production` | Variabile `VITE_FLDA_API_URL` con l'indirizzo FLDA usato dalla build di produzione. |
| `run-local.ps1`, `run-mac` | Avvio locale di FLDA (porta 8765) e del dev server Vite (porta 5173). |
| `.github/workflows/deploy.yml` | Build e deploy su GitHub Pages. |

`package.json` espone lo script `test` (`node --test tests/*.test.ts`); non esiste uno script `lint`.

---

## 2. Entry point, rendering e routing

### Entry point

`index.html` monta l'applicazione in `<div id="app"></div>` e carica `/src/main.ts` come modulo.

All'avvio, `src/main.ts`:

1. importa gli stili globali e quelli delle pagine;
2. carica una sola volta lo stato tramite `loadState()`;
3. inizializza la favicon in base alla fase dell'asta;
4. esegue `render()`.

`render()` ricostruisce interamente il contenuto di `#app`, renderizza la navigazione, renderizza la pagina attiva, compatta alcune testate spostandone le azioni nella topbar, inserisce l'analisi concorrenti nella pagina Asta e infine registra gli handler della pagina corrente (`src/main.ts`).

### Routing

Il routing è esclusivamente in memoria (`src/app/router.ts`):

- la pagina iniziale è sempre `dashboard`;
- `navigateTo(page)` modifica una variabile di modulo;
- non vengono usati URL, History API, hash route o parametri di percorso;
- un refresh riporta quindi la vista alla Dashboard, pur conservando lo stato applicativo in `localStorage`.

Gli identificativi di pagina sono definiti in `src/components/navigation.ts`:

- `dashboard`;
- `auction`;
- `players`;
- `objectives`;
- `insights`;
- `importExport`;
- `playerDetail`.

`playerDetail` (scheda completa giocatore) non compare fra le voci della topbar: vi si accede dallo snapshot giocatore della pagina Players. Il riferimento del giocatore selezionato è una variabile di modulo in `src/main.ts` e non viene persistito.

La voce Asta è disabilitata soltanto durante `setup`; rimane accessibile durante `live` e `finalizing` (`src/components/navigation.ts`).

---

## 3. Pagine presenti

### Dashboard

Implementata in `src/pages/dashboard.ts`.

La Dashboard consente, durante la fase `setup`, di:

- impostare i crediti iniziali, con minimo 1;
- attivare o disattivare il modificatore difesa (il valore viene scritto sia in `defenseModifierEnabled` sia in `pmaConfiguration.defenseModifier`);
- scegliere un profilo di budget o inserire percentuali personalizzate per P, D, C e A;
- creare e modificare manager;
- distinguere nome, cognome, alias e nome squadra;
- rendere un manager owner;
- attivare/disattivare o archiviare un manager;
- aprire un recap della configurazione;
- avviare l'asta se la distribuzione somma a 100 e c'è almeno un manager attivo.

Durante una fase diversa da `setup`, i controlli di configurazione e gestione manager sono bloccati. Sono mostrati stato dell'asta, crediti, partecipanti e distribuzione del budget.

I profili attualmente codificati in `BUDGET_PROFILES` sono parametri UI correnti:

| Profilo | P | D | C | A |
| --- | ---: | ---: | ---: | ---: |
| Prudente | 13 | 25 | 26 | 36 |
| Equilibrata | 10 | 25 | 30 | 35 |
| Aggressiva | 8 | 22 | 30 | 40 |

Nota: il valore predefinito dello stato per il profilo `equilibrata` è invece `P 11, D 21, C 23, A 45`; non coincide con il preset Dashboard `10/25/30/35` (`src/app/state.ts`, `src/pages/dashboard.ts`).

### Auction

Implementata in `src/pages/auction.ts`, con orchestrazione del ciclo di vita in `src/main.ts`.

Durante `live` offre:

- selezione del ruolo attivo P/D/C/A;
- selezione di un giocatore per squadra o per nome;
- chiamata dalla pagina Players, dallo snapshot o dalla scheda completa del giocatore;
- visualizzazione di iCà (V2), PMA, consenso, MV, FMV e titolarità;
- prezzo storico d'asta 2025/26 Serie A / Serie B, se fornito da FLDA (`src/domain/historicalAuctionPrice.ts`);
- indicatori della rosa dell'owner per reparto (iCà, titolarità, prestazione), descritti nella sezione 10.4;
- visualizzazione del consiglio prezzo e dei tre limiti;
- input rapido del prezzo e pulsanti di incremento/decremento;
- segnale `SALI`, `ATTENZIONE` o `STOP` aggiornato sul prezzo inserito;
- aggiudicazione a un manager attivo;
- registrazione opzionale dell'ultimo offerente avversario e della sua offerta;
- marcatura del giocatore come non assegnato senza creare un record;
- storico corrente delle assegnazioni;
- modifica o annullamento di assegnazioni già registrate;
- annullamento dell'ultima assegnazione;
- pannello partecipanti con crediti, spese e slot per ruolo;
- Chiamata consigliata, alternative, Top iCà e gestione degli scarti;
- scheda completa del giocatore;
- analisi concorrenti per il giocatore selezionato.

L'aggiudicazione valida che:

- il prezzo sia un intero positivo;
- il vincitore abbia crediti sufficienti;
- il vincitore non abbia già completato gli slot del ruolo;
- il secondo offerente, se presente, sia diverso dal vincitore;
- l'offerta del secondo sia positiva e non superiore al prezzo finale.

I limiti di rosa correnti sono `P 3, D 8, C 8, A 6` (`src/domain/auctionContext.ts`).

Quando i dati FLDA sono disponibili, il giocatore chiamato viene memorizzato in `currentAuctionFldaPlayerId` e le nuove aggiudicazioni salvano soltanto `fldaPlayerId` (UUID FLDA), senza `playerId` legacy. Il controllo "già assegnato" (`isFldaPlayerAssigned`) riconosce sia i record FLDA sia quelli legacy tramite la mappatura delle identità. Gli algoritmi di prezzo, raccomandazione e concorrenti ricevono uno stato e un elenco giocatori adattati da `buildAuctionStrategyContext` (`src/services/auctionStrategyAdapter.ts`, sezione 8.1).

Il segnale d'offerta (`getBidSignal` in `src/pages/auction.ts`) funziona così:

- `STOP` se il prezzo supera il limite finanziario o il tetto consigliato;
- `SALI` se non esiste un limite di comfort oppure il prezzo non supera il minimo tra limite di valore e limite di reparto;
- `ATTENZIONE` negli altri casi, cioè oltre la zona di comfort ma non oltre il tetto.

Terminare l'asta passa da `live` a `finalizing`. In finalizzazione l'utente sceglie fra:

- **Registra asta:** copia le assegnazioni in `archivedAuctions`, svuota la sessione corrente e torna in `setup`;
- **Scarta asta:** elimina le assegnazioni correnti e torna in `setup`.

Entrambe le operazioni azzerano anche la selezione corrente; gli scarti della raccomandazione vengono azzerati dagli handler di finalizzazione (`src/main.ts`, `src/pages/auction.ts`).

### Players

Implementata in `src/pages/players.ts`.

La pagina è stata riscritta sul dataset FLDA (`loadPlayersDataset` in `src/services/playerRepository.ts`). Mostra una tabella con:

- ruolo, nome, squadra e badge (titolare, P1, rigori, punizioni, corner) ricavati da FLDA;
- iCà V2;
- PMA percentuale, calcolato da FLDA secondo `pmaConfiguration` (`src/domain/pma.ts`);
- xFM (`fm_exp` FLDA);
- titolarità;
- MV/FMV, letti dal giocatore legacy collegato tramite identità;
- stato rispetto all'asta corrente.

Sono disponibili:

- filtri per ruolo e per squadra;
- ricerca per nome o squadra;
- filtri "Solo liberi" (attivo soltanto durante un'asta live), "Titolare XI", "P1", "Rigorista", "Punizioni", "Corner";
- ordinamento per iCà, xFM, titolarità, MV/FMV, stato, nome e squadra;
- snapshot del giocatore in overlay, con dettaglio FLDA caricato su richiesta;
- passaggio alla scheda completa (`playerDetail`);
- chiamata diretta in Asta se la sessione è live e il giocatore non è assegnato;
- pulsante di nuovo tentativo se il caricamento FLDA fallisce.

Se FLDA non è raggiungibile la pagina usa il listone legacy convertito in forma FLDA, senza iCà V2 e senza xFM; il piè di pagina indica "Fonte FLDA" oppure "Fonte legacy". La colonna "consenso" non è più presente.

### Scheda completa giocatore

Implementata in `src/pages/playerDetail.ts`. Carica dettaglio giocatore e guida squadra da FLDA e mostra: intestazione con badge e pulsante CHIAMA, panoramica dell'ultima stagione, grafici prezzi dei Saggi e storico MV/FMV, dati d'asta correnti con prezzo storico, statistiche di ruolo, indicazioni qualitative, guida della squadra (allenatore, modulo, attacco, difesa, commenti) e statistiche avanzate. Il pulsante "← Giocatori" riporta alla pagina Players.

### Objectives

Implementata in `src/pages/objectives.ts`.

Consente di:

- cercare giocatori per nome o squadra;
- aggiungere un giocatore una sola volta;
- assegnargli una priorità `primary`, `secondary`, `third`, `fourth` o `bet`;
- modificare la priorità;
- rimuovere l'obiettivo;
- visualizzare gli obiettivi raggruppati per ruolo e priorità;
- tornare rapidamente all'Asta quando è live.

La ricerca di Objectives usa ancora il listone legacy (`src/data/players.ts`): gli obiettivi sono quindi salvati con ID legacy. In modalità FLDA l'adattatore della strategia conserva l'ID legacy per i giocatori collegati, così la priorità continua a essere riconosciuta.

Ogni obiettivo contiene anche `weight: 1`. Questo campo è un placeholder: viene normalizzato a 1 e non è usato dagli algoritmi. La Chiamata consigliata usa invece direttamente la categoria `priority` (`src/domain/objective.ts`, `src/app/storage.ts`, `src/domain/recommendation.ts`).

### Insights

Implementata in `src/pages/insights.ts`.

Contiene tre aree informative:

1. **Abbinamenti portieri:** ricerca squadra, tre abbinamenti consigliati e matrice completa in overlay.
2. **Rigori/Piazzati:** gerarchie dei battitori per squadra.
3. **Impatto allenatori:** allenatore, modulo, disposizione grafica e valori per macro-ruolo Mantra.

La pagina usa direttamente tre CSV: Allenatori, Portieri e Battitori. La matrice `MisterCana_DB_Portieri.csv` viene descritta nel codice come “legacy” ed è separata dal calendario a 38 giornate usato dal dominio strategico dei portieri.

Le interazioni Insights sono registrate tramite event delegation una volta al caricamento del modulo. Ricerca, selezione squadra, apertura/chiusura matrice ed Escape sono operativi (`src/pages/insights.ts`).

### Import/Export

Implementata in `src/pages/importExport.ts`, con serializzazione e validazione in `src/app/storage.ts`.

La pagina presenta:

- sezione **Fonti dati locali** (FLDA): indirizzo del servizio in uso, stato di salute (`/api/health`), stato dei dataset (`/api/status`) con esito, numero di record, avvisi e blocchi, e pulsanti di aggiornamento (`/api/update`) per tutti i dataset o per `players`, `guide`, `grid`, `history`;
- esportazione del backup JSON completo;
- selezione, validazione, anteprima e conferma di ripristino del backup;
- esportazione CSV delle assegnazioni correnti.

Gli handler vengono registrati automaticamente al caricamento del modulo tramite event delegation. Il ramo `importExport` di `bindPageEvents()` in `src/main.ts` non registra handler, ma la pagina non è puramente visiva: le funzioni sono operative grazie alla chiamata a `bindImportExportEvents()` in fondo al relativo modulo.

---

## 4. Componenti condivisi

### Navigazione

`src/components/navigation.ts` genera la topbar, le sei voci di pagina, gli indicatori Dashboard/Asta e il badge LIVE. Espone inoltre il contenitore `#topbarPageActions`, nel quale `src/main.ts` sposta azioni selezionate dalle testate delle pagine.

### Scheda dettagli giocatore

`src/components/playerDetailOverlay.ts` è stata ridotta a uno **snapshot** in overlay ("SNAPSHOT GIOCATORE"): badge, stato, metriche correnti, grafici prezzi dei Saggi e storico MV/FMV, ultime statistiche di ruolo, pulsante CHIAMA e, dalla pagina Players, il pulsante "Apri scheda completa". I dati arrivano dal dettaglio FLDA; se l'identità FLDA manca, viene mostrato un avviso e si usano i dati legacy.

`src/components/playerDataView.ts` raccoglie le funzioni di rendering condivise fra snapshot, scheda completa e Players: view model del giocatore, badge, metriche correnti (con PMA secondo `pmaConfiguration`), grafici SVG, gerarchie ed escaping HTML.

`src/data/playerDetail.ts` (parsing dei CSV per la vecchia scheda) esiste ancora.

### Modal

`src/components/modal.ts` esiste ma è vuoto e non è importato. Gli overlay effettivi sono implementati direttamente nelle pagine e nel componente di dettaglio.

---

## 5. Stato applicativo

Il modello è definito in `src/app/state.ts`.

### Campi persistiti

| Campo | Contenuto corrente |
| --- | --- |
| `auctionPhase` | `setup`, `live` o `finalizing` nello stato normalizzato. I tipi includono anche `archived` e `discarded`, ma il loader li converte in `setup`. |
| `currentAuctionPlayerId` | ID legacy del giocatore attualmente chiamato o `null`. |
| `currentAuctionFldaPlayerId` | UUID FLDA del giocatore chiamato dai flussi FLDA, o `null`. I due campi sono alternativi: chiamare un giocatore FLDA azzera l'ID legacy e viceversa. |
| `pmaConfiguration` | `mode` (`classic`/`mantra`), `participants` (8/10/12) e `defenseModifier`: selezionano la colonna PMA FLDA da usare. |
| `auctionAssignments` | Acquisti della sessione corrente. |
| `archivedAuctions` | Aste archiviate con ID, data ISO e copia delle assegnazioni. |
| `recommendedDiscards` | ID esclusi dalla raccomandazione automatica corrente. |
| `initialCredits` | Crediti iniziali comuni ai manager. |
| `defenseModifierEnabled` | Flag configurabile e mostrato in Dashboard. |
| `budgetProfile` | Profilo selezionato. |
| `budgetDistribution` | Percentuali P/D/C/A. |
| `managers` | Identità, alias, squadra, owner, attività e archiviazione. |
| `objectives` | Giocatore, priorità e peso placeholder. |

Un'assegnazione contiene ID, manager, prezzo, l'identità del giocatore e, facoltativamente, ID e prezzo del secondo offerente. L'identità del giocatore è `playerId` (ID legacy, presente sui record creati prima della migrazione FLDA) e/o `fldaPlayerId` (UUID FLDA, usato dalle nuove aggiudicazioni); almeno uno dei due è obbligatorio. Viene registrato al massimo un secondo offerente: il modello non conserva l'intera sequenza dei rilanci né l'elenco completo dei manager che hanno partecipato all'asta del giocatore.

Il manager possiede un ID persistente nello stato. Il contesto storico del manager, incluso il nome della squadra relativo a una specifica stagione o asta, non viene però versionato dentro `ArchivedAuction`: le assegnazioni archiviate continuano a riferirsi al manager tramite il suo ID e i dati contestuali restano quelli presenti nell'array globale `managers`.

`ArchivedAuction` non è uno snapshot completo della strategia della sessione: conserva soltanto ID dell'archivio, data di archiviazione e copia delle assegnazioni. Non conserva una copia per asta di `budgetDistribution`, `objectives`, `recommendedDiscards` o di altra configurazione strategica.

### Stato predefinito

- fase `setup`;
- 500 crediti;
- modificatore difesa **attivato** (`defenseModifierEnabled: true`; nella ricognizione del 2 settembre era disattivato);
- `pmaConfiguration`: Classic, 8 partecipanti, con modificatore;
- profilo `equilibrata`;
- distribuzione `P 11, D 21, C 23, A 45`;
- un owner attivo con ID `owner` e nome `Gabriele`;
- nessuna assegnazione, asta archiviata, esclusione o obiettivo.

Questi sono valori correnti del codice, non invarianti concettuali.

### Stato UI non persistito

Routing e varie selezioni visuali sono variabili di modulo e non vengono salvati. Fra queste: pagina attiva, giocatore della scheda completa, ruolo attivo dell'Asta, filtri e ordinamento Players, ricerca e priorità selezionata in Objectives, selezione squadra in Insights, overlay aperti e feedback temporanei.

Anche i dati FLDA (dataset giocatori, storico bulk, risultati iCà V2, dettagli giocatore, guide e calendari squadra) sono tenuti soltanto in cache in memoria (`src/services/playerRepository.ts`) e vengono ricaricati a ogni avvio; non sono scritti in `localStorage` né nei backup.

---

## 6. Persistenza e chiavi browser

`src/app/storage.ts` usa una sola chiave:

```text
mistercana_app_state_v1
```

Non risultano altre chiavi `localStorage` né usi di `sessionStorage`, IndexedDB o cookie.

`saveState()` serializza l'intero `AppState` come JSON. `loadState()`:

- restituisce una copia del default se la chiave manca o il JSON è invalido;
- normalizza fase, selezione, manager, obiettivi, assegnazioni, archivi e scarti;
- migra il vecchio campo manager `name` verso nome/cognome;
- accetta il vecchio `participantId` per le assegnazioni;
- accetta assegnazioni con `playerId`, `fldaPlayerId` o entrambi, scartando quelle prive di entrambi; i duplicati sono riconosciuti per chiave `flda:<uuid>` oppure `legacy:<id>`;
- conserva `currentAuctionFldaPlayerId` soltanto nelle fasi `live` o `finalizing`;
- normalizza `pmaConfiguration`; se manca o non è valida usa il default, ereditando il vecchio `defenseModifierEnabled` quando presente;
- converte la vecchia fase `completed` in `finalizing`;
- converte `archived` e `discarded` in `setup`;
- conserva assegnazioni correnti, scarti e giocatore selezionato soltanto nelle fasi `live` o `finalizing`;
- elimina duplicati di giocatori nelle assegnazioni e negli obiettivi;
- accetta soltanto prezzi interi positivi.

La normalizzazione di `budgetProfile` non verifica esplicitamente che il valore appartenga all'unione TypeScript; un JSON esterno strutturalmente sufficiente può quindi conservare a runtime un valore non previsto.

---

## 7. Database e file dati presenti

I CSV sono separati da `;` e importati nel bundle come testo.

| File | Righe presenti, intestazione inclusa | Uso corrente |
| --- | ---: | --- |
| `database/MisterCana_DB_Giocatori_2026_27.csv` | 505 | Listone e statistiche base dei giocatori. |
| `database/MisterCana_DB_Saggi.csv` | 2416 | Fasce, affidabilità, integrità e prezzi per fonte/Saggio. |
| `database/MisterCana_DB_Allenatori.csv` | 21 | Moduli e impatti per ruoli/macro-ruoli. |
| `database/MisterCana_DB_Battitori.csv` | 21 | Gerarchie rigori e piazzati. |
| `database/MisterCana_DB_Portieri_Calendario.csv` | 21 | Valori 0/1/2 per 38 giornate, usati per copertura strategica. |
| `database/MisterCana_DB_Portieri_Gerarchie.csv` | 62 | Gerarchie P1/P2/P3 per ID e squadra. |
| `database/MisterCana_DB_Portieri.csv` | 21 | Matrice legacy di abbinamento fra squadre, usata nella pagina Insights. |

I conteggi indicano la presenza fisica delle righe; i parser possono scartare righe incomplete o invalide. Non è presente un controllo automatico di integrità referenziale fra tutti i CSV.

Con FLDA attivo, il listone e le statistiche mostrate in Players, Asta e schede provengono da FLDA. I CSV restano la fonte di: fallback legacy, ricerca Objectives, MV/FMV legacy mostrati in Players, pagina Insights, motore strategico portieri (calendario, gerarchie, Saggi) e campi legacy conservati nei giocatori adattati.

### Fonte esterna FLDA

L'indirizzo è letto da `VITE_FLDA_API_URL` (in produzione da `.env.production`); in assenza vale `http://127.0.0.1:8765`. Timeout: 8 s per le letture, 120 s per gli aggiornamenti. Endpoint usati (`src/services/flda.ts`):

| Endpoint | Uso |
| --- | --- |
| `GET /api/health`, `GET /api/status` | Stato del servizio e dei dataset (Import/Export). |
| `GET /api/players` | Listone giocatori FLDA. |
| `GET /api/history/bulk?seasons=3` | Storico delle ultime tre stagioni per l'iCà V2. |
| `GET /api/players/{id}` | Dettaglio giocatore (snapshot e scheda completa). |
| `GET /api/players/{id}/auction-prices` | Prezzi d'asta storici, se assenti nel dettaglio. |
| `GET /api/teams/{team}/guide`, `/hierarchies`, `/fixtures?context=` | Guida squadra, gerarchie (badge rigori/punizioni/corner), calendario. |
| `POST /api/update` | Aggiornamento dei dataset FLDA. |

---

## 8. Moduli `data`

### `src/data/players.ts`

Parsa il listone, converte numeri italiani e percentuali, costruisce benchmark storici per ruolo, calcola iCà e consenso, quindi esporta l'array `players` arricchito.

I campi mancanti restano `undefined`. I flag `Valorizzato`, `Penalizzato` e `Nome_Nascosto` vengono importati ma non risultano consumati da UI o algoritmi. `xMv` e `xFmv` restano `undefined`; `penaltyTaker` resta `false`; la disponibilità effettiva viene derivata dalle assegnazioni.

### `src/data/saggi.ts`

Parsa e indicizza i record per giocatore. Espone input per iCà e calcola il consenso come media delle fasce valide trasformate da 1–5 a 0–10 con `(fascia - 1) × 2,5`. Il prezzo del Saggio è conservato ma non entra in iCà o consenso.

### `src/data/coaches.ts`

Parsa gli impatti per ruolo Mantra. Per il Classic:

- P usa l'impatto Portiere;
- D usa la media di centrali e terzini;
- C usa la media dei quattro macro-ruoli di centrocampo;
- A usa la media di ali, seconde punte e punte centrali.

Il valore viene normalizzato nell'iCà rispetto al massimo impatto assoluto presente nell'intero CSV.

### `src/data/goalkeeperCalendar.ts`

Parsa valori giornalieri 0, 1 o 2. Per una combinazione di squadre sceglie il massimo valore disponibile in ogni giornata e restituisce giornate favorevoli, medie, buchi, copertura, percentuali e media matchup. Espone helper per coppie e terne.

### `src/data/goalkeeperHierarchy.ts`

Parsa gerarchie intere 1, 2 o 3 e indicizza i record per ID giocatore.

### `src/data/playerDetail.ts`

Riparsa listone, Saggi e Battitori per alimentare la scheda dettagliata: prezzi unici per fonte, statistiche grezze e badge con posizione nelle gerarchie rigori/piazzati.

---

## 8.1 Moduli `services`

| Modulo | Responsabilità implementata |
| --- | --- |
| `flda.ts` | Client HTTP FLDA: tipi, `fetch` con timeout, gestione errori (`FldaApiError`: timeout, non raggiungibile, errore API). |
| `playerRepository.ts` | Caricamento del dataset giocatori (FLDA o fallback legacy), arricchimento con gerarchie (rigori, punizioni, corner), storico bulk, riferimenti P95 e cache dei risultati iCà V2; cache di dettagli, guide e calendari squadra. |
| `playerIdentity.ts` | Mappatura legacy ↔ FLDA: per ID esterni (fantacalcio, fantalab, sportsmonks) o per nome/squadra/ruolo normalizzati; esiti `matched_id`, `matched_deterministic_normalized`, `unmatched`, `ambiguous`. |
| `auctionPlayerResolver.ts` | Risoluzione del giocatore corrente e delle assegnazioni (FLDA o legacy), verifica di assegnazione, riepilogo per manager. |
| `auctionStrategyAdapter.ts` | Converte i giocatori FLDA nel modello `Player` usato dagli algoritmi (PMA FLDA, xFM, iCà V2, rigorista) e adatta lo stato: assegnazioni, giocatore corrente e scarti vengono riportati agli ID usati dagli algoritmi. In fallback legacy restituisce i giocatori legacy **con `iCa` impostato a `undefined`**. |

---

## 9. Moduli `domain`

| Modulo | Responsabilità implementata |
| --- | --- |
| `player.ts` | Tipi e campi del giocatore. |
| `objective.ts` | Priorità e struttura degli obiettivi. |
| `ica.ts` | Calcolo dell'indice iCà legacy (usato ancora da `src/data/players.ts`). |
| `icaV2.ts` | Calcolo dell'iCà V2 da dati FLDA (sezione 10.1). |
| `icaV3-beta.ts` | Variante sperimentale con parametri propri; **non è importata da nessun modulo**. |
| `pma.ts` | Lettura del PMA FLDA secondo `pmaConfiguration` (colonna `{mode}_{partecipanti}[_mod/_no_mod]_median_value`). |
| `historicalAuctionPrice.ts` | Prezzo d'asta 2025/26 Serie A / Serie B dal dettaglio FLDA. |
| `rosterMetrics.ts` | Indicatori della rosa per reparto (sezione 10.4). |
| `auctionContext.ts` | Lookup, budget, slot, benchmark, supply e domanda. |
| `priceAdvice.ts` | Valore d'asta, riserve e limiti di prezzo. |
| `recommendation.ts` | Ranking D/C/A e delega al motore P. |
| `goalkeeperPlanning.ts` | Generazione e validazione delle terne portieri. |
| `goalkeeperEconomics.ts` | Riserve e limiti economici specifici per P. |
| `goalkeeperStrategy.ts` | Ranking e spiegazioni per la chiamata dei portieri. |
| `competitorAnalysis.ts` | Capacità, offerta stimata e rischio degli avversari. |

---

## 10. Algoritmi implementati

### 10.1 iCà V2 — provvisorio Alpha/Beta

iCà V2 è adottato come indice provvisorio per Alpha/Beta. La struttura è stabile abbastanza per procedere con lo sviluppo, ma la calibrazione numerica dello storico H non è considerata definitiva. Dopo la Beta deve essere effettuata una revisione dell'indice usando risultati reali, ranking osservati e casi campione.

Il calcolatore è `src/domain/icaV2.ts`, con parametri centralizzati in `ICA_V2_PARAMETERS`:

- `iCàBase = 0.55 * P + 0.45 * H` quando entrambi sono disponibili.
- `P = 0.40 * xFMScore + 0.30 * Utilizzo + 0.20 * IntegritaScore + 0.10 * GerarchieScore`.
- Ogni stagione: `S = 0.35 * BonusScore + 0.20 * MalusScore + 0.15 * MVScore + 0.20 * DisponibilitaScore + 0.10 * AssenzeScore`.
- H è la media ponderata delle ultime tre stagioni disponibili, ordinate dalla più recente, con pesi `0.50`, `0.333333`, `0.166667`. I pesi si rinormalizzano sulle stagioni calcolabili: nessuna divisione aggiuntiva per il numero di stagioni, penalità 1/2/3 stagioni, regressione di H verso 50 o stagione mancante trattata come zero.
- Le sottocomponenti non disponibili vengono escluse e i pesi validi rinormalizzati. `injury_games_missed` non è attualmente disponibile nel bulk FLDA: AssenzeScore resta non disponibile, senza derivazioni da `injured` o Pt.Inf e senza zero artificiale.
- La reliability campione resta quella implementata: 10 presenze → 0.40; 20 → 0.70; 30 → 0.90; 35–38 → 1.00, con interpolazione continua.
- Restano i correttori editoriali moltiplicativi, il cap 0–100 e l'arrotondamento finale a due decimali. I Saggi non entrano nell'iCà V2.

`src/services/playerRepository.ts` carica `/api/history/bulk?seasons=3`, indicizza per UUID e costruisce reference P95 per ruolo/evento e risultati P/H/iCà nella cache condivisa. Players, Asta e schede leggono `getCachedICaV2`: loading/error restituiscono un valore non disponibile, mentre `history: []` realmente caricata consente il comportamento previsto per assenza di storico. Il caricamento storico non introduce richieste detail per giocatore. La cache è in memoria e non modifica localStorage o archivi.

I parametri numerici restano configurabili nel modulo domain e NON vanno considerati definitivi fino alla revisione post-Beta. TODO: **RICALIBRAZIONE iCà POST-BETA**, descritta in `BETA_BACKLOG.md`.

#### iCà legacy — non usato da Players/Asta

L'iCà legacy è ancora calcolato in `src/data/players.ts`, ma l'adattatore della strategia lo azzera: Players, Asta e algoritmi usano soltanto l'iCà V2. Senza FLDA, quindi, nessun iCà è disponibile.

`src/domain/ica.ts` calcola un punteggio 0–100 da quattro componenti. I pesi correnti, configurabili tramite `ICaConfig`, sono:

- rendimento storico: `0,40`;
- titolarità: `0,25`;
- Saggi: `0,25`;
- allenatore: `0,10`.

Se una componente manca, i pesi delle componenti disponibili vengono rinormalizzati.

Il rendimento storico:

- calcola percentile MV e FMV nella popolazione dello stesso ruolo;
- combina FMV `0,70` e MV `0,30`;
- usa come confidenza `minuti / medianaMinutiRuolo`, limitata a 0–1;
- miscela il risultato con un valore neutro corrente di 50 in base alla confidenza.

La titolarità usa `100 × probabilità^0,8`.

La componente Saggi usa le mediane di:

- fascia normalizzata con `(fascia - 1) × 25`, peso `0,60`;
- affidabilità normalizzata `valore × 20`, peso `0,20`;
- integrità normalizzata `valore × 20`, peso `0,20`.

L'impatto allenatore viene trasformato in `50 + 50 × impattoNormalizzato`, con impatto limitato a `[-1, 1]`.

Tutti questi numeri sono parametri attuali, non invarianti stabiliti da `docs/CONCEPTS.md`.

### 10.2 Fasce e slot

`src/domain/auctionContext.ts`:

- converte il PMA percentuale in crediti con `creditiIniziali × PMA / 100`;
- ordina i giocatori per PMA decrescente all'interno del ruolo;
- divide l'ordinamento in gruppi grandi quanto il numero di manager attivi;
- assegna fascia/slot `floor(indice / dimensioneLega) + 1`;
- usa la mediana PMA del gruppo come benchmark dello slot.

Gli slot strategici mancanti vengono coperti confrontando la qualità relativa dei giocatori già posseduti con gli slot richiesti. Un giocatore migliore può coprire uno slot numericamente peggiore.

### 10.3 Supply e domanda

Per D/C/A e per un candidato con slot calcolabile:

- **supply:** numero di giocatori non assegnati dello stesso ruolo con slot uguale o migliore;
- **domanda:** numero di manager attivi che hanno almeno uno slot strategico mancante compatibile con quello del candidato.

La domanda non verifica direttamente la capacità economica del singolo manager (`src/domain/auctionContext.ts`). La capacità economica entra invece nell'analisi concorrenti.

In modalità FLDA il PMA usato da fasce, slot e prezzi è quello FLDA scelto da `pmaConfiguration`, non più il PMA del CSV legacy.

### 10.4 Indicatori della rosa

`src/domain/rosterMetrics.ts` (parametri in `ROSTER_METRICS_V1`, dichiarati come input V1 sostituibili) calcola per l'owner tre medie per reparto, mostrate nella pagina Asta: iCà, titolarità e prestazione.

**D/C/A.** Ogni giocatore posseduto riceve uno slot strutturale `ceil((1 + giocatori dello stesso ruolo con iCà maggiore) / partecipanti)`, dove i partecipanti sono `pmaConfiguration.participants`. Il peso dello slot vale:

| Ruolo | Peso 1 | Peso 0,60 | Peso 0,35 | Peso 0 |
| --- | --- | --- | --- | --- |
| D, C | slot 1–4 | slot 5–6 | slot 7–8 | oltre 8 o slot non calcolabile |
| A | slot 1–3 | slot 4 | slot 5–6 | oltre 6 o slot non calcolabile |

La prestazione combina `xFM × 10` e un punteggio attacco di squadra (gol fatti Serie A 2025/26 riscalati fra 25 e 89; neopromosse a 3), con pesi individuale/squadra 0,90/0,10 (D), 0,80/0,20 (C), 0,70/0,30 (A).

**P.** I portieri posseduti sono raggruppati per squadra. Per ogni squadra la copertura è la somma delle quote di titolarità dei portieri posseduti sul totale della squadra; iCà e prestazione sono pesati per quota. La prestazione del portiere combina squadra (0,65: gol subiti e punti 2025/26) e individuale (0,35: MV, rigori parati, ammonizioni, espulsioni, attenuati con la stessa curva di affidabilità campione dell'iCà V2). Il reparto P è la media semplice dei pacchetti di squadra.

Esempio D/C: con 8 partecipanti, un difensore con 10 difensori di iCà superiore ha slot `ceil(11/8) = 2` e peso 1; con 40 superiori ha slot `ceil(41/8) = 6` e peso 0,60.

---

## 11. Consiglio prezzo attuale

Implementato in `src/domain/priceAdvice.ts`, con branch distinti per P e per D/C/A.

### Parametri correnti

| Parametro | Valore |
| --- | ---: |
| `reserveFactor` | 0,90 |
| `baseRoleElasticity` | 1,08 |
| `topSlotElasticity` | 1,22 |
| `sameRoleMinSample` | 3 |
| `minimumFutureSlotCost` | 1 |
| `scarcityK` | 0,10 |
| `scarcityFactorCap` | 1,25 |
| `roleBlendWeight` | 0,50 |

Sono parametri correnti/configurabili.

### Valore base di mercato

Per ogni assegnazione valida viene calcolato `prezzo / PMA in crediti`. Il fattore di mercato è la mediana scelta con questa precedenza:

1. campione dello stesso ruolo, se ha almeno 3 osservazioni;
2. campione complessivo, se ha almeno 3 osservazioni;
3. mediana del ruolo anche con meno osservazioni;
4. mediana complessiva anche con meno osservazioni;
5. baseline 1 se non esistono osservazioni.

Il valore base è `PMA crediti × fattore mercato`.

### Budget dinamico di reparto

I target iniziali sono le percentuali configurate applicate ai crediti iniziali. Quando un reparto completato ha avanzo, questo viene distribuito proporzionalmente ai reparti successivi. Se è in deficit, il codice riduce in ordine i target successivi senza scendere sotto la spesa già sostenuta più un credito per slot ancora necessario.

L'adattamento automatico avviene soltanto quando un reparto risulta completato; la spesa corrente e le riserve influenzano comunque i limiti durante il reparto.

### D/C/A

Per i giocatori di movimento:

- `pressione = domanda / supply`;
- il fattore scarsità è `1 + 0,10 × max(0, pressione - 1)`, limitato a 1,25;
- il valore atteso è `valoreBase × fattoreScarsità`;
- il limite di valore è il valore atteso arrotondato, con minimo 1;
- le quote strategiche degli slot distribuiscono il target del reparto in proporzione ai benchmark PMA, garantendo almeno un credito a slot;
- la riserva di reparto somma le quote degli slot che resterebbero scoperti dopo il candidato;
- il limite di reparto è `floor(targetDinamico × elasticità - spesoRuolo - riservaRuolo)`, con minimo 0;
- l'elasticità è 1,22 per lo slot 1 e 1,08 per gli altri;
- la riserva globale include D/C/A, ridotta dal fattore prudenziale 0,90 ma mai sotto un credito per slot, più una riserva portieri costruita dai piani validi;
- il limite finanziario è `floor(creditiOwnerResidui - riservaGlobale)`, con minimo 0.

Il tetto morbido è una media arrotondata 50/50 fra limite di valore e limite di reparto quando entrambi esistono. Il tetto consigliato è il minimo fra tetto morbido e limite finanziario. Se uno dei valori manca, il codice usa quello disponibile.

### Portieri

Per P non vengono usati slot PMA, supply, domanda o scarsità per slot. Il limite di valore è il valore base di mercato arrotondato. Il limite di reparto e quello finanziario derivano dai piani di terna validi e dalle riserve specifiche descritte nella sezione portieri.

### Vincolo indicato in UI

`bindingConstraints` restituisce normalmente un solo vincolo:

- `financial` se il limite finanziario determina il tetto;
- altrimenti `value` o `role` in base a quale dei due limiti è minore;
- un solo vincolo disponibile se l'altro manca.

Pur essendo tipizzato come array, il codice corrente non restituisce contemporaneamente più vincoli a parità di valore.

---

## 12. Chiamata consigliata attuale

Implementata in `src/domain/recommendation.ts`, con motore P dedicato in `src/domain/goalkeeperStrategy.ts`.

La raccomandazione considera soltanto il ruolo attivo e rimuove:

- giocatori già assegnati;
- giocatori presenti in `recommendedDiscards`;
- candidati il cui valore base supera il limite finanziario globale, quando entrambi i dati sono disponibili.

Il limite di reparto non è un hard cap del ranking.

### Ranking D/C/A

Il bisogno corrente è il primo slot strategico rimasto. La compatibilità di fascia vale 1 per corrispondenza esatta e decade esponenzialmente:

- profilo migliore dello slot richiesto: `exp(-0,45 × distanza)`;
- profilo peggiore: `exp(-0,65 × distanza)`.

La sostenibilità usa il valore base, non il valore corretto per scarsità, diviso per il minimo fra limite di reparto e limite finanziario. La formula corrente è `clamp(1,25 - 0,50 × rapporto, 0, 1)`.

L'opportunità è `pressione / (1 + pressione)`.

Le priorità obiettivo valgono attualmente:

- primary `1,00`;
- secondary `0,80`;
- third `0,65`;
- fourth `0,50`;
- bet `0,60`;
- non obiettivo `0`.

Il punteggio alpha corrente usa (fra parentesi i valori della ricognizione del 2 settembre):

- qualità/iCà: 30% (15%);
- fit slot (bisogno): 25% (30%);
- sostenibilità: 10% (12%);
- opportunità/mercato: 10% (8%);
- obiettivo: 25% (35%).

Per ottimizzazione, la riserva portieri usata nei limiti dei giocatori di movimento viene calcolata una sola volta per ranking (`calculateGoalkeeperReserveForOutfieldAdvice`) e passata ai singoli consigli prezzo; lo slot del candidato viene letto dal consiglio prezzo anziché ricalcolato.

I pesi disponibili vengono rinormalizzati se una metrica è assente. Successivamente il risultato viene moltiplicato per un fattore di diversificazione della squadra reale. La penalità è quadratica (`0,015 × stessoTeam² + 0,020 × stessoTeamStessoRuolo²`) e limitata al 50%.

L'ordinamento usa il punteggio e, a parità, l'iCà. La UI mostra il primo candidato e due alternative (`alternativesCount: 2`) oltre a un pannello Top iCà separato.

Le motivazioni sono stringhe generate deterministicamente da obiettivo, copertura dello slot, sostenibilità, pressione e diversificazione; vengono mostrate al massimo tre ragioni.

---

## 13. Logica portieri attuale

La logica strategica è distribuita fra:

- `src/data/goalkeeperCalendar.ts`;
- `src/data/goalkeeperHierarchy.ts`;
- `src/domain/goalkeeperPlanning.ts`;
- `src/domain/goalkeeperEconomics.ts`;
- `src/domain/goalkeeperStrategy.ts`.

### Classificazione Saggi corrente

La mediana `Fascia_Valore` del portiere determina:

- top: almeno 5;
- semitop: almeno 4;
- seconda fascia: almeno 3;
- other: sotto 3;
- unknown: nessun dato valido.

Le soglie sono dichiarate dal codice come parametri alpha, non invarianti.

### Piani di terna validi

Il motore enumera combinazioni di tre portieri che contengono tutti quelli già acquistati dall'owner e, quando richiesto, il candidato.

Riconosce tre strategie:

1. **Monoclub:** P1, P2 e P3 della stessa squadra; il P1 deve essere top.
2. **Top-pair:** P1 e P2 della squadra di riferimento, più P1 di un'altra squadra; il P1 della squadra di riferimento deve essere top o semitop.
3. **Rotation:** tre P1 di squadre diverse, tutti classificati seconda fascia.

La copertura del piano prende il miglior valore 0/1/2 per ogni giornata fra le squadre incluse.

### Ordinamento dei piani

I piani non usano una somma pesata. L'ordine corrente è:

1. maggiore forza Saggi dei P1;
2. meno buchi di calendario;
3. più giornate favorevoli;
4. minor costo stimato della terna.

Il costo stimato usa il prezzo reale per portieri già acquistati dall'owner e il valore base di mercato per gli altri.

### Ranking dei portieri

Un candidato viene escluso dal ranking automatico se non mantiene almeno un piano valido. Il suo punteggio esposto è `numeroStrategieAperte / 3`, ma il comparatore usa direttamente questa sequenza:

1. più tipi di strategia ancora aperti;
2. priorità negli Obiettivi;
3. qualità del piano migliore;
4. mediana Saggi del candidato;
5. iCà come tie-break.

Per P non viene applicata la penalità di concentrazione per squadra, perché alcune strategie richiedono portieri dello stesso club. Non viene calcolata opportunità di mercato.

### Economia portieri

Per ogni candidato, la riserva strategica è il costo futuro minimo fra i piani validi che lo contengono, escludendo portieri già acquistati e il candidato stesso.

- Il limite di reparto P è il target dinamico P meno spesa P e riserva strategica.
- Il limite finanziario conserva sia la riserva D/C/A sia quella necessaria a completare P.
- Se non esiste un piano valido, il prezzo manuale continua a funzionare e il vincolo finanziario riserva soltanto un credito per ciascuno slot P rimanente.
- Se non esiste un piano valido, il limite strategico P resta `undefined`.

---

## 14. Analisi concorrenti attuale

Implementata e renderizzata da `src/domain/competitorAnalysis.ts`; `src/main.ts` la inserisce sotto la scheda del giocatore nella colonna principale dell'Asta.

Sono considerati soltanto manager attivi, non archiviati e diversi dall'owner. Un manager viene escluso se:

- ha riempito tutti i 25 slot correnti;
- ha riempito tutti gli slot del ruolo del giocatore;
- non ha capacità finanziaria positiva dopo la riserva minima.

La capacità finanziaria è:

```text
crediti residui - 1 credito per ogni slot che resterebbe dopo l'acquisto
```

Il comportamento di spesa è stimato tramite la mediana del rapporto `prezzo / PMA crediti`, con precedenza:

1. stesso manager e stesso ruolo;
2. stesso manager, tutti i ruoli;
3. mercato corrente, stesso ruolo;
4. mercato corrente complessivo;
5. baseline 1.

L'offerta stimata è `PMA candidato × fattore`, arrotondata e limitata alla capacità finanziaria, con minimo 1.

Il riferimento per il rischio è, in ordine, il tetto consigliato dell'owner, il limite di valore oppure il PMA arrotondato.

- rischio alto: offerta stimata almeno pari al riferimento;
- rischio medio: offerta stimata inferiore ma capacità sufficiente a raggiungerlo;
- rischio basso: capacità inferiore al riferimento.

L'ordinamento è per rischio, offerta stimata, capacità finanziaria e nome.

Limiti attuali: l'analisi usa soltanto l'asta corrente; non usa `archivedAuctions`, il secondo offerente registrato, annotazioni, profili storici multi-stagione o una probabilità esplicita di interesse oltre agli slot liberi del ruolo.

---

## 15. Obiettivi e scarti

Gli obiettivi sono persistenti nell'intero stato applicativo e non sono legati a un ID di asta. La categoria di priorità entra nel ranking D/C/A e nel comparatore P; il campo `weight` non entra in alcun calcolo.

Gli scarti:

- sono ID in `recommendedDiscards`;
- escludono il giocatore soltanto dal ranking automatico;
- non modificano disponibilità o database;
- sono visibili e ripristinabili singolarmente;
- possono essere ripristinati in blocco per il ruolo attivo;
- vengono rimossi quando il giocatore è aggiudicato;
- vengono azzerati quando l'asta viene registrata o scartata;
- il loader li conserva soltanto in `live` o `finalizing`.

Non esiste un'entità asta corrente con ID proprio alla quale obiettivi, strategia o scarti siano formalmente associati.

---

## 16. Backup, ripristino ed export CSV

### Backup JSON

`createStateBackup()` produce un envelope:

```json
{
  "type": "mistercana-state-backup",
  "version": 1,
  "exportedAt": "data ISO",
  "state": "intero AppState"
}
```

Il backup contiene quindi realmente:

- fase e giocatore corrente;
- assegnazioni correnti, inclusi secondo offerente e prezzo;
- aste archiviate e relative assegnazioni;
- scarti della raccomandazione;
- crediti iniziali;
- flag modificatore difesa;
- profilo e distribuzione budget;
- tutti i manager;
- tutti gli obiettivi.

Non contiene i CSV, gli asset, i parametri degli algoritmi, lo stato visuale non persistito o una copia del database giocatori. I dati statici vengono nuovamente letti dal bundle installato al ripristino.

La validazione preliminare richiede tipo, versione 1, data di esportazione, crediti iniziali validi, array manager e oggetto distribuzione budget. Il resto viene normalizzato con le regole del loader. Dopo conferma, il backup sostituisce la chiave locale e la pagina viene ricaricata.

### Export CSV dell'asta corrente

Esporta soltanto `auctionAssignments`, con BOM UTF-8 e separatore `;`. Le colonne sono:

- ID assegnazione e giocatore;
- nome, squadra reale e ruolo;
- ID, nome e squadra fantasy del manager;
- prezzo;
- ID e nome del secondo offerente;
- offerta del secondo.

Le aste archiviate non sono esportate in questo CSV, ma restano incluse nel backup JSON.

Il CSV cerca il giocatore soltanto nel listone legacy tramite `playerId`. Le aggiudicazioni create con FLDA hanno solo `fldaPlayerId`: per esse le colonne `player_id`, `giocatore`, `squadra_reale` e `ruolo` risultano vuote (`buildCurrentAuctionCsv` in `src/pages/importExport.ts`).

Il backup JSON resta alla versione 1 e include i nuovi campi (`currentAuctionFldaPlayerId`, `pmaConfiguration`, `fldaPlayerId` delle assegnazioni); i backup precedenti vengono completati dal loader con i valori predefiniti.

---

## 17. Motion e UI implementate

`src/style.css` definisce i token correnti:

- istantaneo 90 ms;
- veloce 140 ms;
- base 190 ms;
- lento 280 ms;
- uscita 140 ms.

`src/app/motion.ts` legge `--motion-exit`, rileva `prefers-reduced-motion` e gestisce la chiusura differita degli overlay tramite classe `is-closing`.

Sono presenti animazioni o transizioni per:

- indicatore LIVE;
- menu e controlli;
- apertura/chiusura overlay;
- scheda giocatore e progress bar;
- risultati ricerca Objectives;
- suggerimenti e matrice portieri;
- feedback Import/Export;
- segnale d'offerta e feedback Auction.

I fogli stile includono breakpoint responsive specifici per pagina, fino a larghezze mobili di 520/420 px, e regole `prefers-reduced-motion` che disabilitano transizioni e animazioni rilevanti.

La favicon è generata dinamicamente (`src/app/favicon.ts`): rossa fuori dall'asta live e verde lampeggiante ogni 800 ms durante `live`.

---

## 18. Build, Vite e deploy

### Script

Da `package.json`:

- `npm run dev` → `vite`;
- `npm run build` → `tsc && vite build`;
- `npm run preview` → `vite preview`;
- `npm test` → `node --test tests/*.test.ts`.

### Test

Dieci file in `tests/`: migrazione FLDA dell'asta, adattatore strategia, storico bulk, prezzo storico, iCà V2, identità giocatori, iCà nel repository, architettura UI giocatori, PMA, indicatori rosa. Alla data di questa ricognizione `npm test` esegue 62 test: **57 superati, 5 falliti**:

- "repository has shared loading loaded and error states distinct from empty history";
- "repository forwards enriched ICA inputs and deduplicates fixtures by team/context";
- "renders the requested descriptive charts and avoids viewport-wide mobile content";
- "renders the two historical prices and the requested full-page KPI layout";
- "Auction mobile layout stacks top players and assignment history".

`npm run build` termina senza errori.

### Avvio locale

`run-local.ps1` (Windows) e `run-mac` (macOS) avviano FLDA (`flda serve`, porta 8765) se non è già in ascolto, poi il dev server Vite (porta 5173), e aprono `http://localhost:5173`. Lo script Windows usa percorsi fissi `C:\Users\Gabriele\Documents\GitHub\mistercana` e `...\fantalab-data-agent`.

`tsconfig.json` usa target ES2023, DOM, risoluzione `bundler`, `noEmit`, controlli su simboli inutilizzati e fallthrough. Non è abilitato esplicitamente `strict`.

`vite.config.ts` imposta soltanto:

```ts
base: '/mistercana/'
```

La build produce `dist`, che è ignorata da Git. La build di produzione legge `VITE_FLDA_API_URL` da `.env.production`, file tracciato in Git.

### Deploy

`.github/workflows/deploy.yml` esegue su push a `main` o manualmente:

1. checkout;
2. Node 22 con cache npm;
3. `npm ci`;
4. `npm run build`;
5. upload di `dist`;
6. deploy su GitHub Pages.

---

## 19. Parti incomplete e discrepanze evidenti

Questa sezione elenca soltanto condizioni osservate nel codice.

1. **Nessuna integrazione AI.** Non risultano SDK o moduli di conversazione. Le uniche chiamate di rete sono verso FLDA. Tutte le raccomandazioni sono deterministiche.
2. **Nessun backend proprio o sincronizzazione dello stato.** Stato e storico dell'asta esistono soltanto nel `localStorage` del browser o nei backup scaricati. FLDA fornisce soltanto dati giocatori.
3. **Test parzialmente falliti.** 5 test su 62 falliscono (sezione 18).
4. **`src/components/modal.ts` è vuoto.** Gli overlay sono duplicati nelle pagine/componenti.
5. **Commenti non allineati in `src/main.ts`.** Il ramo Import/Export dice che la pagina è puramente visiva, ma il modulo auto-registra handler operativi. Anche Insights auto-registra il binder e viene inoltre chiamato da `main.ts`; il guard interno evita duplicazioni.
6. **Preset equilibrato incoerente col default.** Il default è `11/21/23/45`, il pulsante Equilibrata applica `10/25/30/35`.
7. **Modificatore difesa duplicato.** `defenseModifierEnabled` e `pmaConfiguration.defenseModifier` sono aggiornati insieme dalla Dashboard. Il secondo seleziona la colonna PMA FLDA; nessuno dei due entra direttamente negli algoritmi `domain`.
8. **Campi giocatore non ancora consumati.** Nel listone legacy `valorizzato`, `penalizzato` e `nomeNascosto` sono importati ma non usati, e `xMv` non viene popolato. In modalità FLDA `xFmv` è valorizzato con `fm_exp` e `penaltyTaker` con la gerarchia rigori.
9. **Storico prezzi d'asta limitato.** È mostrato il prezzo 2025/26 Serie A / Serie B, se fornito da FLDA, ma non alimenta il consiglio prezzo. I prezzi dei Saggi sono mostrati nei grafici ma non equivalgono a uno storico d'asta.
10. **Aste archiviate poco utilizzate.** Vengono conservate e incluse nel backup/anteprima, ma non esiste una pagina di consultazione e non alimentano analisi concorrenti o algoritmi.
11. **Fasi `archived` e `discarded` non persistono come stato operativo.** Sono nel tipo e nelle etichette Dashboard, ma le azioni correnti riportano direttamente a `setup` e il loader normalizza tali valori a `setup`.
12. **Il secondo offerente è solo registrato/esportato.** Non alimenta prezzo, ranking o analisi concorrenti.
13. **Obiettivi non formalmente legati alla singola asta.** Persistono globalmente nello stato finché l'utente non li modifica o importa un backup.
14. **Scarti senza ID di asta.** Il ciclo di vita corrente li azzera alla chiusura, ma il modello dati non li associa a un'entità asta identificata.
15. **Matrice portieri doppia.** Insights usa il database legacy `MisterCana_DB_Portieri.csv`; il motore strategico usa invece calendario e gerarchie. Sono due percorsi dati separati.
16. **Dipendenza da FLDA per l'iCà.** Senza FLDA l'app funziona sul listone legacy, ma senza iCà (l'adattatore azzera l'iCà legacy) e senza xFM, badge FLDA, dettaglio e scheda completa.
17. **Validazione backup minima.** Il core viene controllato, ma alcuni campi, come `budgetProfile` e i singoli valori di `budgetDistribution`, non ricevono una validazione esaustiva di dominio.
18. **Possibile owner implicito.** Se nessun manager attivo ha `isOwner`, vari algoritmi trattano il primo manager attivo come owner; la UI permette inoltre di deselezionare l'owner senza imporre immediatamente un sostituto (`src/domain/auctionContext.ts`, `src/pages/dashboard.ts`).
19. **Export CSV incompleto per le aggiudicazioni FLDA.** Nome, squadra, ruolo e ID giocatore restano vuoti per i record con solo `fldaPlayerId` (sezione 16).
20. **Nessuna entità lega/divisione o sessione attiva identificata.** L'`AppState` contiene una sola configurazione e una sola asta corrente, senza un'entità lega/divisione né un identificatore della sessione attiva; Lega A e Lega B non possono quindi convivere nello stesso `AppState` con stato indipendente.
21. **Configurazione PMA modificabile solo in parte.** `pmaConfiguration.mode` e `participants` (default Classic, 8) non hanno un controllo in UI; la Dashboard modifica soltanto il modificatore difesa. Il numero di partecipanti PMA è indipendente dal numero di manager attivi usato per le fasce.
22. **Identità miste.** Obiettivi e scarti usano ID legacy, le nuove aggiudicazioni UUID FLDA; la coerenza dipende dalla mappatura di `playerIdentity.ts`. I giocatori FLDA senza corrispondenza legacy usano l'UUID come ID nella strategia.
23. **Modulo non collegato.** `src/domain/icaV3-beta.ts` non è importato da alcun file.
24. **Percorsi fissi negli script di avvio.** `run-local.ps1` punta a `C:\Users\Gabriele\Documents\GitHub\...`, non alla posizione attuale della repository se è stata spostata.

---

## 20. Rapporto con `docs/CONCEPTS.md`

`docs/CONCEPTS.md` definisce il modello concettuale del prodotto. Il presente documento non assume che ogni principio sia già completo nel codice.

Sono chiaramente riconoscibili nell'implementazione corrente:

- stato strutturato dell'asta come fonte dei calcoli;
- separazione dei limiti economici;
- raccomandazioni non auto-esecutive;
- scarti limitati al ranking;
- strategie portieri dedicate;
- parametri concentrati in oggetti configurabili;
- correzione e annullamento delle assegnazioni;
- spiegazioni deterministiche sintetiche.

Sono soltanto parziali o assenti, fra gli altri:

- identità e storico realmente multi-stagione/multi-asta;
- evidenze e profilazione validata degli avversari;
- adattamento basato sul secondo offerente;
- integrazione AI come livello interpretativo;
- associazione formale di strategia, obiettivi e scarti a una specifica asta;
- consultazione e uso algoritmico dello storico archiviato;
- uso dei prezzi storici d'asta nel consiglio prezzo.

Queste differenze descrivono lo stato reale corrente; non costituiscono da sole un backlog o una decisione di implementazione futura.
