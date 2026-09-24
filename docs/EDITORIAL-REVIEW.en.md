# English editorial review

Reviewed 22 September 2026 against the English manuscript, English interface and chart dictionaries, committed data, and the relevant sampling code. This is a content review from source, not a browser layout audit.

The article works best when you let us notice a problem with a picture and then build the next part of the model together. Preserve that. The biggest improvement would be to carry that approach through **Who**, where the narrative currently becomes a dense account of datasets, download limits and percentages before explaining what the reader sees.

## What has been applied

Only the first-pass spelling, grammar and idiom corrections are applied in `docs/ROADMAP.md` and `lib/i18n/en.ts`. Examples: “spacial” → “spatial”, “defunction” → “death” or “mortality”, “Antartica” → “Antarctica”, “on a given second” → “in a given second”, “home of” → “home to”, and agreement in “where there are more people”. Small punctuation repairs are included. Your questions, contractions, humour, fragments and deliberate repetitions remain. I have not standardised British/American spelling throughout.

Everything below was originally written as a proposal, including factual corrections. On 24 September 2026, the low-risk changes corresponding to items 2, 3, 6–11 and 14 in the follow-up report were applied, and sources were added for the claims collected under item 15. The companion [annotated manuscript](ROADMAP.en.annotated.md) marks every prose paragraph, plus tables and equations, by reading depth and flags the voice passages discussed here. It is an editorial document, not a new page or a working depth selector.

## The narrative and the voice

Your opening voice is conversational and exploratory. “Small problem though”, “This map is cheating a little bit”, “I just see a cloud of dots here” and the colonialism aside work because each belongs to a particular observation. You alternate “we” for the shared experiment and “I” for your own expectation or choice. Keep that distinction. A useful revision pattern is: **what I expected → what the picture shows → what I chose → what that choice misses**.

Suggested running order:

1. Establish immediately that the flashes are simulated. Then ask how to make them plausible.
2. Keep the metronome/random comparison, moving the Poisson derivation into the existing optional explanation.
3. Keep ocean → country → population grid. Explain a crude death rate before introducing CDR as an abbreviation.
4. Make regional variation one continuous argument: the Japan map, a short age-structure explanation, then the Spain/France comparison. “Borders are the wrong unit” currently opens a section with no connective prose and overstates what its chart demonstrates. Suggest “A national rate hides local differences”.
5. In **When**, show the seasonal pattern before explaining how you fit it. Move “Many temperate countries…” ahead of the smoothing widget. Follow with the missing-data problem and your proxy-ranking invitation.
6. Keep the proxy exercise optional. Give every reader its result in a sentence, and distinguish ranking amplitude associations from testing reconstructed curves. “You put the five in an order” needs a skipped-exercise variant, as the scorecard already has.
7. In **Conflicts**, explain first why recent reported deaths need another layer, then the smoothing choice and its cost. Keep the percentile tables in the deepest view, with the widget accessible at the middle level.
8. Start **Who** with one synthetic persona and explain where its attributes came from. Move the sampling illustration immediately after that explanation. Put source years, regional adjustments and limitations next; the download history comes last and is optional.
9. End with what remains uncertain. Keep “Go back and watch them again.” Consider cutting “It reads differently”, which tells the reader what their response ought to be.

The visual sequence should make one claim at a time. Define what a dot, ring, axis or colour means immediately beside the first figure that uses it. The density toggle needs one sentence explaining that a log scale makes large population differences visible. The seasonal map needs a plain baseline: a colour means a modelled departure from the annual-average rate, not deaths proved to have been caused or prevented by weather.

## Factual and explanatory corrections

References to manuscript lines below refer to the lightly edited `docs/ROADMAP.md`; paragraph IDs in the annotated copy remain useful if later edits move lines.

### F1. Explain “live” at the start, not only at the end

**Locations:** hero `chrome.hero`, chart `beatStrip.poisson`, opening, closing paragraph at line 324.

“Every flash is a death” and “the real distribution” suggest observed events or measured second-by-second timing. The final disclosure is good but arrives too late. Suggested hero: **“Every flash represents a simulated death.”** Suggested opening addition: “These aren't reports of people dying right now. The globe draws plausible events from mortality statistics.” Suggested beat-strip label: “Gaps drawn from a Poisson model: most are short, a few are long.” Keep this visible at every depth.

The country-centroid demonstration also deliberately accelerates the animation (`CountryCentroidMap.tsx`, `MEAN_GAP_MS`). Label it “Animation sped up; relative country frequencies preserved.” Otherwise readers may interpret all animations as operating at the global real-time rate.

### F2. The average is valid; the metronome is the mistaken interpretation

**Locations:** lines 18–48, 100–102, random modal.

“Two per second” is a valid approximate average, so “that is not true” makes the article argue against a claim it subsequently uses. Suggested replacement: “That's a useful average. But it doesn't mean two people die in every second.” Randomness and seasonal structure can coexist: seasonality changes the expected rate, while individual events can still be sampled randomly. Replace the later “something better than random” with “Can we improve on a rate that stays the same all year?”

Recalculation using the article's 61.6 million and 365.25 days gives λ ≈ 1.952, P(0) ≈ **14.2%**, P(1) ≈ **27.7%**, P(2) ≈ **27.1%**, and P(0–4) ≈ **95.16%**. The numerical argument works under its assumptions. Say “In this model, between zero and four people die in about 95% of one-second intervals”, rather than “95% certainty”. It is a model probability, not a confidence interval or empirical guarantee. Independence and an approximately constant local rate must be stated; knowing the average alone does not establish a Poisson process. [NIST Poisson reference](https://itl.nist.gov/div898/handbook/eda/section3/eda366j.htm).

Use a consistent year convention: the opening uses 365 days and the formula 365.25. More importantly, replace “the last couple of years we have observed” with a dated description of the model's inputs. `data/rate-grid.json` reports a **2024** baseline of **61,615,938.74 modelled annual deaths**. That is a model total, not proof of a measured worldwide total in each of several recent years.

For the deepest modal, replace the loose “λ^k counts the k instants” derivation with the actual limiting expression: `C(n,k)(λ/n)^k(1−λ/n)^(n−k) → e^(−λ)λ^k/k!`. The factorial removes event-order permutations; it does not remove the choice of which time intervals contained them.

### F3. Correct the source, units and spatial probabilities

**Locations:** lines 56–58; regional chart legends.

The baseline is from the **World Bank**, not the WHO; the WHO supplies the later cause estimates. World Bank CDR is expressed per **1,000** people. Per 100,000 is also a valid scale if converted and labelled, and the regional charts use it; explain the conversion rather than letting the manuscript silently switch scales. Suggested wording: “The World Bank publishes estimates of crude death rate: deaths per year for every 1,000 people. Combining that rate with population gives us an expected number of deaths in each country.” [World Bank indicator and source attribution](https://data.worldbank.org/indicator/SP.DYN.CDRT.IN).

Uniform random points do **not** give Mexico and Lithuania equal probabilities; probability depends on area. Replace “with equal chances…” with “without taking account of where people live”. “Virtually all” countries overcount or undercount needs evidence; “Registration quality varies, so the figures include estimates” is sufficient.

### F4. Keep the age-structure example, correct its numbers

**Location:** line 84.

Current World Bank API values for 2000: Mexico **72.562 years**, **5.481 deaths per 1,000**; Lithuania **72.020 years**, **11.1 per 1,000**. This is about **twice**, not nearly three times. Suggested replacement: “In 2000, life expectancy was around 72 years in both Mexico and Lithuania. Yet Lithuania had about 11 deaths per 1,000 people, compared with about 5.5 in Mexico. Crude death rates depend on the population's age structure as well as its health.” Similar life expectancy illustrates why CDR is not a health ranking; it does not by itself isolate or quantify the contribution of age structure.

Sources queried during this review: [World Bank life-expectancy API](https://api.worldbank.org/v2/country/MEX;LTU/indicator/SP.DYN.LE00.IN?date=2000&format=json), [World Bank crude-death-rate API](https://api.worldbank.org/v2/country/MEX;LTU/indicator/SP.DYN.CDRT.IN?date=2000&format=json). These are current series values and may differ from a historical download; cite the chosen vintage if retaining different figures.

### F5. Define seasonality without implying a causal finding

**Locations:** lines 102, 118, 130–152; proxy definitions in `en.ts`.

- “Vary from year to year, but not by much” is too broad. Suggested: “Averaging several years often reveals a recurring pattern, even though individual years can differ sharply.” State the excluded years in the methods layer.
- “Countries there don't experience astronomical seasons” is incorrect. Suggested: “Seasonal changes in temperature and daylight are smaller near the equator, though rainfall can still vary strongly through the year.”
- Your adaptation explanation is plausible, but the scatterplot does not establish it. Suggested: “One possibility is that places with colder winters are better prepared for them. This chart can't tell us whether that's the reason.” The Eurowinter study provides relevant observational evidence, not proof of the mechanism behind this particular chart. [Eurowinter study](https://pubmed.ncbi.nlm.nih.gov/9149695/).
- GDP shading may show an association with age structure; it does not “confirm” that wealth offsets seasonal mortality. Replace “confirms this” with “shows that these two variables are related in this sample”. The explanation after the GDP plot should remain a hypothesis.
- Amplitude here is calculated as **RMS deviation from the annual mean**, via `harmonicRms`, not the summer–winter difference. Suggested D1 definition: “Higher dots mean a stronger seasonal swing.” Put the exact RMS definition at D3. Explain the regional rings separately from country dots.
- The latitude proxy's Beijing **−27 degrees** needs a temperature unit, date and source; it reads as typical winter weather but appears intended as an extreme. A cleaner comparison is simply “Lisbon has milder winters; Beijing has colder winters and a wetter summer.” GDP being available for “any year and country”, and predicting “average number of teeth”, also need qualification or sources. These examples aren't necessary to explain the proxy.

### F6. Separate the two proxy tests and their limits

**Locations:** lines 156–184, accordion heading, scorecard dictionary.

The checked leave-one-out table supports the neighbour result: median RMSE **0.0265**, compared with climate **0.0304**, latitude **0.0312**, and mean curve **0.0409**. The regional table likewise reports neighbour error **0.017**, below its listed alternatives. These are results for the measured validation sample, not assurances about countries without usable observations.

But “scores for all five proxies” is inaccurate for that accordion: its data contains **three candidate proxies plus the mean-curve baseline**, not GDP and age. Change the subtitle accordingly. The five-way scorecard ranks amplitude associations using |r| and η; those are a different question from leave-one-out curve error. Put this distinction before readers receive their score, not only in a footnote. Climate has slightly lower median error than latitude, but slightly worse aggregate squared-error skill; “better” depends on the metric. Discuss that at D3, together with uneven donor coverage, small cohorts and why validation on data-rich countries may not transfer to missing-data countries.

### F7. Distinguish the explanatory regional maps from the globe's current rate model

**Locations:** regional chapters, lines 192–194, seasonality map labels.

`data/rate-grid.json` uses population × **country** CDR. `useGlobeData.ts` resolves its seasonal multiplier by country ID. The explanatory map's `resolveCellCurves` can instead use region-specific curves. Thus the map and globe share a grid, but do not necessarily apply the same seasonal rate to each cell. The article currently invites that inference. Suggested disclosure: “This map shows the regional detail available in the data. The globe currently uses country-level death rates and seasonal timing; regional information also helps determine the simulated age and cause.” Treat closing that implementation gap as separate work.

A 0.5° cell is about 55 km north–south; east–west width shrinks with latitude. “55 km wide” everywhere is misleading. Also, colouring `annualWeight × (multiplier−1) / 12` gives a **monthly-equivalent deviation at that point in the seasonal curve**, not an integrated calendar-month death count. Use that precise definition at D3 and a shorter “modelled seasonal increase or decrease” in the caption.

“Europe has none at all” is too absolute and also awkward beside western Russia. Say “Most of Europe in this view uses national curves.” The phrase “ten countries have measured regional curves” needs an explicit exclusion of climate-modelled and imputed curves. Likewise, the map's hemispheres need not be exact mirror images.

### F8. Describe conflicts as a lagged estimate and explain the cost of damping

**Locations:** lines 198–253, conflict widget labels.

ACLED publishes aggregates **weekly**; its fatalities are reported estimates subject to revisions, not a complete real-time death registry. Its geographic coordinates in this product are administrative centroids. The article correctly explains the centroids, but “real-time Research feed” and “current week's mortality” overstate timeliness and scope. Prefer “a recent estimate of reported conflict fatalities”. Do not assert conflicts are the largest short-term mortality disturbance without a defined comparison. [ACLED aggregate-data guide](https://acleddata.com/use-access/how-use-acleds-aggregated-data), [fatality methodology](https://acleddata.com/methodology/fatalities).

The code **adds** conflict weights to the seasonal baseline; this is not another multiplicative factor. The baseline may already include some conflict deaths. Disclose the possibility of overlap unless a baseline subtraction can be demonstrated. The code inspected also does not identify a flash as “from the conflict component” before drawing its persona's cause; a conflict-weighted location does not guarantee a conflict cause. Explain this if the visual invites that interpretation.

The worked arithmetic is correct: P10 = 20.6, P90 = 52.8, weighted estimate ≈ **28.36**, rounded to **28.4**. Label this as a self-contained **seven-week illustration**; computing percentiles on seven weeks is not the same as extracting seven values after clipping the twelve-week production window.

Replace “suspiciously extreme” with “extreme”: a high death toll can be real. Suggested D1 tradeoff: “This makes the estimate less sensitive to a single week. It also means a sudden escalation can be understated.” Explain at D3 that P10 clipping raises unusually low weeks too, and that a four-week half-life is a modelling choice rather than a fitted optimum. “A war is not a Poisson process” is also too categorical; “War changes the rate” better describes what this implementation actually does.

### F9. Correct the sampling explanation and data-vintage wording

**Locations:** lines 263–265, Who title, `personaDemo.steps` and `.note`.

`makePersona()` calls **sex → age conditional on sex → cause conditional on both**. Suggested heading: “Sex, age, then cause”, or simply “Giving each flash a possible life”. The essential statistical point is conditioning, not a uniquely correct order. One could draw cause first and then draw age and sex conditionally without creating implausible combinations. Replace the dementia claim with: “Drawing all three independently could pair an age with a cause that is very unlikely at that age.” Do not imply young-onset dementia is impossible.

“2021 release” confuses dataset edition and publication date. Prefer “the **GHE 2021 edition**, using its **2019 estimates**”. WHO's recommended citation dates that edition to **2024**. Preserve all three distinct concepts when explaining the provenance. [WHO GHE citation](https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/ghe-leading-causes-of-death).

The national UN table is a fallback, not the whole age/sex model. `age-sex-cells.json` confirms **44.6% regional**, **51.84% derived**, and **3.56% national**, weighted by baseline expected deaths. Explain the derived category: local population by age combined with national age-specific mortality, with a regional proxy in some cases. These are coverage shares of this model, not shares of all real deaths globally.

### F10. The exact 24.5% cause-coverage claim is not established

**Locations:** lines 269–281 and coverage table.

`cause-cells.json` stores 44.6% as the baseline death share in covered cells and 55.01% as the source's overall share in the three cause groups. Multiplying two marginal shares does not establish their intersection. The groups' share may differ inside the covered regions. Furthermore, the runtime adjusts the **complement** as well as the three named groups before renormalising, so “the rest keep the national mix” is ambiguous: the other groups retain relative proportions within their complement, but their combined probability can change.

Suggested replacement: “Regional cause data reaches cells containing about 45% of the model's baseline deaths. It changes the weights of three broad cause groups; the remaining causes keep their proportions relative to one another.” Remove **24.5%** unless a joint, draw-weighted calculation demonstrates it, with the treatment of the complement explicitly defined.

The paragraph also mixes **723 exported places**, **474 source regions**, and **444 cause archetypes** in the current metadata. Define each denominator if retaining it. “Seventeen regions are cities” and the **2.6%** claim need recalculation: `age-sex-cells.json` currently lists **30 unmatched region keys**, some not cities. Do not replace 17 with 30 without checking whether the original used a different subset. The historical download allowance is a project anecdote; date it rather than presenting it as an enduring IHME access rule.

### F11. The seasonal composition explanation has several implementation mismatches

**Locations:** lines 287–289.

- Age-season curves come from **24 European countries** in the current metadata, using Eurostat; cause-season curves come from **Brazil and Mexico**. The text incorrectly attributes both to the latter two.
- The shipped curves are continuous **order-4 harmonic fits**, not twelve-point curves. Twelve monthly samples are a display representation.
- Measured curves retain their calendar timing, but transferring climate curves can explicitly shift them by half a year. “Measured rather than assumed” is too strong for transferred countries (`climateFallbackCurve`).
- The current metadata does support **55 of 87 labels** having a seasonal mapping and **32** remaining flat. Some code comments have stale 56/90 counts; use the data. Not all 55 use a chapter: leaf-group curves are supported too.
- A multiplier of one means **no direct seasonal adjustment**, not an unchanged final probability. Other weights change and the distribution is renormalised.
- Mean-one multipliers do **not** guarantee that each age/cause category keeps its annual share after conditional normalisation and seasonal event weighting. A two-season example: two initially equal groups, with multipliers `(1.5, 0.5)` for one and `(1, 1)` for the other, yield first-group shares of 60% and 33.3%, averaging 46.7%, not 50%. The composition step does not change the number of flashes, but “annual totals stay exactly what the tables say” overclaims category-level calibration. Remove it or demonstrate a joint annual calibration.

Suggested D1 replacement: “The time of year can also change the age and cause we draw. I estimate those changes from the records available, then borrow patterns for countries without their own data. That borrowing is one of the less certain parts of the model.” Retain the source coverage and hemisphere assumptions in D2/D3.

### F12. Update “still missing”

**Locations:** lines 303–311.

The national-only age paragraph is contradicted by both the preceding coverage table and the implementation. Replace it with: “Regional age and sex estimates already shape many of the personas. The remaining gaps are places where I still have to infer the mix, or where the grid is too coarse to preserve a small region.”

“Deaths cluster in the small hours” needs a relevant all-cause population source; do not generalise a circadian pattern from one cause of death to all deaths. Suggested interim text: “I haven't included a time-of-day pattern. To do that, I'd need evidence that can be applied across populations and causes.” Knowing solar position also does not establish local civil time, and adding hourly weights would require runtime work.

“Excess-mortality estimates are the right measure” is too universal: excess deaths and deaths attributed to a named epidemic answer different questions. Some surveillance feeds include deaths, with varying lag. Suggested: “An epidemic layer needs timely death estimates and a way to avoid counting deaths already in the baseline. I haven't settled on a source and method for that.” The current “fiction dressed as data” line is rhetorically strong but dismisses the same kind of estimation the article otherwise relies on.

### Other claims to source, narrow or remove

These were not independently established during this review and should not be treated as verified:

| Passage                                                           | Suggested action                                                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lake Vivi and “400 kilometers” to a hospital                      | The figure uses a geometric centroid, not a named-centre lookup. Check the actual coordinate; keep “an uninhabited part of the country” unless the precise anecdote is sourced.                     |
| Land dots “overwhelmingly” miss settlements                       | Tie this to the experiment's populated-cell definition. A nonzero 0.5° cell is not proof of a permanent settlement at the sampled point.                                                            |
| Indo-Gangetic Plain holds one-seventh of humanity                 | Cite a boundary definition and reference year, or cut the fraction.                                                                                                                                 |
| Akita “nearly twice” Tokyo; “most” of regional gaps are age       | Cite the year and source; describing a major contribution of age is safer than claiming a quantified decomposition.                                                                                 |
| National rate “wrong for every single region”, half high/half low | A national average is not wrong; it is too coarse for some local purposes. Say “The national average hides these regional differences.” Half on each side is not a mathematical property of a mean. |
| Static JSON “reads the same offline”                              | No third-party API request at sampling time is supported. Offline availability requires the files already to be available; it is not guaranteed by JSON packaging alone.                            |

## Passages that sound machine-written, with proposed voice edits

These are judgments about fit with your opening voice, **not authorship detection**. The strongest signs are compressed implementation explanations, repeated rhetorical oppositions, unexplained abstractions and emphatic endings. An em dash on its own is not a reason to flag a passage: you use them in the handwritten opening too.

| ID / location           | Passage and why it breaks the voice                                                                                                                                   | Suggested replacement or treatment                                                                                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 · line 42            | “what's actually happening underneath the second”, “tiny miss-chance”, “the λ^k half”: strained informality around an incomplete derivation.                          | “Imagine dividing a second into many short intervals, each with a small chance of containing one death. As the intervals get shorter, this gives us the Poisson formula.” Put the actual limit after it at D3.                                                                                                   |
| A2 · line 82            | “enormous internal spread”, “older regions bury more of their people”, a tour of three continents in one sentence.                                                    | “Even within one country, the death rate can vary a lot. Japan gives us a clear example. Part of the difference is age: places with more older people tend to have more deaths per resident.” Let the chart supply the comparison.                                                                               |
| A3 · lines 112–116      | “quality-gated”, “former circular”, “production curve”, “pooled order-4”: reads like release notes.                                                                   | “The records don't all arrive in the same form. Some are weekly, others monthly. Below you can see what happens when we smooth the same data in different ways.” Explain the chosen harmonic model only after the reader has compared them.                                                                      |
| A4 · lines 130, 156–176 | The opening question is yours; “mean-curve floor”, “positive skill”, “nearest-region reconstruction” abruptly become an evaluation report.                            | “How about neighbouring countries? That's better. Among the methods tested here, borrowing from neighbours usually gets closest to the curve we hid.” Keep the ranking caveat and exact metrics in the optional test.                                                                                            |
| A5 · line 194           | “The texture … is population, not seasonality” opens a long correction with several geographic exceptions.                                                            | “A detailed map doesn't mean we have equally detailed data. In most of these countries, every cell still shares the same seasonal curve. The population grid is what gives the map much of its texture.” Add regional exceptions separately and fix the globe/map distinction in F7.                             |
| A6 · line 263           | One sentence contains source, edition, reference year, pandemic exclusion, hierarchy and truncation. The reader has to keep restarting it.                            | “The cause table comes from the WHO. I use its estimates for 2019, before the pandemic. For each country, sex and age group, I keep the eight most common causes and put the rest under ‘other causes’.” Move the formal dataset edition to a source note.                                                       |
| A7 · line 265           | “Draw the cause first and you get twenty-year-olds with dementia”: a punchline doing the work of an incorrect argument.                                               | “The important part is that the age, sex and cause belong together. We draw a cause from the distribution for that age and sex, rather than picking it independently.”                                                                                                                                           |
| A8 · lines 267–269      | “back to IHME, and back to that cap”, “it is worth being exact”, followed by several denominators: anecdote and methods compete for attention.                        | D2: “National averages are useful, but the mix of causes also varies within countries.” D3: “I only managed to download three broad cause groups at regional level. I prioritised those because they account for the largest share of deaths in the source data.” Explain coverage with F10's corrected wording. |
| A9 · line 279           | “a ratio, not a replacement”, “cannot carry”, “never asked to name anything”, “cannot quietly inflate”: repeated oppositions and personified data.                    | “I use the regional data to adjust the WHO probabilities. If a cause group makes up a larger share of deaths in a region than nationally, I increase its weight there. I then rescale the weights so the probabilities add up to one.” Keep the exact ratio and complement behaviour at D3.                      |
| A10 · line 281          | “Three things are still pending, and none … is a detail”; “downloads still owed”; “the grid's fault rather than the data's”: manufactured emphasis.                   | “There are still gaps. I only have regional data for three cause groups, and many places still use the national cause mix. Some small regions also disappear into the half-degree grid.” Put verified counts alongside the relevant limitation, not in one long paragraph.                                       |
| A11 · lines 287–289     | “the month tilts it”, “draws older, and more respiratory”, “a decision rather than an oversight”, “a bag of unrelated deaths”: polished shorthand before explanation. | “The month can change who we draw as well as how often a flash appears.” Then F11's source explanation. For the residual: “I leave ‘other causes’ without its own seasonal adjustment because it combines deaths with very different patterns. Its final share can still move when the other causes change.”     |
| A12 · lines 303, 307    | “fiction dressed as data”; “a curve worth plugging in”: confident final beats that conceal unresolved questions.                                                      | Use F12's plain statements of what evidence and method are missing. Keep uncertainty concrete.                                                                                                                                                                                                                   |
| A13 · line 321          | “It reads differently”: a prescribed emotional conclusion.                                                                                                            | “Go back and watch them again.” Let the reader decide what changes.                                                                                                                                                                                                                                              |

The download anecdote is worth retaining at D3: it is specific, personal and explains a real constraint. The solution is not to erase the technical material, but to give it a purpose and separate it from the main reading path.

The skill's lexical scanner returned **67 points / 15.4 per 1,000 words**, almost entirely for 22 lines containing em dashes, plus “robust”. This is not a probability of AI authorship. I reject those as automatic edits here: the dashes occur in your reference voice and “robust” names a statistical method. The useful findings above come from reading the argument and checking its claims. Prioritise the Who opening, the seasonal-methods transition, and the emphatic limitations paragraphs.

## Three reading depths

A depth score is a **minimum reading layer**, not a difficulty grade or an assessment of importance.

| Depth                      | Reader                                                      | What belongs here                                                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 · Overview              | A college-educated reader without specialist statistics     | The question, visual observations, what each model improvement changes, and the essential limits on interpreting a flash. Define “rate”, “proxy” and “seasonality” plainly.                                                         |
| D2 · Explanation           | A reader comfortable thinking scientifically or technically | Why a method is reasonable, source coverage, conditional sampling, what the comparisons show, and the main competing explanations. Explain terminology before using it.                                                             |
| D3 · Methods and tradeoffs | A reader who wants to inspect or reproduce the choices      | Poisson assumptions and derivation, rate conversions, grid allocation, harmonic order and overfitting, validation design, EWMA clipping, regional reweighting, coverage denominators, transfer assumptions and implementation gaps. |

Views should be **cumulative**: D1 alone; D1+D2; D1+D2+D3. Never hide the fact that the globe is simulated, that missing data is borrowed, or that conflict smoothing can suppress a real escalation. Their detailed consequences can be deeper, but their existence belongs in the overview.

The [annotated manuscript](ROADMAP.en.annotated.md) assigns a depth to every paragraph. Mixed paragraphs have sentence-level split instructions. Scores describe the intended home of the content **after the marked corrections**, not a claim that the current wording is already accessible at that level.

An overview cannot be produced safely by just hiding the existing high-score paragraphs. Add these short bridges first:

- **Opening:** “The flashes are simulated. The question is how to make their timing, location and personal details plausible.”
- **After the population map:** “A country's death rate still hides differences between its regions. Age is one reason: an older population will usually have more deaths per resident.”
- **Before the seasonal methods:** “We can keep drawing events randomly while changing how often they happen through the year.”
- **After the proxy sequence:** “For places without their own records, we have to borrow a pattern. Neighbours work best among the methods tested here, but some countries have no suitable neighbour.”
- **Before the conflict widget:** “Recent conflict reports add another estimate. I smooth it to reduce the influence of one week, at the cost of reacting more slowly to a sudden change.”
- **Opening Who:** “Each flash also gets an age, sex and cause. These describe a possible person, not somebody whose death was reported to the site.”
- **Closing limitations:** “Some parts come from local records. Others use national averages or borrowed patterns. The detail on the screen is often finer than the evidence behind it.”

D1 should keep one visual payoff per chapter: the two timing strips, ocean tally, density toggle, regional comparison, seasonal curves, the proxy result, conflict map and a persona example. D2 can expose the five-proxy exercise, seasonal comparison and sampling explanation. D3 holds the full statistical tests, formulae, clipping tables and data-coverage accounting. Give every figure an explanatory caption at its own depth and an accessible textual takeaway.

In particular, the deepest view should explain **choices and consequences**, not merely reveal variable names. Why four harmonics instead of one? Why exclude pandemic years if “live” is in the title? What happens when no bordering donor exists? Why prioritise three cause groups? What is lost when one region owns a whole grid cell? Those are the questions that make the implementation worth reading.
