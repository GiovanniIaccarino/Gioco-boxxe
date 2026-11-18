# BOXXE — Dal Quartiere al Ring

Simulatore di pugilato per smartphone, travestito da gioco semplice. HTML5 + JavaScript puro, nessuna dipendenza: grafica, animazioni, musica ed effetti sonori sono generati dal codice.

## Come giocare
Apri `index.html` da un server web (anche `python3 -m http.server`) e visitalo dal browser dello smartphone. Si può aggiungere alla schermata Home (PWA). Funziona in verticale e in orizzontale; su desktop si gioca anche da tastiera.

**Comandi:** levetta ← → per muoversi, ↓ + colpo per colpire al corpo · JAB, DIRETTO, GANCIO, MONTANTE · GUARDIA (tieni premuto; con ↓ para al corpo) · SCHIVA (centro = schivata, ↓ = abbassati, ← = passo indietro) · GUARDIA + → da vicino = clinch.
Tastiera: A/D, S, J/K/U/I, Spazio, L, Esc.

## Modalità
- **Storia**: crei il tuo pugile, rissa in strada nel Rione Sole (tutorial nascosto nei consigli di Nino), incontro con il Maestro Sal, allenamenti in palestra, primo incontro sul ring, il rivale Dario "Lo Squalo"… e poi la **carriera**.
- **Carriera**: 4 classifiche (Regionale, Italiano, Europeo, Mondiale), offerte di incontri, settimane di allenamento/riposo/lavoro, forma e infortuni, staff, soldi, fama, età, eventi narrativi.
- **Match rapido**: 12 pugili, da 3 a 12 round, 4 livelli di difficoltà, 4 luoghi.
- **Allenamento**: sacco, corda, colpitori, sparring con i dati reali della simulazione e una guida al combattimento.

## Cosa c'è sotto il cofano
Fiato e fatica che si accumula, danni separati a testa e corpo, stordimento e mento, tagli e gonfiori, guardia alta/bassa che può essere sfondata, schivate con finestra di contrattacco, contropiedi, portata dei colpi, corde, clinch, guardia mancina, 3 giudici con criteri diversi, arbitro che ferma l'incontro, conteggio e rialzata, IA che usa le stesse regole del giocatore e impara i tuoi colpi preferiti.

## Struttura
`js/sim.js` simulazione pura · `js/fighter.js` pugile e animazioni · `js/ai.js` IA · `js/fight.js` scena del match · `js/render.js` grafica procedurale · `js/story.js` storia · `js/career.js` carriera · `js/minigames.js` allenamenti · `js/ui.js` menu.
