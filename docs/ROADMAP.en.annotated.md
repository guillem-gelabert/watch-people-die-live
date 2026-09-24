# English manuscript with editorial depth annotations

This is a review copy of the lightly copyedited English article. It is not consumed by the app. Proposed factual and stylistic rewrites are in [the editorial review](EDITORIAL-REVIEW.en.md); the underlying paragraphs below still contain claims that review recommends changing.

Selected low-risk corrections were applied to the source article on 24 September 2026. This annotated copy preserves the version that was scored, so some wording and line references no longer match the source.

**D1** = overview for a college-educated nonspecialist. **D2** = scientific/technical explanation. **D3** = methods, tradeoffs and implementation. The views are cumulative: D1; D1+D2; D1+D2+D3. A score marks the intended home of the content after revision. A mixed score identifies sentences that need to be separated, not a ready-made visibility rule.

**A1–A13** mark passages that depart from the author's opening voice; they are editorial judgments, not AI-authorship probabilities. **F1–F12** refer to factual findings in the review. Every prose paragraph, table, equation and opening Q&A has a block ID and score. Headings and figure placeholders inherit the depth of the material they introduce; their specific display plan is after the manuscript.

---

# Watch People Die Live

<!-- The whole story lives here. Each section is declared as:
       ### <key> · <Label> · <#sky>
     The key is what section components register their figures against, the label is the
     on-screen chapter title, and the sky is the colour the section's entire palette is
     generated from. Order in this file is order on screen. -->

### first-light · First light · #2b1c3a · hidden

**P01 · D1 · source line 11**

> Editorial note: Keep the invitation. Add the simulation disclosure before the reader sees a plausible persona; F1.

Do you want to know how many people die in a second worldwide? Let's ask the machine.

**P02 · D1 · source line 13**

> Editorial note: Machine-answer example. Make clear that an average is valid; F2.

```
Q: How many people die every second?
A: Roughly 2 people die every second globally
```

**P03 · D1 · source line 18**

> Editorial note: Core average-versus-interval distinction. Replace the claim that the average is untrue, and date the model total; F2.

The problem is that that is not true — or not completely true. For the last couple of years we have observed between 60 and 63 million deaths a year, worldwide. A year has 31,536,000 seconds, and dividing one by the other gives about two deaths a second. But that is a yearly average, and nothing about a death is average.

[blinking dot every 500ms]

**P04 · D1 → D2 · source line 22**

> Editorial note: Sentence 1: D1, quantify the empty-second possibility as about 14% in the model. Sentence 2: D2, the two count probabilities. F2.

In reality there's a good chance that during any given second nobody dies, because deaths don't happen at a steady rhythm. In fact, if deaths were randomly distributed across the year at the observed annual average, there would be about a 27% chance that exactly two people died in any given second — and roughly the same chance that exactly one person died in that second.

[blinking dot randomly blinking]

**P05 · D1 · source line 26**

> Editorial note: Keep the zero-to-four takeaway, explicitly conditional on the model. Replace certainty with model probability; F2.

So, how many people die in a given second? Our new (better) answer is: _if_ people die {{randomly}} throughout the year, probably somewhere between 0 and 4 (with ~95% certainty).

:::rand-modal

## What do you mean by randomly?

**P06 · D2 · source line 32**

> Editorial note: Define the model and independence before the formula; knowing the mean alone is insufficient. F2.

That 27% figure, and every block in the chart further down, comes straight out of the Poisson probability mass function — the standard way to model a count of independent random events (here, deaths) over a fixed window (here, one second) when you only know the average rate. The observed annual average is first converted into a per-second average:

**P07 · D3 · source line 34**

> Editorial note: Rate-conversion equation and caption. Reconcile 365 versus 365.25 days; F2.

$$ Per-second rate
\lambda_{\text{second}} = \dfrac{61{,}600{,}000}{365.25 \times 24 \times 60 \times 60} \approx 1.95
$$ An annual average of roughly 61.6 million deaths.


**P08 · D3 · source line 38**

> Editorial note: Poisson formula and caption; define X, k, λ and factorial. F2.


$$ Poisson probability mass function
P(X = k) = \dfrac{e^{-\lambda_{\text{second}}}\lambda_{\text{second}}^k}{k!}
$$ Run it for each _k_ to get the share of seconds holding _k_ deaths; five or more are grouped into one last block.


**P09 · D3 · A1 · source line 42**

> Editorial note: Replace the informal derivation with the binomial limit and a plain explanation; F2.


_e_ and _k_! aren't arbitrary — each falls out of picturing what's actually happening underneath the second. Slice that second into an enormous number of tiny instants, each with its own tiny, independent chance of holding a death. _e_^-λ is what "none of those instants got a death" collapses to once you compound that tiny miss-chance across all of them — literally the same limiting process that defines Euler's number in the first place. The λ^_k_ half counts the _k_ instants that did land a death, one factor of the rate per hit; dividing by _k_! then erases the ordering, since we only care that _k_ deaths happened somewhere in the second, not which _k_ of the countless instants they fell on.

:::

### where-global · Where [Where - global rate] · #e8956d · chapter


**P10 · D1 · source line 48**

> Editorial note: Transition to location. Distinguish randomness from uniformity and a constant rate; F2.


We made a bold assumption when timing the events: that they happened randomly. As we will see, this is far from the truth and we'll try improving our timing model. Nevertheless, we'll be equally naive for our first spatial distribution model: deaths will happen at random times and at random places.

[map with random dots at random places]


**P11 · D1 · source line 52**

> Editorial note: Use the ocean visual as evidence. The settlement claim needs the grid-definition qualification in the review.


I think most people wouldn't get triggered by our timing model, but our spatial model is painful to watch. Most randomly placed dots (~71%) fall in the ocean, as this is the proportion of Earth that's covered in water. The dots falling on land fall overwhelmingly in areas without any permanent human settlements (deserts, forests, …).

[ocean uninhabited inhabited tally]


**P12 · D1 → D2 · source line 56**

> Editorial note: Sentences 1–3: D1, why national rates help and what a rate means. Sentence 4: D2, qualified registration limits. Correct source units; F3.


We can agree that if our goal is an accurate mortality model it should be way better than that. Maybe instead of using the global mortality numbers we could use country-level data. The good news is that many countries report their Crude Death Rate — how many people die in a year for every 100,000 inhabitants. The bad news is that many don't provide that data, and virtually all the ones that do overcount or undercount some deaths.


**P13 · D1 · source line 58**

> Editorial note: Correct WHO to the baseline data provider and remove equal-area/equal-country confusion; F3.


Luckily the WHO has some very smart people working on it and providing good estimates. Even if imperfect, the mortality rates by country will be a huge upgrade from rendering random points wherever, with equal chances of a point being in Mexico or Lithuania, Togo or Antarctica, on land or in the middle of the ocean.

[chart cdr per country]

### where-country · A country is not an average [Where - country rate] · #f6c58f


**P14 · D1 · source line 64**

> Editorial note: Keep the visual problem and population solution. Sentence 5, the Lake Vivi/hospital anecdote, should be removed or sourced; it is not needed at a deeper level either.


Not having deaths pop up in the middle of the ocean is neat. And seeing the dots pop up in the countries they should be in is also a great improvement. But if you look carefully, you'll notice that the dots always appear exactly in the center of a given country. Sometimes that's in an uninhabited or even uninhabitable part of the country. According to the current simulation, all deaths in Russia happen in Lake Vivi, 400 kilometers away from the closest hospital. But we know that people tend to die where people tend to be, so let's apply a density map to our calculation. This way, the dots will have a greater chance of appearing where there are more people and little chance of appearing in unpopulated areas.


**P15 · D2 · source line 66**

> Editorial note: Grid-versus-border mismatch; keep the concrete analogy and the aside. Correct the latitude-dependent size claim; F7.


Small problem though: the density map is a grid of ~55 km wide cells (0.5°). It's pixelated, so to speak. But country borders aren't pixelated (colonialism got close but not quite), they often follow rivers, mountains or the sea.

[Benelux Westafrika maps density/borders]


**P16 · D3 · source line 70**

> Editorial note: Pixel allocation method. Explain the cost: a boundary cell can obscure a small region. Do not assume that explaining the rule also justifies it.


The way we get around this is by converting every source, every complexity layer to a grid. And we assign each pixel to whichever country has the most population in that specific cell.


**P17 · D1 · source line 72**

> Editorial note: Essential instruction for understanding the density visual; explain what logarithmic means in one short sentence.


This map is cheating a little bit: it uses a logarithmic scale by default. Otherwise you wouldn't see much. The fact is that Earth, even the land, is mostly empty. _Toggle between log and linear scale to see how empty it is._

[density map asia]


**P18 · D1 · source line 76**

> Editorial note: Visual observation; source or remove the one-seventh claim. The exact fraction is optional, the visible concentration is not.


On a linear scale you barely see anything other than a dozen megacities and some shading around the Indo-Gangetic Plain (the region south of the Himalayas that's home to one-seventh of the world's population).


**P19 · D1 · source line 78**

> Editorial note: Closes the population step. Keep.


Now our dots appear mostly in cities and in very populous areas.

### where-region · CDR by region [Where - CDR by region] · #e7e9e4


**P20 · D1 → D2 · A2 · source line 82**

> Editorial note: Sentence 1: D1, national averages hide variation. Sentence 2: D2, simplify to the chart-supported example. Sentence 3: D1, explain age structure but qualify “most”.


A single national rate hides enormous internal spread. In Japan, rural Akita dies at nearly twice the rate of Tokyo; in the US, West Virginia runs well above Utah; in Europe, north-west Bulgaria and eastern Germany far exceed Ireland or the Nordic capitals. Most of the gap is age structure — older regions bury more of their people each year — layered over real differences in health, poverty, and access to care.


**P21 · D2 · source line 84**

> Editorial note: Useful concrete explanation of crude rates and age. Correct 4 to about 5.5 and 3× to about 2×; F4.


An illustrative example of how much the age structure of a place matters to its CDR is that of Mexico and Lithuania. In 2000, both countries had a life expectancy of around 72 years, but Mexico's crude death rate was about 4 per 1,000, while Lithuania's was about 11 per 1,000. Same life expectancy, almost 3× crude death rate difference.

[subnational choropleth]

### borders-wrong-unit · Borders are the wrong unit [Where - region] · #a6d2f5

[national vs regional bars]

### when-seasonality · When [When - seasonality] · #bcd8ee · chapter

:::chapter-sub

**P22 · D3 · source line 95**

> Editorial note: Implementation subtitle. Replace in the main chapter with a reader-facing question about seasonal timing. F7/F11.


The only layer still recomputed in your browser, because it is the only one that changes while you watch.
:::

# Death rate by time of year


**P23 · D1 · source line 100**

> Editorial note: Reintroduce timing as a constant-rate limitation, not a failure of randomness. F2.


From a timing perspective, we're still at the same place that we were at the beginning. Dots still appear at random moments. This definitely looks better than having regular intervals like a metronome, but it's not closer to reality. Randomness feels more organic, but we're striving for something more than feeling.


**P24 · D1 · source line 102**

> Editorial note: Introduce recurring patterns, but qualify year-to-year stability. F5.


Do we have something better than random? Yes, at least for some countries that provide monthly or even weekly CDR numbers. Mortality rates in a given month in a given country vary from year to year, but not by much. Actually, it is quite easy to draw a curve showing when in the year more or fewer people die. And the data is not only consistent from year to year but also between countries.

## A cluster of similar curves


**P25 · D1 · source line 106**

> Editorial note: Necessary instruction when the seasonal-curve chart is shown.


Add or remove any country with a directly measured curve to compare.

[seasonality curves]

## From observations to a continuous multiplier


**P26 · D2 → D3 · A3 · source line 112**

> Editorial note: Sentences 1–2: D2 after explaining observations versus smoothing. Sentences 3–4: D3, quality criteria, previous method and harmonic order. Introduce this after the observed pattern.


Weekly, monthly and quarterly describe how often observations arrive. They are not smoothing methods. Choose any quality-gated country with weekly observations below to see what each cadence preserves, compare the former circular three-month average, and toggle orders 1–4 of the continuous harmonic curve. Order 4 is the model the globe now uses.

[smoothing explainer]


**P27 · D1 → D3 · A3 · source line 116**

> Editorial note: Sentence 1: D1, what a multiplier means. Sentence 2: D3, fitting, cadence and excluded years. Split physically so the basic caption survives.


In these charts a factor above 1 means deaths fire faster than the annual average, and a factor below 1 means they fire slower. The production curve is a pooled order-4 Fourier regression over every complete non-COVID year: weekly observations stay weekly, counts are converted to daily intensity, and the result can be evaluated continuously on any day of the year.


**P28 · D1 · source line 118**

> Editorial note: Main seasonal observation. Move before the smoothing explanation. Use “higher” rather than statistical “significantly” unless a test is supplied; F5.


Many temperate countries follow a similar pattern: winter is significantly more deadly than summer. Closer to the equator the annual signal is usually flatter or follows rainy and dry seasons rather than a winter/summer contrast, so the harmonic model does not assume that every country has a winter peak.


**P29 · D2 → D3 · source line 120**

> Editorial note: D2 beside the chart: state whether displayed curves are calendar-aligned. D3: distinguish display shifts from measured and transferred runtime curves. F11.


Southern-hemisphere curves are shifted by half a year only when the chart compares their seasonal shape with northern countries. Their production curves retain their true calendar phase.


**P30 · D2 · source line 122**

> Editorial note: Good scientific caution. Explain that a recurring pattern need not be caused by climate; qualify any particular example.


These choices in my wording reveal an assumption that, even if quite obvious, could be flawed: that changes in rates over a year are mostly based on climatic seasons. In theory they could reflect something different: think social mechanisms like Ramadan or data artifacts like late reporting of deaths, default dates of death, and so on.


**P31 · D1 · source line 124**

> Editorial note: The missing-data problem drives the next chapter beat. Date the approximate count rather than treating it as fixed.


Trying to understand what causes seasonality is very interesting, but it isn't critical for the countries from which we have observed seasonal data. What do we do with the other ~100 countries that only provide yearly CDR?


**P32 · D1 → D2 · source line 126**

> Editorial note: Sentence 1: D1, define a proxy with an example. Sentence 2: D2, causal relationships. Sentence 3: D1, invite the comparison.


When I'm missing the data I need I always ask the question: are there any proxies for the data I'm looking for, that are easier to get? Are they causes of the phenomenon we study, consequences of it, or do they share a common cause with our subject? In this case I can think of a couple, each with its own strengths and weaknesses.

[proxy ranking card]


**P33 · D2 · A4 · source line 130**

> Editorial note: Define the comparison measure without unimodal/multiple-feature jargon. Do not equate amplitude with a winter–summer gap; F5.


Before committing to one, it's worth seeing what actually tracks the _strength_ of a country's seasonal swing among the countries that already report a curve. Many are roughly unimodal, while some tropical climates can have broader or multiple rainy-season features. Amplitude is still a useful first summary — how far the curve moves away from its annual mean — without claiming that every shape has one winter peak.


**P34 · D1 · source line 132**

> Editorial note: Figure-reading instructions; correct amplitude and distinguish dots from rings where present. F5.


In the charts that follow, every dot is a country with observed seasonal data. The y-axis shows amplitude: the higher a dot is, the bigger the difference in mortality between summer and winter. The x-axis places countries on each of the proposed proxies.


**P35 · D1 · source line 134**

> Editorial note: Plain axis definition; keep next to the latitude chart.


The bottom axis shows absolute latitude — how far a country is from the equator. Points at the left are tropical, points near the right edge are near the poles.

[latitude scatter]


**P36 · D2 · source line 138**

> Editorial note: Keep personal surprise and the adaptation hypothesis, but remove the astronomical-seasons error and do not imply causal proof. F5.


We see an expected pattern: amplitude is lowest between the tropics, as countries there don't experience astronomical seasons. And an — at least for me — unexpected one: above 35° seasonality decreases, instead of climbing with colder and longer winters. A possible explanation is that above a certain threshold people understand that they should adapt to winter and implement social, behavioural and housing adaptations. That Spain, with a more temperate climate, shows higher winter mortality than Sweden would point in this direction.


**P37 · D1 · source line 140**

> Editorial note: Simple prediction about what would make the visual convincing. Define climate groups beside their labels.


Here we put all countries and regions in their respective climatic bucket. If this is to be a good proxy we should see that the dots in each climate are packed together.

[koppen scatter]


**P38 · D2 · source line 144**

> Editorial note: Describe what this dataset shows without turning weak variation into a general predictive law. F5/F6.


Well, this doesn't change the picture much. We confirm that there's a correlation, that seasonality is lower between the tropics, and that climate — just as latitude — best predicts seasonality where seasonality is low.

[pop65 scatter]


**P39 · D2 · source line 148**

> Editorial note: Your first-person observation fits the voice. Separate observed age–GDP association from the untested offset mechanism. F5.


How many older people live in a country seems like a very poor proxy. I just see a cloud of dots here. Possibly because richer countries tend to have older populations and one thing offsets the other. Shading the countries by GDP per capita confirms this: countries on the left are lighter (poorer) than countries on the right.

[gdp scatter]


**P40 · D2 · source line 152**

> Editorial note: Continue the comparison; “no visible relationship here” is narrower than asserting none exists. Label the mechanism as a possibility. F5.


More of the same. There's no visible correlation between how rich a country is and how strongly its mortality is affected by the seasons. The cause is probably the same as above: richer countries offset their seasonality with stronger health systems and better adaptations.

[neighbour scatter]


**P41 · D1 → D3 · A4 · source line 156**

> Editorial note: Sentences 1–3: D1, the neighbour result. Sentence 4: D3, error/correlation/skill. Sentence 5: D2, competing proxies and metric caveat. F6.


How about neighbouring countries? That's better. There's a strong correlation here. Bordering-neighbour adjacency is the strongest proxy — the lowest median error, the highest correlation, and the only one with positive skill against both the mean-curve floor and latitude. Latitude and climate class land close together just behind, with climate edging latitude on the typical country.

:::accordion

## How the proxies actually score · Leave-one-out scores for all five proxies


**P42 · D2 · A4 · source line 162**

> Editorial note: Explain holding out one known curve as a test. Detailed RMSE and skill definitions in the figure belong at D3. F6.


Those are claims about error and skill, so here they are measured. Every country that reports a curve is hidden in turn, predicted from each proxy in place of its own data, and scored against the observed shape.

[prediction comparison]

:::

## So how did your ranking do?


**P43 · D1 · source line 170**

> Editorial note: Reveal the result to readers who ranked and readers who skipped. Explain the separate scoring question first; F6.


You put the five in an order before any of this was on screen. Here is the order the charts above actually produce, and where your guess landed against it.

[proxy scorecard]

## Bordering regions, not just bordering countries


**P44 · D2 → D3 · A4 · source line 176**

> Editorial note: Sentences 1–2: D2, regional borrowing and its measured performance. Sentence 3: D3, named imputations and quality criteria. Avoid treating correlation as proof of a mechanism. F6.


Adjacent regions inside the same country track each other even more tightly than bordering countries do. That agreement is why the nearest-region reconstruction beats every other region-level proxy. Two Russian regions, Ingushetia and Chukotka, had unusable raw weekly data — zero-rate weeks or excessive spike noise — and are imputed from the average of their nearest good neighbours rather than shown as-is or dropped.

[region neighbour scatter]

:::accordion

## The same test over regions · Median error across 297 Admin-1 regions

[region prediction comparison]

:::

## Where the extra deaths fall, month by month

[amplitude map]


**P45 · D1 · source line 192**

> Editorial note: Keep the map-reading sentence after defining the baseline. Qualify hemisphere symmetry and monthly-equivalent quantities; F7.


Each square is a half-degree cell of the same grid the globe samples, coloured by the deaths this month's season adds to, or takes from, an ordinary month there. Drag through the year and the hemispheres trade places: Europe's January surplus is southern Africa's January deficit, and by July they have swapped.


**P46 · D1 → D2 · A5 · source line 194**

> Editorial note: D1: state that map detail exceeds measurement detail. D2: specific coverage, observed/imputed/modelled units and outline legend. Correct the map/globe distinction; F7.


The texture inside a country is population, not seasonality. Ten countries have measured regional curves, and inside this frame that comes down to South Africa, western Russia, and climate-modelled India and China; Europe has none at all. Everywhere else every cell of a country shares one curve, and the outlines say which unit that curve belongs to — solid where somebody counted deaths in it, dashed where it was reconstructed from a neighbour, a climate class or a latitude. What changes from cell to cell inside one of those borders is how many people live there, not when they die.

### conflicts · A war is not a Poisson process [Conflicts] · #eeb87d


**P47 · D1 → D2 · source line 198**

> Editorial note: Sentences 1–2: D1, why recent conflicts need attention; remove unsupported “largest”. Sentences 3–4: D2, reporting cadence and centroid source. The fact that locations are approximate must also be in a D1 caption; F8.


The previous layers capture long-term mortality trends, which account for most deaths worldwide. But current mortality also needs finer-grained factors, the largest being conflicts. ACLED's real-time Research feed publishes weekly country and Admin-1 aggregates with fatalities and regional centroid coordinates. Those centroids are an approximation, not individual event locations.


**P48 · D2 → D3 · source line 200**

> Editorial note: D2: explain that reported conflict fatalities add to the baseline. D3: the common publication cutoff and 12-week window. It is not another multiplicative factor; F8.


For all other layers we multiplied the base crude death rate by a seasonality or density factor. Here we get 12 complete, reported weeks ending at the oldest publication date shared by all six ACLED regions. So what is our factor for the current week?


**P49 · D1 → D2 · source line 202**

> Editorial note: D1: favour recent weeks, reduce extreme values, and state the cost during escalation. D2: name EWMA and explain its weights. F8.


We use a recency-weighted average to estimate the current week's mortality. Specifically, a robust exponentially weighted moving average (Robust EWMA): _use recent weeks more than older weeks, but damp suspiciously extreme values before averaging_.


**P50 · D3 · source line 204**

> Editorial note: Worked example introduction; keep with all following calculations, not stranded when they are hidden.


For example:


**P51 · D3 · source line 206**

> Editorial note: Make this a self-contained seven-week example, distinct from the 12-week production calculation; F8.


Take seven weeks from the 12-week window:


**P52 · D3 · source line 208**

> Editorial note: Input table for the worked example. Keep its explanation and result in the same expandable unit.


| Week       |   1 |   2 |   3 |   4 |   5 |   6 |   7 |
| ---------- | --: | --: | --: | --: | --: | --: | --: |
| Fatalities |  20 |  22 |  21 |  90 |  24 |  26 |  28 |


**P53 · D3 · source line 212**

> Editorial note: Define percentile and explain the interpolation convention if reproducibility matters.


We calculate the 10th and 90th percentiles.


**P54 · D3 · source line 214**

> Editorial note: Percentile table. Values verified against robustEwma.


| Percentile |  Cap | Meaning                                         |
| ---------- | ---: | ----------------------------------------------- |
| P10        | 20.6 | About 10% of weeks have lower numbers than this. |
| P90        | 52.8 | About 90% of weeks have lower numbers than this. |


**P55 · D3 · source line 219**

> Editorial note: Introduce winsorisation in ordinary words before naming it.


Then we update the numbers above and below these caps:


**P56 · D3 · source line 221**

> Editorial note: Clipping table. Make explicit that the operation both raises low weeks and lowers high weeks.


| Week | Original value | Capped value | Change         |
| --: | -------------: | -----------: | -------------- |
|   1 |             20 |         20.6 | Raised to P10  |
|   2 |             22 |           22 | Unchanged      |
|   3 |             21 |           21 | Unchanged      |
|   4 |             90 |         52.8 | Lowered to P90 |
|   5 |             24 |           24 | Unchanged      |
|   6 |             26 |           26 | Unchanged      |
|   7 |             28 |           28 | Unchanged      |


**P57 · D2 → D3 · source line 231**

> Editorial note: Sentence 1: D2, the half-life concept for widget users. Sentence 2: D3, validation limitation and default. The chosen value can also appear as a widget label.


To calculate the weights we choose a half-life: how many weeks it takes to halve a week's impact on the final estimate. A fitted value would require a longer validation exercise; here the production default is four weeks.


**P58 · D3 · source line 233**

> Editorial note: Introduce the weight table; retain with the worked example.


So the weights to halve the impact every four weeks look like this:


**P59 · D3 · source line 235**

> Editorial note: Weight table. Explain that the weighted mean divides by the sum of weights, not the count of weeks.


| Week | Weight | Note                        |
| --: | -----: | --------------------------- |
|   1 |  0.354 |                             |
|   2 |  0.420 |                             |
|   3 |  0.500 |                             |
|   4 |  0.595 |                             |
|   5 |  0.707 |                             |
|   6 |  0.841 |                             |
|   7 |  1.000 | Most recent complete week   |


**P60 · D3 · source line 245**

> Editorial note: Verified seven-week result, about 28.4. Do not present as the actual current estimate.


Then we do a weighted average using these weights. Which gives us 28.4.


**P61 · D1 → D3 · source line 247**

> Editorial note: Sentence 1: D2, author-chosen parameters. Sentence 2: D3, default, spatial allocation and annualisation. Sentence 3: D1 next to any exposed widget, its sliders do not change the globe. Add the D1 clipping tradeoff in F8.


Both choices — how fast a week's influence decays, and how hard the extremes get pulled in — are mine, not the data's. The globe always uses the default four-week/P10–P90 result, distributed by each Admin-1 region's share of the 12-week fatalities and annualised. The sliders below are a counterfactual demonstration; dragging them does not change the globe.

[widget to update half life, curve smoothness, and see prediction]

[map of conflict fatalities]


**P62 · D2 · source line 253**

> Editorial note: Explain reported locations versus sampled cell locations. A short “approximate regional locations” note belongs in the D1 caption. F8.


The map reports fatalities over the same 12 complete weeks at ACLED's Admin-1 centroids. For the globe, each centroid is assigned to the nearest populated sampling-grid cell within the same country.

### who · Who · #d9dbdd · chapter

:::chapter-sub

**P63 · D1 · source line 258**

> Editorial note: Good chapter promise. Make clear this is a possible synthetic person, not a record of a death. F1/F9.


Every flash gets a sentence, drawn from the distribution of the place it fired in.
:::

# Age, then sex, then one cause


**P64 · D2 → D3 · A6 · source line 263**

> Editorial note: Split the long sentence. D2: what supplies age/sex and cause, and why pre-pandemic. D3: edition versus publication/reference year, hierarchy and top-eight truncation. Correct national-only implication; F9.


**Age and sex** come from the UN World Population Prospects table of deaths by age and sex, in its 2023 figures. **Cause** comes from the World Health Organization's Global Health Estimates — the 2021 release, read at 2019, the last year before the pandemic, so that COVID-19 is not drawn as how people ordinarily die — taken at its most specific level — the recognisable causes, not the clinical groupings above them — and reduced to the strongest eight per country, sex and age band, with everything else folded into "other causes".


**P65 · D1 → D2 · A7 · source line 265**

> Editorial note: D1: the attributes are drawn together plausibly. D2: conditional sampling and actual sex→age→cause order. Delete the unsupported causal-order punchline; F9.


They are sampled **in that order**, so a cause is only ever drawn from the age and sex band that plausibly dies of it. Draw the cause first and you get twenty-year-olds with dementia.


**P66 · D3 · A8 · source line 267**

> Editorial note: Packaging and source-selection history. Keep the first-person download constraint if useful, qualify offline access, and date platform-specific rules.


Both tables ship as JSON in the repository, so the feed needs no runtime API call and reads the same offline. The cause table used to come from the IHME Global Burden of Disease, hand-exported from a results tool that puts every download behind a sign-in and a hundred-thousand-row cap. The WHO table is one request and no account, which is most of why it is the one here.


**P67 · D2 → D3 · A8 · source line 269**

> Editorial note: D2: regional cause information is partial, with a rounded coverage takeaway. D3: export arithmetic, download history and measured coverage denominators. Remove the unproved 24.5% intersection; F10.


Getting cause below the country level means going back to IHME, and back to that cap. The subnational export is 723 places by 22 age groups by two sexes by 22 cause groups — seven hundred thousand rows, or eight downloads, against an allowance that is spent per release and never refills. So the eight were ordered by how many deaths each carried rather than by the order the tool lists them in. The allowance ran out after the first. That one download holds cardiovascular disease, the cancers and chronic respiratory disease — 55% of all deaths — at regional resolution; in the tool's own order the same single download would have held about a tenth of that. It is in the feed, and it is worth being exact about how far it reaches, because two different fractions are at work. The regions cover **44.6%** of the deaths drawn; the three groups are **55.0%** of the causes. Only where both hold does the region decide, so **24.5% of all cause draws** now move with the place rather than the country. The rest keep the national mix.


**P68 · D2 · source line 271**

> Editorial note: Introduction to the coverage table. Define “derived” and the denominator first; F9/F10.


What the feed knows, by share of the deaths it draws:


**P69 · D2 → D3 · source line 273**

> Editorial note: D2: rounded regional/derived/national age-sex coverage. D3: detailed cause coverage after clarifying denominators and complement adjustment. F10.


| Layer                  | Resolved from the region | Derived | National |
| ---------------------- | -----------------------: | ------: | -------: |
| Age and sex            |                    44.6% |   51.8% |     3.6% |
| Cause, those 3 groups  |                    44.6% |       — |    55.4% |
| Cause, the other 19    |                        — |       — |     100% |


**P70 · D3 · A9 · source line 279**

> Editorial note: Explain the regional/national ratio, conditional strata, complement and normalisation with one numerical example. F10.


The reweighting is a ratio, not a replacement. Twenty-two clinical groups cannot carry eighty-seven named causes, so GBD is never asked to name anything: for each region, age band and sex it supplies one number per group — that group's share of deaths there, over its share nationally — and the WHO labels inside the group are multiplied by it. Everything outside the three groups moves together on the remainder, so the three cannot quietly inflate.


**P71 · D1 → D3 · A10 · source line 281**

> Editorial note: Extract a D1 sentence saying regional coverage is incomplete and small regions can disappear in the grid. Put the source-access history and verified counts at D3. The existing 17/2.6% claims need reconciliation; F10.


Three things are still pending, and none of them is a detail. Nineteen of the twenty-two groups have no regional data at all, which is seven downloads still owed by an allowance that has not refilled. Fifty-five percent of deaths happen outside the 474 regions — all of China among them, which has no subnational units here — and draw a national cause mix. And seventeen of the regions are cities too small for a half-degree grid cell to award them: Delhi, Ōsaka, Greater London, Mexico City, Jakarta, Manila and eleven more win no cell of their own, so their deaths are drawn with the surrounding region's mix. That is 2.6% of the deaths inside the regions, and it is the grid's fault rather than the data's.

[sampling order]

# Then the month tilts it


**P72 · D1 → D3 · A11 · source line 287**

> Editorial note: Sentence 1: D1, month can affect the persona too. Sentence 2: D3, replace stale twelve-point representation and annual-share guarantee. Sentence 3: D2, distinguish measured phase from transferred assumptions. F11.


The same three tables do not give the same answer in January as in July. Every age band and every cause group carries a twelve-point curve, normalised to average one across the year, so the annual totals stay exactly what the tables say while the mix inside a month moves: a northern winter draws older, and more respiratory. South of the equator those curves run half a year out of phase, which is measured rather than assumed.


**P73 · D2 → D3 · A11 · source line 289**

> Editorial note: D2: distinct age/cause sources, sparse donor coverage and no direct adjustment for some causes. D3: chapter/leaf mapping, 55/87 counts, top-eight residual and renormalisation. Explain that unmapped labels and a deliberately unadjusted residual are different limitations; F11.


The curves come from monthly death records in Brazil and Mexico — the only two countries here whose microdata carries a date and a cause together — and reach everywhere else through the same climate-zone transfer the seasonality chapter uses. Age is covered completely. Cause is not: 55 of the 87 labels borrow the curve of their ICD-10 chapter, and the other 32 are left flat, multiplied by one. The largest of them is "other causes" itself — the residual that the strongest-eight truncation folds everything else into, typically a third of the weight in the adult bands and up to a half. Leaving it flat is a decision rather than an oversight: it is a bag of unrelated deaths with no chapter of its own, and handing it the average death's curve would assert a shape I have not measured.

[deaths by age and cause]

### still-missing · What is still missing [Still missing] · #cf7a68 · chapter-small

:::chapter-sub

**P74 · D1 · source line 296**

> Editorial note: Replace absolute “no source good enough” with a description of the remaining evidence and model gaps. F12.


Layers with a clear place in the model and no source good enough to fill it.
:::

:::accordion

## Ongoing epidemics · Planned · source to be decided


**P75 · D2 · A12 · source line 303**

> Editorial note: Explain epidemic timeliness, attribution and overlap without dismissing estimation. Give D1 readers a short statement that current epidemics are not explicitly modelled; F12.


Epidemics raise mortality in specific regions and periods by a measurable amount. Excess-mortality estimates are the right measure and arrive months late; outbreak feeds arrive quickly and report cases, not deaths. Until something updates faster than the model itself, an epidemic layer would be fiction dressed as data.

## Time of day · Needs a published curve


**P76 · D2 · A12 · source line 307**

> Editorial note: Remove the unsourced all-cause early-hours claim. State what evidence a time-of-day layer would need; implementation details belong at D3. F12.


Deaths cluster in the small hours, and the globe already knows the local hour of every cell — the subsolar point lights it. The layer would plug into the weights without changing the runtime at all. What is missing is a curve worth plugging in.

## Sub-national age structure · Partially available


**P77 · D2 · source line 311**

> Editorial note: Stale implementation claim: replace with the actual remaining regional age/sex gaps. Its short coverage limitation belongs at D1 too; F12.


Personas currently use a national age distribution, so a death in a rural Spanish province gets the same age draw as one in Madrid. Regional age pyramids exist for Europe and would sharpen the feed considerably; elsewhere they are the same patchwork problem as regional rates.

:::

### back-to-the-globe · Back to the globe · #000000 · hidden

:::end-block

# Now you know what the flashes mean.


**P78 · D1 · A13 · source line 321**

> Editorial note: Keep the invitation; consider cutting the instruction about how it should feel.


Go back and watch them again. It reads differently.

:::end-fine

**P79 · D1 · source line 324**

> Editorial note: Essential interpretation, visible at all depths. Move its substance to the opening as well; F1.


The globe is statistical, not a feed of individual records. A flash and its persona are a representative event drawn from public aggregate data, never an identifiable death. A personal project exploring statistical mortality visualisation.
:::

[pull up for the globe]

:::
$$

---

## Figure and heading depth plan

Headings must remain with visible content rather than opening an empty section. The source's `### key · title · colour` and `[slot]` strings below are technical identifiers, not proposed reader-facing copy.

| Figure or section                                     | Minimum view | Treatment                                                                                                                                                                            |
| ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Both blinking strips                                  | D1           | Keep comparison and model qualification together.                                                                                                                                    |
| Random global map and ocean tally                     | D1           | Explain random area sampling and the populated-cell definition.                                                                                                                      |
| Country-rate map                                      | D1           | Include the rate unit and disclose accelerated timing.                                                                                                                               |
| Border closeups                                       | D2           | Open after the population takeaway; allocation mechanics at D3.                                                                                                                      |
| Asia density map and scale toggle                     | D1           | Keep the log-scale explanation visible.                                                                                                                                              |
| Japan regional map and national/regional bars         | D1           | One continuous regional-variation argument with a short age-structure bridge.                                                                                                        |
| Seasonal country curves                               | D1           | Show the pattern before discussing fits; explain any hemisphere alignment.                                                                                                           |
| Smoothing explainer                                   | D2           | Start with the visible smoothness tradeoff; harmonic-order mechanics at D3.                                                                                                          |
| Proxy ranking and five scatterplots                   | D2           | Optional exercise; D1 gets a short missing-data explanation and neighbour takeaway. Figure-reading instructions are D1 language but appear only when their parent figure is visible. |
| Country prediction comparison                         | D3           | Show metrics, baselines and coverage together. D2 retains a plain explanation of holdout testing.                                                                                    |
| Proxy scorecard                                       | D2           | Support skipped ranking; distinguish association from prediction error.                                                                                                              |
| Regional neighbour scatter                            | D2           | Follow the country result; do not imply independent evidence of causality.                                                                                                           |
| Region prediction comparison                          | D3           | Show cohort and eligibility information beside the score.                                                                                                                            |
| Seasonal amplitude map                                | D1           | Define colour, baseline and measured-versus-estimated outlines; exact monthly-equivalent formula at D3.                                                                              |
| Conflict estimate widget                              | D2           | Keep half-life explanation and counterfactual-control note visible. Tables and percentile calculation at D3.                                                                         |
| Conflict map                                          | D1           | Label reported period and approximate locations; include the lag and smoothing limits.                                                                                               |
| Persona/sampling example                              | D1           | Explain synthetic identity; D2 expands conditional sampling and sources. Correct the displayed step order.                                                                           |
| Age/cause distribution chart                          | D2           | Clarify the distinction between share of all deaths and cause mix within an age group.                                                                                               |
| Limitations accordions                                | D2           | D1 also needs a short visible limitations paragraph, rather than hiding all caveats.                                                                                                 |
| Return-to-globe invitation and statistical disclosure | D1           | Keep at every depth.                                                                                                                                                                 |

The D1 route needs the short connecting sentences proposed in the review before these scores can become hide/show rules. Hiding all D2/D3 blocks in the current manuscript would leave unresolved transitions and references to absent figures.

## English copy outside the manuscript

The page also contains paragraphs in `lib/i18n/en.ts` and `lib/i18n/en.charts.ts`. These should follow the same depth system. Short controls, units and accessible descriptions stay with their parent figure; an axis label should never disappear while its figure remains visible.

| Dictionary passage                                                 | Depth   | Editorial instruction                                                                                                                                                       |
| ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chrome.hero`, `globe.latest`, `globe.canvasLabel`                 | D1      | Make the simulated nature clear at first contact. “Latest death” should read “Latest simulated death” if otherwise ambiguous.                                               |
| `proxy.modal.instruction` and `.closing`                           | D2      | Keep with the optional exercise. Explain precisely which test determines the eventual score.                                                                                |
| `proxy.defs[0].body` · GDP                                         | D2      | Sentence 1 needs narrower availability and predictor claims. Sentence 2 explains the useful borrowing idea. Define GDP per capita as economic output per person.            |
| `proxy.defs[1].body` · neighbours                                  | D2      | Keep the concrete cases as hypotheses about similarity, not evidence that every listed trait determines seasonality. Keep the missing-donor caveat.                         |
| `proxy.defs[2].body` · climate                                     | D2 → D3 | D2: why similar climates might help. D3: choosing a classification and the size-versus-donor-coverage tradeoff. Define a donor as a place whose measured curve is borrowed. |
| `proxy.defs[3].body` · latitude                                    | D2      | The Lisbon/Beijing comparison is useful; remove or source the extreme temperature and add units. “Second-degree proxy” can be “an indirect proxy for climate”.              |
| `proxy.defs[4].body` · older population                            | D2      | Explain the hypothesised relationship and possible confounding by wealth. Treat both as expectations to test.                                                               |
| `proxy.scorecard.intro`                                            | D2 → D3 | D2: how much the proxy tracks the seasonal swing. D3: absolute Pearson correlation versus correlation ratio and their limits.                                               |
| `proxy.scorecard.note`                                             | D2 → D3 | D2: association and prediction are different tests. D3: sample coverage, close rankings and comparison caveats. Put the distinction before the score too.                   |
| `panels.deathsByAgeCauseCopy`                                      | D2      | Define each denominator, especially cause mix within an age band.                                                                                                           |
| `panels.ewmaCopy`                                                  | D2      | The controls' effect belongs beside them; technical defaults can be D3 or concise labels.                                                                                   |
| `panels.conflictMapCopy`, `charts.conflictMap.lead`                | D1 → D2 | D1: recent reported fatalities at approximate locations. D2: relocation to populated cells and addition to the baseline.                                                    |
| `ewma.halfLifeNote`                                                | D2      | Retain whenever the slider is available.                                                                                                                                    |
| `ewma.dampingNote`                                                 | D2      | Explain clipping as a choice and its cost; “the massacre counts in full” should not imply that the model has identified a particular event as a massacre.                   |
| `charts.beatStrip.poisson`                                         | D1      | Replace “real distribution” with “Poisson model”; F1.                                                                                                                       |
| `charts.dartTally.uninhabitedNote` / `.inhabitedNote`              | D2      | Clarify that these describe grid coverage. The D1 label must not imply a census of permanent settlements at every point.                                                    |
| `charts.nationalVsRegional.copy` / `.note`                         | D1      | Keep the local-comparison takeaway and units; replace “wrong for every single region”; see the review.                                                                      |
| `charts.smoothing.copy`                                            | D2      | Explain using the same input records to compare methods.                                                                                                                    |
| `charts.smoothing.modes.*.how`                                     | D3      | Reproducible operation, with terms defined.                                                                                                                                 |
| `charts.smoothing.modes.*.goodFor` / `.watchOut`                   | D2      | Benefits and costs are useful to a technically curious reader even without fitting details.                                                                                 |
| `charts.smoothing.orders.*.how`                                    | D3      | State frequencies accurately: order four contains 1, 2, 3 and 4 cycles per year, not four copies of an annual cycle.                                                        |
| `charts.smoothing.orders.*.goodFor` / `.watchOut`                  | D3      | Explain flexibility versus fitting reporting noise; these depend on choosing an order.                                                                                      |
| `charts.pop65Scatter.footnote`, `charts.neighbourScatter.footnote` | D2      | Keep encoding and absent-donor information beside the visible chart.                                                                                                        |
| `charts.amplitudeMap.legendCaption` / `.phaseNote`                 | D1 → D3 | D1: direction, scale and that this is modelled. D3: the monthly-equivalent computation and sampling of the fitted curve.                                                    |
| `charts.personaDemo.note`                                          | D2      | Replace “heaviest single cell” with an explanation of which age/sex entry is being shown, and correct the dementia claim; F9.                                               |
| `charts.prediction.copy`                                           | D3      | Explain RMSE and the skill baseline, not only their direction.                                                                                                              |
| `charts.prediction.cohortCopy` / `.cohortNote`                     | D3      | Retain the overlap, eligibility and data-poor-versus-registration distinction.                                                                                              |
| `charts.prediction.latitudeCopy` / `.subclassCopy`                 | D3      | Retain weighting, group boundaries and small-group limitations.                                                                                                             |
| `charts.regionPrediction.copy`                                     | D3      | Give the eligible sample and comparison scope.                                                                                                                              |
| `charts.cohorts.*Note`                                             | D3      | Technical definitions stay with validation results.                                                                                                                         |
| `globe.math` descriptions and values                               | D3      | Optional inspection of one draw; distinguish probabilities from evidence that an actual person died.                                                                        |
