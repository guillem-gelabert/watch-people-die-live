# Roadmap

_← Back to the globe_

### ● 1 · Global Death Rate

> Source: World Bank crude death rate by country (derived from UN World Population Prospects).

Do you want to know how many people die in a second worldwide? Let's ask the machine.

```
Q: How many people die every second?
A: Roughly 2 people diec every second globally
```

The problem is that that's not true. Or not completely true. The truth behind this statement is that for the last couple years we've observed between 60 million to 63 million people died every year, worldwide. A year has 1'314'000 second (60 seconds x 60 minutes x 365 days). If we divide the number of seconds in a year by the number of defuncitions in a year it certainly gives ~2 deaths/second. But that's just on average, on a yearly average.

[blinking dot every 500ms]

In reality there's a big chance that during any given second nobody dies, because deaths don't happen on a steady rhythm. In fact, if deaths where randomly distributed accross the year there would only be a one in three chance that two people died any given second, the same chances of only one person dying on a given second.

[chart showing how many days in a year what number of people would die]

```
lambda = 2

for k = 0 to 7:
    probability[k] = exp(-lambda) * lambda^k / factorial(k)
    days[k] = 365 * probability[k]

probability[8+] = 1 - sum(probability[0..7])
days[8+] = 365 * probability[8+]
```

So, how many people die on a given second? Our new (better) answer is: if people die randomly around the year, probably somewhere _between 0 and 4_ (with a ~95% certainty). This dot behaves in this way.

[blinking dot randomly blinking]

Of course, people dying at a random frequency is a big assumptions, but now that we're at it let's also assume that they die at random places.

[map with random dots at random places]

### ● 2 · Death Rate By Country

> Source: World Bank crude death rate by country (derived from UN World Population Prospects).

The timing of when people die might be harder to improve. As to where, it's much easier as many countries report their Crude Death Rate by year —how many defunctions they registered in a year. Not all of them do, and virtually all of them overcount or undercount some deaths.

Luckily the WHO has some very smart people working on it and providing good estimates. Even if imperfect the mortality rates by country will be a huge upgrade from rendering random points wherever, with equal chances of it being in Mexico or Lithuania, Togo or the Antartica, on land or in the middle of the ocean.

Now each country fires deaths at its own real annual rate instead of the flat global
average — populous countries pulse far more often than sparse ones.

[chart cdr per country]

### ● 3 · Population Density

> Source: Gridded Population of the World v4 (GPWv4, CIESIN), aggregated to a 0.5° density grid.

Not having deads pop up in the middle of the ocean is neat. And seeing the popping dots on the countries they should be is also a greate improvement. But if you look carefully, you'll notice that the dots appear always exactly in the center of a given country. Sometimes that's in an inhabited or even inhabitable part of the country. According to the current simulation, all deaths in Russia happen in Lake Vivi, 400 kilometers away from the closest hospital. But we know, that people tend to die where people tend to be, so let's apply a density map to our calculation. This way, the dots will have bigger chances to appear where there's more people and little chances of appearing at unpopulated areas.

Small problem though: the density map is a grid of ~55 km wide cells (0.5°), it's pixelated, so to speak. But country borders aren't pixelated (colonialism got close but not quite), they often follow rivers, mountains or the sea.

[Benelux Westafrika maps density/borders]

The way we go around this is by converting every source, every complexity layer to a grid. And we assign each pixel to whichever country has the most population in that specific cell.

This map is cheating a little bit: it uses a logarithmic scale. Otherwise you wouldn't see much. The fact is that the earth, even the land, is mostly empty. _Toggle between log and linear scale to see how empty it is*. On a linear scale you barely see anything else than a dozen megacities and some shading around the Indo-Gangetic Plain (the region south of the Himalayas that's home of one-seventh of the world's population).

Now our dots appear mostly in cities and in very popolous areas.

[density map with dots in log]

### ● 4 · Death Rate By Region

> Source: IHME Global Burden of Disease 2023 (all-cause crude death rate) worldwide, and Eurostat 2023 NUTS-2 rates across Europe, joined to Natural Earth and GISCO regions.

A single national rate hides enormous internal spread. In Japan, rural **Akita** dies at
nearly twice the rate of **Tokyo**; in the US, **West Virginia** runs well above
**Utah**; in Europe, north-west **Bulgaria** and eastern Germany far exceed **Ireland**
or the Nordic capitals. Most of the gap is age structure — older regions bury more of
their people each year — layered over real differences in health, poverty, and access to care.

An illustrative example of how big the age structure of a place is to it's CDR is that of Mexico and Lithuania. In 2000, both countries had life expectancy around 72 years, but Mexico's crude death rate was about 4 per 1,000, while Lithuania's was about 11 per 1,000. Same life expectancy, almost 3× crude death rate difference.

### ● 5 · Death Rate By Time Of Year

> Source: UN Demographic Yearbook monthly deaths, with a latitude-scaled fallback for countries without monthly reports.

From a timing perspective, we're still at the same place that we were at the beginning. Dots still appear at random moments. This looks definitely better than having regular intervals like a metronome, but it's not closer to reality. Randomness feels more organic, but we're striving for something more than feeling.

Do we have something better than random? Yes, at least for some countries, that provide monthly or even weekly CDR numbers. Mortality rates on a given month in a given country vary from year to year, but not by much. Actually, it is quite easy to draw a curve, showing at which time of the year people die less or more. And the data is not only consistent from year to year but also between countries.

:::chart-copy

Add or remove any country with a directly-measured curve to compare.

:::

[similar curves chart]

In this chart a factor above 1 means deaths fire faster than the annual average, and a factor below 1 means they fire slower. Some countries have flatter curves, others have steeper ones, but they all follow a very similar pattern: winter is significantly more deadly than summer. As the song says _Summertime, and the livin’ is easy_.

Again, I've done a little trickery here and I've only chosen countries in the northern hemisphere. In the south hemisphere the curve would have been the opposite, as winter and summer are swapped relative to the northern hemisphere. And another thing, I've only chosen countries that are quite far from the tropics. As the further from the equator we get, the less noticeable are the seasons.

These choices on my wording reveal an assumption that, even if quite obvious, could be flawed: that change in rates over a one year are mostly based on climatic seasons. In theory they could reflect something different: think social mechanisms like Ramadan or data artifacts like late reporting of defunctions, default defunctin dates,...

Trying to understanding what causes seasonality is very interesting, but it isn't critical for the countries from which we have observed seasonal data, but what do we do with the other ~100 countries that only provide yearly CDR?

When I'm missing the data I need I always ask the question: are there any proxies to the data I'm looking for, that are easier to get? Are they causes of the phenomenon we study, consequences of it, or do they share a common cause with our subject?

In this case I can think of a couple proxies, each with its own strengths and weaknesses:

:::proxy-grid

:::proxy-card

## GDP per capita

As flawed as GDP is, it is an surprisingly effective predictor of quality-of-life metrics (child mortality, average number of teeth, homicide rates,...) and it's easily available for any year and country. We could apply the average seasonality factor of countries with a similar GDP per capita to a country without its own sub-year data.

:::

:::proxy-card

## Neighbouring countries

Geographic proximity could reflect multiple factors at once, that have an impact on seasonality. Take the Golf countries, an average donnor country there would be rich, of Muslim majority and have a very similar climate. Italy and Switzerland have comparable health infrastructure, similarly developed insitutions and are very close in longitude (same time of sunrise and sunset) and in latitude (same climatic seasons). Some problems: there are also some cases where neighbouring countries have big differences; there are some clusters of countries without any direct neighbour countries with seasonal data.

:::

:::proxy-card

## Climatic Zone

If our assumption is true, this would help us group seasonality by similar climate. Climatic Classifications group regions by similar temperature and humidity values in a simlar periodicity. The data is not trivial to get —there are many different classifications— and apply to our mortality numbers. Furthermore, we have the risk of choosing a classification model zones that are too big, grouping very different countries; or too small, rendering zones with no donor countries (countries with observed seasonal data) from which to take the data from.

:::

:::proxy-card

## Latitude

That was my first intuition, and it is actually a second degree proxy that derives climate from latitude, which is readliy available for every point on earth. Nevertheless, if we take a look at e.g. Lisbon and Beijing —both around the 125° parallel— we can see that extremly different climates can coexist in a single latitude: Lisbon has a mild winter and a moderately dry summer while Beijing registers temperatures of −27 degrees during its very dry winter and has a very hot and humid monsoonal summer.

:::

:::proxy-card

## Share of population over 65

Viral infections have seasonal patterns and older people are more vulnerable to those. In summer, they are more at risk of a heat caused death. We could expect that places with an older population experience stronger seasonality. On the other hand, countries with older populations are often richer and therefore tend to have better health access.

:::

:::

Before committing to one, it's worth seeing what actually tracks the _strength_ of a country's seasonal swing among the countries that already report a curve. Each dot is one of those countries, plotted by its measured amplitude against three candidate signals — latitude, climate zone, GDP, and how old its population is.

Seasonal curves are mostly unimodal, roughly sinusoidal curves. Which means that they peak once a year and rise and fall in a smooth, wave-like pattern. For these kind of curves most differenciating characteristic is amplitude: how far the peak is from the trough. We can look at how the proxies match the observed curves' amplitudes.

The following charts show all the countries for which we have seasonal data. The y-axis shows the amplitude: the higher a dot is, the more difference in mortality there's that country between summer and winter. The x-axis will place countries on each of the proposed proxies.

:::chart-copy

Here the bottom axis shows the absolute latitude; in other words how far a country is from the equator. Countries at the left of the chart are tropical and countries close to the right edge of the chart are countries near the poles. I've coloured each country according to which climatic zone they belong, to see if the correlation is stronger or weaker in certain climates. I've also added a shaded band covering one SD to see where latitude the strongest correlation shows.

We see an expected pattern: amplitude is the lowest between the tropics, as countries there don't experience astronomical seasons. And an —at least for me— unexpected one: above 35° seasonality decreases, instead of keeping raising because of colder and longer winters. A possible explanation is that above a certain threshold people understand that they should adapt to winter and implement social, behavioral, and housing adaptations. That Spain (with a more temperate climate) shows higher mortality in winter than Sweden would point in this direction. [note: Another factor that could cause this are that most countries closer to the pole happen to be relatively rich countries (Canada, Scandinavia, baltic countries, Russia)]

:::

[amplitude by latitude scatter]

:::chart-copy

Looking at it by climatic zone doesn't change much the picture. We confirm that there's a correlation, that seasonality is lower between the tropics and that climate (just as latitude) best predicts seasonality where seasonality is low.

:::

[amplitude by climate zone scatter]

:::chart-copy

How many older people live in a country seem like a very poor proxy. I just see a cloud of dots here. Possibly because richer countries tend to have older populations and one thing offsets the other. Colouring the countries by GDP per capita confirms this.

:::

[amplitude by age over 65 scatter]

:::chart-copy

More or the same. There's no visible correlation with how rich a country is (as GDP per capita) and how strong their mortality is affected by the seasons. The cause is probably the same as above, richer countries offset their seasonality with stronger health systems and better adaptations.

:::

[amplitude by gdp pc scatter]

:::chart-copy

How about neighbouring countries? That's better. There's a strong correlation here.

:::

[amplitude by neighbouring countries scatter]

Temperature ties the last two together: it is the physical thing latitude and climate were standing in for. See it directly: pick any country below and its seasonal mortality curve tracks its monthly temperature, inverted, almost line for line.

[temperature vs mortality chart]

But a proxy is only worth using if it can actually stand in for a missing curve, so the real test is this: hide a country that _does_ report one, rebuild its curve from each proxy as if it were missing, and see which reconstruction lands closest to the truth.

:::chart-copy

For countries that _do_ report a curve, hold each one out and rebuild it from every proxy as if it were missing, then compare the reconstructions to the measured curve. These six pin down where each method works and where it fails. **Top row** — the country where each proxy reconstructs the curve _best_: its (highlighted) line lands on the red measured curve. **Bottom row** — where each proxy does _worst_: its line pulls away while the others stay closer.

:::

[prediction comparison chart]

Run that leave-one-out test across every reporting country and average the error within latitude bands, and temperature's advantage turns out to be uneven: it pulls clearly ahead in the tropics and at the poles, while across the broad middle latitudes latitude alone is already about as good.

:::chart-copy

The same held-out test, averaged within latitude bands. Temperature's edge over latitude concentrates in the tropics and at the poles; across the broad middle latitudes the two are close, because there latitude alone already captures the winter swing. Each panel shares a y-scale, so the tropics' flatter seasonality reads against the sharper mid-latitude curves.

:::

[climate zone curves]

**Seasonal Mortality Amplitude (Unified)** — Every country with a measured curve, colored by its own seasonal amplitude. Grey still means no direct data.

**Amplitude By Country** — Every rendered country is colored by seasonal amplitude:
observed curves where available, and the fitted latitude fallback everywhere else.
Borders are removed so the map reads as a continuous amplitude surface.

### ● 6 · Ongoing Conflicts

> Source: [ACLED](https://acleddata.com) (Armed Conflict Location & Event Data), fatalities over the trailing 12 months, refreshed daily via the `/api/conflicts` route. Academic / non-commercial use.

Conflicts increase mortality in specific regions by a measurable amount. ACLED records every reported political-violence event with a location and a fatality count. Summing those fatalities over the last twelve months and snapping them onto the same 0.5° grid the globe already samples turns "conflict" from an abstraction into extra weight in the exact cells where people are actually dying — so today's front lines fire faster than their peacetime death rate alone would.

[conflict fatalities map]

I fold the fatalities in flat rather than through the seasonal curve — a war doesn't wait for winter — and only into cells that already have a population, so every dot still belongs to a real country. The pull runs at request time and refreshes about once a day, so the layer tracks conflicts as they escalate and fade without me rebuilding anything.

### ○ 7 · Ongoing Epidemics

> Source: TBD

Epidemics raise mortality in specific regions and periods by a measurable amount.

### ○ 8 · Death Rate By Time Of Day

> Source: TBD

Timing shifts by hour for causes with circadian patterns, such as cardiovascular events and injuries.

---

The globe is statistical, not a feed of individual records. A flash and persona should be
read as a representative event drawn from public aggregate data, never as an identifiable
death.

_This is a personal project exploring statistical mortality visualization._
