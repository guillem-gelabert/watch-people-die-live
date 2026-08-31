import type { Dictionary } from "./en";
import { chartsDe } from "./de.charts";
import { causesDe } from "./de.causes";

// German. The story addresses its reader directly throughout, so this uses "du" rather than
// "Sie" — a personal project talking to one person, not a report.

export const de: Dictionary = {
  meta: {
    title: "Watch People Die Live",
    description:
      "Ein statistischer Sterblichkeitsglobus in Echtzeit: Jedes Aufblitzen wird aus " +
      "öffentlichen Sterberaten, Bevölkerungsdichte und demografischen Daten modelliert — mit " +
      "repräsentativen Personen statt individueller Datensätze.",
    ogDescription:
      "Ein statistischer Sterblichkeitsglobus in Echtzeit, gebaut aus öffentlichen " +
      "demografischen Daten. Jede Person ist repräsentativ, keine identifizierbare Person.",
    twitterDescription:
      "Ein statistischer Sterblichkeitsglobus mit repräsentativen Personen, nicht mit " +
      "individuellen Sterbefällen.",
  },

  chrome: {
    hero: "Jedes Aufblitzen ist ein Tod.",
    cue: "Wie bitte?",
    globe: "Globus",
    pull: {
      idle: "Nach oben ziehen zum Globus",
      keepPulling: "Weiterziehen",
      ready: "Loslassen für den Globus",
    },
  },

  globe: {
    canvasLabel: "Ein Globus der Erde. Jedes Aufblitzen ist ein modellierter Todesfall.",
    waiting: "Warten auf das erste Aufblitzen",
    latest: "Letzter Todesfall",
    justNow: "Gerade eben",
    resume: "Fortsetzen",
    pause: "Pause",
    close: "Schließen",
    persona: "{who}, {age}, {cause} – {country}",
    baby: "Säugling",
    girl: "Mädchen",
    boy: "Junge",
    woman: "Frau",
    man: "Mann",
    where: "{country} · {lat}° {ns}, {lon}° {ew}",
    north: "Nord",
    south: "Süd",
    east: "Ost",
    west: "West",
  },

  proxy: {
    cardTitle: "Mögliche Indikatoren für Saisonalität",
    best: "Bester Prädiktor",
    worst: "Schlechtester",
    reorder: "Indikatoren neu ordnen",
    rank: "Indikatoren ordnen",
    infoLabel: " — was für {title} spricht",
    currentOrder: "Aktuelle Reihenfolge, bester zuerst: {order}",
    moveUp: "{title} nach oben",
    moveDown: "{title} nach unten",
    rankNote: "Dein Platz {n}",
    rankNoteSr: " in deiner Reihung dieses Indikators",
    modal: {
      eyebrow: "Bevor wir uns die Daten ansehen",
      heading: "Welcher davon folgt der Saisonalität?",
      instruction:
        "Ordne die fünf Kandidaten vom stärksten Prädiktor für den saisonalen Ausschlag eines " +
        "Landes bis zum schwächsten. Zieh eine Zeile, um sie zu verschieben; tippe auf i, um " +
        "das Argument noch einmal zu lesen.",
      closing:
        "Danach halten wir jeden einzeln gegen die Länder, die monatliche Sterbefälle melden, " +
        "und sehen, welcher standhält.",
      skip: "Überspringen",
      submit: "Meine Reihung abschicken",
    },
    dnd: {
      instructions:
        "Zieh eine Zeile, um sie zu verschieben, oder nutze die Schaltflächen nach oben und nach " +
        "unten an jedem Indikator, um die fünf ohne Zeigegerät zu reihen.",
      dropped: "{title} steht jetzt auf Platz {rank} von {total}.",
    },
    defs: [
      {
        title: "BIP pro Kopf",
        body:
          "So fehlerhaft das BIP auch ist — es sagt Lebensqualitätsmaße erstaunlich gut voraus " +
          "(Kindersterblichkeit, durchschnittliche Zahl der Zähne, Mordraten) und ist für jedes " +
          "Jahr und jedes Land leicht zu bekommen. Wir könnten den durchschnittlichen " +
          "Saisonalitätsfaktor von Ländern mit ähnlichem BIP pro Kopf auf ein Land ohne eigene " +
          "unterjährige Daten übertragen.",
      },
      {
        title: "Nachbarländer",
        body:
          "Geografische Nähe kann mehrere Faktoren auf einmal abbilden. Nehmen wir die " +
          "Golfstaaten: Ein durchschnittliches Geberland dort wäre reich, mehrheitlich " +
          "muslimisch und hätte ein sehr ähnliches Klima. Italien und die Schweiz haben eine " +
          "vergleichbare Gesundheitsinfrastruktur, ähnlich entwickelte Institutionen und liegen " +
          "in Länge wie Breite sehr nah beieinander. Ein paar Probleme: Nachbarländer " +
          "unterscheiden sich manchmal deutlich, und manche Gruppen haben überhaupt keinen " +
          "Nachbarn mit saisonalen Daten.",
      },
      {
        title: "Klimazone",
        body:
          "Wenn unsere Annahme stimmt, ließe sich damit die Saisonalität nach ähnlichem Klima " +
          "gruppieren. Klimaklassifikationen fassen Regionen mit ähnlichen Temperatur- und " +
          "Feuchtigkeitswerten in ähnlicher Periodizität zusammen. Die Daten sind weder trivial " +
          "zu beschaffen — es gibt viele verschiedene Klassifikationen — noch auf unsere " +
          "Sterbezahlen anzuwenden. Außerdem riskieren wir eine Klassifikation, deren Zonen zu " +
          "groß sind und sehr verschiedene Länder zusammenwerfen, oder zu klein, sodass Zonen " +
          "ohne Geberland übrig bleiben.",
      },
      {
        title: "Breitengrad",
        body:
          "Das war meine erste Intuition, und tatsächlich ist es ein Indikator zweiten Grades, " +
          "der das Klima aus dem Breitengrad ableitet — und der ist für jeden Punkt der Erde " +
          "verfügbar. Sehen wir uns trotzdem Lissabon und Peking an, beide etwa auf demselben " +
          "Breitenkreis: Auf einem einzigen Breitengrad können extrem verschiedene Klimata " +
          "nebeneinander bestehen. Lissabon hat einen milden Winter und einen mäßig trockenen " +
          "Sommer, während Peking in seinem sehr trockenen Winter −27 Grad misst und einen sehr " +
          "heißen, feuchten Monsunsommer hat.",
      },
      {
        title: "Bevölkerungsanteil über 65",
        body:
          "Virusinfektionen folgen saisonalen Mustern, und ältere Menschen sind dafür " +
          "anfälliger. Im Sommer sind sie stärker durch Hitzetote gefährdet. Man könnte " +
          "erwarten, dass Orte mit älterer Bevölkerung eine stärkere Saisonalität erleben. " +
          "Andererseits sind Länder mit älterer Bevölkerung oft reicher und haben deshalb " +
          "tendenziell besseren Zugang zu Gesundheitsversorgung.",
      },
    ],
    scorecard: {
      titleScored: "Wie sich deine Reihung geschlagen hat",
      titleSkipped: "Was die Daten sagen",
      intro:
        "Jeder Indikator danach bewertet, wie eng er der beobachteten saisonalen Amplitude in " +
        "den Ländern folgt, die eine Kurve melden — |r| für die vier numerischen Indikatoren, " +
        "das Korrelationsverhältnis η für die Klimaklassen. Beide laufen von 0 bis 1.",
      unavailable:
        "Die Saisonalitätstabellen sind noch nicht geladen, also gibt es noch nichts, woran die " +
        "Reihung gemessen werden könnte.",
      scoreLabel: "von {total} auf dem richtigen Platz",
      skipped:
        "Du hast die Reihung übersprungen, es gibt also nichts zu bewerten — hier ist die " +
        "Reihenfolge, in die die Daten die fünf bringen.",
      verdictPerfect: "Genau getroffen.",
      verdictClose: "Knapp dran — ein, zwei Tausche von dem entfernt, was die Daten sagen.",
      verdictRough: "Ungefähr richtig. Der größte Teil deiner Reihenfolge übersteht die Daten.",
      verdictHalf: "Halb richtig. Die Daten stimmen etwa der Hälfte deiner Reihung zu.",
      verdictPoor: "Weit daneben — die Daten lesen das fast andersherum.",
      footruleOne:
        "Deine Reihung liegt insgesamt {n} Platz daneben, gegenüber {worst} bei einer komplett " +
        "umgekehrten.",
      footruleOther:
        "Deine Reihung liegt insgesamt {n} Plätze daneben, gegenüber {worst} bei einer komplett " +
        "umgekehrten.",
      topPickRight: "Du hast den stärksten Indikator zuerst gesetzt.",
      topPickWrong: "Der stärkste Indikator ist {title}.",
      hadItHere: "hattest du hier",
      hadItAt: "hattest du auf Platz {ordinal}",
      ordinals: ["1", "2", "3", "4", "5"],
      countryCount: "{n} Länder",
      note:
        "Das ist nicht derselbe Test wie die Auslassungstabelle darüber: Die Übereinstimmung " +
        "fragt, ob ein Indikator der Größe des Ausschlags eines Landes folgt, während das " +
        "Auslassen eines Landes fragt, wie gut er die ganze Form der Kurve rekonstruiert. Beide " +
        "setzen dieselben drei Indikatoren in derselben Reihenfolge nach oben, und das ist der " +
        "nützliche Teil — auch wenn Nachbarn und Klima hier so knapp beieinanderliegen, dass der " +
        "Abstand zwischen Platz eins und zwei nicht zu verteidigen ist. Die Abdeckung " +
        "unterscheidet sich je Zeile: Ein Land ohne angrenzendes Geberland lässt sich beim " +
        "Nachbarindikator gar nicht bewerten.",
    },
  },

  rand: {
    label: "Was zufällig hier bedeutet",
    close: "Schließen",
  },

  panels: {
    samplingOrder: "Reihenfolge der Ziehung",
    deathsByAgeCauseLabel: "Sterbefälle nach Altersgruppe und Ursache",
    deathsByAgeCauseTitle: "Sterbefälle nach Alter, und woran sie sterben",
    deathsByAgeCauseCopy:
      "Anteil der Sterbefälle je Altersgruppe, und die Ursachenmischung innerhalb der Gruppe.",
    densityClusterLabel: "Nahaufnahme von Vektorgrenzen und gerasterter Dichte",
    ewmaLabel: "Robuster exponentiell gewichteter gleitender Mittelwert der Konflikttoten",
    ewmaTitle: "Wöchentliche Todesopfer und der gewichtete Mittelwert des Globus",
    ewmaCopy:
      "Der Globus nutzt die Standardeinstellung von vier Wochen und P10–P90. Die ausgefüllten " +
      "Balken sind ACLEDs 12 vollständige Berichtswochen; der hohle Balken schätzt die aktuelle. " +
      "Die Regler zeigen Gegenfakten und verändern den Globus nicht.",
    conflictMapLabel: "Konflikttote an angenäherten Admin-1-Zentroiden",
    conflictMapTitle: "Wo die Todesopfer der letzten 12 vollständigen Wochen liegen",
    conflictMapCopy:
      "ACLED veröffentlicht wöchentliche Regionalaggregate. Jeder Punkt ist ein Admin-1-Zentroid, " +
      "nicht der Ort eines einzelnen tödlichen Ereignisses.",
    westAfrica: "Westafrika",
    benelux: "Benelux",
    figureLatitude: "Korrelation mit dem Breitengrad",
    figureClimate: "Amplitude nach Klimazone",
    figurePop65: "Amplitude vs. Bevölkerung über 65",
    figureGdp: "Amplitude vs. BIP pro Kopf",
    figureNeighbour: "Amplitude vs. Nachbarländer",
  },

  ewma: {
    empty:
      "Für die letzten {n} vollständigen Wochen sind keine Konflikttoten verfügbar; daher gibt " +
      "es keine Wochenreihe für die Schätzung.",
    ariaLabel:
      "Wöchentliche Konflikttote der letzten {n} vollständigen Wochen. Jede Woche ist nach " +
      "Land gestapelt für Länder ab 10 % dieser Woche; der Rest wird in der kleinsten " +
      "UN-Region zusammengefasst, die 10 % erreicht, der Überrest als Anderswo. Eine " +
      "{weighting} gewichtete Schätzung ergibt {prediction} Tote für die aktuelle Woche{clamp}",
    weightingFlat: "flach",
    weightingHalfLife: "mit {halfLife} Wochen Halbwertszeit",
    clampOn: ", Ausreißer auf P{lo}–P{hi} begrenzt",
    clampOff: ", Ausreißer unbegrenzt",
    estimate: "Schätzung",
    estimateApprox: "aktuell ≈ {value}/Woche",
    halfLifeName: "Halbwertszeit",
    halfLifeFlat: "flacher Mittelwert",
    halfLifeWeeks: "{n} Wochen",
    halfLifeFlatSpoken: "flacher Mittelwert, jede Woche gleich gewichtet",
    halfLifeNote:
      "Wie viele Wochen es dauert, bis sich der Einfluss einer Woche auf die Schätzung halbiert. " +
      "Bei null zählt jede Woche gleich viel.",
    dampingName: "Dämpfung",
    dampingOff: "aus",
    dampingBand: "P{lo}–P{hi}",
    dampingSpokenOn: "auf P{lo} und P{hi} begrenzt",
    dampingSpokenOff: "keine Begrenzung der Wochensummen",
    dampingNote:
      "Wie weit die Ausreißergrenze von jedem Ende her greift, vor jeder Gewichtung. Bei null " +
      "zählt das Massaker in voller Höhe.",
    readout: "Schätzung für die aktuelle Woche:",
    readoutUnit: "Tote/Woche",
    readoutAsidePlain: "(einfacher Durchschnitt der 12 Wochen: {mean}",
    readoutAsideClamped: ", Wochensummen auf P{lo}–P{hi} begrenzt",
    readoutAsideUnclamped: ", nichts begrenzt",
    readoutAsideFlat: ", jede Woche gleich gewichtet",
    elsewhere: "Anderswo",
    tooltipDeaths: "{country}: {n} Tote",
    tooltipMore: "+{n} weitere: {total}",
  },

  geoscheme: {
    2: "Afrika",
    5: "Südamerika",
    9: "Ozeanien",
    10: "Antarktis",
    11: "Westafrika",
    13: "Zentralamerika",
    14: "Ostafrika",
    15: "Nordafrika",
    17: "Mittelafrika",
    18: "Südliches Afrika",
    19: "Amerika",
    21: "Nordamerika",
    29: "Karibik",
    30: "Ostasien",
    34: "Südasien",
    35: "Südostasien",
    39: "Südeuropa",
    53: "Australien und Neuseeland",
    54: "Melanesien",
    57: "Mikronesien",
    61: "Polynesien",
    142: "Asien",
    143: "Zentralasien",
    145: "Westasien",
    150: "Europa",
    151: "Osteuropa",
    154: "Nordeuropa",
    155: "Westeuropa",
    202: "Subsahara-Afrika",
    419: "Lateinamerika und die Karibik",
  },

  causes: causesDe,

  charts: chartsDe,
};
