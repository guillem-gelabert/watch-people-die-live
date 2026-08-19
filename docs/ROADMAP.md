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

The problem is that that is not true — or not completely true. For the last couple of years we have observed between 60 and 63 million deaths a year, worldwide. A year has 31,536,000 seconds, and dividing one by the other gives about two deaths a second. But that is a yearly average, and nothing about a death is average.

[blinking dot every 500ms]

In reality there's a big chance that during any given second nobody dies, because deaths don't happen on a steady rhythm. In fact, if deaths were randomly distributed across the year at the observed annual average, there would be about a 27% chance that exactly two people died in any given second — and roughly the same chance that exactly one person died in that second.

[blinking dot randomly blinking]

So, how many people die on a given second? Our new (better) answer is: _if_ people die {{randomly}} around the year, probably somewhere between 0 and 4 (with a ~95% certainty).

:::rand-modal

## What do you mean by randomly?

That 27% figure, and every block in the chart further down, comes straight out of the Poisson probability mass function — the standard way to model a count of independent random events (here, deaths) over a fixed window (here, one second) when you only know the average rate. The observed annual average is first converted into a per-second average:

$$ Per-second rate
\lambda_{\text{second}} = \dfrac{61{,}600{,}000}{365.25 \times 24 \times 60 \times 60} \approx 1.95
$$ An annual average of roughly 61.6 million deaths.

$$ Poisson probability mass function
P(X = k) = \dfrac{e^{-\lambda_{\text{second}}}\lambda_{\text{second}}^k}{k!}
$$ Run it for each _k_ to get the share of seconds holding _k_ deaths; five or more are grouped into one last block.

_e_ and _k_! aren't arbitrary — each falls out of picturing what's actually happening underneath the second. Slice that second into an enormous number of tiny instants, each with its own tiny, independent chance of holding a death. _e_^-λ is what "none of those instants got a death" collapses to once you compound that tiny miss-chance across all of them — literally the same limiting process that defines Euler's number in the first place. The λ^_k_ half counts the _k_ instants that did land a death, one factor of the rate per hit; dividing by _k_! then erases the ordering, since we only care that _k_ deaths happened somewhere in the second, not which _k_ of the countless instants they fell on.

:::

### where-global · Where [Where - global rate] · #e8956d · chapter

We made a bold assumption when timing the events, that they happened randomly. As we will see this is far from the truth and we'll try improving our timing model. Nevertheless, we'll be equally naive for our first spacial distribution model: deaths will happen at random times and at random places.

[map with random dots at random places]

I think most people wouldn't get triggered by our timing model, but our spacial model is painful to watch. Most randomly placed dots (~71%) fall in the ocean, as this is the proportion of earth that's covered in water. The dots falling on land fall overwhelmingly on areas without any permanent human settlements (deserts, forests,…).

[ocean uninhabited inhabited tally]

We can agree that if our goal is an accurate defunction model it should be way better than that. Maybe instead of using the global mortality numbers we could use country level data. The good news is that many countries report their Crude Death Rate —how many people die in a year for every 100000 inhabitants—. The bad news is that many don't provide that data, and virtually all the ones that do overcount or undercount some deaths.

Luckily the WHO has some very smart people working on it and providing good estimates. Even if imperfect the mortality rates by country will be a huge upgrade from rendering random points wherever, with equal chances of it being in Mexico or Lithuania, Togo or the Antartica, on land or in the middle of the ocean.

[chart cdr per country]

### where-country · A country is not an average [Where - country rate] · #f6c58f

Not having deaths pop up in the middle of the ocean is neat. And seeing the popping dots on the countries they should be is also a great improvement. But if you look carefully, you'll notice that the dots appear always exactly in the center of a given country. Sometimes that's in an uninhabited or even uninhabitable part of the country. According to the current simulation, all deaths in Russia happen in Lake Vivi, 400 kilometers away from the closest hospital. But we know that people tend to die where people tend to be, so let's apply a density map to our calculation. This way, the dots will have bigger chances to appear where there's more people and little chances of appearing at unpopulated areas.

Small problem though: the density map is a grid of ~55 km wide cells (0.5°), it's pixelated, so to speak. But country borders aren't pixelated (colonialism got close but not quite), they often follow rivers, mountains or the sea.

[Benelux Westafrika maps density/borders]

The way we go around this is by converting every source, every complexity layer to a grid. And we assign each pixel to whichever country has the most population in that specific cell.

This map is cheating a little bit: it uses a logarithmic scale by default. Otherwise you wouldn't see much. The fact is that the earth, even the land, is mostly empty. _Toggle between log and linear scale to see how empty it is._

[density map asia]

On a linear scale you barely see anything else than a dozen megacities and some shading around the Indo-Gangetic Plain (the region south of the Himalayas that's home of one-seventh of the world's population).

Now our dots appear mostly in cities and in very populous areas.

### where-region · CDR by region [Where - CDR by region] · #e7e9e4

A single national rate hides enormous internal spread. In Japan, rural Akita dies at nearly twice the rate of Tokyo; in the US, West Virginia runs well above Utah; in Europe, north-west Bulgaria and eastern Germany far exceed Ireland or the Nordic capitals. Most of the gap is age structure — older regions bury more of their people each year — layered over real differences in health, poverty, and access to care.

An illustrative example of how big the age structure of a place is to its CDR is that of Mexico and Lithuania. In 2000, both countries had life expectancy around 72 years, but Mexico's crude death rate was about 4 per 1,000, while Lithuania's was about 11 per 1,000. Same life expectancy, almost 3× crude death rate difference.

[subnational choropleth]

### borders-wrong-unit · Borders are the wrong unit [Where - region] · #a6d2f5

[national vs regional bars]

### when-seasonality · When [When - seasonality] · #bcd8ee · chapter

:::chapter-sub
The only layer still recomputed in your browser, because it is the only one that changes while you watch.
:::

# Death rate by time of year

From a timing perspective, we're still at the same place that we were at the beginning. Dots still appear at random moments. This looks definitely better than having regular intervals like a metronome, but it's not closer to reality. Randomness feels more organic, but we're striving for something more than feeling.

Do we have something better than random? Yes, at least for some countries, that provide monthly or even weekly CDR numbers. Mortality rates on a given month in a given country vary from year to year, but not by much. Actually, it is quite easy to draw a curve, showing at which time of the year people die less or more. And the data is not only consistent from year to year but also between countries.

## A cluster of similar curves

Add or remove any country with a directly-measured curve to compare.

[seasonality curves]

## From observations to a continuous multiplier

Weekly, monthly and quarterly describe how often observations arrive. They are not smoothing methods. Choose any quality-gated country with weekly observations below to see what each cadence preserves, compare the former circular three-month average, and toggle orders 1–4 of the continuous harmonic curve. Order 4 is the model the globe now uses.

[smoothing explainer]

In these charts a factor above 1 means deaths fire faster than the annual average, and a factor below 1 means they fire slower. The production curve is a pooled order-4 Fourier regression over every complete non-COVID year: weekly observations stay weekly, counts are converted to daily intensity, and the result can be evaluated continuously on any day of the year.

Many temperate countries follow a similar pattern: winter is significantly more deadly than summer. Closer to the equator the annual signal is usually flatter or follows rainy and dry seasons rather than a winter/summer contrast, so the harmonic model does not assume that every country has a winter peak.

Southern-hemisphere curves are shifted by half a year only when the chart compares their seasonal shape with northern countries. Their production curves retain their true calendar phase.

These choices on my wording reveal an assumption that, even if quite obvious, could be flawed: that change in rates over a year are mostly based on climatic seasons. In theory they could reflect something different: think social mechanisms like Ramadan or data artifacts like late reporting of defunctions, default defunction dates, and so on.

Trying to understand what causes seasonality is very interesting, but it isn't critical for the countries from which we have observed seasonal data. What do we do with the other ~100 countries that only provide yearly CDR?

When I'm missing the data I need I always ask the question: are there any proxies to the data I'm looking for, that are easier to get? Are they causes of the phenomenon we study, consequences of it, or do they share a common cause with our subject? In this case I can think of a couple, each with its own strengths and weaknesses.

[proxy ranking card]

Before committing to one, it's worth seeing what actually tracks the _strength_ of a country's seasonal swing among the countries that already report a curve. Many are roughly unimodal, while some tropical climates can have broader or multiple rainy-season features. Amplitude is still a useful first summary — how far the curve moves away from its annual mean — without claiming that every shape has one winter peak.

In the charts that follow, every dot is a country with observed seasonal data. The y-axis shows amplitude: the higher a dot is, the bigger the difference in mortality between summer and winter. The x-axis places countries on each of the proposed proxies.

The bottom axis shows absolute latitude — how far a country is from the equator. Points at the left are tropical, points near the right edge are near the poles.

[latitude scatter]

We see an expected pattern: amplitude is lowest between the tropics, as countries there don't experience astronomical seasons. And an — at least for me — unexpected one: above 35° seasonality decreases, instead of climbing with colder and longer winters. A possible explanation is that above a certain threshold people understand that they should adapt to winter and implement social, behavioural and housing adaptations. That Spain, with a more temperate climate, shows higher winter mortality than Sweden would point in this direction.

Here we put all countries and regions in their respective climatic bucket. If this is to be a good proxy we should see that the dots in each climate are packed together.

[koppen scatter]

Well, this doesn't change the picture much. We confirm that there's a correlation, that seasonality is lower between the tropics, and that climate — just as latitude — best predicts seasonality where seasonality is low.

[pop65 scatter]

How many older people live in a country seems like a very poor proxy. I just see a cloud of dots here. Possibly because richer countries tend to have older populations and one thing offsets the other. Shading the countries by GDP per capita confirms this: countries on the left are lighter (poorer) than countries on the right.

[gdp scatter]

More of the same. There's no visible correlation between how rich a country is and how strongly its mortality is affected by the seasons. The cause is probably the same as above: richer countries offset their seasonality with stronger health systems and better adaptations.

[neighbour scatter]

How about neighbouring countries? That's better. There's a strong correlation here. Bordering-neighbour adjacency is the strongest proxy — the lowest median error, the highest correlation, and the only one with positive skill against both the mean-curve floor and latitude. Latitude and climate class land close together just behind, with climate edging latitude on the typical country.

:::accordion

## How the proxies actually score · Leave-one-out scores for all five proxies

Those are claims about error and skill, so here they are measured. Every country that reports a curve is hidden in turn, predicted from each proxy in place of its own data, and scored against the observed shape.

[prediction comparison]

:::

## So how did your ranking do?

You put the five in an order before any of this was on screen. Here is the order the charts above actually produce, and where your guess landed against it.

[proxy scorecard]

## Bordering regions, not just bordering countries

Adjacent regions inside the same country track each other even more tightly than bordering countries do. That agreement is why the nearest-region reconstruction beats every other region-level proxy. Two Russian regions, Ingushetia and Chukotka, had unusable raw weekly data — zero-rate weeks or excessive spike noise — and are imputed from the average of their nearest good neighbours rather than shown as-is or dropped.

[region neighbour scatter]

:::accordion

## The same test over regions · Median error across 297 Admin-1 regions

[region prediction comparison]

:::

## Amplitude by country and region

[amplitude map]

Every rendered country and region is coloured by seasonal amplitude. Observations use their measured curves; targets without observations use the assigned climate, neighbour or latitude proxy.

### conflicts · A war is not a Poisson process [Conflicts] · #eeb87d

The previous layers capture long-term mortality trends, which account for most deaths worldwide. But current mortality also needs finer-grained factors, the largest being conflicts. ACLED's real-time Research feed publishes weekly country and Admin-1 aggregates with fatalities and regional centroid coordinates. Those centroids are an approximation, not individual event locations.

For all other layers we multiplied the base crude death rate by a seasonality or density factor. Here we get 12 complete, reported weeks ending at the oldest publication date shared by all six ACLED regions. So what is our factor for the current week?

We use a recency-weighted average to estimate the current week's mortality. Specifically, a robust exponentially weighted moving average (Robust EWMA): _use recent weeks more than older weeks, but damp suspiciously extreme values before averaging_.

For example:

Take seven weeks from the 12-week window:

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

# Age, then sex, then one cause

**Age and sex** come from the UN World Population Prospects table of deaths by age and sex. **Cause** comes from the IHME Global Burden of Disease, expanded to its level-3 causes — the recognisable ones — and reduced to the strongest eight per country, sex and age band, with everything else folded into "other causes".

They are sampled **in that order**, so a cause is only ever drawn from the age and sex band that plausibly dies of it. Draw the cause first and you get twenty-year-olds with dementia.

Both tables ship as JSON in the repository, so the feed needs no runtime API call and reads the same offline. The Global Burden of Disease has no tokened API at all — its table is exported once by hand from the results tool and committed.

[sampling order]

[deaths by age and cause]

[what the clock got wrong]

### still-missing · What is still missing [Still missing] · #cf7a68 · chapter-small

:::chapter-sub
Layers with a clear place in the model and no source good enough to fill it.
:::

:::accordion

## Ongoing epidemics · Planned · source to be decided

Epidemics raise mortality in specific regions and periods by a measurable amount. Excess-mortality estimates are the right measure and arrive months late; outbreak feeds arrive quickly and report cases, not deaths. Until something updates faster than the model itself, an epidemic layer would be fiction dressed as data.

## Time of day · Needs a published curve

Deaths cluster in the small hours, and the globe already knows the local hour of every cell — the subsolar point lights it. The layer would plug into the weights without changing the runtime at all. What is missing is a curve worth plugging in.

## Sub-national age structure · Partially available

Personas currently use a national age distribution, so a death in a rural Spanish province gets the same age draw as one in Madrid. Regional age pyramids exist for Europe and would sharpen the feed considerably; elsewhere they are the same patchwork problem as regional rates.

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
