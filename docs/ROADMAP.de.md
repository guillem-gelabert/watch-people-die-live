# Watch People Die Live

<!-- Die deutsche Fassung der Geschichte. Der Aufbau muss mit ROADMAP.md identisch sein:
       ### <key> · <Titel> · <#himmel>
     Der Key ist das, wogegen die Figuren registriert sind, und wird NIE übersetzt — genauso
     wenig wie die Platzhalter in eckigen Klammern, etwa [density map asia]. Die Himmelsfarbe
     ist in allen Sprachen dieselbe. Die Reihenfolge in dieser Datei ist die Reihenfolge auf
     dem Bildschirm. -->

### first-light · Erstes Licht · #2b1c3a · hidden

Willst du wissen, wie viele Menschen weltweit pro Sekunde sterben? Fragen wir die Maschine.

```
Q: Wie viele Menschen sterben pro Sekunde?
A: Weltweit sterben rund 2 Menschen pro Sekunde
```

Das Problem ist, dass das nicht stimmt — oder nicht ganz. In den letzten Jahren haben wir weltweit zwischen 60 und 63 Millionen Sterbefälle pro Jahr beobachtet. Ein Jahr hat 31.536.000 Sekunden, und das eine durch das andere geteilt ergibt etwa zwei Tote pro Sekunde. Aber das ist ein Jahresdurchschnitt, und an einem Tod ist nichts durchschnittlich.

[blinking dot every 500ms]

In Wirklichkeit ist die Chance groß, dass in einer beliebigen Sekunde niemand stirbt, denn Sterbefälle folgen keinem gleichmäßigen Takt. Wären die Sterbefälle mit dem beobachteten Jahresdurchschnitt zufällig über das Jahr verteilt, läge die Wahrscheinlichkeit bei rund 27 %, dass in einer bestimmten Sekunde genau zwei Menschen gestorben sind — und ungefähr genauso hoch, dass es genau einer war.

[blinking dot randomly blinking]

Wie viele Menschen sterben also in einer bestimmten Sekunde? Unsere neue (bessere) Antwort lautet: _wenn_ Menschen {{zufällig}} über das Jahr verteilt sterben, wahrscheinlich zwischen 0 und 4 (mit rund 95 % Sicherheit).

:::rand-modal

## Was heißt hier zufällig?

Diese 27 %, und jeder Block im Diagramm weiter unten, kommen direkt aus der Poisson-Wahrscheinlichkeitsfunktion — der üblichen Art, eine Anzahl unabhängiger Zufallsereignisse (hier: Sterbefälle) in einem festen Fenster (hier: einer Sekunde) zu modellieren, wenn man nur die durchschnittliche Rate kennt. Der beobachtete Jahresdurchschnitt wird zuerst in einen Durchschnitt pro Sekunde umgerechnet:

$$ Rate pro Sekunde
\lambda_{\text{second}} = \dfrac{61{,}600{,}000}{365.25 \times 24 \times 60 \times 60} \approx 1.95
$$ Ein Jahresdurchschnitt von rund 61,6 Millionen Sterbefällen.

$$ Poisson-Wahrscheinlichkeitsfunktion
P(X = k) = \dfrac{e^{-\lambda_{\text{second}}}\lambda_{\text{second}}^k}{k!}
$$ Setze jedes _k_ ein, um den Anteil der Sekunden mit _k_ Sterbefällen zu erhalten; fünf und mehr werden zu einem letzten Block zusammengefasst.

_e_ und _k_! sind nicht willkürlich — beide fallen heraus, wenn man sich vorstellt, was in dieser Sekunde tatsächlich passiert. Zerlege die Sekunde in eine enorme Zahl winziger Augenblicke, jeder mit seiner eigenen winzigen, unabhängigen Chance auf einen Todesfall. _e_^-λ ist das, wozu „keiner dieser Augenblicke hat einen Todesfall erwischt" zusammenfällt, wenn man diese winzige Fehlchance über alle Augenblicke hinweg vervielfacht — buchstäblich derselbe Grenzprozess, der die eulersche Zahl überhaupt erst definiert. Die Hälfte λ^_k_ zählt die _k_ Augenblicke, die einen Todesfall erwischt haben, ein Faktor der Rate pro Treffer; das Teilen durch _k_! löscht dann die Reihenfolge, denn uns interessiert nur, dass _k_ Sterbefälle irgendwo in der Sekunde passiert sind, nicht auf welche _k_ der unzähligen Augenblicke sie gefallen sind.

:::

### where-global · Wo [Wo — globale Rate] · #e8956d · chapter

Wir haben beim Timing der Ereignisse eine kühne Annahme gemacht: dass sie zufällig passieren. Wie wir sehen werden, ist das weit von der Wahrheit entfernt, und wir werden versuchen, unser Zeitmodell zu verbessern. Trotzdem sind wir bei unserem ersten räumlichen Modell genauso naiv: Sterbefälle passieren zu zufälligen Zeiten an zufälligen Orten.

[map with random dots at random places]

Ich glaube, die meisten Menschen würden sich an unserem Zeitmodell nicht stoßen, aber unser räumliches Modell tut beim Zusehen weh. Die meisten zufällig platzierten Punkte (~71 %) fallen ins Meer, denn so groß ist der [Anteil der Erdoberfläche, der von Wasser bedeckt ist](https://oceanservice.noaa.gov/facts/oceanwater.html). Die Punkte, die auf Land fallen, landen überwiegend in Gebieten ohne dauerhafte menschliche Siedlungen (Wüsten, Wälder, …). Ich klassifiziere diese Punkte gegen das [GPWv4-Bevölkerungsdichteraster](https://sedac.ciesin.columbia.edu/data/set/gpw-v4-population-density-rev11), das das Modell verwendet.

[ocean uninhabited inhabited tally]

Wir sind uns wohl einig: Wenn wir ein genaues Sterbemodell wollen, muss es deutlich besser sein als das. Vielleicht könnten wir statt der globalen Sterbezahlen Daten auf Länderebene verwenden. Die gute Nachricht ist, dass die [Weltbank Schätzungen der rohen Sterberate veröffentlicht](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN) (wie viele Menschen pro Jahr auf je 1.000 Einwohner*innen sterben). Die schlechte Nachricht ist, dass viele Länder diese Daten nicht liefern und praktisch alle, die es tun, manche Sterbefälle über- oder unterzählen.

Auch wenn sie unvollkommen sind, werden die Sterberaten nach Land ein gewaltiger Fortschritt sein gegenüber Punkten, die ohne Rücksicht darauf gesetzt werden, wo Menschen leben.

[chart cdr per country]

### where-country · Ein Land ist kein Durchschnitt [Wo — Länderrate] · #f6c58f

Dass keine Sterbefälle mehr mitten im Ozean auftauchen, ist schön. Und die aufblitzenden Punkte in den Ländern zu sehen, in die sie gehören, ist auch ein großer Fortschritt. Aber wenn du genau hinsiehst, fällt dir auf, dass die Punkte immer exakt in der Mitte eines Landes erscheinen. Manchmal ist das ein unbewohnter oder sogar unbewohnbarer Teil des Landes. Nach der aktuellen Simulation passieren alle Todesfälle Russlands im [Wiwi-See](https://rgo.ru/activity/redaction/news/pamyatnyy-znak-geograficheskiy-tsentr-rossiyskoy-federatsii-v-evenkii-budet-obnovlyen/), rund 400 Kilometer vom nächsten Krankenhaus entfernt: Eine [regionale Studie](https://elib.sfu-kras.ru/bitstream/handle/2311/28186/shatunov_a_0.pdf?isAllowed=y&sequence=2) verortet den See 366 Kilometer von Tura und nennt das zentrale Bezirkskrankenhaus des Ortes. Aber wir wissen, dass Menschen dort zu sterben pflegen, wo Menschen zu sein pflegen, also legen wir eine Dichtekarte über unsere Rechnung. So haben die Punkte größere Chancen, dort zu erscheinen, wo mehr Menschen sind, und kleine, in unbesiedelten Gegenden aufzutauchen.

Kleines Problem allerdings: Die Dichtekarte ist ein Raster aus rund 55 km breiten Zellen (0,5°), sie ist sozusagen verpixelt. Ländergrenzen sind aber nicht verpixelt (der Kolonialismus kam nah dran, aber nicht ganz), sie folgen oft Flüssen, Bergen oder dem Meer.

[Benelux Westafrika maps density/borders]

Wir lösen das, indem wir jede Quelle, jede Komplexitätsebene in ein Raster überführen. Und wir weisen jedes Pixel dem Land zu, das in genau dieser Zelle die meiste Bevölkerung hat.

Diese Karte mogelt ein bisschen: Sie verwendet standardmäßig eine logarithmische Skala. Sonst würdest du nicht viel sehen. Tatsache ist, dass die Erde, auch das Land, größtenteils leer ist. _Schalte zwischen logarithmischer und linearer Skala um, um zu sehen, wie leer._

[density map asia]

Auf einer linearen Skala siehst du kaum etwas außer einem Dutzend Megastädten und etwas Schattierung um die Gangesebene (die Region südlich des Himalaja, in der [ein Siebtel der Weltbevölkerung lebt](https://pmc.ncbi.nlm.nih.gov/articles/PMC7125076/)).

Jetzt erscheinen unsere Punkte überwiegend in Städten und in sehr bevölkerungsreichen Gegenden.

### where-region · Sterberate nach Region [Wo — Rate nach Region] · #e7e9e4

Eine einzige nationale Rate verdeckt eine enorme innere Streuung. In Japan stirbt das ländliche Akita fast doppelt so schnell wie Tokio; in den USA liegt West Virginia deutlich über Utah; in Europa übertreffen Nordwestbulgarien und Ostdeutschland Irland oder die nordischen Hauptstädte bei Weitem. [Der größte Teil der Lücke ist Altersstruktur](https://ec.europa.eu/eurostat/cache/metadata/en/hlth_cdeath_sims.htm) (ältere Regionen begraben jedes Jahr mehr ihrer Menschen), überlagert von echten Unterschieden bei Gesundheit, Armut und Zugang zu Versorgung. Japans [amtliche Tabelle für 2023](https://www.ipss.go.jp/syoushika/tohkei/Data/Popular2025/T12-26.files/sheet001.htm) setzt die rohen Raten auf 19,3 pro 1.000 in Akita und 10,2 in Tokio; nach Altersstandardisierung rücken sie auf 14,4 und 12,3 zusammen.

Ein anschauliches Beispiel dafür, wie groß der Einfluss der Altersstruktur eines Ortes auf seine Sterberate ist, sind Mexiko und Litauen. Im Jahr 2000 lag die Lebenserwartung in beiden Ländern bei etwa 72 Jahren, doch Mexikos rohe Sterberate lag bei rund 4 pro 1.000, die Litauens bei rund 11 pro 1.000. Gleiche Lebenserwartung, fast dreifacher Unterschied in der rohen Sterberate.

Quellen: Weltbank-Reihen zur [Lebenserwartung bei Geburt](https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=MX-LT&start=2000&end=2000) und zur [rohen Sterberate](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN?locations=MX-LT&start=2000&end=2000).

[subnational choropleth]

### borders-wrong-unit · Grenzen sind die falsche Einheit [Wo — Region] · #a6d2f5

[national vs regional bars]

Quelle: [Eurostats regionale rohe Sterberaten 2023](https://ec.europa.eu/eurostat/databrowser/view/demo_r_gind3/default/table?lang=en).

### when-seasonality · Wann [Wann — Saisonalität] · #bcd8ee · chapter

:::chapter-sub
Die einzige Ebene, die noch in deinem Browser berechnet wird, weil sie als einzige sich ändert, während du zusiehst.
:::

# Sterberate nach Jahreszeit

Zeitlich stehen wir noch genau da, wo wir am Anfang standen. Die Punkte erscheinen weiter zu zufälligen Momenten. Das sieht eindeutig besser aus als regelmäßige Intervalle wie bei einem Metronom, ist der Wirklichkeit aber nicht näher. Zufall wirkt organischer, aber wir wollen mehr als eine Wirkung.

Haben wir etwas Besseres als Zufall? Ja, zumindest für einige Länder, die monatliche oder sogar wöchentliche Sterbezahlen liefern. Die Sterberaten eines bestimmten Monats in einem bestimmten Land schwanken von Jahr zu Jahr, aber nicht stark. Tatsächlich lässt sich recht leicht eine Kurve zeichnen, die zeigt, zu welcher Jahreszeit weniger oder mehr Menschen sterben. Und die Daten sind nicht nur von Jahr zu Jahr konsistent, sondern auch zwischen Ländern.

## Eine Schar ähnlicher Kurven

Füge zum Vergleich ein Land mit direkt gemessener Kurve hinzu oder nimm eines weg.

[seasonality curves]

## Von Beobachtungen zu einem stetigen Multiplikator

Wöchentlich, monatlich, vierteljährlich: So oft meldet ein Land, und das entscheidet, wie viel von der Form übrig bleibt. Die Glättung ist ein eigener Schritt. Wähl unten ein Land, das wöchentlich meldet, um zu sehen, was jede Kadenz behält, vergleich es mit dem zirkulären Dreimonatsdurchschnitt, mit dem der Globus früher lief, und schalte die harmonische Kurve zwischen Ordnung 1 und 4 um. Der Globus nutzt jetzt Ordnung 4.

[smoothing explainer]

Ein Faktor über 1 heißt, Sterbefälle feuern schneller als der Jahresdurchschnitt, unter 1 langsamer. Die Kurve, die der Globus nutzt, ist eine Fourier-Regression vierter Ordnung, gepoolt über alle vollständigen Nicht-COVID-Jahre. Wöchentliche Beobachtungen bleiben wöchentlich, Zählungen werden zu einer täglichen Intensität, und die angepasste Kurve liefert einen Wert für jeden Tag des Jahres, auch für die, die niemand gemeldet hat.

Die meisten gemäßigten Länder sehen ähnlich aus: Der Winter tötet spürbar mehr als der Sommer. Näher am Äquator ist die Kurve flacher oder folgt Regen- und Trockenzeit statt Winter und Sommer. Deshalb setzt das harmonische Modell nirgends eine Winterspitze voraus; es passt sich der Form an, die die Daten haben.

Wenn das Diagramm Länder der Südhalbkugel neben nördliche stellt, verschiebt es sie um ein halbes Jahr, damit sich die Formen vergleichen lassen. Der Globus tut das nicht: Dort ist der Juli in Chile immer noch Juli.

Diese Wortwahl von mir verrät eine Annahme, die zwar naheliegt, aber falsch sein könnte: dass Veränderungen der Raten über ein Jahr überwiegend auf klimatischen Jahreszeiten beruhen. Theoretisch könnten sie etwas anderes widerspiegeln. Denk an soziale Mechanismen wie den Ramadan oder an Datenartefakte wie verspätete Meldung von Sterbefällen, voreingestellte Sterbedaten und so weiter.

Zu verstehen, was Saisonalität verursacht, ist sehr interessant, aber für die Länder, von denen wir beobachtete saisonale Daten haben, nicht entscheidend. Was machen wir mit den anderen rund 100 Ländern, die nur eine jährliche Sterberate liefern?

Wenn mir Daten fehlen, die ich brauche, stelle ich mir immer die Frage: Gibt es Indikatoren für die gesuchten Daten, die leichter zu bekommen sind? Sind sie Ursachen des untersuchten Phänomens, Folgen davon, oder teilen sie mit unserem Gegenstand eine gemeinsame Ursache? In diesem Fall fallen mir ein paar ein, jeder mit eigenen Stärken und Schwächen.

[proxy ranking card]

Bevor wir uns auf einen festlegen, lohnt es sich zu sehen, was die _Stärke_ des saisonalen Ausschlags eines Landes tatsächlich abbildet, unter den Ländern, die bereits eine Kurve melden. Viele sind grob unimodal, während manche tropischen Klimata breitere oder mehrfache Regenzeit-Merkmale haben können. Die Amplitude ist trotzdem eine brauchbare erste Zusammenfassung (wie weit sich die Kurve von ihrem Jahresmittel entfernt), ohne zu behaupten, jede Form habe eine Winterspitze.

In den folgenden Diagrammen ist jeder Punkt ein Land mit beobachteten saisonalen Daten. Die y-Achse zeigt die Amplitude: Je höher ein Punkt liegt, desto größer der Unterschied der Sterblichkeit zwischen Sommer und Winter. Die x-Achse verortet die Länder auf jedem der vorgeschlagenen Indikatoren.

Die untere Achse zeigt den absoluten Breitengrad, wie weit ein Land vom Äquator entfernt ist. Punkte links sind tropisch, Punkte nahe dem rechten Rand liegen nahe den Polen.

[latitude scatter]

Wir sehen ein erwartetes Muster: Die Amplitude ist zwischen den Wendekreisen am niedrigsten, weil Länder dort keine astronomischen Jahreszeiten erleben. Und ein unerwartetes (zumindest für mich): Oberhalb von 35° nimmt die Saisonalität ab, statt mit kälteren und längeren Wintern zu steigen. Eine mögliche Erklärung ist, dass Menschen ab einer bestimmten Schwelle verstehen, dass sie sich an den Winter anpassen müssen, und soziale, verhaltensbezogene und bauliche Anpassungen umsetzen. Dass Spanien mit seinem milderen Klima eine höhere Wintersterblichkeit zeigt als Schweden, würde in diese Richtung deuten.

Hier stecken wir alle Länder und Regionen in ihren jeweiligen Klimatopf. Wenn das ein guter Indikator sein soll, müssten die Punkte in jedem Klima eng beieinanderliegen.

[koppen scatter]

Nun, das ändert das Bild kaum. Wir bestätigen, dass es eine Korrelation gibt, dass die Saisonalität zwischen den Wendekreisen niedriger ist, und dass das Klima, genau wie der Breitengrad, die Saisonalität dort am besten vorhersagt, wo sie niedrig ist.

[pop65 scatter]

Wie viele ältere Menschen in einem Land leben, wirkt wie ein sehr schwacher Indikator. Ich sehe hier bloß eine Punktwolke. Möglicherweise, weil reichere Länder tendenziell ältere Bevölkerungen haben und das eine das andere aufhebt. Die Länder nach BIP pro Kopf einzufärben bestätigt das: Die Länder links sind heller (ärmer) als die Länder rechts.

[gdp scatter]

Mehr vom Gleichen. Es gibt keine sichtbare Korrelation zwischen dem Reichtum eines Landes und der Stärke, mit der die Jahreszeiten seine Sterblichkeit beeinflussen. Die Ursache ist wahrscheinlich dieselbe wie oben: Reichere Länder gleichen ihre Saisonalität mit stärkeren Gesundheitssystemen und besseren Anpassungen aus.

[neighbour scatter]

Und wie steht es mit Nachbarländern? Das ist besser. Hier gibt es eine starke Korrelation. Von allem, was ich an den Ländern mit gemessener Kurve ausprobiert habe, gewinnt das Borgen bei angrenzenden Nachbarn: niedrigster mittlerer Fehler, höchste Korrelation, und die einzige Methode, die sowohl die Mittelkurve als auch den Breitengrad schlägt. Breitengrad und Klimaklasse folgen dicht dahinter, wobei das Klima beim typischen Land knapp vor dem Breitengrad liegt.

:::accordion

## Wie die Indikatoren tatsächlich abschneiden · Auslassungswerte für alle fünf Indikatoren

Ich habe gerade Behauptungen über Fehler und Trennschärfe aufgestellt, also hier die Messung. Ich verstecke jedes Land, das eine Kurve meldet, sage es mit jeder Methode vorher, als hätte es keine Daten, und bewerte die Vorhersage gegen die echte Form. In diesen Diagrammen ist die Amplitude die quadratische mittlere Abweichung der angepassten Kurve von ihrem Jahresmittel.

[prediction comparison]

:::

## Und wie hat sich deine Reihung geschlagen?

Die Reihung fragte, welcher Indikator die Größe des Ausschlags eines Landes abbildet. Der Auslassungstest fragt etwas anderes: Wie gut baut jede Methode die ganze Kurve nach, wenn ich sie verstecke? Wenn du die fünf vor den Diagrammen gereiht hast, hier ist deine Schätzung gelandet.

[proxy scorecard]

## Angrenzende Regionen, nicht nur angrenzende Länder

Benachbarte Regionen innerhalb eines Landes laufen noch enger miteinander als benachbarte Länder, und deshalb schlägt die Rekonstruktion aus der nächstgelegenen Region jeden anderen Indikator auf Regionsebene. Zwei russische Regionen, Inguschetien und Tschukotka, hatten rohe Wochendaten, die ich nicht verwenden konnte (Wochen mit null Toten oder Spitzen, viel zu groß, um echt zu sein), also habe ich sie, statt sie unverändert zu zeigen oder zu verwerfen, mit dem Durchschnitt ihrer nächsten brauchbaren Nachbarn gefüllt.

[region neighbour scatter]

:::accordion

## Dieselbe Prüfung über Regionen · Mittlerer Fehler über 297 Admin-1-Regionen

[region prediction comparison]

:::

## Wo die zusätzlichen Todesfälle liegen, Monat für Monat

[amplitude map]

Jedes Quadrat ist ein halbes Grad desselben Rasters, das der Globus abtastet, eingefärbt nach den Todesfällen, die die Saison dieses Monats einem gewöhnlichen Monat dort hinzufügt oder nimmt. Zieh durch das Jahr, und die Hemisphären tauschen die Plätze: Europas Januarüberschuss ist das Januardefizit im südlichen Afrika, und im Juli ist es umgekehrt.

Die Textur, die du innerhalb eines Landes siehst, ist Bevölkerung. Nur zehn Länder haben gemessene Regionalkurven, und in diesem Ausschnitt bleiben davon Südafrika, das westliche Russland sowie das klimamodellierte Indien und China; Europa hat keine einzige. Überall sonst teilen sich alle Zellen eines Landes eine Kurve, und die Umrisse sagen dir, zu welcher Einheit sie gehört: durchgezogen, wo jemand dort Todesfälle gezählt hat, gestrichelt, wo ich sie aus einem Nachbarn, einer Klimaklasse oder einem Breitengrad rekonstruiert habe. Innerhalb einer solchen Grenze ändert sich von Zelle zu Zelle, wie viele Menschen dort leben. Wann sie sterben, ist überall gleich.

### conflicts · Ein Krieg ist kein Poisson-Prozess [Konflikte] · #eeb87d

Alles bisher ist langsame Sterblichkeit: die langfristigen Trends, die den größten Teil der Todesfälle weltweit ausmachen. Aber manche Todesfälle folgen keinem Trend, und die größte Gruppe davon ist Krieg. [ACLED veröffentlicht wöchentliche Aggregate](https://acleddata.com/use-access/how-use-acleds-aggregated-data) gemeldeter Konflikttoter, festgemacht an den Zentroiden von Ländern und Admin-1-Regionen. ACLED summiert die Ereignisse jeder Woche in der Mitte einer Provinz; wo jedes einzelne passiert ist, sagt es nicht.

Jede andere Ebene bisher war ein Faktor, mit dem wir die rohe Sterberate multiplizieren: Dichte, Jahreszeit. Diese hier ist eine Zählung. Wir bekommen 12 vollständige gemeldete Wochen bis zum ältesten Veröffentlichungsdatum, das die sechs ACLED-Regionen gemeinsam haben. Wie viele Menschen sterben also gerade jetzt in einer beliebigen Woche in Kriegen?

Ich nehme einen gewichteten Durchschnitt, der jüngeren Wochen mehr traut als alten und die Extreme vor dem Mitteln zusammendrückt. Das heißt robuster exponentiell gewichteter gleitender Mittelwert, Robust EWMA. Eine einzelne wilde Woche kann die Schätzung kaum bewegen. Die Kehrseite: Wenn ein Krieg plötzlich schlimmer wird, hinkt die Schätzung hinterher.

So funktioniert das an sieben erfundenen Wochen (die echte Schätzung nutzt 12; mit sieben bleibt die Rechnung kurz).

| Woche      |   1 |   2 |   3 |   4 |   5 |   6 |   7 |
| ---------- | --: | --: | --: | --: | --: | --: | --: |
| Todesopfer |  20 |  22 |  21 |  90 |  24 |  26 |  28 |

Zuerst das 10. und das 90. Perzentil.

| Perzentil | Grenze | Bedeutung                                        |
| --------- | -----: | ------------------------------------------------ |
| P10       |   20,6 | Etwa 10 % der Wochen haben niedrigere Zahlen. |
| P90       |   52,8 | Etwa 90 % der Wochen haben niedrigere Zahlen. |

Alles außerhalb wird hereingezogen:

| Woche | Ursprungswert | Gekappter Wert | Änderung          |
| --: | ------------: | -------------: | ----------------- |
|   1 |            20 |           20,6 | Auf P10 angehoben |
|   2 |            22 |             22 | Unverändert       |
|   3 |            21 |             21 | Unverändert       |
|   4 |            90 |           52,8 | Auf P90 gesenkt   |
|   5 |            24 |             24 | Unverändert       |
|   6 |            26 |             26 | Unverändert       |
|   7 |            28 |             28 | Unverändert       |

Dann die Gewichte. Sie kommen aus einer Halbwertszeit: wie viele Wochen es dauert, bis eine Woche nur noch halb so viel zählt. Ich habe sie nicht angepasst (das bräuchte eine richtige Validierung); der Globus nutzt vier Wochen.

Mit einer Halbwertszeit von vier Wochen sind die Gewichte:

| Woche | Gewicht | Anmerkung                     |
| --: | ------: | ----------------------------- |
|   1 |   0,354 |                               |
|   2 |   0,420 |                               |
|   3 |   0,500 |                               |
|   4 |   0,595 |                               |
|   5 |   0,707 |                               |
|   6 |   0,841 |                               |
|   7 |   1,000 | Jüngste vollständige Woche    |

Gewichteter Durchschnitt der gekappten Werte: 28,4. Der einfache Durchschnitt der Rohzahlen liegt bei 33, hochgezogen von dieser einen Woche mit 90.

Beide Regler (wie schnell eine Woche verblasst, wie stark die Extreme hereingezogen werden) sind meine Entscheidungen; die Daten haben sie nicht gewählt. Der Globus läuft immer mit dem Standard, vier Wochen und P10–P90, verteilt das Ergebnis dann nach dem Anteil jeder Admin-1-Region an den Todesopfern der 12 Wochen und rechnet es auf ein Jahr hoch. Mit den Reglern unten siehst du, was andere Einstellungen ergeben würden. Sie zu bewegen verändert den Globus nicht.

[widget to update half life, curve smoothness, and see prediction]

[map of conflict fatalities]

Die Karte zeigt dieselben 12 Wochen Todesopfer an ACLEDs Admin-1-Zentroiden. Auf dem Globus springt jeder Zentroid auf die nächste besiedelte Rasterzelle im selben Land, damit ein Punkt nicht in einer leeren Wüste landet, nur weil dort die Mitte der Provinz liegt.

### who · Wer · #d9dbdd · chapter

:::chapter-sub
Jedes Aufblitzen bekommt einen Satz, gezogen aus der Verteilung des Ortes, an dem es gefeuert hat.
:::

# Geschlecht, Alter, dann Ursache

Alter und Geschlecht stammen aus der UN-Tabelle der Sterbefälle nach Alter und Geschlecht in den World Population Prospects, Zahlen von 2023. Die Ursache stammt aus den [Global Health Estimates der WHO](https://www.who.int/data/global-health-estimates/), der Ausgabe GHE 2021, veröffentlicht 2024. Ich nutze ihre Schätzungen für 2019, das letzte Jahr vor der Pandemie, weil ich nicht will, dass COVID-19 als die gewöhnliche Art zu sterben gezeichnet wird. Für jedes Land, Geschlecht und jede Altersgruppe behalte ich die acht häufigsten wiedererkennbaren Ursachen und fasse den Rest zu „andere Ursachen" zusammen.

Alter, Geschlecht und Ursache ziehe ich nicht unabhängig voneinander. Erst Geschlecht und Alter, dann die Ursache aus der Verteilung dieser Gruppe. Sonst bekämen wir Kombinationen, die die Quelldaten fast nie zeigen.

Beide Tabellen ([Alter und Geschlecht](/data/mortality-age-sex.json), [Ursache](/data/causes.json)) liegen als JSON im Repository, der Feed macht zur Laufzeit also keinen API-Aufruf und liest sich offline genauso. Die Ursachentabelle kam früher aus der Global Burden of Disease des IHME, die ich von Hand aus einem Ergebniswerkzeug exportieren musste, das jeden Download hinter einer Anmeldung versteckt und bei hunderttausend Zeilen kappt. Die WHO-Tabelle ist eine Anfrage und kein Konto. Das ist der Hauptgrund, warum sie hier steht.

Die Ursache unter die Landesebene zu bringen heißt zurück zum IHME, und zurück zu dieser Grenze. Der subnationale Export sind 723 Orte × 22 Altersgruppen × zwei Geschlechter × 22 Ursachengruppen: siebenhunderttausend Zeilen, also acht Downloads, gegen ein Kontingent, das pro Ausgabe verbraucht wird und sich nie wieder auffüllt. Also habe ich die acht danach geordnet, wie viele Tote jeder trägt, statt nach der Reihenfolge, in der das Werkzeug sie auflistet. Nach dem ersten war das Kontingent aufgebraucht.

Dieser eine Download enthält die Herz-Kreislauf-Erkrankungen, die Krebserkrankungen und die chronischen Atemwegserkrankungen, 55% aller Todesfälle, in regionaler Auflösung. In der Reihenfolge des Werkzeugs hätte derselbe Download etwa ein Zehntel davon enthalten. Jetzt steckt er im Feed. Wie weit reicht er? Zwei Anteile wirken zusammen. Die Regionen decken **44,6%** der gezogenen Todesfälle ab; die drei Gruppen sind **55,0%** der Ursachen. Die Region entscheidet nur, wo beides zutrifft, also bewegen sich **24,5% aller Ursachenziehungen** jetzt mit dem Ort statt mit dem Land. Der Rest behält die nationale Mischung.

Was der Feed weiß, als Anteil der Todesfälle, die er zieht:

| Schicht                  | Aus der Region aufgelöst | Abgeleitet | National |
| ------------------------ | -----------------------: | ---------: | -------: |
| Alter und Geschlecht     |                    44,6% |      51,8% |     3,6% |
| Ursache, diese 3 Gruppen |                    44,6% |          — |    55,4% |
| Ursache, die anderen 19  |                        — |          — |     100% |

Die Neugewichtung ist ein Verhältnis. Zweiundzwanzig klinische Gruppen können keine siebenundachtzig benannten Ursachen tragen, also bitte ich die GBD nie, irgendetwas zu benennen. Für jede Region, Altersgruppe und jedes Geschlecht liefert sie eine Zahl pro Gruppe: den Anteil dieser Gruppe an den Todesfällen dort, geteilt durch ihren Anteil im Land. Die WHO-Bezeichnungen innerhalb der Gruppe werden damit multipliziert. Alles außerhalb der drei Gruppen bewegt sich gemeinsam mit dem Rest, damit die drei sich nicht stillschweigend aufblähen können.

Drei Dinge fehlen noch, und keines davon ist klein. Neunzehn der zweiundzwanzig Gruppen haben überhaupt keine regionalen Daten: sieben Downloads, die mir ein Kontingent noch schuldet, das sich nicht wieder aufgefüllt hat. 55% der Todesfälle geschehen außerhalb der 474 Regionen (darunter ganz China, das hier keine subnationalen Einheiten hat) und ziehen eine nationale Ursachenmischung. Und siebzehn der Regionen sind Städte, zu klein, als dass eine Halbgrad-Zelle ihnen zufallen könnte. Delhi, Osaka, Greater London, Mexiko-Stadt, Jakarta, Manila und elf weitere gewinnen keine eigene Zelle, ihre Todesfälle werden also mit der Mischung der umgebenden Region gezogen. Das sind 2,6% der Todesfälle innerhalb der Regionen. Schuld ist das Gitter; die Daten sind in Ordnung.

[sampling order]

# Dann kippt der Monat es

Die Jahreszeit verändert auch Alter und Ursache, die wir ziehen. Ich schätze diese Veränderungen aus den Registern, die ich habe, und leihe die Muster dann an Länder aus, die keine haben. Dieses Ausleihen ist einer der wackligeren Teile des Modells.

Alter und Ursache nutzen verschiedene Register. Die Alterskurven sind aus [Eurostats Wochenregistern](https://ec.europa.eu/eurostat/cache/metadata/en/demomwk_esms.htm) für 24 europäische Länder gemessen. Die Ursachenkurven kommen aus den monatlichen Sterberegistern von [Brasiliens DATASUS](https://datasus.saude.gov.br/informacoes-de-saude-tabnet/) und [Mexikos Secretaría de Salud](https://www.datos.gob.mx/dataset/registro_defunciones), den beiden Länderquellen hier, deren Mikrodaten Datum und Ursache zusammen führen. Beide werden als stetige harmonische Kurven vierter Ordnung angepasst. Die zwölf Monatswerte im Diagramm sind Momentaufnahmen dieser Kurven; was das Modell behält, ist die Kurve selbst.

Länder ohne solche Register borgen über dieselbe Spenderkaskade wie das Timing: regionale Durchschnitte, Nachbarländer, Klima, Breitengrad. Alle neun Altersgruppen haben gemessene Kurven in den 24 Quellländern. Die Ursache ist lückenhafter: 55 der 87 Bezeichnungen leihen sich die Kurve ihres ICD-10-Kapitels, und die anderen 32 lasse ich flach, mit eins multipliziert. Die größte davon ist „andere Ursachen" selbst, der Sack, in den die Kürzung auf die stärksten acht alles Übrige kehrt, in der Regel ein Drittel des Gewichts in den Erwachsenengruppen und bis zur Hälfte. Ich habe sie absichtlich flach gelassen. Sie ist ein Haufen unverbundener Todesfälle ohne eigenes Kapitel, und ihr die Kurve des durchschnittlichen Todes zu geben hieße, eine Form zu behaupten, die ich nie gemessen habe.

Beim Ziehen verändern diese Multiplikatoren die bedingten Alters- und Ursachengewichte, die dann gemeinsam normiert werden. Jede Kurve hat über das Jahr im Mittel eins, aber das allein garantiert nicht, dass jede Kategorie nach dem Kombinieren der Gewichte genau ihren Jahresanteil behält.

[deaths by age and cause]

### still-missing · Was noch fehlt [Noch offen] · #cf7a68 · chapter-small

:::chapter-sub
Ebenen mit einem klaren Platz im Modell und ohne Quelle, die gut genug wäre, ihn zu füllen.
:::

:::accordion

## Laufende Epidemien · Geplant · Quelle noch offen

Epidemien heben die Sterblichkeit in bestimmten Regionen und Zeiträumen um einen messbaren Betrag. Schätzungen der Übersterblichkeit sind das richtige Maß und kommen Monate zu spät; Ausbruchsmeldungen kommen schnell und melden Fälle, keine Todesfälle. Solange nichts schneller aktualisiert wird als das Modell selbst, wäre eine Epidemieebene Fiktion im Datenkostüm.

## Tageszeit · Braucht eine veröffentlichte Kurve

Sterbefälle häufen sich in den frühen Morgenstunden, und der Globus kennt bereits die Ortszeit jeder Zelle — der subsolare Punkt beleuchtet sie. Die Ebene ließe sich in die Gewichte einstöpseln, ohne die Laufzeit überhaupt zu verändern. Was fehlt, ist eine Kurve, die das Einstöpseln wert wäre.

## Subnationale Altersstruktur · Teilweise verfügbar

Die Personen nutzen derzeit eine nationale Altersverteilung, ein Todesfall in einer ländlichen spanischen Provinz bekommt also dieselbe Altersziehung wie einer in Madrid. Regionale Alterspyramiden existieren für Europa und würden den Feed erheblich schärfen; anderswo sind sie dasselbe Flickwerkproblem wie die regionalen Raten.

:::

### back-to-the-globe · Zurück zum Globus · #000000 · hidden

:::end-block

# Jetzt weißt du, was das Aufblitzen bedeutet.

Geh zurück und sieh es dir noch einmal an. Es liest sich anders.

:::end-fine
Der Globus ist statistisch, kein Strom individueller Datensätze. Ein Aufblitzen und die dazugehörige Person sind ein repräsentatives Ereignis aus öffentlichen aggregierten Daten, nie ein identifizierbarer Todesfall. Ein persönliches Projekt, das statistische Sterblichkeitsvisualisierung erkundet.
:::

[pull up for the globe]

:::
$$
