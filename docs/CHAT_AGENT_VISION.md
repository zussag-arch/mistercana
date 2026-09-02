# Agente 444 — Visione della componente conversazionale

## Stato del documento

Questo documento descrive la visione di una futura componente conversazionale di Agente 444.

Non descrive funzionalità già implementate e non costituisce una specifica tecnica definitiva. In particolare, non sceglie framework, provider o modello AI, database, hosting, architettura backend o schema finale dei dati.

Lo stato reale dell'applicazione è documentato in [`docs/CURRENT_STATE.md`](./CURRENT_STATE.md). I principi generali e gli invarianti del prodotto sono documentati in [`docs/CONCEPTS.md`](./CONCEPTS.md).

Alla data di questo documento, l'app è una SPA client-side utilizzabile localmente e distribuita tramite GitHub Pages. Non esistono ancora backend, componente AI, pagina chatbot, memoria conversazionale, profilazione avanzata o un modello completo multi-lega e multi-asta. Il secondo offerente registrabile è uno solo e non viene conservata l'intera sequenza dei rilanci.

Le sezioni seguenti definiscono un comportamento desiderato futuro senza presentare queste capacità come già disponibili.

---

## 1. Visione generale

La componente conversazionale non deve essere un semplice assistente che resta inattivo finché l'utente non formula una domanda. Deve comportarsi come un **co-manager d'asta**: l'amico competente che segue l'asta insieme all'owner, conosce la situazione, interviene con misura e aiuta a ragionare sotto pressione.

Il co-manager deve poter:

- conoscere automaticamente gli eventi registrati dall'app;
- seguire acquisti, prezzi, rose, crediti, slot, ruolo attivo e andamento del mercato;
- rispondere a domande operative e strategiche;
- intervenire spontaneamente quando un evento ha conseguenze realmente rilevanti;
- aiutare l'owner a mantenere disciplina dopo eventi emotivamente significativi;
- spiegare l'effetto di un acquisto sulla costruzione della rosa;
- proporre adattamenti della strategia senza applicarli autonomamente;
- indicare giocatori o profili coerenti con il nuovo stato;
- mettere in relazione capacità economica e interesse strategico degli avversari;
- raccogliere osservazioni qualitative che l'app non registra direttamente;
- costruire nel tempo una memoria dei manager basata su evidenze e validata dall'utente.

Il valore della conversazione nasce dalla combinazione di tre capacità:

1. conoscere lo stato corrente senza farselo raccontare;
2. interpretare le conseguenze dei fatti e dei calcoli;
3. comunicare nel momento e con il livello di dettaglio appropriati.

Esempio di tono desiderato, non di formula:

> Per prenderlo siamo andati oltre il piano. Adesso eviterei un altro investimento pesante nello stesso reparto. Proverei a chiamare X: dovrebbe costare meno, ha titolarità alta e può portarci qualche bonus senza compromettere il resto della rosa.

La frase mostra un co-manager che parte da un fatto, ne espone la conseguenza e propone una risposta operativa. Non stabilisce una soglia, un algoritmo o un testo fisso.

---

## 2. Principi non negoziabili

### 2.1 Registro prima dell'AI

L'applicazione e il motore deterministico rimangono la fonte dei fatti conoscibili con certezza.

L'AI non deve ricostruire dalla conversazione ciò che l'app può fornire direttamente, come:

- giocatori acquistati;
- manager acquirenti;
- prezzi finali;
- crediti iniziali, spesi e residui;
- composizione delle rose;
- slot occupati e liberi;
- ruolo attivo;
- giocatori disponibili;
- obiettivi e scarti;
- limiti di prezzo;
- ranking deterministici;
- stato corrente degli avversari.

La memoria della chat non sostituisce il registro. Se conversazione e stato applicativo divergono, il sistema deve rendere visibile la divergenza e usare lo stato registrato come riferimento per i fatti applicativi, salvo correzione esplicita dell'utente nel registro.

### 2.2 Human in control

L'agente può interpretare, spiegare, confrontare e proporre. Non deve:

- assegnare autonomamente un giocatore;
- registrare come certo un acquisto non confermato;
- modificare permanentemente la strategia senza approvazione;
- trasformare un'annotazione o un'inferenza in fatto certo;
- rendere permanente una profilazione non validata;
- sostituire la decisione finale dell'owner.

### 2.3 Distinzione epistemica

Ogni risposta strategica deve mantenere distinguibili:

- fatti;
- calcoli deterministici;
- annotazioni dell'utente;
- inferenze;
- raccomandazioni.

La distinzione può essere espressa con il linguaggio naturale e non richiede necessariamente etichette rigide in ogni messaggio. Deve però restare chiaro che cosa è certo, che cosa è calcolato, che cosa è interpretato e che cosa è consigliato.

### 2.4 Spiegabilità proporzionata al momento

Durante un rilancio, la risposta deve poter essere breve e immediatamente operativa. Su richiesta, lo stesso consiglio deve poter essere approfondito mostrando dati, vincoli, alternative e grado di incertezza.

### 2.5 AI come livello aggiuntivo, non fondazione operativa

La componente conversazionale arricchisce l'app, ma non diventa necessaria per il funzionamento dell'asta. Registrazione, navigazione, ricerca, rose, crediti, slot, limiti e Chiamata consigliata deterministica devono restare utilizzabili anche senza AI.

---

## 3. Contesto automatico dell'asta

L'utente non deve ripetere in chat eventi o valori già noti all'app.

Quando viene registrata un'assegnazione, la componente conversazionale deve poter ricevere un evento strutturato che descriva, almeno concettualmente:

- giocatore e ruolo;
- manager acquirente;
- prezzo finale;
- budget prima e dopo;
- slot prima e dopo;
- stato del reparto prima e dopo;
- limiti e previsioni calcolati prima della vendita, se disponibili;
- conseguenze deterministiche sul piano corrente;
- giocatori e alternative ancora disponibili;
- variazioni rilevanti nello stato degli avversari.

Lo stesso principio vale per altri eventi, per esempio:

- chiamata di un giocatore;
- aumento del prezzo corrente;
- asta chiusa senza assegnazione;
- correzione o annullamento di un acquisto;
- cambio del ruolo attivo;
- aggiunta o rimozione di un obiettivo;
- scarto o ripristino di una raccomandazione;
- modifica approvata della strategia;
- chiusura di un reparto;
- conclusione dell'asta.

Il formato tecnico degli eventi resta da decidere. Concettualmente, ogni evento deve essere collegabile allo stato prima e dopo, così che l'agente possa spiegare una conseguenza senza inventare valori.

### Correzioni dello stato

Se un acquisto viene corretto o annullato, anche il contesto dell'agente deve riflettere la correzione. Le interpretazioni fondate sul dato errato devono poter essere ricalcolate, ritirate o marcate come superate.

Una vecchia risposta può restare nella cronologia della conversazione, ma non deve continuare a essere trattata come descrizione valida dello stato corrente.

---

## 4. Ruolo dell'app e ruolo dell'LLM

La separazione desiderata è la seguente.

### App e motore deterministico

Responsabilità:

- registrare eventi confermati;
- mantenere lo stato dell'asta;
- calcolare crediti, slot e rose;
- calcolare limiti, riserve, supply, domanda e ranking;
- produrre indicatori e confronti riproducibili;
- individuare candidati a eventi anomali o opportunità;
- fornire all'agente dati strutturati e aggiornati;
- applicare soltanto azioni autorizzate dall'utente.

### Agente AI

Responsabilità:

- interpretare i dati forniti dall'app;
- collegare eventi recenti e contesto storico validato;
- conversare con linguaggio naturale;
- spiegare conseguenze e alternative;
- sintetizzare situazioni complesse;
- proporre adattamenti;
- trasformare note libere in informazioni strutturate candidate;
- formulare inferenze con un livello di affidabilità;
- produrre report di fine asta;
- aiutare l'utente a mantenere disciplina decisionale.

Il modello linguistico non deve inventare o sostituire la matematica dell'asta. Una risposta numerica deve provenire da dati o calcoli espliciti del motore, oppure essere chiaramente presentata come scenario ipotetico richiesto dall'utente.

---

## 5. Conversazione strategica

L'utente deve poter formulare domande naturali, anche colloquiali e incomplete, come:

- “Secondo te sto facendo una cazzata se provo a prendere anche X?”
- “Chi può rompermi le scatole su questo giocatore?”
- “Devo cambiare strategia?”
- “Chi chiameresti adesso?”
- “Sto spendendo troppo?”
- “Chi dei miei avversari è messo meglio?”
- “Secondo te B sta andando su tutti i top?”

L'agente deve interpretare la domanda nel contesto dell'asta corrente senza chiedere dati già disponibili.

### Struttura sostanziale della risposta

Una risposta completa può includere:

1. **Fatti rilevanti:** stato registrato, per esempio crediti e acquisti.
2. **Calcoli:** limiti, slot, capacità, ranking o variazioni prodotti dal motore.
3. **Inferenza:** lettura prudente di mercato o comportamento.
4. **Raccomandazione:** azione suggerita e alternative.
5. **Incertezza:** dati mancanti o affidabilità dell'interpretazione.

Non tutti i messaggi devono mostrare cinque sezioni. Durante l'asta la forma può essere compatta, purché la natura delle affermazioni resti comprensibile.

### Esempio concettuale

Alla domanda “Sto spendendo troppo?”, una risposta coerente potrebbe:

- indicare la spesa registrata nel reparto;
- riportare il target e i limiti calcolati dall'app;
- spiegare quali slot restano da coprire;
- distinguere una deviazione temporanea da un rischio di completamento;
- suggerire un profilo più efficiente per le prossime chiamate.

Non deve generare numeri plausibili ma inesistenti, né presentare come certa una previsione sul prezzo futuro.

---

## 6. Proattività controllata

Il chatbot deve poter intervenire senza una domanda esplicita, ma soltanto quando il messaggio porta valore operativo.

Principio:

> L'agente non parla perché può. Parla quando ha qualcosa di utile da dire.

La proattività deve essere **event-driven**. Il modello linguistico non osserva autonomamente e in modo continuo l'intero stato decidendo senza controllo quando interrompere l'utente. L'app o il motore deterministico devono poter rilevare eventi, anomalie e opportunità candidate; soltanto dopo questa selezione l'agente può interpretarli e formulare un eventuale messaggio entro le regole definite.

Flusso concettuale:

```text
EVENTI DELL'APP / MOTORE DETERMINISTICO
                  ↓
RILEVAZIONE DI EVENTI CANDIDATI ALLA PROATTIVITÀ
                  ↓
PRIORITÀ / CONTESTO
                  ↓
AGENTE AI
                  ↓
FORMULAZIONE DEL MESSAGGIO
```

Il livello deterministico identifica i candidati alla proattività e fornisce il contesto verificabile. L'AI può collegare gli eventi, valutarne il significato conversazionale, sintetizzarli e decidere come comunicarli entro i vincoli di frequenza, urgenza e controllo definiti dal prodotto. Questo documento non stabilisce l'algoritmo di rilevazione né soglie numeriche.

### Livello 1 — Silenzio

L'evento è normale, coerente con il piano o già evidente nella UI. Un messaggio aggiungerebbe rumore.

Comportamento: aggiornare internamente il contesto senza interrompere l'utente.

### Livello 2 — Nota

L'evento è utile ma non urgente. Può migliorare la lettura dell'asta senza richiedere una reazione immediata.

Esempi:

- acquisto particolarmente conveniente;
- mercato di un reparto che si sta spostando;
- avversario vicino al completamento di un reparto;
- nuova evidenza coerente con un comportamento già osservato;
- opportunità interessante ma non ancora critica.

La nota dovrebbe essere breve, non allarmistica e, quando opportuno, aggregabile con altre osservazioni.

### Livello 3 — Intervento

L'evento modifica significativamente il piano o richiede attenzione immediata.

Esempi:

- prezzo oltre un limite rilevante;
- forte deviazione dal budget;
- rischio di concatenare un altro investimento pesante;
- opportunità destinata a scomparire rapidamente;
- cambiamento dello stato che rende non sostenibile una strategia;
- comportamento avversario che altera concretamente la decisione corrente.

L'intervento deve spiegare in modo sintetico il fatto scatenante, la conseguenza e l'azione proposta.

I livelli sono categorie concettuali. Le soglie numeriche, i criteri di escalation e la loro eventuale personalizzazione non sono definiti in questo documento.

---

## 7. Eventi candidati alla proattività

Le seguenti categorie possono autorizzare una valutazione proattiva; non implicano che ogni occorrenza debba generare un messaggio:

- acquisto molto sopra il tetto o un altro limite significativo;
- acquisto molto conveniente rispetto ai riferimenti disponibili;
- forte deviazione dal budget del reparto;
- cambiamento importante nella strategia o nella sua sostenibilità;
- reparto quasi completato o completato;
- opportunità di mercato emersa;
- scarsità crescente;
- concorrente che cambia comportamento osservabile;
- avversario che esaurisce capacità economica o interesse strategico;
- sequenza di aste perse dall'owner;
- rilancio successivo che suggerisce un possibile inseguimento emotivo;
- nuovo acquisto premium subito dopo una spesa importante;
- giocatore obiettivo che diventa strategicamente interessante;
- mercato di ruolo significativamente diverso dalle attese;
- correzione dello stato che invalida un consiglio precedente;
- più eventi minori che, insieme, producono una conseguenza rilevante.

Il motore deterministico dovrebbe fornire, quando possibile, gli indicatori quantitativi. L'agente dovrebbe decidere come sintetizzarli e comunicarli senza inventare soglie o cause psicologiche.

---

## 8. Frequenza e qualità degli interventi

La proattività non deve trasformarsi in una cronaca continua.

La decisione di parlare dovrebbe poter considerare:

- importanza dell'evento;
- urgenza della conseguenza;
- tempo trascorso dall'ultimo intervento;
- fase dell'asta;
- presenza di una decisione attiva dell'utente;
- ripetizione di eventi simili;
- possibilità di aggregare più segnali;
- probabilità che il messaggio sia già implicito nella UI;
- preferenza dell'utente sulla frequenza degli interventi.

Eventi simili possono essere raccolti in una sola nota. Un evento urgente può interrompere il silenzio, mentre un'osservazione non urgente può attendere un momento di minore pressione.

L'agente dovrebbe evitare:

- ripetere la stessa raccomandazione senza nuovi elementi;
- commentare ogni vendita;
- trasformare oscillazioni minime in allarmi;
- inviare messaggi lunghi durante un rilancio;
- accumulare note obsolete dopo una correzione dello stato;
- usare un tono emotivo più forte dei fatti osservati.

---

## 9. Supporto emotivo basato sui fatti

L'agente può aiutare l'owner a mantenere disciplina, ma non deve diagnosticare emozioni, intenzioni o stati psicologici.

Può riconoscere sequenze osservabili, per esempio:

- più aste perse consecutivamente;
- rilancio sopra i limiti dopo sconfitte recenti;
- acquisto molto costoso appena registrato;
- tentativo immediato di acquistare un altro profilo premium;
- deviazione improvvisa dal piano;
- aumento dell'aggressività rispetto alle azioni precedenti.

Su questa base può ricordare che:

- perdere un obiettivo non implica automaticamente essere in ritardo;
- il giocatore successivo non deve essere pagato di più per “recuperare”;
- una spesa importante può richiedere efficienza nelle chiamate successive;
- una pausa di valutazione può essere utile prima di un altro investimento rilevante.

Il linguaggio deve restare ancorato agli eventi:

- appropriato: “Hai perso due obiettivi e ora il prezzo è già oltre il limite calcolato; eviterei di inseguire.”
- inappropriato: “Sei frustrato e stai perdendo il controllo.”

Il primo descrive fatti e rischio decisionale; il secondo inventa uno stato psicologico.

---

## 10. Strategia dinamica e approvazione

L'agente deve poter proporre adattamenti quando lo stato reale rende il piano iniziale meno efficace, per esempio quando:

- un reparto è più economico delle attese;
- un altro reparto è più costoso;
- un acquisto importante cambia la distribuzione sostenibile;
- emergono opportunità non previste;
- la scarsità o la pressione degli avversari cambiano;
- la composizione effettiva della rosa rende preferibile un profilo diverso.

Una proposta deve indicare:

- fatto o tendenza che la motiva;
- conseguenza sul piano corrente;
- modifica proposta;
- principali vantaggi e rinunce;
- eventuali alternative;
- grado di urgenza.

Flusso concettuale:

```text
STATO ED EVENTI
      ↓
ANALISI DELLE CONSEGUENZE
      ↓
PROPOSTA DELL'AI
      ↓
APPROVAZIONE, MODIFICA O RIFIUTO DELL'UTENTE
      ↓
EVENTUALE AGGIORNAMENTO DELLO STATO DA PARTE DELL'APP
```

Principio:

**L'AI propone. L'utente approva. Solo dopo l'app modifica lo stato.**

Una proposta rifiutata non deve continuare a essere trattata come strategia attiva.

---

## 11. Analisi conversazionale degli avversari

L'analisi futura deve distinguere due domande:

1. quanto un manager può spendere;
2. quanto è plausibile che voglia competere proprio su quel giocatore.

La capacità economica può essere descritta con fatti e calcoli. L'interesse strategico è invece una valutazione che può integrare:

- crediti residui e spesa effettuata;
- slot occupati e mancanti;
- struttura e qualità della rosa;
- ruolo e livello del giocatore chiamato;
- alternative disponibili;
- comportamento osservato nella stessa asta;
- storico validato disponibile;
- annotazioni qualitative dell'utente;
- affidabilità e attualità delle evidenze.

Un manager con molti crediti non è automaticamente il concorrente più pericoloso. Per esempio, chi possiede già un P1 importante può avere meno interesse per un altro P1 rispetto a chi deve ancora costruire il reparto, anche se dispone di più budget.

Le risposte dovrebbero poter distinguere:

- **capacità:** “B può arrivare fino a…” sulla base del calcolo dell'app;
- **interesse stimato:** “B sembra meno probabile…” sulla base della rosa e delle evidenze;
- **incertezza:** “Non abbiamo osservazioni recenti sufficienti…”;
- **raccomandazione:** “Il concorrente da monitorare è C…”.

L'analisi attuale descritta in `CURRENT_STATE.md` non possiede ancora tutte queste informazioni e non deve essere rappresentata come se le possedesse.

---

## 12. Eventi non strutturati e annotazioni libere

Non ogni dettaglio dell'asta deve richiedere un form dedicato.

L'utente deve poter scrivere, per esempio:

> B è arrivato a 77, C a 74 e D a 73.

La componente conversazionale deve poter trasformare il testo in informazioni strutturate **candidate**, preservando il testo originale e chiedendo conferma quando l'interpretazione non è sufficientemente univoca.

Devono restare distinti quattro livelli:

1. **Testo scritto dall'utente:** il contenuto originale della conversazione e la sua provenienza.
2. **Informazione strutturata estratta:** una rappresentazione candidata ricavata dal testo, ancora correggibile e contestuale.
3. **Stato deterministico dell'asta:** il registro principale mantenuto dall'app e usato per i calcoli.
4. **Memoria storica permanente:** informazione selezionata e validata attraverso il relativo processo di approvazione.

Se l'utente scrive “B è arrivato a 77”, l'agente può usare questa informazione nella conversazione dichiarando che proviene dall'utente. L'eventuale estrazione strutturata può diventare una memoria temporanea della singola asta, ma non deve modificare automaticamente i calcoli deterministici del registro principale né diventare una caratteristica permanente di B.

Se il riferimento a “B”, al giocatore, al prezzo o al significato dell'evento è ambiguo, l'interpretazione deve poter essere mostrata, confermata o corretta prima di essere trattata come informazione strutturata affidabile.

Questa capacità è utile perché il modello applicativo corrente registra al massimo un secondo offerente e non l'intera sequenza dei rilanci o tutti i partecipanti.

Il risultato dell'estrazione non deve essere confuso con una modifica automatica del registro principale. Deve poter essere:

- mostrato all'utente;
- corretto;
- confermato;
- mantenuto come memoria temporanea d'asta;
- scartato.

Un'annotazione libera può contenere insieme fatti dichiarati e interpretazioni. Per esempio:

> D si è fermato a 73, ma secondo me stava solo alzando il prezzo.

Il sistema dovrebbe separare la dichiarazione sul rilancio dall'opinione sul comportamento, senza promuovere automaticamente nessuna delle due a verità storica permanente.

---

## 13. Fatti, annotazioni e inferenze

### Fatto

Dato certo proveniente dallo stato applicativo o da un evento esplicitamente registrato e confermato.

Esempio:

> D ha rilanciato fino a 73.

Il sistema deve conservare fonte e contesto del fatto. Un fatto riferito dall'utente può avere una provenienza diversa da un fatto registrato direttamente dall'app, pur restando una dichiarazione concreta.

### Annotazione dell'utente

Osservazione, interpretazione o giudizio inserito manualmente.

Esempio:

> Secondo me D stava soltanto alzando il prezzo.

L'annotazione appartiene all'utente. Non deve essere riscritta come conclusione certa del sistema.

### Inferenza del sistema

Conclusione proposta combinando fatti, annotazioni e altre evidenze.

Esempio:

> Possibile comportamento di price pushing.

L'inferenza deve poter indicare:

- evidenze utilizzate;
- contesto a cui si riferisce;
- livello di affidabilità o confidenza;
- elementi contrari o mancanti;
- stato di validazione.

Un'inferenza non diventa automaticamente fatto. Nuove evidenze possono rafforzarla, indebolirla o superarla.

---

## 14. Memorie temporanee d'asta

Le informazioni estratte dalla conversazione possono diventare memorie temporanee utili nella stessa sessione.

Esempio puramente concettuale, non schema tecnico:

```text
manager: B
tipo: interesse_osservato
player: Dimarco
valore: 77
fonte: annotazione_utente
asta: asta_corrente
```

Una memoria d'asta dovrebbe poter conservare:

- contesto della specifica asta;
- manager e giocatore interessati, quando applicabili;
- evento o contenuto osservato;
- fonte;
- momento o ordine relativo;
- testo originale, se nasce dalla chat;
- eventuale conferma dell'utente;
- livello di affidabilità;
- collegamenti con evidenze correlate.

Queste sono proprietà concettuali, non la definizione di un database.

Le memorie temporanee devono:

- essere utilizzabili durante la stessa asta;
- restare separate dallo stato deterministico principale;
- poter essere corrette o eliminate;
- decadere o essere archiviate con il giusto contesto;
- non diventare automaticamente memoria storica permanente.

### Selezione della memoria

Non tutto ciò che viene scritto o detto nella chat deve essere conservato. La cronologia completa della conversazione non deve diventare automaticamente memoria permanente.

Devono essere distinguibili:

- **conversazione effimera:** scambio utile al dialogo ma privo di valore da conservare;
- **informazione di contesto immediato:** dato utile alla risposta o alla decisione corrente, destinato a perdere rilevanza rapidamente;
- **memoria temporanea della singola asta:** informazione contestuale riutilizzabile durante la sessione;
- **evidenza candidata al report finale:** elemento ritenuto abbastanza rilevante e verificabile da essere sottoposto a valutazione;
- **memoria storica validata:** contenuto selezionato e approvato dall'utente per l'uso nel tempo.

Il passaggio fra questi livelli non è automatico. L'agente deve selezionare ciò che è utile e verificabile, preservarne fonte e contesto ed evitare che battute, ripetizioni, ipotesi momentanee o dettagli irrilevanti producano rumore e accumulo indiscriminato nel profilo storico.

Questo principio descrive il comportamento desiderato della memoria, senza definire uno schema dati, una tecnologia di persistenza o soglie di selezione.

---

## 15. Profilazione progressiva dei manager

Durante l'asta, l'agente deve poter costruire una lettura provvisoria dei manager. Possibili dimensioni, da considerare esempi e non schema definitivo, includono:

- aggressività;
- disciplina di prezzo;
- propensione ai top;
- propensione ai rilanci tardivi;
- concentrazione della spesa;
- sensibilità al budget residuo;
- preferenze di ruolo;
- preferenze per particolari profili;
- comportamento dopo un'asta persa;
- tendenza a spingere il prezzo;
- disponibilità a superare le stime di mercato.

Una singola osservazione non è sufficiente per stabilizzare un tratto. La lettura deve poter distinguere:

- evidenza isolata;
- pattern emergente;
- interpretazione sostenuta da più episodi;
- profilo validato dall'utente;
- storico contraddetto da comportamenti recenti.

La profilazione non deve usare un'etichetta come scorciatoia per ignorare lo stato corrente. “Aggressivo sui top” non significa che un manager parteciperà a ogni asta premium, soprattutto se la sua rosa o il suo budget rendono il giocatore poco coerente.

---

## 16. Uso delle informazioni durante la stessa asta

Eventi e memorie temporanee devono produrre valore immediato, non soltanto alimentare uno storico futuro.

Alla domanda “Chi pensi possa rompere le scatole qui?”, l'agente dovrebbe poter confrontare:

- necessità reale dei manager;
- crediti e capacità massima;
- composizione dei reparti;
- interesse osservato nelle aste precedenti della stessa serata;
- rilanci e stop annotati;
- alternative ancora disponibili;
- eventuale storico validato;
- affidabilità delle informazioni.

Le evidenze recenti possono modificare la lettura operativa anche prima del report finale. Restano però contestuali e provvisorie finché non vengono validate come memoria permanente.

---

## 17. Report di fine asta

Alla conclusione della sessione, l'agente deve poter generare una proposta di report per ciascun manager.

Il report dovrebbe rendere trasparente il passaggio dalle evidenze all'interpretazione. Un formato possibile, non vincolante, è:

```text
MANAGER B

Comportamento osservato
- presente spesso sulle aste premium
- tende ad arrivare vicino al prezzo finale
- più disciplinato sui giocatori secondari

Evidenze
- Dimarco: stop 77, vendita 78
- Giocatore X: stop 43, vendita 45
- Giocatore Y: acquistato 61 rispetto a una stima inferiore

Interpretazione proposta
Propensione alta a competere sui propri obiettivi premium.

Affidabilità
MEDIA

Azioni
VALIDA · MODIFICA · SCARTA
```

Il contenuto deve mostrare:

- fatti osservati;
- annotazioni rilevanti;
- inferenze proposte;
- evidenze a supporto;
- affidabilità;
- eventuali contraddizioni;
- azione richiesta all'utente.

Il report non è ancora memoria permanente.

---

## 18. Validazione prima della memoria permanente

Nessuna profilazione generata dall'AI deve entrare automaticamente nello storico del manager.

Flusso concettuale:

```text
EVENTI + NOTE
      ↓
INFERENZE
      ↓
REPORT DI FINE ASTA
      ↓
VALIDAZIONE UTENTE
      ↓
MEMORIA STORICA
```

L'utente deve poter:

- validare una proposta;
- modificarne formulazione, ambito o affidabilità;
- rifiutarla;
- escludere singole evidenze;
- conservare un'osservazione senza promuoverla a tratto generale.

Soltanto il contenuto approvato può diventare memoria storica. La memoria deve conservare il collegamento alle evidenze che ne giustificano l'esistenza, quando disponibili.

---

## 19. Memoria multi-stagione

L'identità permanente deve seguire il manager, non il nome della squadra fantasy.

Relazione concettuale:

```text
IDENTITÀ PERMANENTE DEL MANAGER
              ↓
PROFILI DELLE SINGOLE ASTE
              ↓
PROFILO STORICO AGGREGATO
```

Ogni evidenza storica deve conservare il proprio contesto, come stagione, lega o divisione, asta, manager, giocatore e fonte.

Il profilo aggregato non è una sentenza. Deve poter essere confrontato con il comportamento corrente:

> Storicamente B è aggressivo sui top, ma oggi sta mostrando un comportamento molto più prudente.

Le osservazioni recenti devono poter aggiornare gradualmente la lettura, senza cancellare arbitrariamente il passato e senza forzare l'asta corrente dentro un'etichetta storica.

Lo stato attuale dell'app conserva un ID manager persistente, ma non versiona il nome squadra per stagione o asta e non dispone ancora delle entità necessarie per questa memoria contestuale.

---

## 20. Profilo della lega e del mercato

Il report finale dovrebbe poter includere anche una lettura complessiva della singola asta o lega, distinta dai profili individuali.

Esempi di contenuto:

- difensori premium pagati sopra i riferimenti;
- attaccanti di seconda fascia sotto i riferimenti;
- reparti con scarsità particolarmente forte;
- distribuzione dell'aggressività sui top;
- mercato complessivamente prudente o aggressivo;
- fasi dell'asta con deviazioni rilevanti;
- opportunità ricorrenti emerse.

Una caratteristica del mercato non deve essere attribuita automaticamente a ogni manager. Allo stesso modo, un comportamento individuale non deve diventare automaticamente una proprietà permanente della lega.

Il contesto deve restare legato alla specifica asta, stagione e lega. Il modello applicativo corrente non possiede ancora un'entità lega/divisione né un identificatore completo della sessione attiva.

---

## 21. UI iniziale della componente

La prima versione dovrebbe essere concepita come pagina dedicata dell'app, non come finestra flottante assunta in partenza.

La pagina può contenere concettualmente:

- cronologia della conversazione;
- indicazione dello stato LIVE;
- input testuale rapido;
- suggerimenti di domande o azioni;
- piccolo riepilogo dell'asta corrente;
- indicatori degli elementi monitorati;
- distinzione visiva fra note e interventi urgenti;
- riferimenti ai dati usati in una risposta;
- richieste di conferma per azioni o memorie candidate.

L'interfaccia deve rispettare il contesto ad alta pressione dell'asta:

- informazioni leggibili rapidamente;
- messaggi operativi brevi per impostazione predefinita;
- approfondimenti disponibili su richiesta;
- pochi passaggi per confermare o correggere un dato;
- uso efficace su desktop e smartphone;
- nessuna animazione che rallenti una decisione.

Una finestra flottante o riposizionabile sopra la pagina Asta può essere valutata successivamente, dopo aver verificato l'utilità e i limiti della pagina dedicata. Non è una scelta già presa.

---

## 22. Tono e comportamento conversazionale

Il tono deve ricordare un co-manager competente:

- diretto senza essere autoritario;
- naturale e colloquiale quando appropriato;
- sintetico durante i momenti rapidi;
- analitico quando l'utente chiede approfondimento;
- trasparente sull'incertezza;
- capace di dissentire motivando il dissenso;
- rispettoso della decisione finale dell'utente.

L'agente non dovrebbe:

- adulare l'utente;
- presentare ogni scelta come corretta;
- drammatizzare oscillazioni normali;
- inventare sicurezza per sembrare utile;
- nascondere un dato mancante;
- confondere una preferenza dell'utente con un fatto di mercato;
- usare profili psicologici non sostenuti da evidenze.

---

## 23. Robustezza e fallback

L'indisponibilità dell'AI non deve interrompere l'asta.

Devono restare indipendenti dalla componente conversazionale:

- registrazione, modifica e annullamento degli acquisti;
- navigazione;
- gestione di rose, crediti e slot;
- database e ricerca giocatori;
- consiglio prezzo deterministico;
- limiti economici;
- Chiamata consigliata deterministica;
- funzioni essenziali di chiusura e salvataggio dell'asta.

In assenza dell'AI, l'app dovrebbe poter comunicare chiaramente che la conversazione non è disponibile senza rappresentare come mancanti anche i calcoli locali ancora operativi.

La modalità di fallback, l'eventuale operatività offline della chat e il comportamento durante errori parziali restano decisioni tecniche aperte.

---

## 24. Criteri di qualità concettuali

La componente è coerente con questa visione se:

- usa automaticamente lo stato dell'app per i fatti disponibili;
- non richiede all'utente di ripetere dati già registrati;
- separa fatti, calcoli, annotazioni, inferenze e consigli;
- non inventa numeri;
- interviene spontaneamente soltanto con valore aggiunto;
- sa restare in silenzio sugli eventi normali;
- spiega le conseguenze di una decisione;
- propone cambiamenti strategici senza applicarli;
- distingue capacità economica e interesse strategico degli avversari;
- rende visibili le evidenze delle profilazioni;
- richiede validazione prima della memoria permanente;
- conserva il contesto storico delle informazioni;
- permette allo stato corrente di contraddire lo storico;
- non rende l'AI un punto singolo di fallimento dell'asta.

Questi sono criteri di comportamento e prodotto, non scelte di architettura.

---

## 25. Decisioni ancora aperte

Le seguenti decisioni devono essere affrontate separatamente prima dell'implementazione. Questo documento non ne anticipa la soluzione.

### Infrastruttura e integrazione

- necessità di un backend e responsabilità da assegnargli;
- tipo di backend e confini fra client, servizi e motore deterministico;
- provider e modello AI;
- gestione sicura delle API key e delle credenziali;
- hosting dei servizi futuri;
- modalità di comunicazione fra app e componente conversazionale;
- eventuale streaming delle risposte;
- gestione di errori, retry e indisponibilità parziali.

### Dati e persistenza

- persistenza della chat;
- durata e cancellazione della cronologia;
- persistenza delle memorie temporanee d'asta;
- struttura dei profili manager;
- schema delle evidenze, delle fonti e dell'affidabilità;
- rappresentazione di fatti, annotazioni e inferenze;
- associazione fra manager permanente e nomi squadra contestuali;
- modello multi-lega e multi-asta;
- gestione di stagioni, divisioni e competizioni;
- snapshot della strategia per singola asta;
- migrazione e compatibilità dei dati nel tempo.

### Contesto del modello

- quantità di contesto inviata al modello;
- selezione fra stato completo, delta ed eventi recenti;
- strategia di aggiornamento e invalidazione del contesto;
- trattamento delle correzioni dello stato;
- recupero delle memorie storiche rilevanti;
- limiti di lunghezza della conversazione;
- prevenzione di duplicazioni e contraddizioni;
- forma con cui il motore espone calcoli e spiegazioni.

### Proattività

- modalità tecnica di attivazione degli interventi spontanei;
- classificazione degli eventi in Silenzio, Nota e Intervento;
- soglie e parametri da validare con aste reali;
- aggregazione di eventi simili;
- cooldown e controllo della frequenza;
- preferenze configurabili dell'utente;
- priorità fra messaggi proattivi e richieste esplicite;
- comportamento quando l'utente ignora o rifiuta un consiglio.

### Qualità, costi e sicurezza

- costo per asta e sostenibilità economica;
- latenza accettabile nelle diverse fasi;
- valutazione della qualità delle risposte;
- casi di test e aste simulate;
- protezioni contro numeri inventati e contesto obsoleto;
- privacy di chat, aste, manager e annotazioni;
- esportazione, cancellazione e portabilità dei dati;
- funzionamento offline e fallback senza AI;
- auditabilità delle inferenze e delle azioni approvate.

### Esperienza utente

- struttura definitiva della pagina chatbot;
- segnali visivi per fatti, inferenze e urgenza;
- modalità di conferma delle informazioni estratte dalla chat;
- livello di dettaglio predefinito;
- eventuale finestra flottante in una fase successiva;
- eventuale interazione vocale, senza assumerla come requisito;
- accessibilità, touch e comportamento su schermi piccoli.

Queste decisioni dovranno essere valutate rispetto ai principi di `CONCEPTS.md`, allo stato reale documentato in `CURRENT_STATE.md` e a osservazioni raccolte durante aste realistiche.
