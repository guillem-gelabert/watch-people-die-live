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

Ich glaube, die meisten Menschen würden sich an unserem Zeitmodell nicht stoßen, aber unser räumliches Modell tut beim Zusehen weh. Die meisten zufällig platzierten Punkte (~71 %) fallen ins Meer, denn so groß ist der Anteil der Erde, der von Wasser bedeckt ist. Die Punkte, die auf Land fallen, landen überwiegend in Gebieten ohne dauerhafte menschliche Siedlungen (Wüsten, Wälder, …).

[ocean uninhabited inhabited tally]

Wir sind uns wohl einig: Wenn wir ein genaues Sterbemodell wollen, muss es deutlich besser sein als das. Vielleicht könnten wir statt der globalen Sterbezahlen Daten auf Länderebene verwenden. Die gute Nachricht ist, dass viele Länder ihre rohe Sterberate melden — wie viele Menschen pro Jahr auf je 100.000 Einwohner sterben. Die schlechte Nachricht ist, dass viele diese Daten nicht liefern und praktisch alle, die es tun, manche Sterbefälle über- oder unterzählen.

Zum Glück arbeiten bei der WHO sehr kluge Leute daran und liefern gute Schätzungen. Auch wenn sie unvollkommen sind, werden die Sterberaten nach Land ein gewaltiger Fortschritt sein gegenüber zufälligen Punkten irgendwo, mit gleicher Chance auf Mexiko oder Litauen, Togo oder die Antarktis, auf Land oder mitten im Ozean.

[chart cdr per country]

### where-country · Ein Land ist kein Durchschnitt [Wo — Länderrate] · #f6c58f

Dass keine Sterbefälle mehr mitten im Ozean auftauchen, ist schön. Und die aufblitzenden Punkte in den Ländern zu sehen, in die sie gehören, ist auch ein großer Fortschritt. Aber wenn du genau hinsiehst, fällt dir auf, dass die Punkte immer exakt in der Mitte eines Landes erscheinen. Manchmal ist das ein unbewohnter oder sogar unbewohnbarer Teil des Landes. Nach der aktuellen Simulation passieren alle Todesfälle Russlands im Wiwi-See, 400 Kilometer vom nächsten Krankenhaus entfernt. Aber wir wissen, dass Menschen dort zu sterben pflegen, wo Menschen zu sein pflegen — also legen wir eine Dichtekarte über unsere Rechnung. So haben die Punkte größere Chancen, dort zu erscheinen, wo mehr Menschen sind, und kleine, in unbesiedelten Gegenden aufzutauchen.

Kleines Problem allerdings: Die Dichtekarte ist ein Raster aus rund 55 km breiten Zellen (0,5°), sie ist sozusagen verpixelt. Ländergrenzen sind aber nicht verpixelt (der Kolonialismus kam nah dran, aber nicht ganz), sie folgen oft Flüssen, Bergen oder dem Meer.

[Benelux Westafrika maps density/borders]

Wir lösen das, indem wir jede Quelle, jede Komplexitätsebene in ein Raster überführen. Und wir weisen jedes Pixel dem Land zu, das in genau dieser Zelle die meiste Bevölkerung hat.

Diese Karte mogelt ein bisschen: Sie verwendet standardmäßig eine logarithmische Skala. Sonst würdest du nicht viel sehen. Tatsache ist, dass die Erde, auch das Land, größtenteils leer ist. _Schalte zwischen logarithmischer und linearer Skala um, um zu sehen, wie leer._

[density map asia]

Auf einer linearen Skala siehst du kaum etwas außer einem Dutzend Megastädten und etwas Schattierung um die Gangesebene (die Region südlich des Himalaja, in der ein Siebtel der Weltbevölkerung lebt).

Jetzt erscheinen unsere Punkte überwiegend in Städten und in sehr bevölkerungsreichen Gegenden.

### where-region · Sterberate nach Region [Wo — Rate nach Region] · #e7e9e4

Eine einzige nationale Rate verdeckt eine enorme innere Streuung. In Japan stirbt das ländliche Akita fast doppelt so schnell wie Tokio; in den USA liegt West Virginia deutlich über Utah; in Europa übertreffen Nordwestbulgarien und Ostdeutschland Irland oder die nordischen Hauptstädte bei Weitem. Der größte Teil der Lücke ist Altersstruktur — ältere Regionen begraben jedes Jahr mehr ihrer Menschen — überlagert von echten Unterschieden bei Gesundheit, Armut und Zugang zu Versorgung.

Ein anschauliches Beispiel dafür, wie groß der Einfluss der Altersstruktur eines Ortes auf seine Sterberate ist, sind Mexiko und Litauen. Im Jahr 2000 lag die Lebenserwartung in beiden Ländern bei etwa 72 Jahren, doch Mexikos rohe Sterberate lag bei rund 4 pro 1.000, die Litauens bei rund 11 pro 1.000. Gleiche Lebenserwartung, fast dreifacher Unterschied in der rohen Sterberate.

[subnational choropleth]

### borders-wrong-unit · Grenzen sind die falsche Einheit [Wo — Region] · #a6d2f5

[national vs regional bars]

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

Wöchentlich, monatlich und vierteljährlich beschreiben, wie oft Beobachtungen eintreffen. Es sind keine Glättungsverfahren. Wähle unten ein qualitätsgeprüftes Land mit wöchentlichen Beobachtungen, um zu sehen, was jede Kadenz bewahrt, vergleiche den früheren zirkulären Dreimonatsdurchschnitt und schalte zwischen den Ordnungen 1–4 der stetigen harmonischen Kurve um. Ordnung 4 ist das Modell, das der Globus jetzt verwendet.

[smoothing explainer]

In diesen Diagrammen bedeutet ein Faktor über 1, dass Sterbefälle schneller feuern als der Jahresdurchschnitt, und ein Faktor unter 1, dass sie langsamer feuern. Die Produktionskurve ist eine gepoolte Fourier-Regression vierter Ordnung über alle vollständigen Nicht-COVID-Jahre: Wöchentliche Beobachtungen bleiben wöchentlich, Zählungen werden in tägliche Intensität umgerechnet, und das Ergebnis lässt sich stetig an jedem Tag des Jahres auswerten.

Viele gemäßigte Länder folgen einem ähnlichen Muster: Der Winter ist deutlich tödlicher als der Sommer. Näher am Äquator ist das Jahressignal meist flacher oder folgt Regen- und Trockenzeiten statt einem Winter-Sommer-Kontrast, deshalb nimmt das harmonische Modell nicht an, dass jedes Land eine Winterspitze hat.

Kurven der Südhalbkugel werden nur dann um ein halbes Jahr verschoben, wenn das Diagramm ihre saisonale Form mit nördlichen Ländern vergleicht. Ihre Produktionskurven behalten ihre echte Kalenderphase.

Diese Wortwahl von mir verrät eine Annahme, die zwar naheliegt, aber falsch sein könnte: dass Veränderungen der Raten über ein Jahr überwiegend auf klimatischen Jahreszeiten beruhen. Theoretisch könnten sie etwas anderes widerspiegeln — denk an soziale Mechanismen wie den Ramadan oder an Datenartefakte wie verspätete Meldung von Sterbefällen, voreingestellte Sterbedaten und so weiter.

Zu verstehen, was Saisonalität verursacht, ist sehr interessant, aber für die Länder, von denen wir beobachtete saisonale Daten haben, nicht entscheidend. Was machen wir mit den anderen rund 100 Ländern, die nur eine jährliche Sterberate liefern?

Wenn mir Daten fehlen, die ich brauche, stelle ich mir immer die Frage: Gibt es Indikatoren für die gesuchten Daten, die leichter zu bekommen sind? Sind sie Ursachen des untersuchten Phänomens, Folgen davon, oder teilen sie mit unserem Gegenstand eine gemeinsame Ursache? In diesem Fall fallen mir ein paar ein, jeder mit eigenen Stärken und Schwächen.

[proxy ranking card]

Bevor wir uns auf einen festlegen, lohnt es sich zu sehen, was die _Stärke_ des saisonalen Ausschlags eines Landes tatsächlich abbildet — unter den Ländern, die bereits eine Kurve melden. Viele sind grob unimodal, während manche tropischen Klimata breitere oder mehrfache Regenzeit-Merkmale haben können. Die Amplitude ist trotzdem eine brauchbare erste Zusammenfassung — wie weit sich die Kurve von ihrem Jahresmittel entfernt — ohne zu behaupten, jede Form habe eine Winterspitze.

In den folgenden Diagrammen ist jeder Punkt ein Land mit beobachteten saisonalen Daten. Die y-Achse zeigt die Amplitude: Je höher ein Punkt liegt, desto größer der Unterschied der Sterblichkeit zwischen Sommer und Winter. Die x-Achse verortet die Länder auf jedem der vorgeschlagenen Indikatoren.

Die untere Achse zeigt den absoluten Breitengrad — wie weit ein Land vom Äquator entfernt ist. Punkte links sind tropisch, Punkte nahe dem rechten Rand liegen nahe den Polen.

[latitude scatter]

Wir sehen ein erwartetes Muster: Die Amplitude ist zwischen den Wendekreisen am niedrigsten, weil Länder dort keine astronomischen Jahreszeiten erleben. Und ein — zumindest für mich — unerwartetes: Oberhalb von 35° nimmt die Saisonalität ab, statt mit kälteren und längeren Wintern zu steigen. Eine mögliche Erklärung ist, dass Menschen ab einer bestimmten Schwelle verstehen, dass sie sich an den Winter anpassen müssen, und soziale, verhaltensbezogene und bauliche Anpassungen umsetzen. Dass Spanien mit seinem milderen Klima eine höhere Wintersterblichkeit zeigt als Schweden, würde in diese Richtung deuten.

Hier stecken wir alle Länder und Regionen in ihren jeweiligen Klimatopf. Wenn das ein guter Indikator sein soll, müssten die Punkte in jedem Klima eng beieinanderliegen.

[koppen scatter]

Nun, das ändert das Bild kaum. Wir bestätigen, dass es eine Korrelation gibt, dass die Saisonalität zwischen den Wendekreisen niedriger ist, und dass das Klima — genau wie der Breitengrad — die Saisonalität dort am besten vorhersagt, wo sie niedrig ist.

[pop65 scatter]

Wie viele ältere Menschen in einem Land leben, wirkt wie ein sehr schwacher Indikator. Ich sehe hier bloß eine Punktwolke. Möglicherweise, weil reichere Länder tendenziell ältere Bevölkerungen haben und das eine das andere aufhebt. Die Länder nach BIP pro Kopf einzufärben bestätigt das: Die Länder links sind heller (ärmer) als die Länder rechts.

[gdp scatter]

Mehr vom Gleichen. Es gibt keine sichtbare Korrelation zwischen dem Reichtum eines Landes und der Stärke, mit der die Jahreszeiten seine Sterblichkeit beeinflussen. Die Ursache ist wahrscheinlich dieselbe wie oben: Reichere Länder gleichen ihre Saisonalität mit stärkeren Gesundheitssystemen und besseren Anpassungen aus.

[neighbour scatter]

Und wie steht es mit Nachbarländern? Das ist besser. Hier gibt es eine starke Korrelation. Angrenzende Nachbarschaft ist der stärkste Indikator — der niedrigste mittlere Fehler, die höchste Korrelation und der einzige mit positiver Trennschärfe sowohl gegenüber der Mittelkurve als auch gegenüber dem Breitengrad. Breitengrad und Klimaklasse liegen dicht dahinter beieinander, wobei das Klima beim typischen Land knapp vor dem Breitengrad liegt.

:::accordion

## Wie die Indikatoren tatsächlich abschneiden · Auslassungswerte für alle fünf Indikatoren

Das sind Behauptungen über Fehler und Trennschärfe, also hier sind sie gemessen. Jedes Land, das eine Kurve meldet, wird der Reihe nach versteckt, aus jedem Indikator statt aus seinen eigenen Daten vorhergesagt und gegen die beobachtete Form bewertet.

[prediction comparison]

:::

## Und wie hat sich deine Reihung geschlagen?

Du hast die fünf in eine Reihenfolge gebracht, bevor irgendetwas davon auf dem Bildschirm war. Hier ist die Reihenfolge, die die Diagramme oben tatsächlich ergeben, und wo deine Schätzung dagegen gelandet ist.

[proxy scorecard]

## Angrenzende Regionen, nicht nur angrenzende Länder

Benachbarte Regionen innerhalb desselben Landes laufen noch enger miteinander als angrenzende Länder. Diese Übereinstimmung ist der Grund, warum die Rekonstruktion aus der nächstgelegenen Region jeden anderen Indikator auf Regionsebene schlägt. Zwei russische Regionen, Inguschetien und Tschukotka, hatten unbrauchbare rohe Wochendaten — Wochen mit Rate null oder übermäßiges Spitzenrauschen — und werden aus dem Durchschnitt ihrer nächsten brauchbaren Nachbarn geschätzt, statt unverändert gezeigt oder verworfen zu werden.

[region neighbour scatter]

:::accordion

## Dieselbe Prüfung über Regionen · Mittlerer Fehler über 297 Admin-1-Regionen

[region prediction comparison]

:::

## Amplitude nach Land und Region

[amplitude map]

Jedes dargestellte Land und jede Region ist nach saisonaler Amplitude eingefärbt. Beobachtungen nutzen ihre gemessenen Kurven; Ziele ohne Beobachtungen nutzen den zugewiesenen Klima-, Nachbar- oder Breitengradindikator.

### conflicts · Ein Krieg ist kein Poisson-Prozess [Konflikte] · #eeb87d

Die bisherigen Ebenen erfassen langfristige Sterblichkeitstrends, die den größten Teil der Todesfälle weltweit ausmachen. Wollen wir aber die aktuelle Sterblichkeit zeigen, müssen wir feinkörnigere Faktoren berücksichtigen, und der größte davon sind Konflikte. ACLED erfasst jedes gemeldete Ereignis politischer Gewalt mit Ort und Zahl der Todesopfer und liefert tägliche Aktualisierungen.

Bei allen anderen Ebenen haben wir die zugrunde liegende rohe Sterberate mit einem Saisonalitäts- oder Dichtefaktor multipliziert. Hier aber bekommen wir tägliche — gestrige — beobachtete oder sehr kurzfristig geschätzte Zahlen echter Sterbefälle. Was ist also unser Faktor?

Wir bilden einen nach Aktualität gewichteten Durchschnitt, um die heutige Sterblichkeit vorherzusagen. Konkret nutzen wir einen robusten exponentiell gewichteten gleitenden Mittelwert (Robust EWMA). Das heißt so viel wie: _nutze jüngere Tage stärker als ältere, aber dämpfe verdächtig extreme Werte, bevor du mittelst_.

Zum Beispiel:

In den letzten 7 Tagen haben wir folgende Zahlen:

| Tag        |   1 |   2 |   3 |   4 |   5 |   6 |   7 |
| ---------- | --: | --: | --: | --: | --: | --: | --: |
| Todesopfer |  20 |  22 |  21 |  90 |  24 |  26 |  28 |

Wir berechnen das 10. und das 90. Perzentil.

| Perzentil | Grenze | Bedeutung                                        |
| --------- | -----: | ------------------------------------------------ |
| P10       |   20,6 | Etwa 10 % der Tage haben niedrigere Zahlen als diese. |
| P90       |   52,8 | Etwa 90 % der Tage haben niedrigere Zahlen als diese. |

Dann passen wir die Zahlen über und unter diesen Grenzen an:

| Tag | Ursprungswert | Gekappter Wert | Änderung          |
| --: | ------------: | -------------: | ----------------- |
|   1 |            20 |           20,6 | Auf P10 angehoben |
|   2 |            22 |             22 | Unverändert       |
|   3 |            21 |             21 | Unverändert       |
|   4 |            90 |           52,8 | Auf P90 gesenkt   |
|   5 |            24 |             24 | Unverändert       |
|   6 |            26 |             26 | Unverändert       |
|   7 |            28 |             28 | Unverändert       |

Für die Gewichte müssen wir eine Halbwertszeit wählen (wie viele Tage es dauert, bis sich der Einfluss eines Tages auf die endgültige Vorhersage halbiert). Am besten bestimmt man eine passende Halbwertszeit für eine gegebene Reihe, indem man verschiedene Werte ausprobiert und schaut, welche vergangene beobachtete Ereignisse aus den vorhergehenden am besten vorhersagen. Das machen wir nicht. Wir nehmen stattdessen 4, worauf ich mit etwas Ausprobieren gekommen bin.

Die Gewichte für eine Halbierung alle 4 Tage sehen also so aus:

| Tag | Gewicht | Anmerkung                     |
| --: | ------: | ----------------------------- |
|   1 |   0,354 |                               |
|   2 |   0,420 |                               |
|   3 |   0,500 |                               |
|   4 |   0,595 |                               |
|   5 |   0,707 |                               |
|   6 |   0,841 |                               |
|   7 |   1,000 | Gestern / der jüngste Tag     |

Dann bilden wir mit diesen Gewichten einen gewichteten Durchschnitt. Das ergibt 28,4.

Beide Entscheidungen — wie schnell der Einfluss eines Tages abklingt und wie stark die Extreme hereingezogen werden, bevor überhaupt gemittelt wird — sind meine, nicht die der Daten. Also hier sind sie als zwei Regler, über den echten letzten zwei Wochen. Zieh daran und sieh zu, wie sich der letzte Balken bewegt: Das ist die Zahl, gegen die der Globus heute feuert.

[widget to update half life, curve smoothness, and see prediction]

[map of conflict fatalities]

### who · Wer · #d9dbdd · chapter

:::chapter-sub
Jedes Aufblitzen bekommt einen Satz, gezogen aus der Verteilung des Ortes, an dem es gefeuert hat.
:::

# Alter, dann Geschlecht, dann eine Ursache

**Alter und Geschlecht** stammen aus der UN-Tabelle der Sterbefälle nach Alter und Geschlecht aus den World Population Prospects. Die **Ursache** stammt aus der Global Burden of Disease des IHME, aufgefächert auf ihre Level-3-Ursachen — die wiedererkennbaren — und reduziert auf die acht stärksten je Land, Geschlecht und Altersgruppe, wobei alles Übrige zu „andere Ursachen" zusammengefasst wird.

Sie werden **in dieser Reihenfolge** gezogen, sodass eine Ursache immer nur aus der Alters- und Geschlechtsgruppe kommt, die plausibel daran stirbt. Zieh die Ursache zuerst, und du bekommst Zwanzigjährige mit Demenz.

Beide Tabellen liegen als JSON im Repository, der Feed braucht also keinen API-Aufruf zur Laufzeit und liest sich offline genauso. Die Global Burden of Disease hat überhaupt keine API mit Token — ihre Tabelle wird einmal von Hand aus dem Ergebniswerkzeug exportiert und eingecheckt.

[sampling order]

[deaths by age and cause]

[what the clock got wrong]

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
