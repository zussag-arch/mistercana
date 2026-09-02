# Agente 444 — Backlog Beta

## Stato del documento

Questo documento raccoglie il backlog corrente emerso dall'uso reale di Agente 444.

Non descrive funzionalità già implementate, salvo quando serve a spiegare il punto di partenza. Non trasforma automaticamente osservazioni, ipotesi o idee in requisiti definitivi. Le voci ancora insufficientemente definite sono marcate `DA CHIARIRE` o `BLOCCATO DA DATI`.

I riferimenti principali sono:

- [`docs/CONCEPTS.md`](./CONCEPTS.md), per principi e invarianti concettuali;
- [`docs/CURRENT_STATE.md`](./CURRENT_STATE.md), per il comportamento realmente implementato;
- [`docs/CHAT_AGENT_VISION.md`](./CHAT_AGENT_VISION.md), per la visione futura della componente conversazionale.

Questo backlog non sceglie soluzioni tecniche e non modifica il comportamento attuale dell'app.

---

## Legenda

### Priorità

- `P0`: bloccante o da correggere prima di una beta utilizzabile.
- `P1`: molto importante per le prime aste beta.
- `P2`: importante, ma affinabile tra una beta e l'altra.
- `P3`: evoluzione successiva, ricerca o nuova feature.

Le priorità rappresentano la pianificazione corrente e possono cambiare dopo le aste reali.

Quando una voce mantiene una priorità mista (`P0/P1` o `P1/P2`), il riepilogo numerico finale la conta nella fascia più urgente, senza eliminare l'incertezza indicata nella scheda.

### Stati

- `DA FARE`
- `DA CHIARIRE`
- `BLOCCATO DA DATI`
- `IN ANALISI`
- `PRONTO PER IMPLEMENTAZIONE`
- `IN TEST`
- `VALIDATO`
- `RIMANDATO`

Nessuna voce è marcata `VALIDATO` in assenza di una verifica esplicita.

---

# 1. Identità e design

## BETA-001 — Cambio nome

- **Area:** Identità e design
- **Tipo:** UI / BRANDING
- **Osservazione:** nelle UI e nei riferimenti correnti compaiono ancora i nomi MisterCanà e, nel feedback raccolto, Fanta Agente. Il nome prodotto scelto è Agente 444.
- **Comportamento desiderato:** aggiornare il nome visibile del prodotto ad Agente 444. Valutare separatamente riferimenti tecnici, favicon, logo attuale e futuro logo dedicato, evitando rinominazioni tecniche non necessarie.
- **Priorità corrente:** P2
- **Dipendenze:** inventario dei riferimenti visibili e tecnici; decisione successiva sull'identità visiva.
- **Stato:** DA FARE
- **Criterio di validazione:** tutte le superfici utente concordate mostrano Agente 444; eventuali identificatori tecnici mantenuti sono documentati; nessun logo nuovo viene introdotto senza una progettazione dedicata.

## BETA-002 — Sistema visivo

- **Area:** Identità e design
- **Tipo:** UI / UX
- **Osservazione:** l'app appare troppo scura e presenta forme e colori non sempre uniformi.
- **Comportamento desiderato:** aumentare luminosità e vividezza, uniformare forme e colori, mantenere contrasto e leggibilità sotto pressione senza rendere l'interfaccia rumorosa.
- **Priorità corrente:** P1
- **Dipendenze:** revisione delle schermate reali; verifica coordinata con gerarchia tipografica e colori delle metriche.
- **Stato:** DA FARE
- **Criterio di validazione:** prova comparativa su desktop e iPhone/PWA durante un flusso d'asta; informazioni principali leggibili rapidamente, contrasto adeguato e assenza di sovraccarico visivo.

## BETA-003 — Gerarchia tipografica

- **Area:** Identità e design
- **Tipo:** UI / UX
- **Osservazione:** numeri e testi hanno dimensioni poco coerenti; alcuni valori risultano troppo grandi e altri troppo piccoli.
- **Comportamento desiderato:** definire una gerarchia coerente per numeri principali, metriche secondarie, label, badge, testi descrittivi e controlli. Non aumentare indiscriminatamente tutti i font.
- **Priorità corrente:** P1
- **Dipendenze:** sistema visivo generale; verifica sulle pagine principali e sugli overlay.
- **Stato:** DA FARE
- **Criterio di validazione:** i livelli informativi sono riconoscibili senza leggere ogni etichetta; non emergono valori secondari più dominanti di quelli operativi; desktop e iPhone/PWA restano leggibili.

## BETA-004 — Colori percentuali e metriche in Players

- **Area:** Identità e design / Players
- **Tipo:** UI
- **Osservazione:** iCà, Consenso e Titolarità possono apparire tutti verdi indipendentemente dal valore.
- **Comportamento desiderato:** usare una scala visiva coerente dal valore basso o negativo al valore alto o positivo, per esempio rosso → intermedio → verde.
- **Priorità corrente:** P1
- **Dipendenze:** definizione e validazione delle soglie per ciascuna metrica; coordinamento col sistema visivo.
- **Stato:** IN ANALISI
- **Criterio di validazione:** valori chiaramente bassi, intermedi e alti producono segnali distinguibili e semanticamente coerenti; le soglie sono configurabili e verificate su distribuzioni reali, non assunte come invarianti.

## BETA-005 — Colori delle schede strategia

- **Area:** Identità e design / Strategia
- **Tipo:** UI
- **Osservazione:** i colori delle card relative alla distribuzione e alla strategia percentuale richiedono revisione.
- **Comportamento desiderato:** rendere le card coerenti con il futuro sistema visivo generale e con la gerarchia delle informazioni.
- **Priorità corrente:** P2
- **Dipendenze:** BETA-002.
- **Stato:** DA FARE
- **Criterio di validazione:** le card usano colori e stati coerenti col resto dell'app, mantenendo chiari selezione, disponibilità e significato strategico.

---

# 2. Pagina Obiettivi

## BETA-006 — Revisione complessiva della pagina Obiettivi

- **Area:** Objectives
- **Tipo:** UX / UI
- **Osservazione:** la richiesta di revisione della pagina è reale ma ancora generica; non è stato isolato con precisione che cosa rallenta l'uso.
- **Comportamento desiderato:** migliorare velocità, priorità informative, disposizione delle categorie, ricerca e leggibilità per ruolo, dopo aver osservato il problema nella UI reale.
- **Priorità corrente:** P2
- **Dipendenze:** raccolta di esempi d'uso e problemi concreti durante le beta.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** prima dell'implementazione esiste una descrizione verificabile dei problemi; dopo l'intervento, aggiunta, modifica e consultazione degli obiettivi risultano più rapide nei casi osservati.

---

# 3. Pagina Insights

## BETA-007 — Campo ricerca Insights

- **Area:** Insights
- **Tipo:** UX / UI
- **Osservazione:** il campo di ricerca è percepito come da rivedere, ma il problema specifico non è ancora definito.
- **Comportamento desiderato:** correggere l'esperienza soltanto dopo aver chiarito se il problema riguarda scoperta, suggerimenti, selezione, cancellazione, focus, touch o altro.
- **Priorità corrente:** P2
- **Dipendenze:** descrizione o riproduzione del comportamento problematico.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** il problema è riproducibile prima dell'intervento e il flusso corretto viene verificato su desktop e mobile.

## BETA-008 — Discordanza fra algoritmo portieri e griglia percentuale

- **Area:** Insights / Portieri
- **Tipo:** ALGORITMO / UX / DATI
- **Osservazione:** è percepita una discordanza tra l'algoritmo di abbinamento portieri e la griglia percentuale legacy. `CURRENT_STATE.md` conferma che usano percorsi dati distinti: calendario/gerarchie per il motore strategico e matrice legacy per Insights.
- **Comportamento desiderato:** determinare se la differenza è corretta perché misura concetti diversi, se la UI non chiarisce le metriche, oppure se esiste un problema nei dati o in un algoritmo. Non unificare automaticamente i sistemi.
- **Priorità corrente:** P1
- **Dipendenze:** casi concreti discordanti; definizione del significato di entrambe le metriche; verifica dei CSV coinvolti.
- **Stato:** IN ANALISI
- **Criterio di validazione:** per una serie di coppie/terne note, origine, significato e risultato dei due percorsi sono ricostruibili; eventuali differenze sono spiegabili oppure corrette alla causa identificata.

---

# 4. Specialisti

## BETA-009 — Gerarchie corner

- **Area:** Specialisti
- **Tipo:** DATI / FEATURE
- **Osservazione:** rigori e piazzati sono presenti; i corner non dispongono ancora di una fonte integrata.
- **Comportamento desiderato:** integrare in futuro le gerarchie corner nelle schede specialisti quando sarà disponibile una fonte affidabile.
- **Priorità corrente:** P2
- **Dipendenze:** database o fonte affidabile con identità e gerarchie verificabili.
- **Stato:** BLOCCATO DA DATI
- **Criterio di validazione:** la fonte copre le squadre previste, il mapping giocatore/squadra è verificato e le gerarchie vengono mostrate senza confonderle con rigori o piazzati.

## BETA-010 — UI di rigori, piazzati e corner

- **Area:** Specialisti
- **Tipo:** UI / UX
- **Osservazione:** la presentazione degli specialisti richiede maggiore leggibilità e una gerarchia informativa più coerente.
- **Comportamento desiderato:** rivedere leggibilità, dimensioni tipografiche e ordine delle informazioni per rigori, piazzati e, quando disponibili, corner.
- **Priorità corrente:** P2
- **Dipendenze:** BETA-003; BETA-009 per la parte corner.
- **Stato:** DA FARE
- **Criterio di validazione:** ruolo specialistico e posizione in gerarchia sono identificabili rapidamente su scheda giocatore, Players e Insights senza ambiguità cromatiche o tipografiche.

## BETA-011 — Badge specialisti incoerenti

- **Area:** Specialisti / Players
- **Tipo:** BUG / UI
- **Osservazione:** i badge di 1°, 2° e 3° specialista non risultano coerenti per colore e posizione; è stato osservato che primo e secondo rigorista possono apparire entrambi bronzo.
- **Comportamento desiderato:** individuare se la causa è nei dati, nel mapping dei ranghi o nei CSS e correggere il livello responsabile.
- **Priorità corrente:** P1
- **Dipendenze:** caso riproducibile; controllo di `MisterCana_DB_Battitori.csv`, parsing e classi CSS.
- **Stato:** IN ANALISI
- **Criterio di validazione:** per casi noti, 1°, 2° e 3° rango producono badge coerenti e distinti in tutte le viste che li mostrano.

---

# 5. Allenatori

## BETA-012 — Ruolo dell'algoritmo allenatori

- **Area:** Allenatori
- **Tipo:** ALGORITMO
- **Osservazione:** l'impatto allenatore è già una componente dell'iCà, ma non è definito quale ulteriore informazione o funzione strategica debba produrre.
- **Comportamento desiderato:** chiarire se l'effetto debba restare nell'iCà, influire sulla Chiamata consigliata o diventare un'analisi separata, evitando doppio conteggio.
- **Priorità corrente:** P2
- **Dipendenze:** definizione del problema operativo; esempi numerici e casi d'asta; analisi delle correlazioni con componenti già presenti.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** ogni uso dell'effetto allenatore ha significato distinto, formula ricostruibile e beneficio verificabile su casi reali, senza premiare o penalizzare due volte lo stesso fenomeno.

## BETA-013 — Nota “DB coener?”

- **Area:** Allenatori / Database
- **Tipo:** DATI
- **Osservazione:** nel feedback originale compare la nota “DB coener?”, il cui significato non è comprensibile con le informazioni disponibili.
- **Comportamento desiderato:** ottenere dall'owner il significato esatto prima di trasformare la nota in attività.
- **Priorità corrente:** DA CHIARIRE
- **Dipendenze:** chiarimento dell'owner.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** la nota viene spiegata in termini comprensibili e, solo se necessario, riclassificata come voce concreta con area, priorità e risultato atteso.

---

# 6. Import/Export e multi-lega

## BETA-014 — Significato di “backup completo”

- **Area:** Import/Export
- **Tipo:** UX / DOCUMENTAZIONE / ARCHITETTURA
- **Osservazione:** `CURRENT_STATE.md` documenta che il backup JSON contiene l'intero `AppState`, ma non i database CSV statici. L'espressione “backup completo” può far supporre una copertura più ampia.
- **Comportamento desiderato:** rendere comprensibile nella UI che cosa viene incluso e che cosa resta esterno al backup.
- **Priorità corrente:** P1
- **Dipendenze:** nessuna soluzione architetturale richiesta; allineamento con il formato reale del backup.
- **Stato:** PRONTO PER IMPLEMENTAZIONE
- **Criterio di validazione:** prima dell'esportazione o del ripristino, una persona non sviluppatrice distingue correttamente stato applicativo e CSV statici.

## BETA-015 — Stato indipendente di Lega A e Lega B

- **Area:** Import/Export / Multi-lega
- **Tipo:** ARCHITETTURA / DATI
- **Osservazione:** oggi `AppState` contiene una sola configurazione e una sola asta corrente, senza entità lega/divisione o identificatore completo della sessione attiva.
- **Comportamento desiderato:** definire come divisioni della stessa stagione possano condividere i database giocatori mantenendo indipendenti acquisti, strategie, obiettivi se previsti, scarti, storico e stato operativo.
- **Priorità corrente:** P1
- **Dipendenze:** modello concettuale di lega, divisione, stagione e asta; regole per backup e selezione del contesto; piano di migrazione.
- **Stato:** IN ANALISI
- **Criterio di validazione:** due leghe possono essere descritte senza sovrapporre lo stato; ogni dato strategico e operativo ha un contesto non ambiguo; import/export non mescola le sessioni.

---

# 7. Database

## BETA-016 — Riorganizzazione dei database

- **Area:** Database
- **Tipo:** DATI / ARCHITETTURA
- **Osservazione:** va valutata una separazione più chiara fra dati anagrafici/statistici del giocatore, squadre e PMA. Gli import attuali hanno più consumer e alcuni CSV vengono parsati in più moduli.
- **Comportamento desiderato:** definire un'organizzazione coerente soltanto dopo aver esaminato i database aggiornati reali, senza cambiare schema o consumer senza migrazione.
- **Priorità corrente:** P1/P2
- **Dipendenze:** BETA-017; inventario completo dei consumer; verifica degli ID e piano di migrazione.
- **Stato:** BLOCCATO DA DATI
- **Criterio di validazione:** responsabilità e fonte di ogni campo sono chiare; tutti i consumer sono mappati; la migrazione preserva i dati e non interrompe pagine o algoritmi.

## BETA-017 — Aggiornamento e validazione database per Beta 1

- **Area:** Database
- **Tipo:** DATI
- **Osservazione:** sono previsti aggiornamenti o completamenti dei database prima della Beta 1; i file aggiornati non sono ancora disponibili.
- **Comportamento desiderato:** all'arrivo dei file, controllare intestazioni, ID, completezza, valori mancanti, duplicati, mapping fra fonti, consumer e adattamenti realmente necessari. Non adattare preventivamente il codice a dati ipotetici.
- **Priorità corrente:** P0
- **Dipendenze:** consegna dei database reali aggiornati.
- **Stato:** BLOCCATO DA DATI
- **Criterio di validazione:** controlli documentati sui file effettivi; mapping coerente fra fonti; parser e viste verificati sui nuovi dati; build e prova generale completate.

---

# 8. Prezzo stagione precedente

## BETA-018 — Modellazione e uso dei prezzi storici

- **Area:** Prezzi storici
- **Tipo:** DATI / ALGORITMO / UI
- **Osservazione:** l'UI corrente mostra uno storico non disponibile. Uno stesso giocatore può avere più prezzi nella stessa stagione in leghe o divisioni differenti.
- **Comportamento desiderato:** definire conservazione contestuale, visualizzazione e possibile uso algoritmico come decisioni separate. Non ridurre automaticamente più prezzi a un solo valore e non inserirli automaticamente nel valore corrente o nel consiglio prezzo.
- **Priorità corrente:** P2
- **Dipendenze:** modello multi-lega/multi-asta; fonti reali dei prezzi; definizione dei contesti; validazione separata di qualsiasi uso algoritmico.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** più prezzi dello stesso giocatore possono essere ricondotti senza ambiguità a stagione, lega/divisione e asta; la UI distingue fatti storici e valutazioni correnti; ogni uso algoritmico è esplicito e verificato.

---

# 9. Scheda giocatore

## BETA-019 — Gerarchia della scheda dettaglio

- **Area:** Scheda giocatore
- **Tipo:** UX / UI
- **Osservazione:** quando apre la scheda, l'utente cerca prima informazioni sul giocatore. Sono stati annotati: box “Valorizzato” troppo grande, spazi sbilanciati, prezzi Saggi da rivedere, valore sintetico Saggi poco separato e gerarchia numerica incoerente.
- **Comportamento desiderato:** valutare un ordine che privilegi dati e prestazioni, poi informazioni d'asta, quindi grafici e approfondimenti; evitare di ripetere o sovraccaricare il grafico con lo stesso valore sintetico.
- **Priorità corrente:** P1
- **Dipendenze:** osservazione della UI reale; BETA-003; chiarimento del ruolo informativo dei dati Saggi.
- **Stato:** IN ANALISI
- **Criterio di validazione:** nei test l'utente trova rapidamente dati e prestazioni principali; spazi, numeri e sezione Saggi hanno gerarchia coerente su desktop e mobile. L'ordine finale viene validato sulla UI, non assunto dal presente backlog.

---

# 10. Pagina Asta

## BETA-020 — Flusso post-assegnazione

- **Area:** Auction
- **Tipo:** UX / FLUSSO ASTA
- **Osservazione:** dopo l'assegnazione, la pagina può continuare a mostrare il giocatore e informazioni calcolate per lo stato precedente, generando contenuto obsoleto.
- **Comportamento desiderato:** progettare la chiusura della scheda/dettaglio corrente, rimuovere la raccomandazione riferita al vecchio stato, ricalcolare lo stato e passare a “attesa prossima chiamata”. Valutare in tale stato un recap degli ultimi 5 assegnati; 5 è una proposta UI corrente, non un invariante.
- **Priorità corrente:** P0
- **Dipendenze:** definizione del contenuto dello stato di attesa; verifica del ciclo render/salvataggio e dei pannelli dipendenti dal giocatore corrente.
- **Stato:** PRONTO PER IMPLEMENTAZIONE
- **Criterio di validazione:** dopo ogni aggiudicazione non rimangono scheda, limiti o Chiamata consigliata del giocatore precedente; crediti, slot, concorrenti e nuova raccomandazione sono basati sul nuovo stato; l'interfaccia attende chiaramente la prossima chiamata.

## BETA-021 — Shortcut Asta → Players sincronizzata col ruolo

- **Area:** Auction / Players
- **Tipo:** UX
- **Osservazione:** la shortcut dalla pagina Asta apre Players mantenendo il vecchio filtro locale, anche se il ruolo attivo dell'asta è cambiato.
- **Comportamento desiderato:** il passaggio contestuale Asta → Players deve aprire Players sul ruolo attivo dell'Asta. La navigazione ordinaria verso Players non deve necessariamente modificare il filtro.
- **Priorità corrente:** P0/P1
- **Dipendenze:** definizione di un passaggio contestuale del ruolo senza rendere globale ogni navigazione.
- **Stato:** PRONTO PER IMPLEMENTAZIONE
- **Criterio di validazione:** se Players era su C e l'Asta è in P, la shortcut apre Players filtrato su P; aprire Players dalla navigazione principale mantiene il comportamento concordato per la navigazione ordinaria.

---

# 11. Algoritmo concorrenti

## BETA-022 — Interesse strategico dei concorrenti sui portieri

- **Area:** Concorrenti / Portieri
- **Tipo:** ALGORITMO
- **Osservazione:** un manager che possiede già il P1 di una squadra può risultare il concorrente più pericoloso per il P1 di un'altra squadra. L'algoritmo attuale considera capacità e slot, ma non rappresenta sufficientemente l'utilità marginale del candidato nella costruzione reale del reparto.
- **Comportamento desiderato:** distinguere capacità di spesa, bisogno del reparto e interesse strategico plausibile. Per P va valutata una logica dedicata coerente con i piani portieri, senza applicare un moltiplicatore arbitrario.
- **Priorità corrente:** P0/P1
- **Dipendenze:** ricostruzione del caso reale; dati completi delle rose; definizione esplicita dell'interesse; casi limite e piani portieri correnti.
- **Stato:** IN ANALISI
- **Criterio di validazione:** il caso osservato è riproducibile con input e passaggi visibili; manager con diverse costruzioni P vengono ordinati coerentemente in casi realistici; capacità e interesse restano valori distinti e spiegabili.

---

# 12. Profilazione degli sfidanti

## BETA-023 — Evidenze e profili dei manager

- **Area:** Profilazione sfidanti
- **Tipo:** DATI / ALGORITMO / AI
- **Osservazione:** non è ancora definito quali eventi debbano essere osservati e archiviati per costruire profili affidabili dei manager.
- **Comportamento desiderato:** progettare la specifica facendo riferimento a `CHAT_AGENT_VISION.md`, considerando come esempi prezzo rispetto ai riferimenti, massimi osservati nelle aste perse, frequenza di partecipazione, interessi, disciplina, concentrazione della spesa, comportamento dopo sconfitte e stato della rosa.
- **Priorità corrente:** P2
- **Dipendenze:** modello multi-asta; schema concettuale di fatto/annotazione/inferenza; validazione utente; decisioni architetturali della chat.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** ogni tratto proposto è collegato a evidenze contestualizzate e multiple quando possibile; nessun campo permanente viene creato soltanto perché appare nell'elenco esplorativo.

---

# 13. Chatbot / co-manager

## BETA-024 — Componente conversazionale

- **Area:** Chatbot / Co-manager
- **Tipo:** FEATURE / AI / ARCHITETTURA
- **Osservazione:** la componente descritta in `CHAT_AGENT_VISION.md` non è implementata e richiede progettazione architetturale prima dello sviluppo.
- **Comportamento desiderato:** realizzare in futuro una pagina dedicata con accesso automatico allo stato, conversazione strategica, proattività event-driven, supporto decisionale, annotazioni libere, analisi avversari, memorie temporanee, report finale, validazione e profilo storico.
- **Priorità corrente:** P3 per l'implementazione immediata; alta priorità progettuale.
- **Dipendenze:** decisioni aperte di `CHAT_AGENT_VISION.md`; modello multi-asta; persistenza, privacy, fallback e confini del motore deterministico.
- **Stato:** DA FARE
- **Criterio di validazione:** prima di implementare esiste una proposta architetturale coerente con “registro prima dell'AI”, human in control e funzionamento dell'asta senza AI. La specifica dettagliata resta in `CHAT_AGENT_VISION.md`.

## BETA-025 — Finestra flottante della chat

- **Area:** Chatbot / Co-manager
- **Tipo:** UX / FEATURE
- **Osservazione:** una chat flottante o riposizionabile potrebbe risultare utile sopra la pagina Asta, ma non è stata validata.
- **Comportamento desiderato:** valutarla soltanto dopo aver provato la pagina dedicata iniziale.
- **Priorità corrente:** P3
- **Dipendenze:** BETA-024; evidenze d'uso della pagina dedicata.
- **Stato:** RIMANDATO
- **Criterio di validazione:** la decisione deriva da problemi osservati nella pagina dedicata e da test desktop/mobile, non da una preferenza astratta.

## BETA-026 — Discussione della strategia tramite chat

- **Area:** Chatbot / Strategia
- **Tipo:** AI / STRATEGIA
- **Osservazione:** il co-manager dovrà poter discutere se adattare la strategia durante l'asta; la capacità è già inclusa nella visione conversazionale e non esiste oggi.
- **Comportamento desiderato:** rispettare il flusso “AI propone → owner approva → app modifica lo stato”, senza modifiche strategiche autonome.
- **Priorità corrente:** inclusa in `CHAT_AGENT_VISION.md`; non ancora classificata separatamente P0–P3.
- **Dipendenze:** BETA-024; modello della strategia per singola asta; azioni approvabili e auditabili.
- **Stato:** DA FARE
- **Criterio di validazione:** una proposta espone motivazione e conseguenze; nessun cambiamento persistente avviene prima della conferma esplicita dell'owner.

---

# 14. Qualità della rosa

## BETA-027 — Indicatori live della rosa

- **Area:** Qualità della rosa
- **Tipo:** FEATURE / ALGORITMO / UI
- **Osservazione:** manca una lettura sintetica live della qualità e della titolarità complessive della rosa costruita.
- **Comportamento desiderato:** valutare indicatori con significato operativo durante l'asta, evitando medie semplicistiche e considerando ruoli e slot.
- **Priorità corrente:** P2
- **Dipendenze:** definizione di ogni indicatore; dati affidabili; esempi numerici; verifica di doppio conteggio con iCà e altri segnali.
- **Stato:** DA CHIARIRE
- **Criterio di validazione:** ogni indicatore ha formula, variabili, origine dati, casi limite e interpretazione espliciti; su rose realistiche produce informazioni utili e non una media priva di significato.

---

# 15. Audit degli algoritmi

## BETA-028 — Audit completo iCà

- **Area:** iCà / Valutazione giocatori
- **Tipo:** ALGORITMO / DATI
- **Osservazione:** durante l'uso reale sono emersi risultati iCà che non sembrano rappresentare correttamente il valore fantacalcistico del giocatore. Il primo caso di benchmark da conservare e analizzare è **Falcone circa 80 contro Di Gregorio circa 71**. Secondo l'osservazione dell'owner, Falcone può anche essere più forte individualmente, ma gioca in una squadra di livello inferiore e può quindi risultare meno desiderabile al Fantacalcio rispetto a Di Gregorio. Questo non dimostra di per sé che un peso sia sbagliato.
- **Comportamento desiderato:** chiarire innanzitutto che cosa iCà intende misurare fra qualità individuale, valore fantacalcistico, affidabilità, desiderabilità d'asta oppure una combinazione esplicita di questi concetti. Prima di modificare la formula, ricostruire la formula reale dal codice; elencare tutte le variabili e l'origine di ogni dato; mostrare il contributo numerico di ogni componente; verificare dati mancanti e rinormalizzazione, rappresentazione del contesto della squadra, necessità di una logica dedicata ai portieri, doppio conteggio, soglie o trasformazioni arbitrarie e più casi reali. Non correggere singoli casi a mano e non modificare ancora pesi, soglie o formule.
- **Priorità corrente:** P0/P1
- **Dipendenze:** codice e dati effettivamente usati dal calcolo; disponibilità di input riproducibili per Falcone e Di Gregorio; ulteriori esempi raccolti nelle aste reali; definizione esplicita del significato di iCà.
- **Stato:** IN ANALISI
- **Criterio di validazione:** il benchmark Falcone–Di Gregorio e altri casi reali sono riproducibili a mano a partire dagli stessi dati dell'app; formula, variabili, fonti, contributi, rinormalizzazioni e casi limite sono documentati; l'eventuale incoerenza è ricondotta a uno specifico dato, parametro, vincolo o significato della metrica prima di proporre modifiche.

## BETA-029 — Audit generale degli algoritmi

- **Area:** Algoritmi trasversali
- **Tipo:** ALGORITMO / DATI
- **Osservazione:** durante l'uso reale sono emersi risultati non sempre intuitivi o comprensibili negli algoritmi principali. Le aree da verificare sistematicamente sono iCà, consiglio prezzo, Chiamata consigliata, supply, domanda, pressione di mercato, logica portieri, economia portieri, analisi concorrenti, stima della puntata degli avversari ed eventuale impatto allenatori.
- **Comportamento desiderato:** per ogni audit: 1) scrivere la formula effettivamente implementata; 2) definire ogni variabile; 3) indicare la provenienza di ogni dato; 4) costruire esempi numerici verificabili a mano; 5) spiegare il significato del risultato; 6) verificare casi limite; 7) verificare doppio conteggio; 8) verificare soglie arbitrarie; 9) distinguere parametri correnti da invarianti; 10) confrontare l'output con casi reali osservati in asta. Se un risultato sembra incoerente, ricostruire il calcolo e identificare il parametro, il dato o il vincolo responsabile, senza difendere automaticamente la formula esistente.
- **Priorità corrente:** P1
- **Dipendenze:** BETA-028 per l'audit specifico iCà; casi reali riproducibili raccolti durante le beta; codice, configurazioni e dati effettivamente utilizzati da ciascun algoritmo.
- **Stato:** IN ANALISI
- **Criterio di validazione:** per ciascuna area esaminata esistono formula, glossario delle variabili, fonti, esempi manuali, casi limite e confronto con evidenze d'asta; ogni anomalia è ricondotta alla causa concreta prima di qualsiasi modifica e i valori correnti/configurabili restano distinti dagli invarianti concettuali.

---

# 16. Ordine di lavoro corrente

## Prima della Beta 1

Priorità operative:

1. aggiornare e validare i database reali;
2. adattare il codice soltanto dove i nuovi database lo richiedono;
3. correggere il flusso post-assegnazione della pagina Asta;
4. sincronizzare il ruolo nella shortcut Asta → Players;
5. analizzare e correggere l'interesse concorrenti sui portieri;
6. correggere bug UI evidenti che compromettono la lettura;
7. predisporre la raccolta strutturata degli output sospetti, con dati sufficienti a trasformarli in casi di benchmark riproducibili;
8. eseguire build e prova generale.

Le attività bloccate dai nuovi database non autorizzano adattamenti preventivi basati su schemi ipotetici.

## Beta 1

Durante la prima asta reale:

- non cambiare formule durante l'asta, salvo bug bloccanti;
- raccogliere esempi concreti;
- annotare giocatore, stato, consiglio prodotto, comportamento atteso e problema percepito;
- conservare i dati necessari a ricostruire il caso dopo l'asta;
- trasformare gli output sospetti in casi di benchmark per gli audit, senza cambiare formule durante l'asta salvo bug bloccanti.

## Fra Beta 1 e Beta 2

Classificare ogni problema come:

- DATI;
- BUG;
- UI/UX;
- PARAMETRO;
- ALGORITMO;
- NUOVA FEATURE.

Correggere soltanto dopo aver identificato la causa. Una percezione di incoerenza non deve tradursi automaticamente in una modifica della formula.

## Beta 2

Usare la seconda asta per verificare:

- regressioni;
- comportamento del consiglio prezzo;
- Chiamata consigliata;
- portieri;
- analisi concorrenti;
- velocità dell'interfaccia;
- leggibilità;
- nuovi output sospetti da conservare con il relativo contesto e trasformare in casi di benchmark verificabili.

## Verso la beta finale

Dopo le due aste:

- stabilizzare;
- evitare nuove feature ad alto rischio;
- rivedere i parametri sulla base delle osservazioni;
- correggere regressioni;
- preparare una versione candidata per l'asta finale.

---

# 17. Riepilogo delle voci

## Conteggio per priorità

Le voci principali sono **29**.

Nel conteggio seguente, `P0/P1` è conteggiata in P0 e `P1/P2` in P1, come fascia più urgente. Le due voci prive di una classificazione numerica definitiva sono riportate separatamente.

| Priorità di conteggio | Numero |
| --- | ---: |
| P0 | 5 |
| P1 | 10 |
| P2 | 10 |
| P3 | 2 |
| Non classificata P0–P3 | 2 |

Le due voci non classificate numericamente sono:

- BETA-013 — Nota “DB coener?”;
- BETA-026 — Discussione della strategia tramite chat.

## Voci nello stato `DA CHIARIRE`

- BETA-006 — Revisione complessiva della pagina Obiettivi.
- BETA-007 — Campo ricerca Insights.
- BETA-012 — Ruolo dell'algoritmo allenatori.
- BETA-013 — Nota “DB coener?”.
- BETA-018 — Modellazione e uso dei prezzi storici.
- BETA-023 — Evidenze e profili dei manager.
- BETA-027 — Indicatori live della rosa.

I conteggi e gli stati sono una fotografia della pianificazione corrente e devono essere riesaminati alla luce delle aste beta e dei database reali.
