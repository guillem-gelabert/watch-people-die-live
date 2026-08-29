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
    pull: {
      idle: "Estira amunt cap al globus",
      keepPulling: "Continua estirant",
      ready: "Deixa anar i hi tornem",
    },
  },

  globe: {
    canvasLabel: "Un globus terraqüi. Cada llampec és una mort modelada.",
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
    rank: "Ordena els indicadors",
    infoLabel: " — l'argument a favor de {title}",
    currentOrder: "Ordre actual, del millor al pitjor: {order}",
    moveUp: "Puja {title}",
    moveDown: "Baixa {title}",
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
        "Arrossega una fila per moure-la, o fes servir els botons de pujar i baixar de cada " +
        "indicador per classificar els cinc sense apuntador.",
      dropped: "{title} ara ocupa la posició {rank} de {total}.",
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

  panels: {
    samplingOrder: "Ordre de mostreig",
    deathsByAgeCauseLabel: "Defuncions per franja d'edat i causa",
    deathsByAgeCauseTitle: "Defuncions per edat, i de què moren",
    deathsByAgeCauseCopy:
      "Proporció de defuncions a cada franja d'edat, i la barreja de causes dins de cadascuna.",
    densityClusterLabel: "Detall de fronteres vectorials i densitat rasteritzada",
    ewmaLabel: "Mitjana mòbil robusta ponderada exponencialment de morts per conflicte",
    ewmaTitle: "Morts setmanals, i la mitjana ponderada que fa servir el globus",
    ewmaCopy:
      "El globus fa servir l'estimació predeterminada de quatre setmanes i P10–P90. Les barres " +
      "plenes són les 12 setmanes completes publicades per ACLED; la barra buida estima la " +
      "setmana actual. Moure els controls és una demostració contrafactual i no canvia el globus.",
    conflictMapLabel: "Morts per conflicte en centroides Admin-1 aproximats",
    conflictMapTitle: "On són les morts de les últimes 12 setmanes completes",
    conflictMapCopy:
      "ACLED publica agregats regionals setmanals. Cada punt és un centroide Admin-1, no la " +
      "ubicació d'un esdeveniment mortal individual.",
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
      "No hi ha morts per conflicte disponibles per a les últimes {n} setmanes completes, així " +
      "que no hi ha cap sèrie setmanal sobre la qual fer l'estimació.",
    ariaLabel:
      "Morts setmanals per conflicte de les últimes {n} setmanes completes. Cada setmana " +
      "s'apila per país per als que arriben al 5% d'aquella setmana; la resta s'agrupa en la " +
      "regió de l'ONU més petita que arribi al 5%, i el sobrant com a Altres llocs. Una " +
      "estimació ponderada {weighting} dóna {prediction} morts per a la setmana actual{clamp}",
    weightingFlat: "plana",
    weightingHalfLife: "amb semivida de {halfLife} setmanes",
    clampOn: ", valors extrems retallats a P{lo}–P{hi}",
    clampOff: ", valors extrems sense retallar",
    estimate: "estimació",
    estimateApprox: "actual ≈ {value}/setmana",
    halfLifeName: "Semivida",
    halfLifeFlat: "mitjana plana",
    halfLifeWeeks: "{n} setmanes",
    halfLifeFlatSpoken: "mitjana plana, totes les setmanes ponderades igual",
    halfLifeNote:
      "Quantes setmanes triga a reduir-se a la meitat la influència d'una setmana sobre " +
      "l'estimació. A zero, totes les setmanes compten igual.",
    dampingName: "Esmorteïment",
    dampingOff: "desactivat",
    dampingBand: "P{lo}–P{hi}",
    dampingSpokenOn: "retallat a P{lo} i P{hi}",
    dampingSpokenOff: "sense retallar els totals",
    dampingNote:
      "Fins on entra el retall de valors extrems des de cada extrem, abans de cap ponderació. A " +
      "zero, la massacre compta sencera.",
    readout: "Estimació per a la setmana actual:",
    readoutUnit: "morts/setmana",
    readoutAsidePlain: "(mitjana simple de les 12 setmanes: {mean}",
    readoutAsideClamped: ", totals retallats a P{lo}–P{hi}",
    readoutAsideUnclamped: ", res retallat",
    readoutAsideFlat: ", totes les setmanes ponderades igual",
    elsewhere: "Altres llocs",
    tooltipDeaths: "{country}: {n} morts",
    tooltipMore: "+{n} més: {total}",
  },

  geoscheme: {
    2: "Àfrica",
    5: "Amèrica del Sud",
    9: "Oceania",
    10: "Antàrtida",
    11: "Àfrica occidental",
    13: "Amèrica Central",
    14: "Àfrica oriental",
    15: "Àfrica septentrional",
    17: "Àfrica central",
    18: "Àfrica meridional",
    19: "Amèrica",
    21: "Amèrica del Nord",
    29: "Carib",
    30: "Àsia oriental",
    34: "Àsia meridional",
    35: "Sud-est asiàtic",
    39: "Europa meridional",
    53: "Austràlia i Nova Zelanda",
    54: "Melanèsia",
    57: "Micronèsia",
    61: "Polinèsia",
    142: "Àsia",
    143: "Àsia central",
    145: "Àsia occidental",
    150: "Europa",
    151: "Europa oriental",
    154: "Europa septentrional",
    155: "Europa occidental",
    202: "Àfrica subsahariana",
    419: "Amèrica Llatina i el Carib",
  },

  causes: causesCa,

  charts: chartsCa,
};
