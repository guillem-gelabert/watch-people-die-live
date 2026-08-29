import type { ChartsDictionary } from "./en.charts";

// Català — les figures. Vegeu en.charts.ts per a què hi entra i què no.

export const chartsCa: ChartsDictionary = {
  common: {
    unknown: "Desconegut",
    countries: "Països",
    regions: "Regions",
    layers: "Capes",
    amplitudeAxis: "Amplitud",
    method: "Mètode",
    best: " · millor",
  },

  beatStrip: {
    poisson:
      "Intervals entre morts extrets de la distribució real: la majoria són curts, uns quants " +
      "són llargs",
    metronome: "Un batec cada {gap}, la mitjana anual",
    sincePrevious: "{ms} ms des de la mort anterior",
    onRate: " — a la taxa mitjana",
    always: "{gap} — sempre",
  },

  dartTally: {
    ocean: "Oceà",
    uninhabited: "Deshabitat",
    inhabited: "Habitat",
    uninhabitedNote:
      "Terra sense cap cel·la poblada a la graella de 0,5° que mostreja el model — uns 55 km " +
      "d'amplada.",
    inhabitedNote: "Terra amb almenys una cel·la poblada a la graella, per poc que sigui.",
    spoken: "{label}: {count} de {total} morts, {share} per cent",
    spokenLimit: ", convergint cap al {limit} per cent",
    counting: "{label}: comptant",
  },

  globalRandomMap: {
    aria:
      "Amèrica del Sud i el Pacífic, amb creus que cauen en punts aleatoris a la taxa de " +
      "mortalitat global",
  },

  countryCentroidMap: {
    aria:
      "Europa ombrejada per taxa de mortalitat, amb cada mort caient al centre geogràfic del seu " +
      "país",
    deathsPerYear: "{name}: {n} morts/any",
    noRate: "{name}: sense dades de taxa",
  },

  borderRaster: {
    loading: "Carregant…",
    aria:
      "Detall de fronteres vectorials superposades a cel·les de densitat rasteritzades prop de " +
      "{title}",
    mismatch: "ràster: {raster} / vector: {vector} (discrepància)",
    peoplePerCell: "{n} persones/cel·la — {place}",
  },

  densityMap: {
    aria:
      "Àsia meridional, central i oriental ombrejada per població per cel·la de la graella, amb " +
      "les morts caient a les cel·les en proporció a la seva població",
    peoplePerCell: "{name}: {n} persones/cel·la",
    scaleLog: "Logarítmica",
    scaleLinear: "Lineal",
    scaleSpoken: "Escala de color logarítmica",
  },

  subnationalMap: {
    aria:
      "Mapa de les prefectures del Japó ombrejades per taxa bruta de mortalitat, que mostra " +
      "diferències grans dins d'un mateix país",
    loading: "Carregant les taxes de mortalitat subnacionals…",
    legendMax: "{max}+ per 100k",
  },

  nationalVsRegional: {
    title: "L'estimació nacional contra la veritat regional",
    copy: "Morts per 100.000, sis regions de dos països.",
    loading: "Carregant les taxes de mortalitat regionals…",
    national: "nacional {n}",
    ariaBlock: "{label}: taxa nacional {national} per 100.000; regions {regions}",
    note:
      "La taxa nacional és errònia per a absolutament totes les regions — massa baixa per a la " +
      "meitat i massa alta per a la resta.",
  },

  countryCurves: {
    empty: "Afegeix un país o una categoria a dalt per veure'n la corba estacional.",
    placeholder: "Afegeix un país o una categoria…",
    placeholderAtCap: "Comparant {max} — treu-ne un per afegir-ne un altre",
    aria: "Gràfic de línies que compara les corbes de mortalitat estacional de {names}",
    remove: "Treu {name}",
    selected: "Països seleccionats",
    clearAll: "Buida-ho tot",
    noMatches: "Cap coincidència",
    limitReached: "N'has afegit {added} — límit de {max} línies ({dropped} no es mostren)",
    groupClimate: "Clima",
    groupGdp: "PIB",
    groupLatitude: "Latitud",
    gdpBins: ["PIB < 10.000 $", "PIB 10.000–30.000 $", "PIB 30.000–50.000 $", "PIB > 50.000 $"],
    latBins: [
      "Tròpics (0–23,5°)",
      "Subtròpics (23,5–35°)",
      "Temperada (35–50°)",
      "Latitud alta (50°+)",
    ],
  },

  smoothing: {
    loading: "Carregant la comparació de suavitzats…",
    title: "Una sèrie, moltes resolucions",
    copy:
      "Totes les vistes fan servir les mateixes observacions setmanals completes no COVID i la " +
      "mateixa escala de mitjana 1.",
    country: "País",
    order: "Ordre",
    cadenceGroup: "Cadència d'observació i mètode de suavitzat",
    orderGroup: "Ordre harmònic",
    how: "Com funciona",
    goodFor: "Bo per a",
    watchOut: "Compte amb",
    source: "{source}. {country}: {from}–{to}; 2020–2022 exclosos.",
    aria:
      "Vista {mode} del multiplicador de mortalitat estacional de {country}. Els valors van de " +
      "{lo} a {hi}, amb la mitjana anual a 1.",
    harmonicOrderLabel: "Harmònic · ordre {n}",
    modes: {
      weekly: {
        label: "Setmanal",
        how:
          "Fa la mitjana de la mateixa setmana ISO al llarg dels anys complets després de " +
          "convertir els recomptes en morts per dia.",
        goodFor:
          "Conservar el moment dels canvis estacionals curts quan hi ha registres setmanals " +
          "llargs i complets.",
        watchOut: "És sorollós, demana moltes dades, i la setmana 53 se sosté sobre menys anys.",
      },
      monthly: {
        label: "Mensual",
        how:
          "Fa la mitjana de la intensitat diària de mortalitat dins de cada mes natural i " +
          "després compara el mateix mes entre anys.",
        goodFor: "Un equilibri pràctic entre detall temporal i estabilitat entre anys.",
        watchOut:
          "Cada canvi s'assigna a un mes, de manera que els límits es tornen esglaons " +
          "artificials.",
      },
      quarterly: {
        label: "Trimestral",
        how: "Combina tres mesos alhora fent servir la seva exposició en dies naturals.",
        goodFor: "Mostrar només el contrast estacional més ampli quan les observacions escassegen.",
        watchOut:
          "Quatre valors no poden situar un pic amb precisió ni revelar una segona temporada " +
          "curta.",
      },
      circular3: {
        label: "Circular de 3 punts",
        how:
          "Substitueix cada valor mensual pel 25% del mes anterior, el 50% d'ell mateix i el 25% " +
          "del següent, enllaçant desembre amb gener.",
        goodFor: "Reducció local de soroll transparent, amb una amplada fixa fàcil d'explicar.",
        watchOut:
          "L'amplada de tres mesos triada esmussa els pics i encara deixa una graella de " +
          "sortida mensual.",
      },
      harmonic: {
        label: "Harmònic",
        how:
          "Ajusta parells de sinus/cosinus anuals a cada observació setmanal vàlida en una sola " +
          "regressió agrupada.",
        goodFor: "Un multiplicador continu i compacte, suau i periòdic entre desembre i gener.",
        watchOut:
          "Els ordres alts conserven trets més curts però també poden seguir el soroll; els " +
          "ordres baixos imposen estacions més amples.",
      },
    },
    orders: {
      "1": {
        how: "Ajusta un parell de sinus/cosinus anual a totes les observacions setmanals vàlides.",
        goodFor: "Una pujada i baixada anual ampla amb el model periòdic més simple possible.",
        watchOut: "Força una forma simètrica d'un sol cicle i no pot representar pics secundaris.",
      },
      "2": {
        how:
          "Ajusta parells de sinus/cosinus anuals i semestrals a totes les observacions " +
          "setmanals vàlides.",
        goodFor: "Asimetria ampla i una possible segona pujada estacional, sense gaire detall fi.",
        watchOut: "Els pics curts encara s'esborren i cada parell afegit augmenta la flexibilitat.",
      },
      "3": {
        how: "Ajusta tres parells de sinus/cosinus anuals a totes les observacions setmanals vàlides.",
        goodFor:
          "Capturar estructura estacional amb múltiples pics o més marcada a escales d'uns " +
          "quatre mesos.",
        watchOut:
          "Pot començar a conservar soroll de registre recurrent com si fos estacionalitat.",
      },
      "4": {
        how:
          "Ajusta quatre parells de sinus/cosinus anuals a cada observació setmanal vàlida en " +
          "una sola regressió agrupada.",
        goodFor:
          "El model de producció: una corba contínua amb prou resolució per a trets estacionals " +
          "més curts.",
        watchOut:
          "Pot seguir artefactes estables de període curt, i no pot representar xocs puntuals " +
          "abruptes.",
      },
    },
  },

  latitudeScatter: {
    aria:
      "Diagrama de dispersió de la latitud absoluta contra l'amplitud de mortalitat estacional, " +
      "amb cada país com a punt ple i cada regió mesurada com a anella",
    tropic: "Tròpic",
    polarCircle: "Cercle Polar",
  },

  koppenScatter: {
    axisTitle: "Zona de Köppen-Geiger",
    aria:
      "Diagrama de dispersió en tires de l'amplitud de mortalitat estacional agrupada per " +
      "família climàtica dominant de Köppen–Geiger, amb cada país com a punt ple i cada regió " +
      "mesurada com a anella",
  },

  gdpScatter: {
    xLabel: "renda per habitant (escala logarítmica)",
    aria:
      "Diagrama de dispersió de l'amplitud de mortalitat estacional contra el PIB per capita en " +
      "escala logarítmica",
  },

  pop65Scatter: {
    xLabel: "proporció de més de 65 (%)",
    value: "{v}% de més de 65",
    aria:
      "Diagrama de dispersió de l'amplitud de mortalitat estacional contra la proporció de " +
      "població de 65 anys o més",
    footnote:
      "L'opacitat del punt indica la renda per habitant: com més fosc el punt, més ric el país.",
  },

  neighbourScatter: {
    xLabel: "amplitud mitjana dels veïns (%)",
    value: "veïns {v}%",
    aria:
      "Diagrama de dispersió de l'amplitud de mortalitat estacional d'una unitat contra " +
      "l'amplitud mitjana dels seus veïns fronterers",
    footnote:
      "Hi ha {n} països que no surten gens en aquest gràfic: cap país amb qui limiten declara " +
      "una corba mensual, així que l'indicador no té d'on manllevar.",
    ringLabel:
      "Les anelles són regions Admin-1 mesurades contra les seves pròpies regions frontereres.",
  },

  regionNeighbourScatter: {
    aria:
      "Diagrama de dispersió de l'amplitud estacional de cada regió Admin-1 mesurada contra " +
      "l'amplitud mitjana de les seves regions mesurades frontereres, amb els països superposats " +
      "com a contorns grisos",
  },

  amplitudeMap: {
    aria:
      "Mapa de Noruega a Sud-àfrica i de Mauritània a Bangladesh. Cada cel·la de mig grau està " +
      "acolorida per les morts que l'estació d'aquest mes afegeix, o treu, a un mes ordinari " +
      "d'allà, i els contorns marquen el país o la regió d'on prové la corba estacional de cada " +
      "cel·la",
    legendCaption:
      "El color són les morts d'excés al mes a cada cel·la de mig grau: neutre per sota de " +
      "{neutral} al mes, intensitat plena a {domain}.",
    legendFewer: "menys morts",
    legendMore: "més morts",
    provenanceMeasured: "corba mesurada aquí",
    provenanceEstimated: "corba estimada",
    sourceObserved: "observat",
    sourceOwnRegions: "calculat a partir de {n} regions mesurades",
    sourceBorderingCountries: "calculat a partir dels països fronterers: {donors}",
    sourceClimate: "estimat a partir del clima: {donor}",
    sourceLatitude: "calculat a partir del recurs de latitud: {donor}",
    tooltip: "{name}: {amplitude} ({source})",
    regionTooltip: "{name} ({country}): {amplitude} d'amplitud{note}",
    regionEstimate: " · estimació per {proxy}",
    regionOverride: " (sobreescrit manualment)",
    regionImputed: " · imputat a partir de {donors}",
  },

  ageMix: {
    loading: "Carregant les defuncions per edat i causa…",
    tail: "Tota la resta",
    ariaBand: "{label}: {share}% de les defuncions",
    barCaption: "La llargada de la barra és la proporció de defuncions d'aquella franja",
  },

  personaDemo: {
    steps: ["Lloc", "Edat", "Sexe", "Causa"],
    woman: "Dona",
    man: "Home",
    womenOf: "dones",
    menOf: "homes",
    undetermined: "una causa indeterminada",
    note:
      "La cel·la individual més pesada de la taula de {country}. La causa s'ha extret d'aquella " +
      "cel·la — {group} de {age} — i mai de la taula sencera, que és el que evita que un noi de " +
      "vint anys mori de demència.",
    loading: "Carregant les taules d'edat, sexe i causa…",
  },

  conflictMap: {
    note:
      "{fatalities} morts declarades en {regions} regions Admin-1 durant {weeks} setmanes " +
      "completes, fins al {through}.",
    noData: "No hi ha dades de conflictes disponibles — la capa està desactivada.",
    aria: "Mapa aproximat de centroides Admin-1 de morts per conflicte. {note}",
    lead:
      "Les ubicacions són centroides regionals. Per al globus, cadascuna es mou a la cel·la " +
      "poblada més propera del mateix país i s'afegeix a la mortalitat ordinària.",
    plateTitle: "{n} morts durant la finestra",
    regionTooltip: "{region}, {country}: {n} morts",
  },

  prediction: {
    title: "Prediccions contra la corba mesurada",
    copy:
      "Amaguem per torns cadascun dels {n} països que declaren una corba, la reconstruïm a " +
      "partir de cada indicador com si faltés, i puntuem com de lluny queda la reconstrucció de " +
      "la corba mesurada. Com més baix l'RMSE mitjà, millor; la capacitat predictiva és la " +
      "caiguda de l'error quadràtic total respecte a cada referència.",
    colMedianRmse: "RMSE mitjà",
    colMedianR: "r mitjana",
    colSkillMean: "Millora vs. mitjana",
    colSkillLatitude: "Millora vs. latitud",
    colWonLatitude: "Guanya vs. latitud",
    group: "Grup",
    count: "n",
    latitudeRmse: "RMSE latitud",
    climateRmse: "RMSE clima",
    neighbourRmse: "RMSE veïns",
    bestColumn: "Millor",
    cohortTitle: "Rendiment per cohort",
    cohortCopy:
      "RMSE mitjà de la corba ponderat per dies dins de cada cohort superposada. Com més baix, " +
      "millor; una ratlla vol dir que el conjunt de validació no té cap corba mesurada elegible " +
      "per a aquella cohort.",
    cohortNote:
      "«Temperat» inclou les famílies C i D de Köppen–Geiger. «Pobre en dades» vol dir poca " +
      "cobertura de donants locals, no un registre incomplet de defuncions; els països sense " +
      "corba mesurada no es poden puntuar per validació creuada.",
    latitudeTitle: "Rendiment per latitud absoluta",
    latitudeCopy:
      "RMSE mitjà de la corba ponderat per dies en bandes disjuntes de latitud absoluta del " +
      "centroide del país. Com més baix, millor.",
    subclassTitle: "Rendiment per subclasse de Köppen–Geiger",
    subclassCopy:
      "RMSE mitjà de la corba ponderat per dies segons la subclasse dominant de Köppen–Geiger " +
      "ponderada per població de cada país. Com més baix, millor; els grups petits són " +
      "descriptius.",
    subclassGroup: "Classe — subclasse",
    methods: {
      "Mean mortality curve": "Corba de mortalitat mitjana",
      "Nearest latitude": "Latitud més propera",
      "Climate class": "Classe climàtica",
      "Nearest neighbour country": "País veí més proper",
    },
  },

  regionPrediction: {
    title: "Prediccions contra la corba mesurada (regió)",
    copy:
      "La mateixa prova de validació creuada, feta sobre {n} regions Admin-1 observades en " +
      "comptes de països. {note}",
    colCountryRmse: "RMSE mitjà per país",
    colRegionRmse: "RMSE mitjà per regió",
  },

  cohorts: {
    latitude: "Latitud",
    climate: "Clima",
    neighbour: "Veïns",
    none: "—",
    tropical: "Tropical",
    tropicalNote: "Clima tropical de Köppen–Geiger ponderat per població (família A).",
    temperate: "Temperat",
    temperateNote:
      "Clima temperat o continental de Köppen–Geiger ponderat per població (famílies C o D).",
    polar: "Polar",
    polarNote: "Clima polar de Köppen–Geiger ponderat per població (família E).",
    island: "Illa",
    islandNote: "Cap veí amb frontera terrestre a la topologia de països.",
    dataPoor: "Pobre en dades",
    dataPoorNote:
      "Menys de dos països fronterers amb una corba mesurada en aquest conjunt de validació.",
    latitudeBandNote: "Latitud absoluta del centroide del país {from}°–{to}°.",
    unclassified: "Sense classificar",
    subclassNote: "Subclasse climàtica de Köppen–Geiger ponderada per població {code}.",
    unclassifiedNote:
      "No hi ha cap subclasse de Köppen–Geiger ponderada per població a les dades d'indicadors.",
  },

  kgFamilies: {
    A: "Tropical",
    B: "Àrid",
    C: "Temperat",
    D: "Continental",
    E: "Polar",
  },

  kgSubclasses: {
    Af: "selva plujosa",
    Am: "monsònic",
    Aw: "sabana",
    BWh: "desert càlid",
    BWk: "desert fred",
    BSh: "semiàrid càlid",
    BSk: "semiàrid fred",
    Csa: "mediterrani d'estiu calorós",
    Csb: "mediterrani d'estiu suau",
    Csc: "mediterrani d'estiu fresc",
    Cwa: "hivern sec, estiu calorós",
    Cwb: "hivern sec, estiu suau",
    Cwc: "hivern sec, estiu fresc",
    Cfa: "subtropical humit",
    Cfb: "oceànic",
    Cfc: "oceànic subpolar",
    Dsa: "estiu sec i calorós",
    Dsb: "estiu sec i suau",
    Dsc: "estiu sec subàrtic",
    Dsd: "estiu sec, fred extrem",
    Dwa: "hivern sec, estiu calorós",
    Dwb: "hivern sec, estiu suau",
    Dwc: "hivern sec subàrtic",
    Dwd: "hivern sec, fred extrem",
    Dfa: "continental humit d'estiu calorós",
    Dfb: "continental humit d'estiu suau",
    Dfc: "subàrtic",
    Dfd: "subàrtic de fred extrem",
    ET: "tundra",
    EF: "casquet glacial",
  },

  kgCold: "Fred",
};
