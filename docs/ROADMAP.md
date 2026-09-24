# Watch People Die Live

<!-- The whole story lives here. Each section is declared as:
       ### <key> · <Label> · <#sky>
     The key is what section components register their figures against, the label is the
     on-screen chapter title, and the sky is the colour the section's entire palette is
     generated from. Order in this file is order on screen. -->

### first-light · First light · #2b1c3a · hidden

Do you want to know how many people die in a second worldwide? Let's ask the machine.

```
Q: How many people die every second?
A: Roughly 2 people die every second globally
```

The problem is that that is not true — or not completely true. For the last couple of years we have observed between 60 and 63 million deaths a year, worldwide. An average year has 31,557,600 seconds, and dividing one by the other gives about two deaths a second. But that is a yearly average, and nothing about a death is average.

[blinking dot every 500ms]

In reality there's about a 14% chance that during any given second nobody dies, if deaths are randomly distributed across the year at the observed annual average. Under the same model, there is about a 27% chance that exactly two people die in any given second — and roughly the same chance that exactly one person dies in that second.

[blinking dot randomly blinking]

So, how many people die in a given second? Our new (better) answer is: _if_ people die {{randomly}} throughout the year, between 0 and 4 in about 95% of one-second intervals.

:::rand-modal

## What do you mean by randomly?

That 27% figure, and every block in the chart further down, comes straight out of the Poisson probability mass function — the standard way to model a count of independent random events (here, deaths) over a fixed window (here, one second). It assumes that events are independent and that the average rate stays roughly constant within the window. The observed annual average is first converted into a per-second average:

$$ Per-second rate
\lambda_{\text{second}} = \dfrac{61{,}600{,}000}{365.25 \times 24 \times 60 \times 60} \approx 1.95
$$ An annual average of roughly 61.6 million deaths.

$$ Poisson probability mass function
P(X = k) = \dfrac{e^{-\lambda_{\text{second}}}\lambda_{\text{second}}^k}{k!}
$$ Run it for each _k_ to get the share of seconds holding _k_ deaths; five or more are grouped into one last block.

_e_ and _k_! aren't arbitrary — each falls out of picturing what's actually happening underneath the second. Slice that second into an enormous number of tiny instants, each with its own tiny, independent chance of holding a death. _e_^-λ is what "none of those instants got a death" collapses to once you compound that tiny miss-chance across all of them — literally the same limiting process that defines Euler's number in the first place. The λ^_k_ half counts the _k_ instants that did land a death, one factor of the rate per hit; dividing by _k_! then erases the ordering, since we only care that _k_ deaths happened somewhere in the second, not which _k_ of the countless instants they fell on.

:::

### where-global · Where [Where - global rate] · #e8956d · chapter

We made a bold assumption when timing the events: that they happened randomly. As we will see, this is far from the truth and we'll try improving our timing model. Nevertheless, we'll be equally naive for our first spatial distribution model: deaths will happen at random times and at random places.

[map with random dots at random places]

I think most people wouldn't get triggered by our timing model, but our spatial model is painful to watch. Most randomly placed dots (~71%) fall in the ocean, as this is the [proportion of Earth's surface covered in water](https://oceanservice.noaa.gov/facts/oceanwater.html). The dots falling on land fall overwhelmingly in areas without any permanent human settlements (deserts, forests, …). I classify those points against the [GPWv4 population-density grid](https://sedac.ciesin.columbia.edu/data/set/gpw-v4-population-density-rev11) used by the model.

[ocean uninhabited inhabited tally]

We can agree that if our goal is an accurate mortality model it should be way better than that. Maybe instead of using the global mortality numbers we could use country-level data. The good news is that the [World Bank publishes estimates of crude death rate](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN) — how many people die in a year for every 1,000 inhabitants. The bad news is that many countries don't provide that data, and virtually all the ones that do overcount or undercount some deaths.

Even if imperfect, mortality rates by country will be a huge upgrade from placing points without taking account of where people live.

[chart cdr per country]

### where-country · A country is not an average [Where - country rate] · #f6c58f

Not having deaths pop up in the middle of the ocean is neat. And seeing the dots pop up in the countries they should be in is also a great improvement. But if you look carefully, you'll notice that the dots always appear exactly in the center of a given country. Sometimes that's in an uninhabited or even uninhabitable part of the country. According to the current simulation, all deaths in Russia happen at [Lake Vivi](https://rgo.ru/activity/redaction/news/pamyatnyy-znak-geograficheskiy-tsentr-rossiyskoy-federatsii-v-evenkii-budet-obnovlyen/), roughly 400 kilometers from the closest hospital: a [regional study](https://elib.sfu-kras.ru/bitstream/handle/2311/28186/shatunov_a_0.pdf?isAllowed=y&sequence=2) places the lake 366 kilometers from Tura and identifies the town's central district hospital. But we know that people tend to die where people tend to be, so let's apply a density map to our calculation. This way, the dots will have a greater chance of appearing where there are more people and little chance of appearing in unpopulated areas.

Small problem though: the density map is a grid of ~55 km wide cells (0.5°). It's pixelated, so to speak. But country borders aren't pixelated (colonialism got close but not quite), they often follow rivers, mountains or the sea.

[Benelux Westafrika maps density/borders]

The way we get around this is by converting every source, every complexity layer to a grid. And we assign each pixel to whichever country has the most population in that specific cell.

This map is cheating a little bit: it uses a logarithmic scale by default. Otherwise you wouldn't see much. The fact is that Earth, even the land, is mostly empty. _Toggle between log and linear scale to see how empty it is._

[density map asia]

On a linear scale you barely see anything other than a dozen megacities and some shading around the Indo-Gangetic Plain (the region south of the Himalayas that's [home to about one-seventh of the world's population](https://pmc.ncbi.nlm.nih.gov/articles/PMC7125076/)).

Now our dots appear mostly in cities and in very populous areas.

### where-region · CDR by region [Where - CDR by region] · #e7e9e4

A single national rate hides enormous internal spread. In Japan, rural Akita dies at nearly twice the rate of Tokyo; in the US, West Virginia runs well above Utah; in Europe, north-west Bulgaria and eastern Germany far exceed Ireland or the Nordic capitals. [Most of the gap is age structure](https://ec.europa.eu/eurostat/cache/metadata/en/hlth_cdeath_sims.htm) — older regions bury more of their people each year — layered over real differences in health, poverty, and access to care. Japan's [official 2023 table](https://www.ipss.go.jp/syoushika/tohkei/Data/Popular2025/T12-26.files/sheet001.htm) puts the crude rates at 19.3 per 1,000 in Akita and 10.2 in Tokyo; after age standardisation, they narrow to 14.4 and 12.3.

An illustrative example of how much the age structure of a place matters to its CDR is that of Mexico and Lithuania. In 2000, both countries had a life expectancy of around 72 years, but Mexico's crude death rate was about 4 per 1,000, while Lithuania's was about 11 per 1,000. Same life expectancy, almost 3× crude death rate difference.

Sources: World Bank series for [life expectancy at birth](https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=MX-LT&start=2000&end=2000) and [crude death rate](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN?locations=MX-LT&start=2000&end=2000).

[subnational choropleth]

### borders-wrong-unit · Borders are the wrong unit [Where - region] · #a6d2f5

[national vs regional bars]

Source: [Eurostat's 2023 regional crude death rates](https://ec.europa.eu/eurostat/databrowser/view/demo_r_gind3/default/table?lang=en).

### when-seasonality · When [When - seasonality] · #bcd8ee · chapter

:::chapter-sub
The only layer still recomputed in your browser, because it is the only one that changes while you watch.
:::

# Death rate by time of year

From a timing perspective, we're still at the same place that we were at the beginning. Dots still appear at random moments. This definitely looks better than having regular intervals like a metronome, but it's not closer to reality. Randomness feels more organic, but we're striving for something more than feeling.

Do we have something better than random? Yes, at least for some countries that provide monthly or even weekly CDR numbers. Mortality rates in a given month in a given country vary from year to year, but not by much. The coronavirus pandemic is the obvious exception: mortality during 2020–2022 did vary sharply, which is why those years are excluded from the fitted curves below. Actually, it is quite easy to draw a curve showing when in the year more or fewer people die. And the data is not only consistent from year to year but also between countries.

## A cluster of similar curves

Add or remove any country with a directly measured curve to compare.

[seasonality curves]

## From observations to a continuous multiplier

Weekly, monthly and quarterly describe how often observations arrive. They are not smoothing methods. Choose any quality-gated country with weekly observations below to see what each cadence preserves, compare the former circular three-month average, and toggle orders 1–4 of the continuous harmonic curve. Order 4 is the model the globe now uses.

[smoothing explainer]

In these charts a factor above 1 means deaths fire faster than the annual average, and a factor below 1 means they fire slower. The production curve is a pooled order-4 Fourier regression over every complete non-COVID year: weekly observations stay weekly, counts are converted to daily intensity, and the result can be evaluated continuously on any day of the year.

Many temperate countries follow a similar pattern: winter is significantly more deadly than summer. Closer to the equator the annual signal is usually flatter or follows rainy and dry seasons rather than a winter/summer contrast, so the harmonic model does not assume that every country has a winter peak.

Southern-hemisphere curves are shifted by half a year only when the chart compares their seasonal shape with northern countries. Their production curves retain their true calendar phase.

These choices in my wording reveal an assumption that, even if quite obvious, could be flawed: that changes in rates over a year are mostly based on climatic seasons. In theory they could reflect something different: think social mechanisms like Ramadan or data artifacts like late reporting of deaths, default dates of death, and so on.

Trying to understand what causes seasonality is very interesting, but it isn't critical for the countries from which we have observed seasonal data. What do we do with the other ~100 countries that only provide yearly CDR?

When I'm missing the data I need I always ask the question: are there any proxies for the data I'm looking for, that are easier to get? Are they causes of the phenomenon we study, consequences of it, or do they share a common cause with our subject? In this case I can think of a couple, each with its own strengths and weaknesses.

[proxy ranking card]

Before committing to one, it's worth seeing what actually tracks the _strength_ of a country's seasonal swing among the countries that already report a curve. Many are roughly unimodal, while some tropical climates can have broader or multiple rainy-season features. Amplitude is still a useful first summary of how strongly the curve moves away from its annual mean, without claiming that every shape has one winter peak.

In the charts that follow, every dot is a country with observed seasonal data. The y-axis shows amplitude: the higher a dot is, the stronger the seasonal swing. The x-axis places countries on each of the proposed proxies.

The bottom axis shows absolute latitude — how far a country is from the equator. Points at the left are tropical, points near the right edge are near the poles.

[latitude scatter]

We see an expected pattern: amplitude is lowest between the tropics, as countries there don't experience astronomical seasons. And an — at least for me — unexpected one: above 35° seasonality decreases, instead of climbing with colder and longer winters. A possible explanation is that above a certain threshold people understand that they should adapt to winter and implement social, behavioural and housing adaptations. That Spain, with a more temperate climate, shows higher winter mortality than Sweden would point in this direction.

Here we put all countries and regions in their respective climatic bucket. If this is to be a good proxy we should see that the dots in each climate are packed together.

[koppen scatter]

Well, this doesn't change the picture much. We confirm that there's a correlation, that seasonality is lower between the tropics, and that climate — just as latitude — best predicts seasonality where seasonality is low.

[pop65 scatter]

How many older people live in a country seems like a very poor proxy. I just see a cloud of dots here. Richer countries also tend to have older populations, which may be part of what we're seeing. The GDP shading supports that association: countries with fewer older people tend to be poorer than countries with more older people. It does not tell us whether wealth offsets seasonal mortality.

[gdp scatter]

More of the same. There's no clear relationship in this sample between how rich a country is and how strongly its mortality is affected by the seasons. One possibility is that stronger health systems and better adaptations offset some of the seasonal risk in richer countries, but this chart cannot tell us whether that's the reason.

[neighbour scatter]

How about neighbouring countries? That's better. There's a strong correlation here. Among the methods tested on countries with measured curves, bordering-neighbour adjacency is the strongest proxy — the lowest median error, the highest correlation, and the only one with positive skill against both the mean-curve floor and latitude. Latitude and climate class land close together just behind, with climate edging latitude on the typical country.

:::accordion

## How the proxies actually score · Leave-one-out reconstruction scores

Those are claims about error and skill, so here they are measured. Every country that reports a curve is hidden in turn, predicted from each method in place of its own data, and scored against the observed shape. For these charts, amplitude is the root-mean-square deviation of the fitted curve from its annual mean.

[prediction comparison]

:::

## So how did your ranking do?

The ranking exercise asked which proxy tracks the size of a country's seasonal swing. The leave-one-out test asks a different question: how well can each method reconstruct the whole curve when we hide it? If you ranked the five before seeing the charts, here is where your guess landed.

[proxy scorecard]

## Bordering regions, not just bordering countries

Adjacent regions inside the same country track each other even more tightly than bordering countries do. That agreement is why the nearest-region reconstruction beats every other region-level proxy. Two Russian regions, Ingushetia and Chukotka, had unusable raw weekly data — zero-rate weeks or excessive spike noise — and are imputed from the average of their nearest good neighbours rather than shown as-is or dropped.

[region neighbour scatter]

:::accordion

## The same test over regions · Median error across 297 Admin-1 regions

[region prediction comparison]

:::

## Where the extra deaths fall, month by month

[amplitude map]

Each square is a half-degree cell of the same grid the globe samples, coloured by the deaths this month's season adds to, or takes from, an ordinary month there. Drag through the year and the hemispheres trade places: Europe's January surplus is southern Africa's January deficit, and by July they have swapped.

The texture inside a country is population, not seasonality. Ten countries have measured regional curves, and inside this frame that comes down to South Africa, western Russia, and climate-modelled India and China; Europe has none at all. Everywhere else every cell of a country shares one curve, and the outlines say which unit that curve belongs to — solid where somebody counted deaths in it, dashed where it was reconstructed from a neighbour, a climate class or a latitude. What changes from cell to cell inside one of those borders is how many people live there, not when they die.

### conflicts · A war is not a Poisson process [Conflicts] · #eeb87d

The previous layers capture long-term mortality trends, which account for most deaths worldwide. But current mortality also needs finer-grained factors, the largest being conflicts. [ACLED publishes weekly aggregates](https://acleddata.com/use-access/how-use-acleds-aggregated-data) of reported conflict fatalities, with country and Admin-1 centroid coordinates. Those centroids are an approximation, not individual event locations.

For all other layers we multiplied the base crude death rate by a seasonality or density factor. Here we get 12 complete, reported weeks ending at the oldest publication date shared by all six ACLED regions. So what is our recent weekly estimate?

We use a recency-weighted average to estimate recent weekly mortality. Specifically, a robust exponentially weighted moving average (Robust EWMA): _use recent weeks more than older weeks, but damp extreme values before averaging_. This makes the estimate less sensitive to a single week. It also means a sudden escalation can be understated.

For example, take this self-contained seven-week illustration:

The production estimate uses 12 weeks; these seven invented values make the arithmetic easier to follow.

| Week       |   1 |   2 |   3 |   4 |   5 |   6 |   7 |
| ---------- | --: | --: | --: | --: | --: | --: | --: |
| Fatalities |  20 |  22 |  21 |  90 |  24 |  26 |  28 |

We calculate the 10th and 90th percentiles.

| Percentile |  Cap | Meaning                                         |
| ---------- | ---: | ----------------------------------------------- |
| P10        | 20.6 | About 10% of weeks have lower numbers than this. |
| P90        | 52.8 | About 90% of weeks have lower numbers than this. |

Then we update the numbers above and below these caps:

| Week | Original value | Capped value | Change         |
| --: | -------------: | -----------: | -------------- |
|   1 |             20 |         20.6 | Raised to P10  |
|   2 |             22 |           22 | Unchanged      |
|   3 |             21 |           21 | Unchanged      |
|   4 |             90 |         52.8 | Lowered to P90 |
|   5 |             24 |           24 | Unchanged      |
|   6 |             26 |           26 | Unchanged      |
|   7 |             28 |           28 | Unchanged      |

To calculate the weights we choose a half-life: how many weeks it takes to halve a week's impact on the final estimate. A fitted value would require a longer validation exercise; here the production default is four weeks.

So the weights to halve the impact every four weeks look like this:

| Week | Weight | Note                        |
| --: | -----: | --------------------------- |
|   1 |  0.354 |                             |
|   2 |  0.420 |                             |
|   3 |  0.500 |                             |
|   4 |  0.595 |                             |
|   5 |  0.707 |                             |
|   6 |  0.841 |                             |
|   7 |  1.000 | Most recent complete week   |

Then we do a weighted average using these weights. Which gives us 28.4.

Both choices — how fast a week's influence decays, and how hard the extremes get pulled in — are mine, not the data's. The globe always uses the default four-week/P10–P90 result, distributed by each Admin-1 region's share of the 12-week fatalities and annualised. The sliders below are a counterfactual demonstration; dragging them does not change the globe.

[widget to update half life, curve smoothness, and see prediction]

[map of conflict fatalities]

The map reports fatalities over the same 12 complete weeks at ACLED's Admin-1 centroids. For the globe, each centroid is assigned to the nearest populated sampling-grid cell within the same country.

### who · Who · #d9dbdd · chapter

:::chapter-sub
Every flash gets a sentence, drawn from the distribution of the place it fired in.
:::

# Sex, age, then cause

**Age and sex** come from the UN World Population Prospects table of deaths by age and sex, in its 2023 figures. **Cause** comes from the [WHO Global Health Estimates](https://www.who.int/data/global-health-estimates/), the GHE 2021 edition published in 2024. I use its estimates for 2019, the last year before the pandemic, so that COVID-19 is not drawn as how people ordinarily die. For each country, sex and age band, I keep the eight most common recognisable causes and fold everything else into "other causes".

The age, sex and cause are drawn together rather than independently. Once sex and age have been selected, the cause comes from the distribution for that group. This avoids combinations that would be very unlikely in the source data.

Both the [age-and-sex table](/data/mortality-age-sex.json) and the [cause table](/data/causes.json) ship as JSON in the repository, so the feed needs no runtime API call and reads the same offline. The cause table used to come from the IHME Global Burden of Disease, hand-exported from a results tool that puts every download behind a sign-in and a hundred-thousand-row cap. The WHO table is one request and no account, which is most of why it is the one here.

Getting cause below the country level means going back to IHME, and back to that cap. The subnational export is 723 places by 22 age groups by two sexes by 22 cause groups — seven hundred thousand rows, or eight downloads, against an allowance that is spent per release and never refills. So the eight were ordered by how many deaths each carried rather than by the order the tool lists them in. The allowance ran out after the first. That one download holds cardiovascular disease, the cancers and chronic respiratory disease — 55% of all deaths — at regional resolution; in the tool's own order the same single download would have held about a tenth of that. It is in the feed, and it is worth being exact about how far it reaches, because two different fractions are at work. The regions cover **44.6%** of the deaths drawn; the three groups are **55.0%** of the causes. Only where both hold does the region decide, so **24.5% of all cause draws** now move with the place rather than the country. The rest keep the national mix.

What the feed knows, by share of the deaths it draws:

| Layer                  | Resolved from the region | Derived | National |
| ---------------------- | -----------------------: | ------: | -------: |
| Age and sex            |                    44.6% |   51.8% |     3.6% |
| Cause, those 3 groups  |                    44.6% |       — |    55.4% |
| Cause, the other 19    |                        — |       — |     100% |

The reweighting is a ratio, not a replacement. Twenty-two clinical groups cannot carry eighty-seven named causes, so GBD is never asked to name anything: for each region, age band and sex it supplies one number per group — that group's share of deaths there, over its share nationally — and the WHO labels inside the group are multiplied by it. Everything outside the three groups moves together on the remainder, so the three cannot quietly inflate.

Three things are still pending, and none of them is a detail. Nineteen of the twenty-two groups have no regional data at all, which is seven downloads still owed by an allowance that has not refilled. Fifty-five percent of deaths happen outside the 474 regions — all of China among them, which has no subnational units here — and draw a national cause mix. And seventeen of the regions are cities too small for a half-degree grid cell to award them: Delhi, Ōsaka, Greater London, Mexico City, Jakarta, Manila and eleven more win no cell of their own, so their deaths are drawn with the surrounding region's mix. That is 2.6% of the deaths inside the regions, and it is the grid's fault rather than the data's.

[sampling order]

# Then the month tilts it

The time of year can also change the age and cause we draw. I estimate those changes from the records available, then borrow patterns for countries without their own data. That borrowing is one of the less certain parts of the model.

Age and cause use different records. The age curves are measured from [Eurostat weekly records](https://ec.europa.eu/eurostat/cache/metadata/en/demomwk_esms.htm) for 24 European countries. The cause curves come from monthly death records in [Brazil's DATASUS mortality system](https://datasus.saude.gov.br/informacoes-de-saude-tabnet/) and [Mexico's Secretaría de Salud](https://www.datos.gob.mx/dataset/registro_defunciones) — the two country sources here whose microdata carries a date and a cause together. Both are fitted as continuous order-4 harmonic curves. The twelve monthly values in the chart are snapshots of those curves, not the stored model.

Countries without those records borrow curves through the same donor cascade used for timing: regional averages, neighbouring countries, climate and latitude. All nine age bands have measured curves in the 24 source countries. Cause is not completely covered: 55 of the 87 labels borrow the curve of their ICD-10 chapter, and the other 32 are left flat, multiplied by one. The largest of them is "other causes" itself — the residual that the strongest-eight truncation folds everything else into, typically a third of the weight in the adult bands and up to a half. Leaving it flat is a decision rather than an oversight: it is a bag of unrelated deaths with no chapter of its own, and handing it the average death's curve would assert a shape I have not measured.

At sampling time, these multipliers change the conditional age and cause weights, which are then normalised together. Each curve averages one across the year, but that alone does not guarantee that every category preserves its exact annual share after the weights are combined.

[deaths by age and cause]

### still-missing · What is still missing [Still missing] · #cf7a68 · chapter-small

:::chapter-sub
Layers with a clear place in the model and no source good enough to fill it.
:::

:::accordion

## Ongoing epidemics · Planned · source to be decided

Epidemics raise mortality in specific regions and periods by a measurable amount. An epidemic layer needs timely death estimates and a way to avoid counting deaths already in the baseline. I haven't settled on a source and method for that.

## Time of day · Needs a published curve

I haven't included a time-of-day pattern. To do that, I'd need evidence that can be applied across populations and causes.

## Sub-national age structure · Partially available

Regional age and sex estimates already shape many of the personas. The remaining gaps are places where I still have to infer the mix, or where the grid is too coarse to preserve a small region.

:::

### back-to-the-globe · Back to the globe · #000000 · hidden

:::end-block

# Now you know what the flashes mean.

Go back and watch them again. It reads differently.

:::end-fine
The globe is statistical, not a feed of individual records. A flash and its persona are a representative event drawn from public aggregate data, never an identifiable death. A personal project exploring statistical mortality visualisation.
:::

[pull up for the globe]

:::
$$
