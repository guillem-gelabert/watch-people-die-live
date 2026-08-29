import type { ChartsDictionary } from "./en.charts";

// Deutsch — die Figuren. Siehe en.charts.ts dazu, was hier hineingehört und was nicht.

export const chartsDe: ChartsDictionary = {
  common: {
    unknown: "Unbekannt",
    countries: "Länder",
    regions: "Regionen",
    layers: "Ebenen",
    amplitudeAxis: "Amplitude",
    method: "Methode",
    best: " · beste",
  },

  beatStrip: {
    poisson:
      "Abstände zwischen Sterbefällen, gezogen aus der echten Verteilung: die meisten kurz, " +
      "einige lang",
    metronome: "Ein Schlag alle {gap}, der Jahresdurchschnitt",
    sincePrevious: "{ms} ms seit dem vorigen Todesfall",
    onRate: " — auf der Durchschnittsrate",
    always: "{gap} — immer",
  },

  dartTally: {
    ocean: "Ozean",
    uninhabited: "Unbewohnt",
    inhabited: "Bewohnt",
    uninhabitedNote:
      "Land ohne bevölkerte Zelle im 0,5°-Raster, das das Modell abtastet — rund 55 km breit.",
    inhabitedNote:
      "Land mit mindestens einer bevölkerten Zelle im Raster, und sei sie noch so dünn.",
    spoken: "{label}: {count} von {total} Sterbefällen, {share} Prozent",
    spokenLimit: ", strebt gegen {limit} Prozent",
    counting: "{label}: wird gezählt",
  },

  globalRandomMap: {
    aria:
      "Südamerika und der Pazifik, mit Fadenkreuzen, die zur globalen Sterberate an zufälligen " +
      "Punkten landen",
  },

  countryCentroidMap: {
    aria:
      "Europa nach Sterberate eingefärbt, wobei jeder Todesfall im geografischen Mittelpunkt " +
      "seines Landes landet",
    deathsPerYear: "{name}: {n} Tote/Jahr",
    noRate: "{name}: keine Ratendaten",
  },

  borderRaster: {
    loading: "Wird geladen…",
    aria: "Nahaufnahme von Vektor-Ländergrenzen über gerasterten Dichtezellen in der Nähe von {title}",
    mismatch: "Raster: {raster} / Vektor: {vector} (Abweichung)",
    peoplePerCell: "{n} Menschen/Zelle — {place}",
  },

  densityMap: {
    aria:
      "Süd-, Zentral- und Ostasien nach Bevölkerung je Rasterzelle eingefärbt, wobei Sterbefälle " +
      "im Verhältnis zur Bevölkerung auf Zellen landen",
    peoplePerCell: "{name}: {n} Menschen/Zelle",
    scaleLog: "Logarithmisch",
    scaleLinear: "Linear",
    scaleSpoken: "Logarithmische Farbskala",
  },

  subnationalMap: {
    aria:
      "Karte der japanischen Präfekturen nach roher Sterberate eingefärbt, die große " +
      "Unterschiede innerhalb eines Landes zeigt",
    loading: "Subnationale Sterberaten werden geladen…",
    legendMax: "{max}+ pro 100k",
  },

  nationalVsRegional: {
    title: "Nationale Schätzung gegen regionale Wirklichkeit",
    copy: "Sterbefälle pro 100.000, sechs Regionen aus zwei Ländern.",
    loading: "Regionale Sterberaten werden geladen…",
    national: "national {n}",
    ariaBlock: "{label}: nationale Rate {national} pro 100.000; Regionen {regions}",
    note:
      "Die nationale Rate ist für jede einzelne Region falsch — für die Hälfte zu niedrig und " +
      "für den Rest zu hoch.",
  },

  countryCurves: {
    empty: "Füge oben ein Land oder eine Kategorie hinzu, um die saisonale Kurve zu sehen.",
    placeholder: "Land oder Kategorie hinzufügen…",
    placeholderAtCap: "{max} im Vergleich — nimm eines weg, um ein weiteres hinzuzufügen",
    aria: "Liniendiagramm zum Vergleich der saisonalen Sterblichkeitskurven von {names}",
    remove: "{name} entfernen",
    selected: "Ausgewählte Länder",
    clearAll: "Alle entfernen",
    noMatches: "Keine Treffer",
    limitReached:
      "{added} hinzugefügt — Grenze von {max} Linien erreicht ({dropped} nicht gezeigt)",
    groupClimate: "Klima",
    groupGdp: "BIP",
    groupLatitude: "Breitengrad",
    gdpBins: ["BIP < 10.000 $", "BIP 10.000–30.000 $", "BIP 30.000–50.000 $", "BIP > 50.000 $"],
    latBins: [
      "Tropen (0–23,5°)",
      "Subtropen (23,5–35°)",
      "Gemäßigt (35–50°)",
      "Hohe Breiten (50°+)",
    ],
  },

  smoothing: {
    loading: "Der Glättungsvergleich wird geladen…",
    title: "Eine Reihe, viele Auflösungen",
    copy:
      "Jede Ansicht nutzt dieselben vollständigen wöchentlichen Nicht-COVID-Beobachtungen und " +
      "dieselbe Mittelwert-1-Skala.",
    country: "Land",
    order: "Ordnung",
    cadenceGroup: "Beobachtungskadenz und Glättungsverfahren",
    orderGroup: "Harmonische Ordnung",
    how: "So funktioniert es",
    goodFor: "Gut für",
    watchOut: "Achtung",
    source: "{source}. {country}: {from}–{to}; 2020–2022 ausgeschlossen.",
    aria:
      "{mode}-Ansicht des saisonalen Sterblichkeitsmultiplikators von {country}. Die Werte " +
      "reichen von {lo} bis {hi}, mit dem Jahresdurchschnitt bei 1.",
    harmonicOrderLabel: "Harmonisch · Ordnung {n}",
    modes: {
      weekly: {
        label: "Wöchentlich",
        how:
          "Mittelt dieselbe ISO-Woche über vollständige Jahre, nachdem die Zählungen in Tote pro " +
          "Tag umgerechnet wurden.",
        goodFor:
          "Den Zeitpunkt kurzer saisonaler Veränderungen zu bewahren, wenn lange, vollständige " +
          "Wochenreihen vorliegen.",
        watchOut: "Sie ist verrauscht, datenhungrig, und Woche 53 stützt sich auf weniger Jahre.",
      },
      monthly: {
        label: "Monatlich",
        how:
          "Mittelt die tägliche Sterblichkeitsintensität innerhalb jedes Kalendermonats und " +
          "vergleicht dann denselben Monat über die Jahre.",
        goodFor:
          "Ein praktischer Ausgleich zwischen zeitlicher Auflösung und Stabilität über Jahre.",
        watchOut:
          "Jede Veränderung wird einem Monat zugeordnet, sodass die Grenzen zu künstlichen " +
          "Stufen werden.",
      },
      quarterly: {
        label: "Vierteljährlich",
        how: "Fasst drei Monate zusammen, gewichtet nach ihren Kalendertagen.",
        goodFor: "Nur den breitesten saisonalen Kontrast zu zeigen, wenn Beobachtungen dünn sind.",
        watchOut:
          "Vier Werte können eine Spitze nicht genau verorten oder eine kurze zweite Saison " +
          "sichtbar machen.",
      },
      circular3: {
        label: "Zirkulär, 3 Punkte",
        how:
          "Ersetzt jeden Monatswert durch 25 % des Vormonats, 50 % seiner selbst und 25 % des " +
          "Folgemonats, wobei Dezember in Januar übergeht.",
        goodFor:
          "Transparente lokale Rauschunterdrückung mit leicht erklärbarer fester Bandbreite.",
        watchOut:
          "Die gewählte Dreimonatsbandbreite stumpft Spitzen ab und lässt weiterhin ein " +
          "monatliches Ausgaberaster.",
      },
      harmonic: {
        label: "Harmonisch",
        how:
          "Passt jährliche Sinus/Kosinus-Paare in einer gepoolten Regression an jede gültige " +
          "Wochenbeobachtung an.",
        goodFor:
          "Ein kompakter stetiger Multiplikator, glatt und periodisch über Dezember und Januar " +
          "hinweg.",
        watchOut:
          "Höhere Ordnungen bewahren kürzere Merkmale, können aber auch dem Rauschen folgen; " +
          "niedrigere Ordnungen erzwingen breitere Jahreszeiten.",
      },
    },
    orders: {
      "1": {
        how: "Passt ein jährliches Sinus/Kosinus-Paar an alle gültigen Wochenbeobachtungen an.",
        goodFor:
          "Ein breites jährliches Auf und Ab mit dem denkbar einfachsten periodischen Modell.",
        watchOut:
          "Es erzwingt eine symmetrische Einzelzyklusform und kann keine Nebenspitzen abbilden.",
      },
      "2": {
        how:
          "Passt jährliche und halbjährliche Sinus/Kosinus-Paare an alle gültigen " +
          "Wochenbeobachtungen an.",
        goodFor:
          "Breite Asymmetrie und einen möglichen zweiten saisonalen Anstieg ohne Feinheiten.",
        watchOut:
          "Kurze Spitzen werden weiterhin weggeglättet, und jedes weitere Paar erhöht die " +
          "Flexibilität.",
      },
      "3": {
        how: "Passt drei jährliche Sinus/Kosinus-Paare an alle gültigen Wochenbeobachtungen an.",
        goodFor:
          "Mehrgipflige oder schärfere saisonale Struktur auf Skalen von etwa vier Monaten zu " +
          "erfassen.",
        watchOut:
          "Es kann anfangen, wiederkehrendes Melderauschen zu bewahren, als wäre es Saisonalität.",
      },
      "4": {
        how:
          "Passt vier jährliche Sinus/Kosinus-Paare in einer gepoolten Regression an jede " +
          "gültige Wochenbeobachtung an.",
        goodFor:
          "Das Produktionsmodell: eine stetige Kurve mit genug Auflösung für kürzere saisonale " +
          "Merkmale.",
        watchOut:
          "Es kann stabilen kurzperiodischen Artefakten folgen und kann abrupte einmalige " +
          "Schocks nicht abbilden.",
      },
    },
  },

  latitudeScatter: {
    aria:
      "Streudiagramm des absoluten Breitengrads gegen die saisonale Sterblichkeitsamplitude, mit " +
      "jedem Land als gefülltem Punkt und jeder gemessenen Region als Ring",
    tropic: "Wendekreis",
    polarCircle: "Polarkreis",
  },

  koppenScatter: {
    axisTitle: "Köppen-Geiger-Zone",
    aria:
      "Streifen-Streudiagramm der saisonalen Sterblichkeitsamplitude, gruppiert nach dominanter " +
      "Köppen–Geiger-Klimafamilie, mit jedem Land als gefülltem Punkt und jeder gemessenen " +
      "Region als Ring",
  },

  gdpScatter: {
    xLabel: "Einkommen pro Kopf (log. Skala)",
    aria:
      "Streudiagramm der saisonalen Sterblichkeitsamplitude gegen das BIP pro Kopf auf " +
      "logarithmischer Skala",
  },

  pop65Scatter: {
    xLabel: "Anteil über 65 (%)",
    value: "{v} % über 65",
    aria:
      "Streudiagramm der saisonalen Sterblichkeitsamplitude gegen den Bevölkerungsanteil ab 65 " +
      "Jahren",
    footnote:
      "Die Deckkraft des Punktes zeigt das Einkommen pro Kopf: je dunkler der Punkt, desto " +
      "reicher das Land.",
  },

  neighbourScatter: {
    xLabel: "mittlere Amplitude der Nachbarn (%)",
    value: "Nachbarn {v} %",
    aria:
      "Streudiagramm der saisonalen Sterblichkeitsamplitude einer Einheit gegen die mittlere " +
      "Amplitude ihrer angrenzenden Nachbarn",
    footnote:
      "{n} Länder fehlen in diesem Diagramm vollständig: Kein Land, an das sie grenzen, meldet " +
      "eine Monatskurve, der Indikator hat also nichts zu borgen.",
    ringLabel: "Ringe sind gemessene Admin-1-Regionen gegen ihre eigenen angrenzenden Regionen.",
  },

  regionNeighbourScatter: {
    aria:
      "Streudiagramm der saisonalen Amplitude jeder gemessenen Admin-1-Region gegen die mittlere " +
      "Amplitude ihrer angrenzenden gemessenen Regionen, mit Ländern als grauen Umrissen darüber",
  },

  amplitudeMap: {
    aria:
      "Karte von Norwegen bis Südafrika und von Mauretanien bis Bangladesch, jedes Land " +
      "eingefärbt nach beobachteter oder räumlich geschätzter saisonaler " +
      "Sterblichkeitsamplitude, mit gemessenen Admin-1-Regionen in ihrer eigenen feineren " +
      "Amplitude",
    legendCaption: "Stärke der monatlichen Abweichung",
    sourceObserved: "beobachtet",
    sourceOwnRegions: "berechnet aus {n} gemessenen Regionen",
    sourceBorderingCountries: "berechnet aus angrenzenden Ländern: {donors}",
    sourceClimate: "aus dem Klima geschätzt: {donor}",
    sourceLatitude: "aus dem Breitengrad-Rückfall berechnet: {donor}",
    tooltip: "{name}: {amplitude} ({source})",
    regionTooltip: "{name} ({country}): {amplitude} Amplitude{note}",
    regionEstimate: " · Schätzung über {proxy}",
    regionOverride: " (manuell überschrieben)",
    regionImputed: " · geschätzt aus {donors}",
  },

  ageMix: {
    loading: "Sterbefälle nach Alter und Ursache werden geladen…",
    tail: "Alles Übrige",
    ariaBand: "{label}: {share} % der Sterbefälle",
    barCaption: "Die Balkenlänge ist der Anteil dieser Altersgruppe an allen Sterbefällen",
  },

  personaDemo: {
    steps: ["Ort", "Alter", "Geschlecht", "Ursache"],
    woman: "Frau",
    man: "Mann",
    womenOf: "Frauen",
    menOf: "Männer",
    undetermined: "eine unbestimmte Ursache",
    note:
      "Die schwerste einzelne Zelle in der Tabelle von {country}. Die Ursache wurde aus dieser " +
      "Zelle gezogen — {group} im Alter von {age} — und nie aus der Tabelle als Ganzes, und " +
      "genau das hält Zwanzigjährige davon ab, an Demenz zu sterben.",
    loading: "Die Tabellen zu Alter, Geschlecht und Ursache werden geladen…",
  },

  conflictMap: {
    note:
      "{fatalities} gemeldete Todesopfer in {regions} Admin-1-Regionen über {weeks} vollständige " +
      "Wochen, bis {through}.",
    noData: "Keine Konfliktdaten verfügbar — die Ebene ist aus.",
    aria: "Ungefähre Admin-1-Zentroidkarte der Konflikttoten. {note}",
    lead:
      "Die Orte sind regionale Zentroide. Für den Globus wird jeder zum nächsten besiedelten " +
      "Rasterfeld desselben Landes verschoben und zur gewöhnlichen Sterblichkeit addiert.",
    plateTitle: "{n} Todesopfer im Fenster",
    regionTooltip: "{region}, {country}: {n} Todesopfer",
  },

  prediction: {
    title: "Vorhersagen gegen die gemessene Kurve",
    copy:
      "Wir lassen jedes der {n} Länder, die eine Kurve melden, der Reihe nach weg, bauen sie aus " +
      "jedem Indikator neu auf, als fehlte sie, und bewerten, wie weit die Rekonstruktion von " +
      "der gemessenen Kurve entfernt landet. Niedrigerer mittlerer RMSE ist besser; die " +
      "Trennschärfe ist der Rückgang des gesamten quadratischen Fehlers gegenüber der jeweiligen " +
      "Grundlinie.",
    colMedianRmse: "Mittlerer RMSE",
    colMedianR: "Mittleres r",
    colSkillMean: "Vorteil vs. Mittel",
    colSkillLatitude: "Vorteil vs. Breite",
    colWonLatitude: "Gewinnt vs. Breite",
    group: "Gruppe",
    count: "n",
    latitudeRmse: "RMSE Breitengrad",
    climateRmse: "RMSE Klima",
    neighbourRmse: "RMSE Nachbarn",
    bestColumn: "Beste",
    cohortTitle: "Leistung nach Kohorte",
    cohortCopy:
      "Mittlerer tagesgewichteter Kurven-RMSE innerhalb jeder überlappenden Kohorte. Niedriger " +
      "ist besser; ein Gedankenstrich heißt, dass der Validierungssatz für diese Kohorte keine " +
      "geeignete gemessene Kurve hat.",
    cohortNote:
      "„Gemäßigt“ umfasst die Köppen–Geiger-Familien C und D. „Datenarm“ meint dünne lokale " +
      "Geberabdeckung, keine unvollständige Sterberegistrierung; Länder ohne gemessene Kurve " +
      "lassen sich per Auslassungsvalidierung nicht bewerten.",
    latitudeTitle: "Leistung nach absolutem Breitengrad",
    latitudeCopy:
      "Mittlerer tagesgewichteter Kurven-RMSE in disjunkten Bändern des absoluten " +
      "Länderschwerpunkt-Breitengrads. Niedriger ist besser.",
    subclassTitle: "Leistung nach Köppen–Geiger-Unterklasse",
    subclassCopy:
      "Mittlerer tagesgewichteter Kurven-RMSE nach der bevölkerungsgewichteten dominanten " +
      "Köppen–Geiger-Unterklasse jedes Landes. Niedriger ist besser; kleine Gruppen sind " +
      "beschreibend.",
    subclassGroup: "Klasse — Unterklasse",
    methods: {
      "Mean mortality curve": "Mittlere Sterblichkeitskurve",
      "Nearest latitude": "Nächster Breitengrad",
      "Climate class": "Klimaklasse",
      "Nearest neighbour country": "Nächstes Nachbarland",
    },
  },

  regionPrediction: {
    title: "Vorhersagen gegen die gemessene Kurve (Region)",
    copy:
      "Derselbe Auslassungstest, ausgeführt über {n} beobachtete Admin-1-Regionen statt über " +
      "Länder. {note}",
    colCountryRmse: "Mittlerer RMSE Land",
    colRegionRmse: "Mittlerer RMSE Region",
  },

  cohorts: {
    latitude: "Breitengrad",
    climate: "Klima",
    neighbour: "Nachbarn",
    none: "—",
    tropical: "Tropisch",
    tropicalNote: "Bevölkerungsgewichtetes tropisches Köppen–Geiger-Klima (Familie A).",
    temperate: "Gemäßigt",
    temperateNote:
      "Bevölkerungsgewichtetes gemäßigtes oder kontinentales Köppen–Geiger-Klima (Familien C " +
      "oder D).",
    polar: "Polar",
    polarNote: "Bevölkerungsgewichtetes polares Köppen–Geiger-Klima (Familie E).",
    island: "Insel",
    islandNote: "Kein Nachbar mit Landgrenze in der Ländertopologie.",
    dataPoor: "Datenarm",
    dataPoorNote:
      "Weniger als zwei angrenzende Länder mit gemessener Kurve in diesem Validierungssatz.",
    latitudeBandNote: "Absoluter Länderschwerpunkt-Breitengrad {from}°–{to}°.",
    unclassified: "Nicht klassifiziert",
    subclassNote: "Bevölkerungsgewichtete Köppen–Geiger-Klimaunterklasse {code}.",
    unclassifiedNote:
      "In den Indikatordaten ist keine bevölkerungsgewichtete Köppen–Geiger-Unterklasse verfügbar.",
  },

  kgFamilies: {
    A: "Tropisch",
    B: "Arid",
    C: "Gemäßigt",
    D: "Kontinental",
    E: "Polar",
  },

  kgSubclasses: {
    Af: "Regenwald",
    Am: "Monsun",
    Aw: "Savanne",
    BWh: "heiße Wüste",
    BWk: "kalte Wüste",
    BSh: "heiß semiarid",
    BSk: "kalt semiarid",
    Csa: "mediterran mit heißem Sommer",
    Csb: "mediterran mit warmem Sommer",
    Csc: "mediterran mit kühlem Sommer",
    Cwa: "trockener Winter, heißer Sommer",
    Cwb: "trockener Winter, warmer Sommer",
    Cwc: "trockener Winter, kühler Sommer",
    Cfa: "feucht subtropisch",
    Cfb: "ozeanisch",
    Cfc: "subpolar ozeanisch",
    Dsa: "trockener Sommer, heißer Sommer",
    Dsb: "trockener Sommer, warmer Sommer",
    Dsc: "trockener Sommer, subarktisch",
    Dsd: "trockener Sommer, extrem kalt",
    Dwa: "trockener Winter, heißer Sommer",
    Dwb: "trockener Winter, warmer Sommer",
    Dwc: "trockener Winter, subarktisch",
    Dwd: "trockener Winter, extrem kalt",
    Dfa: "feucht kontinental mit heißem Sommer",
    Dfb: "feucht kontinental mit warmem Sommer",
    Dfc: "subarktisch",
    Dfd: "extrem kalt subarktisch",
    ET: "Tundra",
    EF: "Eiskappe",
  },

  kgCold: "Kalt",
};
