# Watch People Die Live

<!-- The whole story lives here. Each section is declared as:
       ### <key> · <Label> · <#sky>
     The key is what section components register their figures against, the label is the
     on-screen chapter title, and the sky is the colour the section's entire palette is
     generated from. Order in this file is order on screen. -->

### first-light · First light · #2b1c3a

> Source: World Bank crude death rate by country (derived from UN World Population Prospects).

Do you want to know how many people die in a second worldwide? Let's ask the machine.

```
Q: How many people die every second?
A: Roughly 2 people die every second globally
```

The problem is that that is not true — or not completely true. For the last couple of years we have observed between 60 and 63 million deaths a year, worldwide. A year has 31,536,000 seconds, and dividing one by the other gives about two deaths a second. But that is a yearly average, and nothing about a death is average.

[blinking dot every 500ms]

In reality there's a big chance that during any given second nobody dies, because deaths don't happen on a steady rhythm. In fact, if deaths were randomly distributed across the year at the observed annual average, there would be about a 27% chance that exactly two people died in any given second — and roughly the same chance that exactly one person died in that second.

[chart showing 365 sampled one-second intervals]

That 27% figure, and every column in the chart above, comes straight out of the Poisson probability mass function — the standard way to model a count of independent random events (here, deaths) over a fixed window (here, one second) when you only know the average rate. The observed annual average is first converted into a per-second average:

$$ Per-second rate
\lambda_{\text{second}} = \dfrac{61{,}600{,}000}{365.25 \times 24 \times 60 \times 60} \approx 1.95
$$

$$ Poisson probability mass function
P(X = k) = \dfrac{e^{-\lambda_{\text{second}}}\lambda_{\text{second}}^k}{k!}
$$

_e_ and _k_! aren't arbitrary — each falls out of picturing what's actually happening underneath the second. Slice that second into an enormous number of tiny instants, each with its own tiny, independent chance of holding a death. _e_^-λ is what "none of those instants got a death" collapses to once you compound that tiny miss-chance across all of them — literally the same limiting process that defines Euler's number in the first place. The λ^_k_ half counts the _k_ instants that did land a death, one factor of the rate per hit; dividing by _k_! then erases the ordering, since we only care that _k_ deaths happened somewhere in the second, not which _k_ of the countless instants they fell on. Run it for each _k_ to get the share of seconds holding _k_ deaths; five or more are grouped into one last block.

So, how many people die on a given second? Our new (better) answer is: if people die randomly around the year, probably somewhere _between 0 and 4_ (with a ~95% certainty).

[blinking dot randomly blinking]

That dot isn't rolling the day-count dice above once and spreading the result out evenly — it needs to know the exact wait until the next death, moment to moment. That's a different (but related) formula: the gap between two consecutive events in a Poisson process follows an exponential distribution, sampled here by inverting its CDF:

$$ Exponential inter-arrival time
T = -\mu \ln(1 - U), \qquad U \sim \text{Uniform}(0, 1)
$$

Here _U_ is a fresh random number between 0 and 1, and μ (mu) is the mean gap — the average time between deaths, currently ~512ms at the real global rate of ~1.95 deaths/second. Draw a gap, wait that long, blink, draw the next gap, repeat — that's the formula timing every randomly-blinking dot and every randomly-placed map on this page.

### where-global · Where · #e8956d

> Source: World Bank crude death rate by country (derived from UN World Population Prospects).

We made a bold assumption when timing the events, that they happened randomly. As we will see this is far from the truth and we'll try improving our timing model. Nevertheless, we'll be equally naive for our first spatial distribution model: deaths will happen at random times and at random places.

I think most people wouldn't get triggered by our timing model, but our spatial model is painful to watch. Most randomly placed dots (~71%) fall in the ocean, as this is the proportion of earth that's covered in water. The dots falling on land fall overwhelmingly on areas without any permanent human settlements — deserts, forests, ice.

[map with random dots at random places]

We can agree that if our goal is an accurate mortality model it should be way better than that. Maybe instead of using the global numbers we could use country-level data. The good news is that many countries report their Crude Death Rate — how many people die in a year for every 100,000 inhabitants. The bad news is that many don't, and virtually all the ones that do overcount or undercount some deaths.

Luckily the WHO has some very smart people working on it and providing good estimates. Even if imperfect, the mortality rates by country are a huge upgrade from rendering random points wherever, with equal chances of it being in Mexico or Lithuania, Togo or Antarctica, on land or in the middle of the ocean.

Now each country fires deaths at its own real annual rate instead of the flat global average — populous countries pulse far more often than sparse ones.

[chart cdr per country]

### where-country · A country is not an average · #f6c58f

> Source: Gridded Population of the World v4 (GPWv4, CIESIN), aggregated to a 0.5° density grid.

Not having deaths pop up in the middle of the ocean is neat. And seeing the popping dots on the countries they should be on is also a great improvement. But if you look carefully, you'll notice that the dots appear always exactly in the centre of a given country. Sometimes that's in an uninhabited or even uninhabitable part of the country. According to the current simulation, all deaths in Russia happen in Lake Vivi, 400 kilometres away from the closest hospital.

But we know that people tend to die where people tend to be, so let's apply a density map to our calculation. This way, the dots will have bigger chances to appear where there's more people and little chances of appearing at unpopulated areas.

Small problem though: the density map is a grid of ~55 km wide cells (0.5°), it's pixelated, so to speak. But country borders aren't pixelated (colonialism got close but not quite), they often follow rivers, mountains or the sea.

[Benelux Westafrika maps density/borders]

The way we go around this is by converting every source, every complexity layer, to a grid. And we assign each pixel to whichever country has the most population in that specific cell.

This map is cheating a little bit: it uses a logarithmic scale. Otherwise you wouldn't see much. The fact is that the earth, even the land, is mostly empty. _Toggle between log and linear scale to see how empty it is._ On a linear scale you barely see anything else than a dozen megacities and some shading around the Indo-Gangetic Plain, the region south of the Himalayas that is home to one-seventh of the world's population.

[density map with dots in log]

Now our dots appear mostly in cities and in very populous areas.

### where-region · CDR by region · #e7e9e4

> Source: IHME Global Burden of Disease 2023 (all-cause crude death rate) worldwide, and Eurostat 2023 NUTS-2 rates across Europe, joined to Natural Earth and GISCO regions.

A single national rate hides enormous internal spread. In Japan, rural **Akita** dies at nearly twice the rate of **Tokyo**; in the US, **West Virginia** runs well above **Utah**; in Europe, north-west **Bulgaria** and eastern Germany far exceed **Ireland** or the Nordic capitals. Most of the gap is age structure — older regions bury more of their people each year — layered over real differences in health, poverty, and access to care.

[subnational choropleth map]

An illustrative example of how big a part the age structure of a place plays in its CDR is that of Mexico and Lithuania. In 2000, both countries had life expectancy around 72 years, but Mexico's crude death rate was about 4 per 1,000, while Lithuania's was about 11 per 1,000. Same life expectancy, almost 3× crude death rate difference.

### borders-wrong-unit · Borders are the wrong unit · #a6d2f5

> Source: as above — Admin-1 and NUTS-2 regional rates against their own national figure.

The national rate is wrong for every single region it covers — too low for half of them and too high for the rest. A border is an administrative fact, not a mortality one: it groups a capital with the countryside that empties into it, and splits a shared climate and a shared health system down the middle.

That is the last thing the model can fix about _where_. From here the question stops being where a death happens and becomes when.

### when-seasonality · When · #bcd8ee

> Source: UN Demographic Yearbook, HMD STMF and World Mortality Dataset, with a quality-ranked climate, neighbouring-area or latitude proxy where no seasonal curve is observed.

This is the only layer still recomputed in your browser, because it is the only one that changes while you watch.

From a timing perspective, we're still at the same place that we were at the beginning. Dots still appear at random moments. This looks definitely better than having regular intervals like a metronome, but it's not closer to reality. Randomness feels more organic, but we're striving for something more than feeling.

Do we have something better than random? Yes, at least for some countries, that provide monthly or even weekly CDR numbers. Mortality rates on a given month in a given country vary from year to year, but not by much. Actually, it is quite easy to draw a curve, showing at which time of the year people die less or more. And the data is not only consistent from year to year but also between countries.

:::chart-copy

Add or remove any country with a directly-measured curve to compare.

:::

[similar curves chart]

In this chart a factor above 1 means deaths fire faster than the annual average, and a factor below 1 means they fire slower. Some countries have flatter curves, others have steeper ones, but they all follow a very similar pattern: winter is significantly more deadly than summer. As the song says, _Summertime, and the livin' is easy_.

Again, I've done a little trickery here and I've only chosen countries in the northern hemisphere. In the southern hemisphere the curve would have been the opposite, as winter and summer are swapped. And another thing, I've only chosen countries that are quite far from the tropics. The further from the equator we get, the more noticeable the seasons.

These choices in my wording reveal an assumption that, even if quite obvious, could be flawed: that change in rates over a year is mostly driven by climatic seasons. In theory they could reflect something different — social mechanisms like Ramadan, or data artifacts like late reporting of deaths and default death dates.

Understanding what causes seasonality is very interesting, but it isn't critical for the countries from which we have observed seasonal data. What do we do with the other ~100 countries that only provide yearly CDR?

When I'm missing the data I need I always ask the question: are there any proxies to the data I'm looking for, that are easier to get? Are they causes of the phenomenon we study, consequences of it, or do they share a common cause with our subject?

In this case I can think of a couple of proxies, each with its own strengths and weaknesses:

:::proxy-grid

:::proxy-card

## GDP per capita

As flawed as GDP is, it is a surprisingly effective predictor of quality-of-life metrics (child mortality, average number of teeth, homicide rates) and it's easily available for any year and country. We could apply the average seasonality factor of countries with a similar GDP per capita to a country without its own sub-year data.

:::

:::proxy-card

## Neighbouring countries

Geographic proximity could reflect multiple factors at once. Take the Gulf countries: an average donor country there would be rich, of Muslim majority and have a very similar climate. Italy and Switzerland have comparable health infrastructure, similarly developed institutions and are very close in longitude and in latitude. Some problems: neighbouring countries sometimes differ sharply, and some clusters have no neighbour with seasonal data at all.

:::

:::proxy-card

## Climatic zone

If our assumption is true, this would help us group seasonality by similar climate. Climatic classifications group regions by similar temperature and humidity values in a similar periodicity. The data is not trivial to get — there are many different classifications — and to apply to our mortality numbers. Furthermore, we risk choosing a classification whose zones are too big, grouping very different countries, or too small, leaving zones with no donor countries to take data from.

:::

:::proxy-card

## Latitude

That was my first intuition, and it is actually a second-degree proxy that derives climate from latitude, which is readily available for every point on earth. Nevertheless, if we take a look at Lisbon and Beijing — both around the same parallel — we can see that extremely different climates can coexist at a single latitude: Lisbon has a mild winter and a moderately dry summer while Beijing registers temperatures of −27 degrees during its very dry winter and has a very hot and humid monsoonal summer.

:::

:::proxy-card

## Share of population over 65

Viral infections have seasonal patterns and older people are more vulnerable to those. In summer, they are more at risk of a heat caused death. We could expect that places with an older population experience stronger seasonality. On the other hand, countries with older populations are often richer and therefore tend to have better health access.

:::

:::

Before committing to one, it's worth seeing what actually tracks the _strength_ of a country's seasonal swing among the countries that already report a curve. Each dot is one of those countries, plotted by its measured amplitude against the candidate signals — latitude, climate zone, GDP, and how old its population is.

Seasonal curves are mostly unimodal, roughly sinusoidal curves. Which means they peak once a year and rise and fall in a smooth, wave-like pattern. For these kinds of curves the most differentiating characteristic is amplitude: how far the peak is from the trough. We can look at how the proxies match the observed curves' amplitudes.

The following charts show all the countries for which we have seasonal data. The y-axis shows the amplitude: the higher a dot is, the more difference in mortality there is in that country between summer and winter. The x-axis places countries on each of the proposed proxies.

:::chart-panel.wide

## Latitude Correlation

Here the bottom axis shows the absolute latitude; in other words how far a country or individual region is from the equator. Points at the left of the chart are tropical and points close to the right edge are near the poles. Each country is a solid dot; each measured region is a hollow one. Region curves come from Admin-1 regions in Argentina, Australia, Brazil, Canada, Mexico, Russia, South Africa and the US, plus Buenos Aires province as measured by its own partido registry.

We see an expected pattern: amplitude is the lowest between the tropics, as countries there don't experience astronomical seasons. And an — at least for me — unexpected one: above 35° seasonality decreases, instead of continuing to rise with colder and longer winters. A possible explanation is that above a certain threshold people understand that they should adapt to winter and implement social, behavioural, and housing adaptations. That Spain, with a more temperate climate, shows higher mortality in winter than Sweden would point in this direction.

[latitude scatter chart]

:::

:::chart-panel.wide

## Amplitude by Climate Zone

Looking at it by climatic zone doesn't change the picture much. We confirm that there's a correlation, that seasonality is lower between the tropics, and that climate — just like latitude — best predicts seasonality where seasonality is low.

[amplitude by climate zone scatter]

:::

:::chart-panel.wide

## Amplitude vs. Population 65+

How many older people live in a country seems like a very poor proxy. I just see a cloud of dots here. Possibly because richer countries tend to have older populations and one thing offsets the other. Colouring the countries by GDP per capita confirms this: countries on the left are lighter (poorer) than countries on the right.

[amplitude by age over 65 scatter]

:::

:::chart-panel.wide

## Amplitude vs. GDP per Capita

More of the same. There's no visible correlation between how rich a country is and how strongly its mortality is affected by the seasons. The cause is probably the same as above: richer countries offset their seasonality with stronger health systems and better adaptations.

[amplitude by gdp pc scatter]

:::

:::chart-panel.wide

## Amplitude vs. Neighbouring Countries

How about neighbouring countries? That's better. There's a strong correlation here.

[amplitude by neighbouring countries scatter]

:::

[prediction comparison chart]

Bordering-neighbour adjacency is the strongest proxy — the lowest median error, the highest correlation, and the only one with positive skill against both the mean-curve floor and latitude. Latitude and climate class land close together just behind, with climate edging latitude on the typical country, and all three clear the mean-curve floor comfortably. For every country or region without its own curve, production applies the highest-quality available donor group after adjusting for history, cadence, climate specificity, coverage and distance.

:::chart-panel

## Bordering Regions, Not Just Bordering Countries

Adjacent regions inside the same country track each other even more tightly than bordering
countries do. That agreement is why the nearest-region reconstruction below beats every other
region-level proxy.

[region amplitude by neighbouring regions scatter]

:::

[region prediction comparison chart]

Two RusSTMF regions (Ingushetia, Chukotka) had unusable raw weekly data — zero-rate weeks or excessive spike noise — and are imputed from the average of their nearest good neighbours rather than shown as-is or dropped.

[amplitude map]

### who · Who · #d9dbdd

> Source: UN World Population Prospects (deaths by age and sex) and IHME Global Burden of Disease (level-3 causes). Both ship as JSON in the repository.

Every flash gets a sentence, drawn from the distribution of the place it fired in.

Age and sex come from the UN World Population Prospects table of deaths by age and sex. Cause comes from the IHME Global Burden of Disease, expanded to its level-3 causes — the recognisable ones — and reduced to the strongest eight per country, sex and age band, with everything else folded into "other causes".

They are sampled in that order, so a cause is only ever drawn from the age and sex band that plausibly dies of it. Draw the cause first and you get twenty-year-olds with dementia.

Both tables ship as JSON in the repository, so the feed needs no runtime API call and reads the same offline. The Global Burden of Disease has no tokened API at all — its table is exported once by hand from the results tool and committed.

### conflicts · Ongoing Conflicts · #eeb87d

> Source: [ACLED](https://acleddata.com) (Armed Conflict Location & Event Data), fatalities over the trailing 12 months, refreshed daily via the `/api/conflicts` route. Academic / non-commercial use.

The previous layers capture long term mortality trends, which account for most of the deaths worldwide. But if we want to show current mortality we need to take into account finer grain factors, the biggest one being conflicts. ACLED records every reported political-violence event with a location and a fatality count and provides updates on a daily basis.

For all other layers we multiplied the base Crude Death Rate by a seasonality or density factor. But here we get daily —yesterday's— observed or very short-term estimated numbers of real defunctions, so what's our factor?

We do a recency weighted average to predict today's mortality. Specifically we use a robust exponentially weighted moving average (Robust EWMA). Which means something like _use recent days more than older days, but dampen suspiciously extreme values before averaging_.

For example:

In the last 7 days, we've got the following numbers:

| Day        |   1 |   2 |   3 |   4 |   5 |   6 |   7 |
| ---------- | --: | --: | --: | --: | --: | --: | --: |
| Fatalities |  20 |  22 |  21 |  90 |  24 |  26 |  28 |

We calculate the 10th and 90th percentiles.

| Percentile |  Cap | Meaning                                         |
| ---------- | ---: | ----------------------------------------------- |
| P10        | 20.6 | About 10% of days have lower numbers than this. |
| P90        | 52.8 | About 90% of days have lower numbers than this. |

Then we update the numbers above and below these caps:

| Day | Original value | Capped value | Change         |
| --: | -------------: | -----------: | -------------- |
|   1 |             20 |         20.6 | Raised to P10  |
|   2 |             22 |           22 | Unchanged      |
|   3 |             21 |           21 | Unchanged      |
|   4 |             90 |         52.8 | Lowered to P90 |
|   5 |             24 |           24 | Unchanged      |
|   6 |             26 |           26 | Unchanged      |
|   7 |             28 |           28 | Unchanged      |

To calculate the weights we need to chose a half-life factor (how many days it takes to halve the impact a day has in the final prediction). The best way to calculate an appropriate half-life factor for a given series, is to try different values and see which values better predict past observed events based on previous events. We won't do this. We'll use 4 instead, which I've landed on with some trial and error.

So the weights to halve the impact every 4 days look like this:

| Day | Weight | Note                        |
| --: | -----: | --------------------------- |
|   1 |  0.354 |                             |
|   2 |  0.420 |                             |
|   3 |  0.500 |                             |
|   4 |  0.595 |                             |
|   5 |  0.707 |                             |
|   6 |  0.841 |                             |
|   7 |  1.000 | Yesterday / most recent day |

Then we do a weighted average using these weights. Which gives us 28.4.

[widget to update half life, curve smoothness, and see prediction]

### still-missing · What is still missing · #cf7a68

> Source: TBD

Layers with a clear place in the model and no source good enough to fill it.

## Ongoing epidemics

Epidemics raise mortality in specific regions and periods by a measurable amount. Excess-mortality estimates are the right measure and arrive months late; outbreak feeds arrive quickly and report cases, not deaths. Until something updates faster than the model itself, an epidemic layer would be fiction dressed as data.

## Time of day

Deaths cluster in the small hours, and the globe already knows the local hour of every cell — the subsolar point lights it. The layer would plug into the weights without changing the runtime at all. What is missing is a curve worth plugging in.

## Sub-national age structure

Personas currently use a national age distribution, so a death in a rural Spanish province gets the same age draw as one in Madrid. Regional age pyramids exist for Europe and would sharpen the feed considerably; elsewhere they are the same patchwork problem as regional rates.

### back-to-the-globe · Back to the globe · #000000

Now you know what the flashes mean. Go back and watch them again. It reads differently.

The globe is statistical, not a feed of individual records. A flash and persona should be
read as a representative event drawn from public aggregate data, never as an identifiable
death.

_This is a personal project exploring statistical mortality visualization._
