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

Crec que la majoria de la gent no s'esgarrifaria del nostre model temporal, però el model espacial fa mal de mirar. La major part dels punts col·locats aleatòriament (~71%) cauen a l'oceà, perquè aquesta és la [proporció de la superfície de la Terra coberta d'aigua](https://oceanservice.noaa.gov/facts/oceanwater.html). Els que cauen a terra ferma cauen aclaparadorament en zones sense cap assentament humà permanent (deserts, boscos…). Classifico aquests punts contra la [graella de densitat de població GPWv4](https://sedac.ciesin.columbia.edu/data/set/gpw-v4-population-density-rev11) que fa servir el model.

[ocean uninhabited inhabited tally]

Podem estar d'acord que, si el nostre objectiu és un model de mortalitat acurat, hauria de ser molt millor que això. Potser, en comptes de fer servir les xifres de mortalitat globals, podríem fer servir dades a escala de país. La bona notícia és que el [Banc Mundial publica estimacions de la taxa bruta de mortalitat](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN) (quantes persones moren en un any per cada 1.000 habitants). La mala notícia és que molts països no faciliten aquestes dades, i que pràcticament tots els que sí que ho fan compten de més o de menys algunes defuncions.

Encara que siguin imperfectes, les taxes de mortalitat per país seran una millora enorme respecte a col·locar punts sense tenir en compte on viu la gent.

[chart cdr per country]

### where-country · Un país no és una mitjana [On - taxa per país] · #f6c58f

Que no apareguin morts al mig de l'oceà està bé. I veure els punts sortint als països on toca també és una gran millora. Però si mires amb atenció, veuràs que els punts apareixen sempre exactament al centre de cada país. De vegades això és en una part deshabitada o fins i tot inhabitable del país. Segons la simulació actual, totes les morts de Rússia passen al [llac Vivi](https://rgo.ru/activity/redaction/news/pamyatnyy-znak-geograficheskiy-tsentr-rossiyskoy-federatsii-v-evenkii-budet-obnovlyen/), a uns 400 quilòmetres de l'hospital més proper: un [estudi regional](https://elib.sfu-kras.ru/bitstream/handle/2311/28186/shatunov_a_0.pdf?isAllowed=y&sequence=2) situa el llac a 366 quilòmetres de Tura i identifica l'hospital de districte central de la vila. Però sabem que la gent tendeix a morir on tendeix a haver-hi gent, així que apliquem un mapa de densitat al càlcul. D'aquesta manera, els punts tindran més probabilitats d'aparèixer on hi ha més gent i poques d'aparèixer en zones despoblades.

Un petit problema, però: el mapa de densitat és una graella de cel·les d'uns 55 km d'amplada (0,5°), està pixelat, per dir-ho així. Però les fronteres dels països no estan pixelades (el colonialisme s'hi va acostar, però no del tot), sovint segueixen rius, muntanyes o el mar.

[Benelux Westafrika maps density/borders]

La manera com ho resolem és convertint cada font, cada capa de complexitat, en una graella. I assignem cada píxel al país que hi té més població en aquella cel·la concreta.

Aquest mapa fa una mica de trampa: per defecte fa servir una escala logarítmica. Altrament no hi veuries gran cosa. El fet és que la Terra, fins i tot la part de terra ferma, és majoritàriament buida. _Canvia entre escala logarítmica i lineal per veure com de buida és._

[density map asia]

En escala lineal amb prou feines veus res més que una dotzena de megaciutats i una mica d'ombreig al voltant de la plana indogangètica (la regió al sud de l'Himàlaia que [acull una setena part de la població mundial](https://pmc.ncbi.nlm.nih.gov/articles/PMC7125076/)).

Ara els nostres punts apareixen sobretot a les ciutats i a les zones molt poblades.

### where-region · TBM per regió [On - TBM per regió] · #e7e9e4

Una única taxa nacional amaga una dispersió interna enorme. Al Japó, l'Akita rural mor a gairebé el doble de la taxa de Tòquio; als Estats Units, Virgínia de l'Oest queda molt per sobre d'Utah; a Europa, el nord-oest de Bulgària i l'est d'Alemanya superen de bon tros Irlanda o les capitals nòrdiques. [La major part de la diferència és l'estructura d'edat](https://ec.europa.eu/eurostat/cache/metadata/en/hlth_cdeath_sims.htm) (les regions més envellides enterren més gent cada any), superposada a diferències reals de salut, pobresa i accés a l'atenció mèdica. La [taula oficial de 2023 del Japó](https://www.ipss.go.jp/syoushika/tohkei/Data/Popular2025/T12-26.files/sheet001.htm) situa les taxes brutes en 19,3 per 1.000 a Akita i 10,2 a Tòquio; després d'estandarditzar per edat, s'acosten a 14,4 i 12,3.

Un exemple il·lustratiu de com de determinant és l'estructura d'edat d'un lloc per a la seva TBM és el de Mèxic i Lituània. L'any 2000, tots dos països tenien una esperança de vida al voltant dels 72 anys, però la taxa bruta de mortalitat de Mèxic era d'uns 4 per 1.000, mentre que la de Lituània era d'uns 11 per 1.000. La mateixa esperança de vida, gairebé el triple de taxa bruta de mortalitat.

Fonts: sèries del Banc Mundial d'[esperança de vida en néixer](https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=MX-LT&start=2000&end=2000) i de [taxa bruta de mortalitat](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN?locations=MX-LT&start=2000&end=2000).

[subnational choropleth]

### borders-wrong-unit · Les fronteres són la unitat equivocada [On - regió] · #a6d2f5

[national vs regional bars]

Font: [taxes brutes de mortalitat regionals d'Eurostat de 2023](https://ec.europa.eu/eurostat/databrowser/view/demo_r_gind3/default/table?lang=en).

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

Setmanal, mensual, trimestral: això és cada quant informa un país, i decideix quanta forma sobreviu. El suavitzat és un pas a part. Tria a sota un país que informi setmanalment per veure què conserva cada cadència, compara-ho amb la mitjana circular de tres mesos amb què funcionava abans el globus, i canvia la corba harmònica entre els ordres 1 i 4. El globus fa servir ara l'ordre 4.

[smoothing explainer]

Un factor per sobre d'1 vol dir que les morts es disparen més de pressa que la mitjana de l'any; per sota d'1, més a poc a poc. La corba que fa servir el globus és una regressió de Fourier d'ordre 4 agrupada sobre tots els anys complets sense COVID. Les observacions setmanals es queden setmanals, els recomptes es converteixen en una intensitat diària, i la corba ajustada dona un valor per a qualsevol dia de l'any, també els que ningú no ha informat.

La majoria de països temperats s'assemblen: l'hivern mata força més que l'estiu. Més a prop de l'equador la corba és més plana, o segueix l'estació de pluges i la seca en comptes de l'hivern i l'estiu. Per això el model harmònic no dona per fet cap pic d'hivern enlloc; s'ajusta a la forma que tinguin les dades.

Quan el gràfic posa els països de l'hemisferi sud al costat dels del nord, els desplaça mig any perquè les formes es puguin comparar. El globus no ho fa: allà, el juliol de Xile continua sent juliol.

Aquestes tries meves de vocabulari revelen una assumpció que, encara que sembli òbvia, podria ser errònia: que els canvis de les taxes al llarg de l'any es deuen sobretot a les estacions climàtiques. En teoria podrien reflectir una altra cosa: pensa en mecanismes socials com el Ramadà o en artefactes de dades com el registre tardà de defuncions, les dates de defunció per defecte, i coses així.

Intentar entendre què causa l'estacionalitat és molt interessant, però no és crític per als països dels quals tenim dades estacionals observades. Què fem amb els altres ~100 països que només faciliten la TBM anual?

Quan em falten les dades que necessito sempre em faig la pregunta: hi ha algun indicador indirecte de les dades que busco que sigui més fàcil d'aconseguir? Són causes del fenomen que estudiem, conseqüències seves, o comparteixen una causa comuna amb el nostre tema? En aquest cas se me'n poden acudir uns quants, cadascun amb els seus punts forts i febles.

[proxy ranking card]

Abans de comprometre'ns amb un, val la pena veure què segueix realment la _força_ de l'oscil·lació estacional d'un país entre els països que ja declaren una corba. Moltes són més o menys unimodals, mentre que alguns climes tropicals poden tenir trets més amples o múltiples de temporada de pluges. L'amplitud continua sent un bon primer resum (com de lluny es mou la corba respecte a la seva mitjana anual), sense pretendre que tota forma tingui un únic pic d'hivern.

En els gràfics que segueixen, cada punt és un país amb dades estacionals observades. L'eix y mostra l'amplitud: com més amunt és un punt, més gran és la diferència de mortalitat entre estiu i hivern. L'eix x situa els països en cadascun dels indicadors proposats.

L'eix inferior mostra la latitud absoluta, com de lluny és un país de l'equador. Els punts de l'esquerra són tropicals, els punts a prop de la vora dreta són a prop dels pols.

[latitude scatter]

Veiem un patró esperat: l'amplitud és mínima entre els tròpics, perquè allà els països no experimenten estacions astronòmiques. I un altre d'inesperat (si més no per a mi): per sobre dels 35° l'estacionalitat disminueix, en comptes d'enfilar-se amb hiverns més freds i més llargs. Una explicació possible és que a partir d'un cert llindar la gent entén que s'ha d'adaptar a l'hivern i implementa adaptacions socials, de conducta i d'habitatge. Que Espanya, amb un clima més temperat, mostri una mortalitat hivernal més alta que Suècia apuntaria en aquesta direcció.

Aquí posem tots els països i regions al seu respectiu calaix climàtic. Si això ha de ser un bon indicador, hauríem de veure que els punts de cada clima estan agrupats.

[koppen scatter]

Doncs bé, això no canvia gaire el panorama. Confirmem que hi ha correlació, que l'estacionalitat és més baixa entre els tròpics, i que el clima, igual que la latitud, prediu millor l'estacionalitat allà on l'estacionalitat és baixa.

[pop65 scatter]

Quanta gent gran viu en un país sembla un indicador molt pobre. Aquí només hi veig un núvol de punts. Possiblement perquè els països més rics tendeixen a tenir poblacions més envellides i una cosa compensa l'altra. Ombrejar els països pel PIB per capita ho confirma: els països de l'esquerra són més clars (més pobres) que els de la dreta.

[gdp scatter]

Més del mateix. No hi ha cap correlació visible entre com de ric és un país i com de fort afecten les estacions la seva mortalitat. La causa és probablement la mateixa que abans: els països rics compensen la seva estacionalitat amb sistemes sanitaris més forts i millors adaptacions.

[neighbour scatter]

I els països veïns? Això va millor. Aquí hi ha una correlació forta. De tot el que he provat amb els països que tenen corba mesurada, manllevar dels veïns fronterers guanya: l'error mitjà més baix, la correlació més alta, i l'únic mètode que supera alhora el llindar de la corba mitjana i la latitud. La latitud i la classe climàtica queden just darrere, amb el clima lleugerament per davant de la latitud en el país típic.

:::accordion

## Com puntuen realment els indicadors · Puntuacions de validació creuada per als cinc indicadors

Acabo de fer afirmacions sobre error i capacitat predictiva, així que aquí hi ha la mesura. Amago cada país que declara una corba, el predic amb cada mètode com si no tingués dades, i puntuo la predicció contra la forma real. En aquests gràfics, l'amplitud és la desviació quadràtica mitjana de la corba ajustada respecte a la seva mitjana anual.

[prediction comparison]

:::

## Doncs com ha anat la teva classificació?

La classificació preguntava quin indicador segueix la mida de l'oscil·lació d'un país. La prova de deixar-ne un fora pregunta una altra cosa: fins a quin punt reconstrueix cada mètode la corba sencera quan l'amago? Si has ordenat els cinc abans dels gràfics, aquí és on ha quedat la teva aposta.

[proxy scorecard]

## Regions frontereres, no només països fronterers

Les regions veïnes dins d'un mateix país es segueixen encara més de prop que els països veïns, i per això la reconstrucció a partir de la regió més propera supera qualsevol altre indicador a escala regional. Dues regions russes, Ingúixia i Txukotka, tenien dades setmanals brutes que no podia fer servir (setmanes amb zero morts, o pics massa grans per ser reals), així que en comptes de mostrar-les tal qual o descartar-les les he omplert amb la mitjana dels seus veïns bons més propers.

[region neighbour scatter]

:::accordion

## La mateixa prova sobre regions · Error mitjà en 297 regions Admin-1

[region prediction comparison]

:::

## On cauen les morts de més, mes a mes

[amplitude map]

Cada quadrat és mig grau de la mateixa graella que mostreja el globus, acolorit per les morts que l'estació d'aquest mes afegeix, o treu, a un mes ordinari d'allà. Arrossega per l'any i els hemisferis es bescanvien: el superàvit de gener a Europa és el dèficit de gener al sud d'Àfrica, i al juliol s'han intercanviat.

La textura que veus dins d'un país és població. Només deu països tenen corbes regionals mesurades, i en aquest marc això es redueix a Sud-àfrica, la Rússia occidental i l'Índia i la Xina modelades pel clima; Europa no en té cap. A tota la resta, totes les cel·les d'un país comparteixen una sola corba, i els contorns et diuen a quina unitat pertany: continus quan algú hi ha comptat morts, discontinus quan l'he reconstruït a partir d'un veí, d'una classe climàtica o d'una latitud. Dins d'una d'aquestes fronteres, el que canvia d'una cel·la a l'altra és quanta gent hi viu. Quan mor és igual a tot arreu.

### conflicts · Una guerra no és un procés de Poisson [Conflictes] · #eeb87d

Tot el que hem vist fins ara és mortalitat lenta: les tendències a llarg termini que expliquen la major part de les morts del món. Però hi ha morts que no segueixen cap tendència, i el grup més gran són les guerres. [ACLED publica agregats setmanals](https://acleddata.com/use-access/how-use-acleds-aggregated-data) de morts declarades en conflictes, clavats als centroides de cada país i de cada regió Admin-1. ACLED suma els esdeveniments de cada setmana al centre d'una província; no diu on ha passat cadascun.

Totes les altres capes fins ara eren un factor pel qual multiplicàvem la taxa bruta de mortalitat: la densitat, l'estació. Aquesta és un recompte. Tenim 12 setmanes completes declarades, que acaben en la data de publicació més antiga que comparteixen les sis regions d'ACLED. Així doncs, quanta gent mor a les guerres en una setmana qualsevol d'ara mateix?

Faig una mitjana ponderada que es refia més de les setmanes recents que de les antigues i que aixafa els extrems abans de fer la mitjana. Això té nom: mitjana mòbil robusta ponderada exponencialment, Robust EWMA. Una setmana boja no pot moure gaire l'estimació. La contrapartida: quan una guerra empitjora de cop, l'estimació va endarrerida.

Aquí ho tens amb set setmanes inventades (l'estimació real en fa servir 12; amb set l'aritmètica és més curta).

| Setmana |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
| ----- | --: | --: | --: | --: | --: | --: | --: |
| Morts |  20 |  22 |  21 |  90 |  24 |  26 |  28 |

Primer, els percentils 10 i 90.

| Percentil | Límit | Significat                                       |
| --------- | ----: | ------------------------------------------------ |
| P10       |  20,6 | Al voltant del 10% de les setmanes tenen xifres més baixes. |
| P90       |  52,8 | Al voltant del 90% de les setmanes tenen xifres més baixes. |

Tot el que queda fora s'arrossega cap endins:

| Setmana | Valor original | Valor retallat | Canvi          |
| --: | -------------: | -------------: | -------------- |
|   1 |             20 |           20,6 | Pujat a P10    |
|   2 |             22 |             22 | Sense canvis   |
|   3 |             21 |             21 | Sense canvis   |
|   4 |             90 |           52,8 | Baixat a P90   |
|   5 |             24 |             24 | Sense canvis   |
|   6 |             26 |             26 | Sense canvis   |
|   7 |             28 |             28 | Sense canvis   |

Després, els pesos. Surten d'una semivida: quantes setmanes passen fins que una setmana compta la meitat del que comptava. No l'he ajustada (caldria una validació en condicions); el globus fa servir quatre setmanes.

Amb una semivida de quatre setmanes els pesos són:

| Setmana | Pes    | Nota                        |
| --: | -----: | --------------------------- |
|   1 |  0,354 |                             |
|   2 |  0,420 |                             |
|   3 |  0,500 |                             |
|   4 |  0,595 |                             |
|   5 |  0,707 |                             |
|   6 |  0,841 |                             |
|   7 |  1,000 | Setmana completa més recent |

Mitjana ponderada dels valors retallats: 28,4. La mitjana simple de les xifres brutes és 33, estirada cap amunt per aquella setmana de 90.

Tots dos comandaments (com de ràpid s'esvaeix una setmana, com de fort s'arrosseguen els extrems cap endins) són tries meves; les dades no les han triat. El globus sempre fa anar el valor per defecte, quatre setmanes i P10–P90, després reparteix el resultat entre les regions Admin-1 segons la part de cadascuna en les morts de les 12 setmanes, i l'anualitza. Els controls de sota et deixen veure què donarien altres ajustos. Moure'ls no toca el globus.

[widget to update half life, curve smoothness, and see prediction]

[map of conflict fatalities]

El mapa mostra les mateixes 12 setmanes de morts als centroides Admin-1 d'ACLED. Al globus, cada centroide salta a la cel·la poblada més propera del mateix país, perquè un punt no pugui caure en un desert buit només perquè allà hi ha el centre de la província.

### who · Qui · #d9dbdd · chapter

:::chapter-sub
Cada llampec rep una frase, treta de la distribució del lloc on s'ha disparat.
:::

# Sexe, edat, després causa

L'edat i el sexe surten de la taula de defuncions per edat i sexe de les Perspectives de la Població Mundial de l'ONU, xifres de 2023. La causa surt de les [Estimacions Sanitàries Mundials de l'OMS](https://www.who.int/data/global-health-estimates/), l'edició GHE 2021 publicada el 2024. En faig servir les estimacions de 2019, l'últim any abans de la pandèmia, perquè no vull que la COVID-19 es dibuixi com la manera ordinària de morir. Per a cada país, sexe i franja d'edat em quedo les vuit causes reconeixibles més freqüents i plego la resta a «altres causes».

No trec l'edat, el sexe i la causa per separat. Primer el sexe i l'edat, després la causa de la distribució d'aquell grup. Altrament tindríem combinacions que les dades d'origen gairebé mai no mostren.

Totes dues taules ([edat i sexe](/data/mortality-age-sex.json), [causa](/data/causes.json)) s'inclouen com a JSON al repositori, així que el flux no fa cap crida a una API en temps d'execució i es llegeix igual sense connexió. La taula de causes venia abans de l'Estudi de la Càrrega Global de Malaltia de l'IHME, que vaig haver d'exportar a mà d'una eina de resultats que amaga cada descàrrega darrere d'un compte i la limita a cent mil files. La taula de l'OMS és una petició i cap compte. Això és bona part del motiu que sigui la que hi ha aquí.

Baixar la causa per sota del país vol dir tornar a l'IHME, i tornar a aquell límit. L'exportació subnacional són 723 llocs × 22 franges d'edat × dos sexes × 22 grups de causes: set-centes mil files, o vuit descàrregues, contra una quota que es gasta per edició i no es recupera mai. Així que vaig ordenar les vuit per quantes morts porta cadascuna, en comptes de l'ordre en què l'eina les llista. La quota es va acabar després de la primera.

Aquella descàrrega conté les malalties cardiovasculars, els càncers i les malalties respiratòries cròniques, el 55% de totes les morts, a resolució regional. En l'ordre propi de l'eina, la mateixa descàrrega n'hauria contingut aproximadament una desena part. Ara ja és al flux. Fins on arriba? Hi actuen dues fraccions. Les regions cobreixen el **44,6%** de les morts que es dibuixen; els tres grups són el **55,0%** de les causes. La regió només decideix allà on es compleixen totes dues, així que el **24,5% de totes les tries de causa** ara es mouen amb el lloc en comptes del país. La resta conserven la barreja nacional.

El que sap el flux, en proporció de les morts que dibuixa:

| Capa                   | Resolta des de la regió | Derivada | Nacional |
| ---------------------- | ----------------------: | -------: | -------: |
| Edat i sexe            |                   44,6% |    51,8% |     3,6% |
| Causa, aquests 3 grups |                   44,6% |        — |    55,4% |
| Causa, els altres 19   |                       — |        — |     100% |

La reponderació és una raó. Vint-i-dos grups clínics no poden carregar vuitanta-set causes amb nom, així que mai no demano al GBD que anomeni res. Per a cada regió, franja d'edat i sexe dona un nombre per grup: la proporció de morts d'aquell grup allà, dividida per la seva proporció nacional. Les etiquetes de l'OMS de dins del grup es multipliquen per aquest nombre. Tot el que queda fora dels tres grups es mou plegat amb el romanent, de manera que els tres no es poden inflar en silenci.

Falten tres coses, i cap no és petita. Dinou dels vint-i-dos grups no tenen cap dada regional: set descàrregues que encara em deu una quota que no s'ha recuperat. El 55% de les morts passen fora de les 474 regions (tota la Xina entre elles, que aquí no té unitats subnacionals) i treuen una barreja de causes nacional. I disset de les regions són ciutats massa petites perquè una cel·la de mig grau les hi pugui adjudicar. Delhi, Osaka, el Gran Londres, Ciutat de Mèxic, Jakarta, Manila i onze més no guanyen cap cel·la pròpia, així que les seves morts es dibuixen amb la barreja de la regió del voltant. Això és el 2,6% de les morts de dins de les regions. La culpa és de la graella; les dades estan bé.

[sampling order]

# Després el mes ho decanta

L'època de l'any també canvia l'edat i la causa que traiem. Estimo aquests canvis a partir dels registres que tinc, i després presto els patrons als països que no en tenen. Aquest préstec és una de les parts més fluixes del model.

L'edat i la causa fan servir registres diferents. Les corbes d'edat es mesuren a partir dels [registres setmanals d'Eurostat](https://ec.europa.eu/eurostat/cache/metadata/en/demomwk_esms.htm) de 24 països europeus. Les corbes de causa surten dels registres mensuals de defuncions del [sistema de mortalitat DATASUS del Brasil](https://datasus.saude.gov.br/informacoes-de-saude-tabnet/) i de la [Secretaría de Salud de Mèxic](https://www.datos.gob.mx/dataset/registro_defunciones), les dues fonts de país d'aquí les microdades de les quals porten data i causa alhora. Totes dues s'ajusten com a corbes harmòniques contínues d'ordre 4. Els dotze valors mensuals del gràfic són instantànies d'aquestes corbes; el que el model guarda és la corba mateixa.

Els països sense aquests registres manlleven a través de la mateixa cascada de donants que el temps: mitjanes regionals, països veïns, clima, latitud. Les nou franges d'edat tenen corbes mesurades als 24 països d'origen. La causa és més irregular: 55 de les 87 etiquetes manlleven la corba del seu capítol de la CIM-10, i les altres 32 les deixo planes, multiplicades per u. La més gran d'aquestes és «altres causes» mateixa, el sac on la retallada a les vuit més fortes escombra tota la resta, típicament un terç del pes a les franges adultes i fins a la meitat. L'he deixada plana a posta. És un munt de morts sense relació entre si i sense cap capítol propi, i donar-li la corba de la mort mitjana seria afirmar una forma que no he mesurat mai.

En el moment de mostrejar, aquests multiplicadors canvien els pesos condicionals d'edat i causa, que després es normalitzen plegats. Cada corba fa de mitjana u al llarg de l'any, però això sol no garanteix que cada categoria conservi exactament la seva proporció anual un cop combinats els pesos.

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

### back-to-the-globe · Tornar al globus · #000000 · hidden

:::end-block

# Ara ja saps què volen dir els llampecs.

Torna-hi i mira'ls una altra vegada. Es llegeix diferent.

:::end-fine
El globus és estadístic, no és un flux de registres individuals. Un llampec i la seva persona són un esdeveniment representatiu extret de dades agregades públiques, mai una mort identificable. Un projecte personal que explora la visualització estadística de la mortalitat.
:::

[pull up for the globe]

:::
$$
