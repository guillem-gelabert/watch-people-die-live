# Watch People Die Live

<!-- La versió catalana de la història. L'estructura ha de ser idèntica a la de ROADMAP.md:
       ### <clau> · <Títol> · <#cel>
     La clau és allò contra el que es registren les figures i NO es tradueix mai, igual que
     els marcadors entre claudàtors com [density map asia]. El color del cel també és el mateix
     a totes les llengües. L'ordre d'aquest fitxer és l'ordre a la pantalla. -->

### first-light · Primera llum · #2b1c3a · hidden

Vols saber quanta gent mor cada segon al món? Preguntem-ho a la màquina.

```
Q: Quanta gent mor cada segon?
A: Aproximadament 2 persones moren cada segon al món
```

El problema és que això no és cert — o no del tot. Els darrers anys hem observat entre 60 i 63 milions de defuncions l'any a tot el món. Un any té 31.536.000 segons, i dividint una xifra per l'altra surten unes dues morts per segon. Però això és una mitjana anual, i una mort no té res de mitjana.

[blinking dot every 500ms]

En realitat hi ha moltes possibilitats que en un segon qualsevol no mori ningú, perquè les morts no segueixen un ritme constant. De fet, si les morts es distribuïssin aleatòriament al llarg de l'any amb la mitjana anual observada, hi hauria un 27% de probabilitats que morissin exactament dues persones en un segon determinat — i aproximadament les mateixes que en morís exactament una.

[blinking dot randomly blinking]

Aleshores, quanta gent mor en un segon donat? La nostra nova resposta (millor) és: _si_ la gent mor {{aleatòriament}} al llarg de l'any, probablement entre 0 i 4 (amb una certesa del ~95%).

:::rand-modal

## Què vols dir amb aleatòriament?

Aquell 27%, i cada bloc del gràfic de més avall, surt directament de la funció de massa de probabilitat de Poisson — la manera estàndard de modelar un recompte d'esdeveniments aleatoris independents (aquí, defuncions) en una finestra fixa (aquí, un segon) quan només en coneixes la taxa mitjana. La mitjana anual observada es converteix primer en una mitjana per segon:

$$ Taxa per segon
\lambda_{\text{second}} = \dfrac{61{,}600{,}000}{365.25 \times 24 \times 60 \times 60} \approx 1.95
$$ Una mitjana anual d'uns 61,6 milions de defuncions.

$$ Funció de massa de probabilitat de Poisson
P(X = k) = \dfrac{e^{-\lambda_{\text{second}}}\lambda_{\text{second}}^k}{k!}
$$ Executa-la per a cada _k_ per obtenir la proporció de segons que contenen _k_ morts; cinc o més s'agrupen en un darrer bloc.

_e_ i _k_! no són arbitraris — tots dos surten de mirar què està passant realment dins d'aquell segon. Talla el segon en un nombre enorme d'instants minúsculs, cadascun amb la seva petita probabilitat independent de contenir una mort. _e_^-λ és el resultat de compondre aquella minúscula probabilitat de fallar per tots els instants — literalment el mateix procés límit que defineix el nombre d'Euler. La part λ^_k_ compta els _k_ instants que sí que van tenir una mort, un factor de la taxa per encert; dividir per _k_! esborra després l'ordre, perquè només ens importa que hi hagi hagut _k_ morts en algun punt del segon, no en quins _k_ dels incomptables instants van caure.

:::

### where-global · On [On - taxa global] · #e8956d · chapter

Vam fer una suposició atrevida en cronometrar els esdeveniments: que passaven aleatòriament. Com veurem, això és lluny de la veritat i mirarem de millorar el nostre model temporal. Tot i així, serem igual d'ingenus amb el nostre primer model espacial: les morts passaran en moments aleatoris i en llocs aleatoris.

[map with random dots at random places]

Crec que la majoria de la gent no s'esgarrifaria del nostre model temporal, però el model espacial fa mal de mirar. La major part dels punts col·locats aleatòriament (~71%) cauen a l'oceà, perquè aquesta és la proporció de la Terra coberta d'aigua. Els que cauen a terra ferma cauen aclaparadorament en zones sense cap assentament humà permanent (deserts, boscos…).

[ocean uninhabited inhabited tally]

Podem estar d'acord que, si el nostre objectiu és un model de defuncions acurat, hauria de ser molt millor que això. Potser, en comptes de fer servir les xifres de mortalitat globals, podríem fer servir dades a escala de país. La bona notícia és que molts països declaren la seva taxa bruta de mortalitat —quantes persones moren en un any per cada 100.000 habitants—. La mala notícia és que molts no faciliten aquestes dades, i que pràcticament tots els que sí que ho fan compten de més o de menys algunes defuncions.

Per sort, l'OMS té gent molt intel·ligent treballant-hi i proporcionant bones estimacions. Encara que siguin imperfectes, les taxes de mortalitat per país seran una millora enorme respecte a dibuixar punts aleatoris arreu, amb la mateixa probabilitat de caure a Mèxic o a Lituània, al Togo o a l'Antàrtida, a terra o al mig de l'oceà.

[chart cdr per country]

### where-country · Un país no és una mitjana [On - taxa per país] · #f6c58f

Que no apareguin morts al mig de l'oceà està bé. I veure els punts sortint als països on toca també és una gran millora. Però si mires amb atenció, veuràs que els punts apareixen sempre exactament al centre de cada país. De vegades això és en una part deshabitada o fins i tot inhabitable del país. Segons la simulació actual, totes les morts de Rússia passen al llac Vivi, a 400 quilòmetres de l'hospital més proper. Però sabem que la gent tendeix a morir on tendeix a haver-hi gent, així que apliquem un mapa de densitat al càlcul. D'aquesta manera, els punts tindran més probabilitats d'aparèixer on hi ha més gent i poques d'aparèixer en zones despoblades.

Un petit problema, però: el mapa de densitat és una graella de cel·les d'uns 55 km d'amplada (0,5°), està pixelat, per dir-ho així. Però les fronteres dels països no estan pixelades (el colonialisme s'hi va acostar, però no del tot), sovint segueixen rius, muntanyes o el mar.

[Benelux Westafrika maps density/borders]

La manera com ho resolem és convertint cada font, cada capa de complexitat, en una graella. I assignem cada píxel al país que hi té més població en aquella cel·la concreta.

Aquest mapa fa una mica de trampa: per defecte fa servir una escala logarítmica. Altrament no hi veuries gran cosa. El fet és que la Terra, fins i tot la part de terra ferma, és majoritàriament buida. _Canvia entre escala logarítmica i lineal per veure com de buida és._

[density map asia]

En escala lineal amb prou feines veus res més que una dotzena de megaciutats i una mica d'ombreig al voltant de la plana indogangètica (la regió al sud de l'Himàlaia que acull una setena part de la població mundial).

Ara els nostres punts apareixen sobretot a les ciutats i a les zones molt poblades.

### where-region · TBM per regió [On - TBM per regió] · #e7e9e4

Una única taxa nacional amaga una dispersió interna enorme. Al Japó, l'Akita rural mor a gairebé el doble de la taxa de Tòquio; als Estats Units, Virgínia de l'Oest queda molt per sobre d'Utah; a Europa, el nord-oest de Bulgària i l'est d'Alemanya superen de bon tros Irlanda o les capitals nòrdiques. La major part de la diferència és l'estructura d'edat — les regions més envellides enterren més gent cada any — superposada a diferències reals de salut, pobresa i accés a l'atenció mèdica.

Un exemple il·lustratiu de com de determinant és l'estructura d'edat d'un lloc per a la seva TBM és el de Mèxic i Lituània. L'any 2000, tots dos països tenien una esperança de vida al voltant dels 72 anys, però la taxa bruta de mortalitat de Mèxic era d'uns 4 per 1.000, mentre que la de Lituània era d'uns 11 per 1.000. La mateixa esperança de vida, gairebé el triple de taxa bruta de mortalitat.

[subnational choropleth]

### borders-wrong-unit · Les fronteres són la unitat equivocada [On - regió] · #a6d2f5

[national vs regional bars]

### when-seasonality · Quan [Quan - estacionalitat] · #bcd8ee · chapter

:::chapter-sub
L'única capa que encara es recalcula al teu navegador, perquè és l'única que canvia mentre mires.
:::

# Taxa de mortalitat segons l'època de l'any

Des del punt de vista temporal, som al mateix lloc que al principi. Els punts encara apareixen en moments aleatoris. Això té millor aspecte que uns intervals regulars com els d'un metrònom, però no és més a prop de la realitat. L'atzar sembla més orgànic, però busquem alguna cosa més que una sensació.

Tenim res millor que l'atzar? Sí, com a mínim per a alguns països, els que faciliten xifres de TBM mensuals o fins i tot setmanals. Les taxes de mortalitat d'un mes concret en un país concret varien d'un any a l'altre, però no gaire. De fet, és força fàcil dibuixar una corba que mostra en quin moment de l'any mor menys gent o més. I les dades no només són consistents d'un any a l'altre sinó també entre països.

## Un grup de corbes semblants

Afegeix o treu qualsevol país amb una corba mesurada directament per comparar.

[seasonality curves]

## De les observacions a un multiplicador continu

Setmanal, mensual i trimestral descriuen amb quina freqüència arriben les observacions. No són mètodes de suavitzat. Tria qualsevol país amb observacions setmanals que passi el control de qualitat per veure què conserva cada cadència, compara l'antiga mitjana circular de tres mesos i commuta entre els ordres 1–4 de la corba harmònica contínua. L'ordre 4 és el model que fa servir ara el globus.

[smoothing explainer]

En aquests gràfics, un factor per sobre d'1 vol dir que les morts es disparen més ràpid que la mitjana anual, i un factor per sota d'1 vol dir que ho fan més lentament. La corba de producció és una regressió de Fourier d'ordre 4 agrupada sobre tots els anys complets no COVID: les observacions setmanals es queden setmanals, els recomptes es converteixen en intensitat diària, i el resultat es pot avaluar de manera contínua en qualsevol dia de l'any.

Molts països temperats segueixen un patró semblant: l'hivern és significativament més mortal que l'estiu. A prop de l'equador el senyal anual sol ser més pla o segueix les estacions plujoses i seques en comptes d'un contrast hivern/estiu, de manera que el model harmònic no assumeix que tots els països tinguin un pic d'hivern.

Les corbes de l'hemisferi sud només es desplacen mig any quan el gràfic compara la seva forma estacional amb la de països del nord. Les seves corbes de producció mantenen la fase de calendari real.

Aquestes tries meves de vocabulari revelen una assumpció que, encara que sembli òbvia, podria ser errònia: que els canvis de les taxes al llarg de l'any es deuen sobretot a les estacions climàtiques. En teoria podrien reflectir una altra cosa: pensa en mecanismes socials com el Ramadà o en artefactes de dades com el registre tardà de defuncions, les dates de defunció per defecte, i coses així.

Intentar entendre què causa l'estacionalitat és molt interessant, però no és crític per als països dels quals tenim dades estacionals observades. Què fem amb els altres ~100 països que només faciliten la TBM anual?

Quan em falten les dades que necessito sempre em faig la pregunta: hi ha algun indicador indirecte de les dades que busco que sigui més fàcil d'aconseguir? Són causes del fenomen que estudiem, conseqüències seves, o comparteixen una causa comuna amb el nostre tema? En aquest cas se me'n poden acudir uns quants, cadascun amb els seus punts forts i febles.

[proxy ranking card]

Abans de comprometre'ns amb un, val la pena veure què segueix realment la _força_ de l'oscil·lació estacional d'un país entre els països que ja declaren una corba. Moltes són més o menys unimodals, mentre que alguns climes tropicals poden tenir trets més amples o múltiples de temporada de pluges. L'amplitud continua sent un bon primer resum — com de lluny es mou la corba respecte a la seva mitjana anual — sense pretendre que tota forma tingui un únic pic d'hivern.

En els gràfics que segueixen, cada punt és un país amb dades estacionals observades. L'eix y mostra l'amplitud: com més amunt és un punt, més gran és la diferència de mortalitat entre estiu i hivern. L'eix x situa els països en cadascun dels indicadors proposats.

L'eix inferior mostra la latitud absoluta — com de lluny és un país de l'equador. Els punts de l'esquerra són tropicals, els punts a prop de la vora dreta són a prop dels pols.

[latitude scatter]

Veiem un patró esperat: l'amplitud és mínima entre els tròpics, perquè allà els països no experimenten estacions astronòmiques. I un altre — si més no per a mi — inesperat: per sobre dels 35° l'estacionalitat disminueix, en comptes d'enfilar-se amb hiverns més freds i més llargs. Una explicació possible és que a partir d'un cert llindar la gent entén que s'ha d'adaptar a l'hivern i implementa adaptacions socials, de conducta i d'habitatge. Que Espanya, amb un clima més temperat, mostri una mortalitat hivernal més alta que Suècia apuntaria en aquesta direcció.

Aquí posem tots els països i regions al seu respectiu calaix climàtic. Si això ha de ser un bon indicador, hauríem de veure que els punts de cada clima estan agrupats.

[koppen scatter]

Doncs bé, això no canvia gaire el panorama. Confirmem que hi ha correlació, que l'estacionalitat és més baixa entre els tròpics, i que el clima — igual que la latitud — prediu millor l'estacionalitat allà on l'estacionalitat és baixa.

[pop65 scatter]

Quanta gent gran viu en un país sembla un indicador molt pobre. Aquí només hi veig un núvol de punts. Possiblement perquè els països més rics tendeixen a tenir poblacions més envellides i una cosa compensa l'altra. Ombrejar els països pel PIB per capita ho confirma: els països de l'esquerra són més clars (més pobres) que els de la dreta.

[gdp scatter]

Més del mateix. No hi ha cap correlació visible entre com de ric és un país i com de fort afecten les estacions la seva mortalitat. La causa és probablement la mateixa que abans: els països rics compensen la seva estacionalitat amb sistemes sanitaris més forts i millors adaptacions.

[neighbour scatter]

I els països veïns? Això va millor. Aquí hi ha una correlació forta. L'adjacència amb veïns fronterers és l'indicador més fort — l'error mitjà més baix, la correlació més alta, i l'únic amb capacitat predictiva positiva tant contra el llindar de la corba mitjana com contra la latitud. La latitud i la classe climàtica queden juntes just darrere, amb el clima superant la latitud en el país típic.

:::accordion

## Com puntuen realment els indicadors · Puntuacions de validació creuada per als cinc indicadors

Aquestes són afirmacions sobre error i capacitat predictiva, així que aquí les tens mesurades. Cada país que declara una corba s'amaga per torns, es prediu a partir de cada indicador en comptes de les seves pròpies dades, i es puntua contra la forma observada.

[prediction comparison]

:::

## Doncs com ha anat la teva classificació?

Has posat els cinc en un ordre abans que res d'això fos a la pantalla. Aquest és l'ordre que produeixen realment els gràfics de més amunt, i on ha quedat la teva proposta.

[proxy scorecard]

## Regions frontereres, no només països fronterers

Les regions adjacents dins d'un mateix país es corresponen encara més estretament que els països fronterers. Aquesta coincidència és el motiu pel qual la reconstrucció a partir de la regió més propera supera qualsevol altre indicador a escala regional. Dues regions russes, Ingúixia i Txukotka, tenien dades setmanals brutes inservibles — setmanes amb taxa zero o soroll excessiu de pics — i s'imputen a partir de la mitjana dels seus millors veïns propers en comptes de mostrar-se tal qual o descartar-se.

[region neighbour scatter]

:::accordion

## La mateixa prova sobre regions · Error mitjà en 297 regions Admin-1

[region prediction comparison]

:::

## Amplitud per país i per regió

[amplitude map]

Cada país i regió representats estan acolorits per amplitud estacional. Les observacions fan servir les seves corbes mesurades; els objectius sense observacions fan servir l'indicador de clima, veí o latitud que se'ls hagi assignat.

### conflicts · Una guerra no és un procés de Poisson [Conflictes] · #eeb87d

Les capes anteriors capturen tendències de mortalitat a llarg termini, que expliquen la major part de les morts al món. Però la mortalitat actual també necessita factors de gra més fi, i el més gran són els conflictes. El canal en temps real d'ACLED per a recerca publica agregats setmanals per país i Admin-1 amb morts i coordenades del centroide regional. Aquests centroides són una aproximació, no ubicacions d'esdeveniments individuals.

Per a totes les altres capes multiplicàvem la taxa bruta de mortalitat base per un factor d'estacionalitat o de densitat. Aquí obtenim 12 setmanes completes declarades, acabades en la data de publicació més antiga compartida per les sis regions d'ACLED. Quin és, doncs, el factor per a la setmana actual?

Fem una mitjana ponderada per recència per estimar la mortalitat de la setmana actual. Concretament fem servir una mitjana mòbil robusta ponderada exponencialment (Robust EWMA): _dona més pes a les setmanes recents que a les antigues, però esmorteeix els valors sospitosament extrems abans de fer la mitjana_.

Per exemple:

Prenem set setmanes de la finestra de 12:

| Setmana |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
| ----- | --: | --: | --: | --: | --: | --: | --: |
| Morts |  20 |  22 |  21 |  90 |  24 |  26 |  28 |

Calculem els percentils 10 i 90.

| Percentil | Límit | Significat                                       |
| --------- | ----: | ------------------------------------------------ |
| P10       |  20,6 | Al voltant del 10% de les setmanes tenen xifres més baixes. |
| P90       |  52,8 | Al voltant del 90% de les setmanes tenen xifres més baixes. |

Després actualitzem les xifres per sobre i per sota d'aquests límits:

| Setmana | Valor original | Valor retallat | Canvi          |
| --: | -------------: | -------------: | -------------- |
|   1 |             20 |           20,6 | Pujat a P10    |
|   2 |             22 |             22 | Sense canvis   |
|   3 |             21 |             21 | Sense canvis   |
|   4 |             90 |           52,8 | Baixat a P90   |
|   5 |             24 |             24 | Sense canvis   |
|   6 |             26 |             26 | Sense canvis   |
|   7 |             28 |             28 | Sense canvis   |

Per calcular els pesos triem una semivida: quantes setmanes triga a reduir-se a la meitat l'impacte d'una setmana en l'estimació final. Ajustar-la exigiria una validació més llarga; aquí el valor predeterminat de producció és quatre setmanes.

Així que els pesos per reduir l'impacte a la meitat cada quatre setmanes queden així:

| Setmana | Pes    | Nota                        |
| --: | -----: | --------------------------- |
|   1 |  0,354 |                             |
|   2 |  0,420 |                             |
|   3 |  0,500 |                             |
|   4 |  0,595 |                             |
|   5 |  0,707 |                             |
|   6 |  0,841 |                             |
|   7 |  1,000 | Setmana completa més recent |

Després fem una mitjana ponderada amb aquests pesos. Que ens dona 28,4.

Totes dues tries — com de ràpid decau la influència d'una setmana i com de fort s'arrosseguen cap endins els extrems — són meves, no de les dades. El globus sempre fa servir el resultat predeterminat de quatre setmanes i P10–P90, distribuït segons la proporció de morts de cada regió Admin-1 dins les 12 setmanes i anualitzat. Els controls són una demostració contrafactual; moure'ls no canvia el globus.

[widget to update half life, curve smoothness, and see prediction]

[map of conflict fatalities]

El mapa mostra les morts de les mateixes 12 setmanes completes als centroides Admin-1 d'ACLED. Per al globus, cada centroide s'assigna a la cel·la poblada més propera dins del mateix país.

### who · Qui · #d9dbdd · chapter

:::chapter-sub
Cada llampec rep una frase, treta de la distribució del lloc on s'ha disparat.
:::

# Edat, després sexe, després una causa

**L'edat i el sexe** surten de la taula de defuncions per edat i sexe de les Perspectives de la Població Mundial de l'ONU. La **causa** surt de l'Estudi de la Càrrega Global de Malaltia de l'IHME, ampliada a les seves causes de nivell 3 — les reconeixibles — i reduïda a les vuit més fortes per país, sexe i franja d'edat, amb tota la resta plegada en «altres causes».

Es mostregen **en aquest ordre**, de manera que una causa només es treu de la franja d'edat i sexe que plausiblement en mor. Treu la causa primer i tens vint-i-cinc-anyencs amb demència.

Totes dues taules s'inclouen com a JSON al repositori, així que el flux no necessita cap crida a una API en temps d'execució i es llegeix igual sense connexió. L'Estudi de la Càrrega Global de Malaltia no té cap API amb testimoni: la seva taula s'exporta un cop a mà des de l'eina de resultats i es puja al repositori.

[sampling order]

[deaths by age and cause]

### still-missing · Què falta encara [Falta encara] · #cf7a68 · chapter-small

:::chapter-sub
Capes amb un lloc clar al model i sense cap font prou bona per omplir-lo.
:::

:::accordion

## Epidèmies en curs · Previst · font per decidir

Les epidèmies eleven la mortalitat en regions i períodes concrets en una quantitat mesurable. Les estimacions d'excés de mortalitat són la mesura adequada i arriben mesos tard; els sistemes de vigilància de brots arriben ràpid i reporten casos, no morts. Fins que no hi hagi res que s'actualitzi més ràpid que el model mateix, una capa d'epidèmies seria ficció disfressada de dades.

## Hora del dia · Necessita una corba publicada

Les morts es concentren a la matinada, i el globus ja sap l'hora local de cada cel·la — el punt subsolar l'il·lumina. La capa s'enxufaria als pesos sense canviar gens el temps d'execució. El que falta és una corba que valgui la pena endollar-hi.

## Estructura d'edat subnacional · Parcialment disponible

Les persones que apareixen fan servir ara una distribució d'edat nacional, així que una mort en una província rural espanyola rep el mateix sorteig d'edat que una a Madrid. Les piràmides d'edat regionals existeixen per a Europa i afinarien el flux considerablement; a la resta del món són el mateix problema de mosaic que les taxes regionals.

:::

### back-to-the-globe · Tornar al globus · #0c223f · hidden

:::end-block

# Ara ja saps què volen dir els llampecs.

Torna-hi i mira'ls una altra vegada. Es llegeix diferent.

:::end-fine
El globus és estadístic, no és un flux de registres individuals. Un llampec i la seva persona són un esdeveniment representatiu extret de dades agregades públiques, mai una mort identificable. Un projecte personal que explora la visualització estadística de la mortalitat.
:::

[pull up for the globe]

:::
$$
