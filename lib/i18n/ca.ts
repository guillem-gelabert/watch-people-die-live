import type { Dictionary } from "./en";
import { chartsCa } from "./ca.charts";
import { causesCa } from "./ca.causes";

// Catalan. Central variety, with the story's own register kept: first person, direct, and
// technical where the English is technical.

export const ca: Dictionary = {
  meta: {
    title: "Watch People Die Live",
    description:
      "Un globus de mortalitat estadística en temps real: cada llampec es modela a partir de " +
      "dades públiques de taxa de mortalitat, densitat de població i demografia, amb persones " +
      "representatives i no pas registres individuals.",
    ogDescription:
      "Un globus de mortalitat estadística en temps real construït amb dades demogràfiques " +
      "públiques. Cada persona és representativa, no una persona identificable.",
    twitterDescription:
      "Un globus de mortalitat estadística amb persones representatives, no registres de " +
      "defuncions individuals.",
  },

  chrome: {
    hero: "Cada llampec és una mort.",
    cue: "Com?",
    globe: "Globus",
    language: "Idioma",
    languageChoose: "Llegeix-ho en un altre idioma",
    pull: {
      idle: "Estira amunt cap al globus",
      keepPulling: "Continua estirant",
      ready: "Deixa anar i hi tornem",
    },
  },

  globe: {
    waiting: "Esperant el primer llampec",
    latest: "Última mort",
    justNow: "Ara mateix",
    resume: "Reprèn",
    pause: "Pausa",
    close: "Tanca",
    persona: "{who} de {age}, {cause} – {country}",
    baby: "Nadó",
    girl: "Nena",
    boy: "Nen",
    woman: "Dona",
    man: "Home",
    where: "{country} · {lat}° {ns}, {lon}° {ew}",
    north: "nord",
    south: "sud",
    east: "est",
    west: "oest",
  },

  proxy: {
    cardTitle: "Possibles indicadors de l'estacionalitat",
    best: "Millor predictor",
    worst: "Pitjor",
    reorder: "Reordena els indicadors",
    infoLabel: " — l'argument a favor de {title}",
    currentOrder: "Ordre actual, del millor al pitjor: {order}",
    rankNote: "El teu núm. {n}",
    rankNoteSr: " a la teva classificació d'indicadors",
    modal: {
      eyebrow: "Abans de mirar les dades",
      heading: "Quin d'aquests segueix l'estacionalitat?",
      instruction:
        "Ordena els cinc candidats del que millor prediu l'oscil·lació estacional d'un país fins " +
        "al que pitjor la prediu. Arrossega una fila per moure-la; toca la i per rellegir " +
        "l'argument de cadascun.",
      closing:
        "Després els contrastarem un per un amb els països que sí que declaren defuncions " +
        "mensuals, i veurem quin aguanta.",
      skip: "Ho deixo estar",
      submit: "Envia la meva classificació",
    },
    dnd: {
      instructions:
        "Prem espai o retorn per agafar aquest indicador. Fes servir les fletxes amunt i avall " +
        "per moure'l per la classificació, espai o retorn per deixar-lo anar, i escapada per " +
        "cancel·lar.",
      pickedUp: "Has agafat {title}. Ocupa la posició {rank} de {total}.",
      over: "{title} passaria a la posició {rank}.",
      dropped: "{title} ara ocupa la posició {rank} de {total}.",
      cancelled: "Has deixat anar {title}. La classificació no ha canviat.",
    },
    defs: [
      {
        title: "PIB per capita",
        body:
          "Per molt imperfecte que sigui, el PIB prediu sorprenentment bé els indicadors de " +
          "qualitat de vida (mortalitat infantil, nombre mitjà de dents, taxes d'homicidi) i " +
          "és fàcil d'obtenir per a qualsevol any i país. Podríem aplicar el factor " +
          "d'estacionalitat mitjà dels països amb un PIB per capita semblant a un país sense " +
          "dades infraanuals pròpies.",
      },
      {
        title: "Països veïns",
        body:
          "La proximitat geogràfica pot reflectir diversos factors alhora. Pensem en els països " +
          "del Golf: un país donant mitjà d'allà seria ric, de majoria musulmana i amb un clima " +
          "molt semblant. Itàlia i Suïssa tenen una infraestructura sanitària comparable, " +
          "institucions igual de desenvolupades i són molt properes en longitud i en latitud. " +
          "Alguns problemes: de vegades els països veïns es diferencien molt, i hi ha grups que " +
          "no tenen cap veí amb dades estacionals.",
      },
      {
        title: "Zona climàtica",
        body:
          "Si la nostra hipòtesi és certa, això ens ajudaria a agrupar l'estacionalitat per " +
          "climes semblants. Les classificacions climàtiques agrupen regions amb valors de " +
          "temperatura i humitat semblants i amb una periodicitat semblant. Les dades no són " +
          "trivials d'obtenir — hi ha moltes classificacions diferents — ni d'aplicar a les " +
          "nostres xifres de mortalitat. A més, correm el risc de triar una classificació amb " +
          "zones massa grans, que barregin països molt diferents, o massa petites, que deixin " +
          "zones sense cap país donant d'on prendre dades.",
      },
      {
        title: "Latitud",
        body:
          "Va ser la meva primera intuïció, i de fet és un indicador de segon grau que dedueix " +
          "el clima de la latitud, que tenim a mà per a qualsevol punt de la Terra. Tot i així, " +
          "si mirem Lisboa i Pequín — totes dues cap al mateix paral·lel — veiem que en una " +
          "mateixa latitud hi poden conviure climes extremadament diferents: Lisboa té un hivern " +
          "suau i un estiu moderadament sec, mentre que Pequín registra temperatures de −27 " +
          "graus durant un hivern molt sec i té un estiu monsònic molt calorós i humit.",
      },
      {
        title: "Proporció de població de més de 65 anys",
        body:
          "Les infeccions víriques tenen patrons estacionals i la gent gran hi és més " +
          "vulnerable. A l'estiu, tenen més risc de morir per la calor. Podríem esperar que els " +
          "llocs amb població més envellida tinguessin una estacionalitat més marcada. D'altra " +
          "banda, els països amb població més envellida solen ser més rics i, per tant, tendeixen " +
          "a tenir un millor accés a la sanitat.",
      },
    ],
    scorecard: {
      titleScored: "Com ha anat la teva classificació",
      titleSkipped: "Què diuen les dades",
      intro:
        "Cada indicador puntuat segons com de bé segueix l'amplitud estacional observada als " +
        "països que declaren una corba — |r| per als quatre indicadors numèrics, i la raó de " +
        "correlació η per a les classes climàtiques. Tots dos van de 0 a 1.",
      unavailable:
        "Les taules d'estacionalitat encara no s'han carregat, així que no hi ha res amb què " +
        "puntuar la classificació.",
      scoreLabel: "de {total} a la posició correcta",
      skipped:
        "T'has saltat la classificació, així que no hi ha res a corregir — aquest és l'ordre en " +
        "què les dades posen els cinc.",
      verdictPerfect: "L'has clavada.",
      verdictClose: "A prop — a un canvi o dos del que diuen les dades.",
      verdictRough: "Més o menys. La major part del teu ordre sobreviu a les dades.",
      verdictHalf: "A mitges. Les dades coincideixen amb la meitat del teu ordre.",
      verdictPoor: "Lluny — les dades els llegeixen gairebé a l'inrevés.",
      footruleOne:
        "La teva classificació falla {n} posició en total, contra {worst} d'una completament " +
        "invertida.",
      footruleOther:
        "La teva classificació falla {n} posicions en total, contra {worst} d'una completament " +
        "invertida.",
      topPickRight: "Has posat el millor indicador en primer lloc.",
      topPickWrong: "El millor indicador és {title}.",
      hadItHere: "el tenies aquí",
      hadItAt: "el tenies {ordinal}",
      ordinals: ["1r", "2n", "3r", "4t", "5è"],
      countryCount: "{n} països",
      note:
        "Aquesta no és la mateixa prova que la taula de validació creuada de més amunt: la " +
        "concordança pregunta si un indicador segueix com de gran és l'oscil·lació d'un país, " +
        "mentre que deixar-ne un fora pregunta com de bé en reconstrueix tota la forma de la " +
        "corba. Totes dues posen els mateixos tres indicadors al capdamunt i en el mateix ordre, " +
        "que és la part útil — tot i que aquí veïns i clima acaben prou a prop com perquè la " +
        "diferència entre el primer i el segon no valgui la pena defensar-la. La cobertura varia " +
        "per fila: un país sense cap donant fronterer no es pot puntuar amb l'indicador de veïns.",
    },
  },

  rand: {
    label: "Què vol dir aleatòriament aquí",
    close: "Tanca",
  },

  concept: {
    clock: [
      {
        kind: "Mètode",
        title: "Un sol rellotge global",
        body:
          "Les defuncions totals per any es converteixen en una taxa per segon. Cada interval " +
          "es treu d'una distribució exponencial, de manera que les ràfegues i els buits passen " +
          "pel mateix motiu que passen a la realitat.",
      },
      {
        kind: "Per què va fallar",
        title: "Morts a l'oceà",
        body:
          "Un punt uniforme sobre una esfera posa set de cada deu morts a l'aigua i la major " +
          "part de la resta en terra deshabitada. Total correcte, mapa sense sentit.",
      },
      {
        kind: "Concepte",
        title: "Procés de Poisson",
        body:
          "Esdeveniments independents, temps d'espera exponencials. Per això el ritme sembla " +
          "trencat i no ho és.",
      },
    ],
  },

  panels: {
    samplingOrder: "Ordre de mostreig",
    deathsByAgeCauseLabel: "Defuncions per franja d'edat i causa",
    deathsByAgeCauseTitle: "Defuncions per edat, i de què moren",
    deathsByAgeCauseCopy:
      "Proporció de defuncions a cada franja d'edat, i la barreja de causes dins de cadascuna.",
    densityClusterLabel: "Detall de fronteres vectorials i densitat rasteritzada",
    ewmaLabel: "Mitjana mòbil robusta ponderada exponencialment de morts per conflicte",
    ewmaTitle: "Morts mensuals, i la mitjana ponderada que fa servir el globus",
    ewmaCopy:
      "Les barres plenes són morts declarades i la línia és la mitjana ponderada " +
      "exponencialment. La barra buida de la dreta és avui — la xifra que faria servir el " +
      "globus. Mou qualsevol dels dos controls i és el que es mou.",
    conflictMapLabel: "Morts per conflicte sobre la graella de mostreig",
    conflictMapTitle: "On són les morts de l'últim any",
    conflictMapCopy: "Esdeveniments mortals d'ACLED agregats sobre la graella de mostreig.",
    westAfrica: "Àfrica Occidental",
    benelux: "Benelux",
    figureLatitude: "Correlació amb la latitud",
    figureClimate: "Amplitud per zona climàtica",
    figurePop65: "Amplitud vs. població de més de 65",
    figureGdp: "Amplitud vs. PIB per capita",
    figureNeighbour: "Amplitud vs. països veïns",
  },

  ewma: {
    empty:
      "No s'ha declarat cap mort per conflicte en els darrers {n} dies (o la capa en directe " +
      "d'ACLED no està disponible), així que no hi ha cap sèrie recent sobre la qual fer la " +
      "predicció.",
    ariaLabel:
      "Morts diàries per conflicte dels darrers {n} dies, apilades per país (els països que cada " +
      "dia queden per sota del 10% s'agrupen com a Altres a baix), amb una predicció ponderada " +
      "{weighting} de {prediction} morts per avui{clamp}",
    weightingFlat: "plana",
    weightingHalfLife: "amb semivida de {halfLife} dies",
    clampOn: ", valors extrems retallats a P{lo}–P{hi}",
    clampOff: ", valors extrems sense retallar",
    today: "avui",
    todayApprox: "avui ≈ {value}/dia",
    halfLifeName: "Semivida",
    halfLifeFlat: "mitjana plana",
    halfLifeDays: "{n} dies",
    halfLifeFlatSpoken: "mitjana plana, tots els dies ponderats igual",
    halfLifeNote:
      "Quants dies triga a reduir-se a la meitat la influència d'un dia sobre la predicció. A " +
      "zero, tots els dies de la finestra compten igual.",
    dampingName: "Esmorteïment",
    dampingOff: "desactivat",
    dampingBand: "P{lo}–P{hi}",
    dampingSpokenOn: "retallat a P{lo} i P{hi}",
    dampingSpokenOff: "sense retallar els totals",
    dampingNote:
      "Fins on entra el retall de valors extrems des de cada extrem, abans de cap ponderació. A " +
      "zero, la massacre compta sencera.",
    readout: "Predicció per avui:",
    readoutUnit: "morts/dia",
    readoutAsidePlain: "(mitjana simple de la quinzena: {mean}",
    readoutAsideClamped: ", totals retallats a P{lo}–P{hi}",
    readoutAsideUnclamped: ", res retallat",
    readoutAsideFlat: ", tots els dies ponderats igual",
    others: "Altres",
    tooltipDeaths: "{country}: {n} morts",
    tooltipMore: "+{n} més: {total}",
  },

  causes: causesCa,

  charts: chartsCa,
};
