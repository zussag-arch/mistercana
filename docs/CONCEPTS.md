# Agente 444 — Principi concettuali

## Stato del documento

Questo documento descrive i principi concettuali e gli invarianti di Agente 444.

Non descrive necessariamente:
- il comportamento attualmente implementato nel codice;
- l'architettura tecnica corrente;
- i valori numerici correnti degli algoritmi;
- le funzionalità già completate;
- il backlog di sviluppo.

Questi aspetti devono essere documentati separatamente.

Le regole contenute qui rappresentano il modello concettuale del prodotto e devono essere usate come riferimento quando vengono progettate o revisionate nuove funzionalità.

---

# 1. Visione del prodotto

Agente 444 è un assistente per l'asta del Fantacalcio progettato per aiutare l'utente a prendere decisioni in tempo reale durante un contesto lungo, rapido e ad alta pressione.

Il suo obiettivo non è soltanto registrare acquisti.

Deve aiutare l'utente a:
- conoscere lo stato reale dell'asta;
- valutare i giocatori;
- controllare budget e costruzione della rosa;
- adattare la strategia durante l'asta;
- individuare opportunità di mercato;
- scegliere quanto offrire;
- scegliere chi chiamare;
- comprendere il comportamento degli avversari;
- confrontare alternative;
- mantenere memoria delle aste precedenti;
- prendere decisioni più razionali quando la pressione dell'asta aumenta.

L'utente rimane sempre il decisore finale.

Agente 444 consiglia, interpreta e segnala.

Non acquista autonomamente giocatori e non deve modificare decisioni strategiche permanenti senza conferma dell'utente.

---

# 2. Fonte dello stato reale

Lo stato dell'asta deve provenire dall'applicazione e dai suoi dati strutturati.

Sono fatti deterministici, tra gli altri:
- giocatori acquistati;
- proprietario di ogni giocatore;
- prezzo di acquisto;
- crediti iniziali;
- crediti spesi;
- crediti residui;
- slot occupati;
- slot liberi;
- ruolo attualmente in asta;
- giocatori disponibili;
- obiettivi;
- scarti della chiamata consigliata;
- stato delle rose degli avversari.

L'intelligenza artificiale non deve diventare la fonte primaria di questi dati.

La memoria conversazionale non deve sostituire lo stato applicativo.

Principio:

**registro prima dell'AI.**

L'AI può interpretare i fatti, metterli in relazione, spiegarli e formulare raccomandazioni, ma non deve inventare o ricostruire arbitrariamente ciò che l'applicazione può conoscere in modo deterministico.

---

# 3. Separazione tra fatti, calcoli, inferenze e consigli

Agente 444 deve mantenere distinti almeno quattro livelli.

## 3.1 Fatti

Informazioni direttamente presenti nei dati o nello stato dell'asta.

Esempio:
- un manager ha 218 crediti residui;
- un giocatore è stato acquistato a 74;
- un manager possiede già un P1.

## 3.2 Calcoli deterministici

Risultati ottenuti tramite formule o regole definite.

Esempio:
- limite finanziario;
- budget residuo di reparto;
- massimo valore;
- ranking di base;
- capacità massima di spesa.

## 3.3 Inferenze

Interpretazioni ottenute combinando fatti e comportamento osservato.

Esempio:
- un avversario sembra molto interessato a una determinata fascia di giocatori;
- il mercato di un reparto sembra più caro del previsto.

Le inferenze non devono essere presentate come fatti certi.

## 3.4 Raccomandazioni

Indicazioni operative rivolte all'utente.

Esempio:
- fermarsi su un giocatore;
- aumentare l'aggressività;
- cambiare prossimo obiettivo;
- preservare budget;
- chiamare un determinato profilo.

Una raccomandazione non modifica automaticamente lo stato dell'asta.

---

# 4. Human in control

L'utente rimane sempre responsabile delle decisioni finali.

Agente 444 può:
- consigliare;
- avvisare;
- spiegare;
- confrontare alternative;
- proporre cambiamenti strategici;
- evidenziare comportamenti anomali;
- suggerire una nuova distribuzione del budget.

Agente 444 non deve:
- assegnare autonomamente un giocatore;
- registrare un acquisto non confermato;
- modificare permanentemente la strategia senza conferma;
- trasformare automaticamente un'ipotesi in dato storico certo;
- sostituire una decisione dell'utente.

---

# 5. Separare valore, sostenibilità e strategia

Una decisione d'asta deve distinguere concettualmente almeno tre dimensioni.

## 5.1 Valore del giocatore

Quanto il giocatore è interessante in termini assoluti o relativi al ruolo.

Può dipendere da dati quali:
- PMA o altri valori di mercato;
- prestazioni;
- titolarità;
- affidabilità;
- integrità;
- statistiche;
- consenso degli esperti;
- fascia del giocatore;
- altri indicatori disponibili.

## 5.2 Sostenibilità economica

Quanto può essere speso senza compromettere:
- completamento della rosa;
- reparto corrente;
- reparti successivi;
- liquidità futura;
- vincoli minimi necessari.

## 5.3 Strategia

Come l'utente intende costruire la propria rosa e distribuire le risorse.

Comprende ad esempio:
- distribuzione del budget;
- maggiore o minore aggressività;
- priorità di reparto;
- obiettivi;
- struttura desiderata della rosa.

Queste dimensioni non devono essere confuse o duplicate inutilmente all'interno dello stesso algoritmo.

---

# 6. Parametri configurabili e invarianti

Pesi, percentuali, moltiplicatori, soglie numeriche e coefficienti non sono automaticamente invarianti del sistema.

Sono parametri configurabili finché non vengono esplicitamente stabilizzati.

Esempi:
- distribuzione percentuale del budget;
- pesi della chiamata consigliata;
- coefficienti del valore;
- soglie cromatiche;
- fattori prudenziali;
- elasticità dei reparti;
- fasce della pressione di mercato;
- distribuzione del budget portieri;
- coefficienti legati a supply e domanda.

Una versione precedente del codice o della documentazione non rende automaticamente definitivo un numero.

Prima di modificare o consolidare un parametro occorre comprendere:
- origine;
- significato;
- effetto;
- casi limite;
- comportamento nelle aste reali.

---

# 7. Strategia per singola asta

La strategia appartiene alla singola asta.

Non deve essere trattata automaticamente come impostazione globale permanente.

Due aste della stessa stagione possono avere:
- distribuzioni di budget differenti;
- obiettivi differenti;
- strategie differenti;
- scarti differenti;
- andamento di mercato differente.

È quindi possibile condividere lo stesso database dei giocatori mantenendo indipendente lo stato strategico delle diverse aste.

---

# 8. Budget dinamico

La distribuzione iniziale del budget tra P, D, C e A rappresenta un piano, non quattro tetti rigidi indipendenti.

Il piano deve poter reagire all'andamento reale dell'asta.

Quando un reparto consuma meno risorse del previsto, parte dell'avanzo può diventare disponibile per i reparti futuri.

Quando un reparto consuma più risorse del previsto, i reparti successivi devono adattarsi senza compromettere il completamento della rosa.

Principio fondamentale:

**nessuna riallocazione strategica deve rendere impossibile completare la rosa.**

---

# 9. Adattamento durante il reparto

Agente 444 non deve attendere necessariamente il completamento di un reparto prima di reagire.

Durante il reparto corrente deve poter considerare:
- spesa già sostenuta;
- giocatori acquistati;
- slot già coperti;
- slot ancora disponibili;
- qualità degli acquisti effettuati;
- disponibilità futura;
- budget residuo;
- andamento del mercato.

Se vengono effettuati acquisti molto costosi, le raccomandazioni successive possono diventare più orientate all'efficienza.

Se vengono effettuati acquisti convenienti, il sistema può valutare una maggiore aggressività successiva.

L'adattamento deve essere progressivo e spiegabile.

---

# 10. Fasce e slot

Le fasce o slot rappresentano il livello relativo dei giocatori all'interno di un ruolo.

Non coincidono necessariamente con:
- ordine cronologico di acquisto;
- numero di giocatori già comprati;
- posizione fisica nella rosa.

Servono come rappresentazione della distribuzione del valore e della scarsità del mercato.

Il metodo esatto con cui vengono costruite le fasce può cambiare.

Il concetto di fascia è distinto dal singolo algoritmo utilizzato per determinarla.

---

# 11. Supply, domanda e pressione di mercato

## Supply

La supply rappresenta quanti giocatori ancora disponibili possono soddisfare una determinata esigenza o un'esigenza equivalente/migliore.

## Domanda

La domanda rappresenta quanti manager possono essere realmente interessati a quel tipo di giocatore.

La domanda non deve essere stimata soltanto dal numero di manager con crediti disponibili.

Deve poter considerare almeno:
- slot ancora liberi;
- struttura della rosa;
- capacità economica;
- ruolo già coperto;
- necessità reale;
- eventuali strategie o comportamenti osservati.

## Pressione

La pressione di mercato nasce dalla relazione tra domanda e supply.

Questi concetti devono restare distinti.

Un manager economicamente forte non è automaticamente un concorrente reale se il giocatore non è coerente con la sua rosa.

---

# 12. Analisi degli avversari

Agente 444 deve considerare gli avversari come soggetti dinamici, non soltanto come saldi di budget.

Per stimare la probabilità che un manager partecipi realmente a un'asta possono essere rilevanti:
- crediti residui;
- crediti già spesi;
- slot ancora necessari;
- giocatori già acquistati;
- qualità del reparto;
- capacità massima di spesa;
- ruolo del giocatore chiamato;
- alternative disponibili;
- comportamento osservato nell'asta corrente;
- comportamento storico disponibile.

La capacità economica e l'interesse strategico sono concetti distinti.

Un manager può avere molti crediti ma scarso interesse per un giocatore.

Un manager con meno crediti può essere invece il concorrente più pericoloso se ha un bisogno molto forte.

---

# 13. Identità permanente del manager

L'identità di un manager deve essere distinta dal nome della sua squadra.

Un manager può cambiare nome squadra tra:
- stagioni;
- divisioni;
- competizioni.

La memoria storica deve seguire il manager come persona/identità permanente.

Il nome della squadra è un attributo contestuale.

---

# 14. Storico multi-stagione

Agente 444 deve poter utilizzare informazioni provenienti dalle aste precedenti senza trasformarle automaticamente in regole valide per sempre.

Lo storico può contenere:
- prezzi;
- acquisti;
- comportamento di spesa;
- preferenze osservate;
- andamento di specifiche aste;
- profili comportamentali validati.

Le informazioni storiche devono conservare il contesto originario, come:
- stagione;
- asta;
- lega/divisione;
- manager;
- giocatore;
- eventuale fonte.

Il comportamento passato è un'evidenza, non una certezza sul comportamento futuro.

---

# 15. Limiti di prezzo distinti

Il consiglio economico deve mantenere distinti concettualmente almeno:

## Limite finanziario globale

Protegge la possibilità di completare correttamente l'intera rosa.

Non rappresenta il valore del giocatore.

## Limite strategico del reparto

Rappresenta quanto il giocatore può essere pagato senza compromettere eccessivamente il piano del reparto.

È un vincolo strategico.

## Massimo valore / PMA

Rappresenta una valutazione economica del giocatore, eventualmente adattata al mercato.

Non rappresenta automaticamente ciò che l'utente può permettersi.

## Tetto consigliato

È il tetto operativo derivato dal vincolo più restrittivo applicabile.

I diversi limiti non devono essere considerati tre stime dello stesso valore.

Non devono inoltre essere assunti in un ordine numerico fisso.

La UI deve essere in grado di rappresentare il loro ordine reale.

---

# 16. Riserva finanziaria

Agente 444 deve proteggere una quantità di risorse sufficiente a completare gli acquisti futuri.

La riserva può essere stimata attraverso benchmark robusti degli slot ancora necessari.

Il metodo esatto è configurabile.

Può utilizzare, ad esempio:
- valori mediani;
- fasce;
- costo minimo per slot;
- altre stime robuste.

Principio:

**la riserva deve proteggere il futuro senza rendere l'agente inutilmente conservativo.**

---

# 17. Portieri: dominio dedicato

I portieri possono richiedere una logica strategica ed economica diversa da D, C e A.

Non deve essere assunto automaticamente che:

`budget portieri / numero slot portieri`

sia una buona stima della distribuzione prevista.

Il budget può essere fortemente concentrato sul P1, con P2 e P3 acquistati a costi molto differenti.

La logica portieri può considerare:
- gerarchie P1/P2/P3;
- squadre;
- coppie o terne;
- calendario;
- complementarità;
- fasce strategiche;
- costo complessivo del piano.

I dati utilizzati per visualizzazioni informative non devono essere automaticamente confusi con quelli utilizzati dall'algoritmo strategico.

---

# 18. Chiamata consigliata

La chiamata consigliata deve considerare sempre il ruolo attualmente attivo.

Non deve proporre automaticamente giocatori di altri ruoli.

Il ranking deve separare concettualmente almeno:

## Qualità

Quanto il giocatore è interessante.

## Sostenibilità economica

Quanto è compatibile con il budget disponibile.

## Coerenza con il reparto

Quanto è coerente con ciò che manca alla rosa e con il piano del reparto.

## Opportunità di mercato

Quanto è interessante chiamare quel giocatore in quel momento, considerando:
- supply;
- domanda;
- concorrenti;
- fase dell'asta;
- alternative ancora disponibili.

## Obiettivi personali

L'eventuale priorità esplicitamente assegnata dall'utente.

I pesi con cui queste componenti vengono combinate sono configurabili.

---

# 19. Evitare il doppio conteggio

Uno stesso fenomeno non deve essere penalizzato o premiato più volte attraverso fattori apparentemente diversi.

Esempio:

se il costo del giocatore influenza già la sostenibilità economica, occorre verificare attentamente prima di penalizzarlo nuovamente in:
- qualità;
- strategia;
- pacing;
- affordability;
- opportunità.

Ogni componente di un algoritmo deve avere un significato distinto e spiegabile.

Quando vengono introdotti nuovi fattori bisogna verificare possibili correlazioni o duplicazioni.

---

# 20. Evitare soglie arbitrarie

Soglie rigide possono produrre variazioni molto grandi a fronte di differenze reali molto piccole.

Quando possibile sono preferibili:
- funzioni progressive;
- transizioni morbide;
- normalizzazioni continue.

Una soglia discreta deve avere una motivazione esplicita.

Le soglie introdotte sperimentalmente devono essere trattate come parametri da validare.

---

# 21. Scarti della chiamata consigliata

Scartare un giocatore dalla chiamata consigliata significa esclusivamente:

**escluderlo dal ranking automatico della specifica asta.**

Lo scarto non deve:
- rendere il giocatore venduto;
- rimuoverlo dal database;
- impedirne la selezione manuale;
- influenzare automaticamente altre aste.

Gli scarti appartengono alla singola asta.

Devono poter essere:
- visualizzati;
- riabilitati singolarmente;
- riabilitati completamente.

Se gli scarti impediscono al ranking di trovare candidati utili, il sistema deve comunicarlo chiaramente.

---

# 22. Prezzi storici

Il prezzo storico rappresenta un fatto di mercato passato.

Non rappresenta automaticamente:
- il valore corrente;
- il PMA corrente;
- il prezzo consigliato corrente;
- il prezzo a cui il giocatore verrà acquistato nuovamente.

Lo storico deve poter conservare più prezzi per lo stesso giocatore quando provengono da:
- aste differenti;
- leghe differenti;
- divisioni differenti;
- stagioni differenti.

Ogni prezzo deve mantenere il proprio contesto.

L'eventuale utilizzo algoritmico del prezzo storico deve essere progettato e validato separatamente.

---

# 23. Spiegabilità

Una raccomandazione deve essere comprensibile.

Quando possibile Agente 444 deve poter spiegare:
- quali dati ha utilizzato;
- quale vincolo è attivo;
- perché un giocatore è consigliato;
- perché un prezzo è considerato troppo alto;
- perché una strategia dovrebbe cambiare;
- quali alternative esistono.

Le spiegazioni devono essere compatibili con il contesto dell'asta: brevi quando serve velocità, più approfondite quando l'utente chiede analisi.

---

# 24. Robustezza rispetto all'AI

L'operatività fondamentale dell'asta non deve dipendere dalla disponibilità del modello linguistico.

Se il servizio AI non è disponibile devono continuare a funzionare almeno:
- registrazione degli acquisti;
- rose;
- crediti;
- slot;
- database;
- ricerca;
- calcoli deterministici;
- limiti economici;
- funzionalità essenziali dell'asta.

L'AI è un livello di interpretazione e supporto.

Non deve essere un single point of failure per il registro dell'asta.

---

# 25. Correggibilità

Gli errori di registrazione sono inevitabili durante un'asta reale.

Il sistema deve favorire:
- correzione rapida;
- consistenza dello stato;
- ricalcolo delle conseguenze;
- comprensibilità di ciò che è stato modificato.

La strategia e le raccomandazioni successive devono basarsi sullo stato corretto.

Il metodo tecnico con cui viene implementato questo principio non è definito da questo documento.

---

# 26. Esperienza d'uso durante l'asta

Agente 444 viene utilizzato mentre l'utente deve seguire persone, rilanci e decisioni in pochi secondi.

Sono quindi principi di prodotto:
- pochi tap;
- informazioni importanti immediatamente leggibili;
- gerarchia visiva chiara;
- interazioni rapide;
- controlli utilizzabili con touch;
- compatibilità desktop e smartphone;
- assenza di animazioni che rallentino le decisioni;
- segnali visivi comprensibili rapidamente;
- riduzione del carico cognitivo.

La bellezza visiva non deve compromettere velocità e chiarezza.

---

# 27. Strategia adattiva

La strategia iniziale rappresenta un piano.

Non deve diventare un vincolo cieco quando il mercato reale mostra condizioni differenti.

Agente 444 deve poter riconoscere:
- reparti più costosi del previsto;
- reparti più economici del previsto;
- scarsità anomala;
- opportunità inattese;
- modifiche nella pressione degli avversari;
- acquisti dell'utente che cambiano la costruzione prevista.

Può quindi proporre adattamenti.

La modifica permanente della strategia deve restare sotto controllo dell'utente.

---

# 28. Metodo di progettazione degli algoritmi

Prima di consolidare una nuova formula bisogna poterla comprendere e verificare manualmente.

Per ogni algoritmo importante occorre:
1. scrivere la formula;
2. definire ogni variabile;
3. indicare l'origine di ogni dato;
4. costruire esempi numerici verificabili;
5. spiegare il significato del risultato;
6. verificare i casi limite;
7. verificare eventuali doppie penalizzazioni;
8. distinguere parametri configurabili e invarianti;
9. confrontare il risultato con casi d'asta realistici.

Se un risultato sembra incoerente, bisogna ricostruire il calcolo e individuare il parametro o il vincolo responsabile.

Non bisogna difendere automaticamente la formula esistente.

---

# 29. Evidenza prima della profilazione

La conoscenza storica degli avversari deve essere basata, quando possibile, su evidenze osservabili.

Una valutazione comportamentale deve distinguere:
- fatto osservato;
- annotazione dell'utente;
- inferenza del sistema;
- livello di affidabilità;
- conclusione eventualmente validata.

Una singola osservazione non deve automaticamente diventare una caratteristica permanente del manager.

Il sistema deve poter accumulare evidenze nel tempo e rivedere le proprie interpretazioni.

---

# 30. Principio di memoria

Agente 444 deve ricordare ciò che è utile nel lungo periodo senza confondere memoria e verità.

Devono essere distinguibili:
- stato della singola asta;
- storico delle aste;
- profilo storico del manager;
- dati della singola stagione;
- dati permanenti;
- osservazioni non ancora validate.

La memoria storica deve aiutare le decisioni future ma deve poter essere superata dai comportamenti osservati nelle aste successive.

---

# 31. Terminologia

I termini devono essere utilizzati in modo coerente.

Terminologia concettuale principale:

- Agente 444
- asta
- manager
- owner
- ruolo
- reparto
- slot / fascia
- supply
- domanda
- pressione di mercato
- limite finanziario
- limite strategico del reparto
- massimo valore / PMA
- tetto consigliato
- chiamata consigliata
- obiettivo
- scarto
- evidenza
- inferenza
- profilazione
- strategia

Quando un termine può generare ambiguità, deve essere definito prima di essere utilizzato.

---

# 32. Cosa questo documento non decide

Questo documento non stabilisce:
- framework frontend;
- framework backend;
- provider AI;
- database tecnico;
- hosting;
- autenticazione;
- Telegram o altri canali;
- numero fisso di partecipanti;
- crediti iniziali fissi;
- percentuali di budget definitive;
- coefficienti definitivi;
- soglie definitive;
- formule definitive;
- struttura definitiva dei database;
- architettura definitiva del chatbot;
- tecnologia definitiva per la memoria dell'agente.

Queste sono decisioni implementative o parametriche e devono essere valutate rispetto allo stato reale del progetto.

---

# 33. Regola finale

Agente 444 deve essere costruito mantenendo sempre separati:

**ciò che sappiamo**

**ciò che calcoliamo**

**ciò che deduciamo**

**ciò che consigliamo**

Questa separazione è fondamentale per mantenere il sistema verificabile, affidabile e utile durante un'asta reale.
