# Low-risk editorial changes for the English article

This report tracks corrections that can be applied without reorganising the article, changing its central visual idea, or making a new modelling decision. They either correct a statement against the current data and code, narrow a claim to what the evidence shows, or make a technical explanation easier to read.

The first spelling and idiom pass has been applied to `docs/ROADMAP.md` and the English interface dictionaries. On 24 September 2026, items 2, 3, 6–11 and 13–14 were also applied. For item 15, the claims were retained and sources were added. Item 4 received sources without changing its text, and item 5 received only the requested coronavirus caveat. Item 1 was dropped. Item 12 remains pending.

Each item keeps its original rationale and proposed wording as an editorial record. Its status states whether the source article now contains the change.

## Change log and remaining recommendations

### 1. Separate the average from the metronome

**Status: dropped.** The article keeps its original framing, and this change is no longer recommended for application.

### 2. Describe the Poisson result as a model probability

**Status: applied on 24 September 2026.** The article now uses 365.25 days, gives the modelled zero-death probability, describes zero through four deaths as occurring in about 95% of one-second intervals, and states the independence and locally stable-rate assumptions.

Replace:

> probably somewhere between 0 and 4 (with ~95% certainty)

with:

> In this model, between zero and four people die in about 95% of one-second intervals.

Using 61.6 million deaths and 365.25 days gives an average rate of about 1.952 deaths per second. Under the Poisson assumptions, the probabilities are approximately 14.2% for no deaths, 27.7% for one, 27.1% for two, and 95.16% for zero through four. “Certainty” sounds like a confidence interval or empirical guarantee; this is a probability produced by the stated model.

Use 365.25 days consistently in both the prose and the equation. Describe independence and a locally stable rate as assumptions rather than implying that the annual average alone proves a Poisson process.

### 3. Correct the mortality source and unit

**Status: applied on 24 September 2026.** The passage now attributes the baseline crude death rate to the World Bank, gives the unit as deaths per 1,000 people, and removes the equal-chance comparison between differently sized countries.

Replace the WHO attribution in the country-rate passage with:

> The World Bank publishes estimates of crude death rate: the number of deaths in a year for every 1,000 people. Combining that rate with population gives us an expected number of deaths in each country.

The WHO supplies the cause-of-death estimates used later in the article, not the baseline crude death rates. Regional figures may still be displayed per 100,000 if the conversion is clearly labelled.

Also replace the claim that a uniformly placed point has equal chances of landing in Mexico or Lithuania. Uniform sampling over the globe gives places probability in proportion to their area. A safe replacement is:

> This is already a large improvement over placing points without taking account of where people live.

### 4. Correct the Mexico–Lithuania example

**Status: sources added; text retained.** The article now links the World Bank life-expectancy and crude-death-rate series for Mexico and Lithuania in 2000. The prose remains unchanged by request.

The current World Bank series does not reproduce every rounded value in the prose exactly. That factual discrepancy remains recorded here rather than being silently resolved through a wording change.

### 5. Add a pandemic caveat to the seasonality claim

**Status: applied as requested.** The original phrasing remains. It is now followed by a sentence identifying the coronavirus pandemic as the obvious exception and explaining that 2020–2022 are excluded from the fitted curves. No other changes from the original item 5 proposal were applied.

### 6. Correct the GDP interpretation

**Status: applied on 24 September 2026.** The copy now distinguishes the association visible in the GDP shading from the untested offsetting mechanism. The following scatterplot paragraph also treats healthcare and adaptation as a possible explanation rather than a conclusion.

The relevant passage is in `docs/ROADMAP.md`, in the paragraph following the population-over-65 scatterplot.

Replace:

> Possibly because richer countries tend to have older populations and one thing offsets the other. Shading the countries by GDP per capita confirms this: countries on the left are lighter (poorer) than countries on the right.

with:

> Richer countries also tend to have older populations, which may be part of what we're seeing. The GDP shading supports that association: countries with fewer older people tend to be poorer than countries with more older people. It does not tell us whether wealth offsets seasonal mortality.

The shading can support an association between GDP and the share of older people. It cannot confirm the proposed offsetting mechanism.

In the following GDP scatter paragraph, replace “There's no visible correlation” with “There's no clear relationship in this sample”, and retain the healthcare/adaptation explanation as a possibility rather than a conclusion.

### 7. Define amplitude according to the implementation

**Status: applied on 24 September 2026.** The overview calls amplitude the strength of the seasonal swing, while the methods passage defines it as the root-mean-square deviation of the fitted curve from its annual mean.

The charts calculate amplitude as the RMS deviation of the fitted curve from its annual mean. The current prose describes it as the difference between summer and winter, which is not the implemented measure and does not fit tropical or multi-peak curves.

Use this in the main text:

> Higher dots mean a stronger seasonal swing.

Reserve the exact definition for the deepest view:

> Amplitude is the root-mean-square deviation of the fitted seasonal multiplier from its annual mean.

### 8. Separate the two proxy evaluations

**Status: applied on 24 September 2026.** The article now distinguishes the amplitude-ranking exercise from leave-one-out curve reconstruction, renames the reconstruction table, and scopes the neighbour result to the tested countries with measured curves.

The five-proxy scorecard measures association with seasonal amplitude. The leave-one-out table tests how well a method reconstructs a complete hidden curve. These are different questions.

Before the scorecard, add:

> The ranking exercise asked which proxy tracks the size of a country's seasonal swing. The next test is stricter: can that proxy reconstruct the whole curve when we hide it?

Rename “Leave-one-out scores for all five proxies”. The table contains three candidate methods plus a mean-curve baseline, not all five proxies. A suitable title is:

> Leave-one-out reconstruction scores

The current validation data supports the conclusion that borrowing from neighbouring countries performs best among the tested methods. Keep that conclusion scoped to countries with curves available for validation.

### 9. Describe conflict data as recent reported estimates

**Status: applied on 24 September 2026.** The article and English chart copy now describe reported ACLED fatalities and a recent weekly estimate. The seven-week example is labelled as an invented illustration, the twelve-week production window is explicit, and the damping tradeoff mentions that escalation can be understated.

Replace “real-time Research feed” and “the current week's mortality” with language such as:

> ACLED publishes weekly aggregates of reported conflict fatalities. I use the most recent complete window to estimate a recent weekly rate.

Replace “suspiciously extreme values” with “extreme values”. A very high count may be a real escalation rather than a bad observation.

Add the main tradeoff beside the explanation:

> This makes the estimate less sensitive to a single week. It also means a sudden escalation can be understated.

Label the seven-week table as a self-contained illustration. The production calculation uses a twelve-week window. Its numerical result, about 28.4, is correct for the seven values shown.

### 10. Correct the persona sampling explanation

**Status: applied on 24 September 2026.** The heading, article copy and chart steps now follow sex, age and cause. The explanation describes conditional sampling and removes the dementia example.

The implementation samples sex first, then age conditional on sex, then cause conditional on both. Replace the heading “Age, then sex, then one cause” with:

> Sex, age, then cause

Replace:

> They are sampled in that order, so a cause is only ever drawn from the age and sex band that plausibly dies of it. Draw the cause first and you get twenty-year-olds with dementia.

with:

> The age, sex and cause are drawn together rather than independently. Once age and sex have been selected, the cause comes from the distribution for that group. This avoids combinations that would be very unlikely in the source data.

The problem is independence, not the act of drawing cause first. A model could draw cause first and then condition age and sex on it.

### 11. Clarify the WHO data vintage

**Status: applied on 24 September 2026.** The article now identifies the GHE 2021 edition, its 2024 publication, and the 2019 estimates as separate facts.

Replace “the 2021 release, read at 2019” with:

> the GHE 2021 edition, using its estimates for 2019

The edition, publication date and reference year are separate facts. The WHO's recommended citation dates the GHE 2021 edition to 2024.

### 12. Remove the unsupported 24.5% cause-coverage figure

**Status: applied on 24 September 2026.** The section now distinguishes the sources for age and cause curves, identifies the 24 Eurostat age-source countries and the Brazil and Mexico cause sources, describes the continuous order-4 harmonic representation, preserves the 55-of-87 cause-label coverage limit, and explains why mean-one curves alone do not guarantee exact annual category shares after conditional weights are combined.

The current 24.5% value multiplies two marginal percentages: the share of baseline deaths falling in covered cells and the overall share of deaths assigned to three cause groups. That multiplication does not establish the share at their intersection.

Use the supported claim:

> Regional cause data reaches cells containing about 45% of the model's baseline deaths. It changes the weights of three broad cause groups; the remaining causes keep their proportions relative to one another.

Remove the exact 24.5% figure unless it is replaced with a joint, draw-weighted calculation. Counts involving 723 exported places, 474 source regions, 444 archetypes, 17 unmatched cities and 2.6% should also be reconciled before publication because they describe different populations or appear to come from different data versions.

### 13. Correct the seasonal persona sources and representation

**Status: pending.**

The current implementation uses different sources for age and cause seasonality:

- Age curves are measured from Eurostat data for 24 European countries.
- Cause curves are measured from records in Brazil and Mexico.
- The shipped curves are continuous order-four harmonic fits. Twelve monthly values are a display representation, not the stored model.
- The current data maps 55 of 87 cause labels to a seasonal curve; 32 remain without a direct seasonal adjustment.

A safe overview replacement is:

> The time of year can also change the age and cause we draw. I estimate those changes from the records available, then borrow patterns for countries without their own data. That borrowing is one of the less certain parts of the model.

Remove the claim that mean-one curves guarantee that each age or cause category preserves its exact annual share. The composition is renormalised after applying several conditional weights, so mean-one multipliers alone do not guarantee category-level annual calibration.

### 14. Update the stale “still missing” age paragraph

**Status: applied on 24 September 2026.** The closing section now describes the remaining regional age and sex gaps, states what evidence a time-of-day layer would require, and gives the source and double-counting problems that an epidemic layer must solve.

The current article says personas use a national age distribution. Regional and locally derived estimates are already in the model.

Replace that paragraph with:

> Regional age and sex estimates already shape many of the personas. The remaining gaps are places where I still have to infer the mix, or where the grid is too coarse to preserve a small region.

For time of day, a safe interim version is:

> I haven't included a time-of-day pattern. To do that, I'd need evidence that can be applied across populations and causes.

For epidemics:

> An epidemic layer needs timely death estimates and a way to avoid counting deaths already in the baseline. I haven't settled on a source and method for that.

These versions state what is missing without making unsupported universal claims.

### 15. Add sources for the factual claims

**Status: applied on 24 September 2026.** The claims were retained, as requested, and the source article now identifies the evidence behind them:

| Claim                                                                                                | Source added                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Russia's country-centroid point lands at Lake Vivi, roughly 400 kilometres from the closest hospital | The Russian Geographical Society identifies Lake Vivi as Russia's geographical centre; a Siberian Federal University regional study places it 366 kilometres from Tura and identifies Tura's central district hospital. |
| Random land points overwhelmingly miss permanent settlements                                         | The paragraph now identifies the GPWv4 population-density grid used to classify the sampled cells.                                                                                                                      |
| The Indo-Gangetic Plain contains about one-seventh of humanity                                       | A linked _Scientific Reports_ paper states that population share for the region.                                                                                                                                        |
| Akita's crude rate is nearly twice Tokyo's                                                           | Japan's official 2023 table gives 19.3 deaths per 1,000 in Akita and 10.2 in Tokyo, alongside age-standardised rates of 14.4 and 12.3.                                                                                  |
| Most of the regional gap is age structure                                                            | Eurostat's mortality metadata explains how strongly population structure influences broad crude death rates; the Japan table shows most of the Akita–Tokyo gap disappearing after age standardisation.                  |
| The national rate differs from every region in the chart                                             | The article now links the 2023 Eurostat regional crude-death-rate table used for the comparison.                                                                                                                        |
| Static JSON lets the feed run offline                                                                | The paragraph now links directly to the two JSON files shipped with the application.                                                                                                                                    |

## Low-risk voice edits

**Status: not applied as a separate pass.** A few phrases changed while applying the numbered factual corrections; the remaining bullets are still proposals.

The following changes bring the later sections closer to the direct, exploratory voice of the opening without imposing a new style:

- Split the long WHO source sentence into three sentences: source, reference year, and top-eight grouping.
- Replace release-note language such as “quality-gated”, “production curve” and “mean-curve floor” in the main narrative. Keep exact terms in the deepest methods view.
- Replace “a ratio, not a replacement” and the personified explanation that GBD is “never asked to name anything” with a direct description of reweighting and normalisation.
- Replace “Three things are still pending, and none of them is a detail” with “There are still gaps”, followed by the actual gaps.
- Replace “fiction dressed as data” and “a curve worth plugging in” with the concrete evidence or method that is missing.
- End with “Go back and watch them again.” The following sentence, “It reads differently”, tells the reader what reaction to have and can be removed.

These are not claims that a machine wrote the passages. They identify places where the later prose stops sounding like the person speaking in the opening.

## Changes to hold for a separate decision

The following recommendations are useful but not low risk enough to fold into a mechanical correction pass:

- Changing the hero line “Every flash is a death”. The simulation disclosure should appear earlier, but the exact hero wording is a central tonal and product decision.
- Reordering sections or moving figures.
- Changing the chapter title “A war is not a Poisson process”.
- Replacing the full Poisson derivation.
- Resolving the difference between the regional detail shown in explanatory maps and the country-level rate and seasonal timing used by the globe. This could be handled in prose or implementation.
- Implementing the three reading-depth views. The current article needs bridge paragraphs and some paragraph splitting before visibility rules can be added safely.

## Suggested order for the remaining work

1. Resolve the unsupported cause-coverage calculation in item 12.
2. Apply any desired voice edits that do not move content.
3. Read the page in a browser to confirm that captions and transitions still refer to visible material.

Item 12 is now the highest-risk unresolved factual issue because the published 24.5% figure is inferred by multiplying two marginal percentages rather than measuring their intersection.
