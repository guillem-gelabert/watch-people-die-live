// Everything the figures themselves say: panel titles, axis titles, legends, control labels,
// statuses, footnotes and the aria descriptions that stand in for a chart nobody can see.
//
// Split out of en.ts only for length — it is the same dictionary, and the same rule applies:
// plain strings with `{name}` placeholders, nothing that would not survive JSON.
//
// Place names are deliberately absent. Country and region names come out of the topology and the
// mortality tables at runtime, in whatever spelling those sources use, and a translation table
// for them would be a second source of truth for the same fact.

export const chartsEn = {
  common: {
    unknown: "Unknown",
    countries: "Countries",
    regions: "Regions",
    layers: "Layers",
    amplitudeAxis: "Amplitude",
    method: "Method",
    best: " · best",
  },

  beatStrip: {
    poisson: "Gaps between deaths drawn from the real distribution: most are short, a few are long",
    metronome: "A beat every {gap}, the annual average",
    sincePrevious: "{ms} ms since the previous death",
    onRate: " — on the average rate",
    always: "{gap} — always",
  },

  dartTally: {
    ocean: "Ocean",
    uninhabited: "Uninhabited",
    inhabited: "Inhabited",
    uninhabitedNote:
      "Land with no populated cell in the 0.5° grid the model samples — about 55 km across.",
    inhabitedNote: "Land with at least one populated cell in the grid, however sparsely.",
    spoken: "{label}: {count} of {total} deaths, {share} per cent",
    spokenLimit: ", converging to {limit} per cent",
    counting: "{label}: counting",
  },

  globalRandomMap: {
    aria:
      "South America and the Pacific, with crosshairs falling at random points at the global " +
      "mortality rate",
  },

  countryCentroidMap: {
    aria: "Europe shaded by death rate, with every death landing on its country's geographic centre",
    deathsPerYear: "{name}: {n} deaths/yr",
    noRate: "{name}: no rate data",
  },

  borderRaster: {
    loading: "Loading…",
    aria: "Close-up of vector country borders overlapping rastered density cells near {title}",
    mismatch: "raster: {raster} / vector: {vector} (mismatch)",
    peoplePerCell: "{n} people/cell — {place}",
  },

  densityMap: {
    aria:
      "South, central and east Asia shaded by population per grid cell, with deaths landing on " +
      "cells in proportion to their population",
    peoplePerCell: "{name}: {n} people/cell",
    scaleLog: "Logarithmic",
    scaleLinear: "Linear",
    scaleSpoken: "Logarithmic colour scale",
  },

  subnationalMap: {
    aria:
      "Map of Japan's prefectures shaded by crude death rate, showing large differences within " +
      "one country",
    loading: "Loading subnational death rates…",
    legendMax: "{max}+ per 100k",
  },

  nationalVsRegional: {
    title: "National guess against regional truth",
    copy: "Deaths per 100,000, six regions of two countries.",
    loading: "Loading regional death rates…",
    national: "national {n}",
    ariaBlock: "{label}: national rate {national} per 100,000; regions {regions}",
    note:
      "The national rate is wrong for every single region — too low for half of them and too " +
      "high for the rest.",
  },

  countryCurves: {
    empty: "Add a country or category above to see its seasonal curve.",
    placeholder: "Add a country or category…",
    placeholderAtCap: "Comparing {max} — remove one to add another",
    aria: "Line chart comparing the seasonal mortality curves of {names}",
    remove: "Remove {name}",
    selected: "Selected countries",
    clearAll: "Clear all",
    noMatches: "No matches",
    limitReached: "Added {added} — reached the {max}-line limit ({dropped} not shown)",
    groupClimate: "Climate",
    groupGdp: "GDP",
    groupLatitude: "Latitude",
    gdpBins: ["GDP < $10k", "GDP $10k–$30k", "GDP $30k–$50k", "GDP > $50k"],
    latBins: [
      "Tropics (0–23.5°)",
      "Subtropics (23.5–35°)",
      "Temperate (35–50°)",
      "High latitude (50°+)",
    ],
  },

  smoothing: {
    loading: "Loading the smoothing comparison…",
    title: "One series, many resolutions",
    copy: "Every view uses the same complete non-COVID weekly observations and the same mean-1 scale.",
    country: "Country",
    order: "Order",
    cadenceGroup: "Observation cadence and smoothing method",
    orderGroup: "Harmonic order",
    how: "How it works",
    goodFor: "Good for",
    watchOut: "Watch out",
    source: "{source}. {country}: {from}–{to}; 2020–2022 excluded.",
    aria:
      "{mode} view of {country}'s seasonal mortality multiplier. Values range from {lo} to {hi}, " +
      "with annual average at 1.",
    harmonicOrderLabel: "Harmonic · order {n}",
    modes: {
      weekly: {
        label: "Weekly",
        how:
          "Average the same ISO week across complete years after converting counts to deaths " +
          "per day.",
        goodFor:
          "Preserving the timing of short seasonal changes when long, complete weekly records " +
          "exist.",
        watchOut: "It is noisy, data-hungry, and week 53 is supported by fewer years.",
      },
      monthly: {
        label: "Monthly",
        how:
          "Average daily mortality intensity within each calendar month, then compare the same " +
          "month across years.",
        goodFor: "A practical balance between timing detail and year-to-year stability.",
        watchOut: "Every change is assigned to a month, so boundaries become artificial steps.",
      },
      quarterly: {
        label: "Quarterly",
        how: "Combine three months at a time using their calendar-day exposure.",
        goodFor: "Showing only the broadest seasonal contrast when observations are sparse.",
        watchOut: "Four values cannot locate a peak precisely or reveal a short secondary season.",
      },
      circular3: {
        label: "Circular 3-point",
        how:
          "Replace each monthly value with 25% of the previous month, 50% of itself, and 25% of " +
          "the next, wrapping December into January.",
        goodFor: "Transparent local noise reduction with an easy-to-explain fixed bandwidth.",
        watchOut:
          "The chosen three-month bandwidth blunts peaks and still leaves a monthly output grid.",
      },
      harmonic: {
        label: "Harmonic",
        how:
          "Fit annual sine/cosine pairs to every qualifying weekly observation in one pooled " +
          "regression.",
        goodFor:
          "A compact continuous multiplier that is smooth and periodic across December and " +
          "January.",
        watchOut:
          "Higher orders preserve shorter features but can also follow noise; lower orders " +
          "impose broader seasons.",
      },
    },
    orders: {
      "1": {
        how: "Fit one annual sine/cosine pair to all qualifying weekly observations.",
        goodFor: "One broad annual rise and fall with the simplest possible periodic model.",
        watchOut: "It forces a symmetric single-cycle shape and cannot represent secondary peaks.",
      },
      "2": {
        how: "Fit annual and half-year sine/cosine pairs to all qualifying weekly observations.",
        goodFor: "Broad asymmetry and a possible secondary seasonal rise without much fine detail.",
        watchOut: "Short peaks are still smoothed away and every added pair increases flexibility.",
      },
      "3": {
        how: "Fit three annual sine/cosine pairs to all qualifying weekly observations.",
        goodFor: "Capturing multi-peak or sharper seasonal structure on roughly four-month scales.",
        watchOut: "It can begin to preserve recurrent reporting noise as if it were seasonality.",
      },
      "4": {
        how:
          "Fit four annual sine/cosine pairs to every qualifying weekly observation in one " +
          "pooled regression.",
        goodFor:
          "The production model: a continuous curve with enough resolution for shorter seasonal " +
          "features.",
        watchOut:
          "It can follow stable short-period artifacts, and cannot represent abrupt one-off " +
          "shocks.",
      },
    },
  },

  latitudeScatter: {
    aria:
      "Scatter plot of absolute latitude against seasonal mortality amplitude, with each country " +
      "as a filled dot and each measured region as a ring",
    tropic: "Tropic",
    polarCircle: "Polar Circle",
  },

  koppenScatter: {
    axisTitle: "Köppen-Geiger zone",
    aria:
      "Strip scatter plot of seasonal mortality amplitude grouped by dominant Köppen–Geiger " +
      "climate family, with each country as a filled dot and each measured region as a ring",
  },

  gdpScatter: {
    xLabel: "income per head (log scale)",
    aria: "Scatter plot of seasonal mortality amplitude against GDP per capita on a logarithmic scale",
  },

  pop65Scatter: {
    xLabel: "share over 65 (%)",
    value: "{v}% over 65",
    aria:
      "Scatter plot of seasonal mortality amplitude against the share of population aged 65 and " +
      "over",
    footnote: "Dot opacity carries income per head: the darker the dot, the richer the country.",
  },

  neighbourScatter: {
    xLabel: "mean amplitude of neighbours (%)",
    value: "neighbours {v}%",
    aria:
      "Scatter plot of a unit's seasonal mortality amplitude against the mean amplitude of its " +
      "bordering neighbours",
    footnote:
      "{n} countries are missing from this chart entirely: no country they border reports a " +
      "monthly curve, so the proxy has nothing to borrow from.",
    ringLabel: "Rings are measured Admin-1 regions against their own bordering regions.",
  },

  regionNeighbourScatter: {
    aria:
      "Scatter plot of each measured Admin-1 region's seasonal amplitude against the mean " +
      "amplitude of its bordering measured regions, with countries overlaid as grey outlines",
  },

  amplitudeMap: {
    aria:
      "Map from Norway to South Africa and from Mauritania to Bangladesh. Every half-degree grid " +
      "cell is colored by the deaths this month's season adds to, or takes from, an ordinary " +
      "month there, and outlines mark the country or region each cell's seasonal curve came from",
    legendCaption:
      "Colour is excess deaths a month in each half-degree cell: neutral below {neutral} a " +
      "month, full strength at {domain}.",
    monthName: "Month",
    monthNote:
      "Drag through the year. The colours are the same scale in every month, so a cell that " +
      "changes really did change.",
    legendFewer: "fewer deaths",
    legendMore: "more deaths",
    provenanceMeasured: "curve measured here",
    provenanceEstimated: "curve estimated",
    sourceObserved: "observed",
    sourceOwnRegions: "calculated from {n} measured regions",
    sourceBorderingCountries: "calculated from bordering countries: {donors}",
    sourceClimate: "estimated from climate: {donor}",
    sourceLatitude: "calculated from latitude fallback: {donor}",
    tooltip: "{name}: {amplitude} ({source})",
    regionTooltip: "{name} ({country}): {amplitude} amplitude{note}",
    regionEstimate: " · {proxy} estimate",
    regionOverride: " (manual override)",
    regionImputed: " · imputed from {donors}",
  },

  ageMix: {
    loading: "Loading deaths by age and cause…",
    tail: "Everything else",
    ariaBand: "{label}: {share}% of deaths",
    barCaption: "Bar length is that band's share of all deaths",
  },

  personaDemo: {
    steps: ["Place", "Age", "Sex", "Cause"],
    woman: "Woman",
    man: "Man",
    womenOf: "women",
    menOf: "men",
    undetermined: "an undetermined cause",
    note:
      "The heaviest single cell in {country}'s table. The cause was drawn from that cell — " +
      "{group} of {age} — and never from the table at large, which is what keeps a " +
      "twenty-year-old from dying of dementia.",
    loading: "Loading the age, sex and cause tables…",
  },

  conflictMap: {
    note:
      "{fatalities} reported fatalities across {regions} Admin-1 regions over {weeks} complete " +
      "weeks, through {through}.",
    noData: "No conflict data available — the layer is off.",
    aria: "Approximate Admin-1 centroid map of conflict fatalities. {note}",
    lead:
      "Locations are regional centroids. For the globe, each is moved to the nearest populated " +
      "cell in the same country and added on top of ordinary mortality.",
    plateTitle: "{n} fatalities in the window",
    regionTooltip: "{region}, {country}: {n} fatalities",
  },

  prediction: {
    title: "Predictions vs. Measured Curve",
    copy:
      "Hold out each of the {n} countries that report a curve in turn, rebuild it from each " +
      "proxy as if it were missing, and score how far the reconstruction lands from the measured " +
      "curve. Lower median RMSE is better; skill is the drop in total squared error against each " +
      "baseline.",
    colMedianRmse: "Median RMSE",
    colMedianR: "Median r",
    colSkillMean: "Skill vs mean",
    colSkillLatitude: "Skill vs latitude",
    colWonLatitude: "Won vs latitude",
    group: "Group",
    count: "n",
    latitudeRmse: "Latitude RMSE",
    climateRmse: "Climate RMSE",
    neighbourRmse: "Neighbour RMSE",
    bestColumn: "Best",
    cohortTitle: "Performance by cohort",
    cohortCopy:
      "Median day-weighted curve RMSE within each overlapping cohort. Lower is better; an em " +
      "dash means the validation set has no eligible measured curve for that cohort.",
    cohortNote:
      "Temperate includes Köppen–Geiger families C and D. Data-poor means sparse local donor " +
      "coverage, not incomplete mortality registration; countries with no measured curve cannot " +
      "be scored by hold-one-out validation.",
    latitudeTitle: "Performance by absolute latitude",
    latitudeCopy:
      "Median day-weighted curve RMSE in disjoint absolute country-centroid latitude bands. " +
      "Lower is better.",
    subclassTitle: "Performance by Köppen–Geiger sub-class",
    subclassCopy:
      "Median day-weighted curve RMSE by each country's population-weighted dominant " +
      "Köppen–Geiger sub-class. Lower is better; small groups are descriptive.",
    subclassGroup: "Class — sub-class",
    // The four rows of the comparison table are values baked into the validation JSON, so they
    // are translated by lookup rather than at the source.
    methods: {
      "Mean mortality curve": "Mean mortality curve",
      "Nearest latitude": "Nearest latitude",
      "Climate class": "Climate class",
      "Nearest neighbour country": "Nearest neighbour country",
    },
  },

  regionPrediction: {
    title: "Predictions vs. Measured Curve (region)",
    copy:
      "The same leave-one-out test, run over {n} observed Admin-1 regions instead of countries. " +
      "{note}",
    colCountryRmse: "Country median RMSE",
    colRegionRmse: "Region median RMSE",
  },

  cohorts: {
    latitude: "Latitude",
    climate: "Climate",
    neighbour: "Neighbour",
    none: "—",
    tropical: "Tropical",
    tropicalNote: "Population-weighted Köppen–Geiger tropical climate (family A).",
    temperate: "Temperate",
    temperateNote:
      "Population-weighted Köppen–Geiger temperate or continental climate (families C or D).",
    polar: "Polar",
    polarNote: "Population-weighted Köppen–Geiger polar climate (family E).",
    island: "Island",
    islandNote: "No land-border neighbour in the country topology.",
    dataPoor: "Data-poor",
    dataPoorNote:
      "Fewer than two bordering countries with a measured curve in this validation set.",
    latitudeBandNote: "Absolute country-centroid latitude {from}°–{to}°.",
    unclassified: "Unclassified",
    subclassNote: "Population-weighted Köppen–Geiger climate sub-class {code}.",
    unclassifiedNote:
      "No population-weighted Köppen–Geiger sub-class is available in the proxy data.",
  },

  // The five Köppen–Geiger families, shared by the climate scatter and the cohort tables.
  kgFamilies: {
    A: "Tropical",
    B: "Arid",
    C: "Temperate",
    D: "Continental",
    E: "Polar",
  },

  // The sub-class descriptors, keyed by Köppen code. The codes themselves are never translated —
  // "Cfb" is the same everywhere — but the words beside them are ordinary description.
  kgSubclasses: {
    Af: "rainforest",
    Am: "monsoon",
    Aw: "savanna",
    BWh: "hot desert",
    BWk: "cold desert",
    BSh: "hot semi-arid",
    BSk: "cold semi-arid",
    Csa: "hot-summer Mediterranean",
    Csb: "warm-summer Mediterranean",
    Csc: "cold-summer Mediterranean",
    Cwa: "dry-winter hot-summer",
    Cwb: "dry-winter warm-summer",
    Cwc: "dry-winter cold-summer",
    Cfa: "humid subtropical",
    Cfb: "oceanic",
    Cfc: "subpolar oceanic",
    Dsa: "dry-summer hot-summer",
    Dsb: "dry-summer warm-summer",
    Dsc: "dry-summer subarctic",
    Dsd: "dry-summer extremely cold",
    Dwa: "dry-winter hot-summer",
    Dwb: "dry-winter warm-summer",
    Dwc: "dry-winter subarctic",
    Dwd: "dry-winter extremely cold",
    Dfa: "hot-summer humid continental",
    Dfb: "warm-summer humid continental",
    Dfc: "subarctic",
    Dfd: "extremely cold subarctic",
    ET: "tundra",
    EF: "ice cap",
  },

  // The "Cold" family used by the sub-class table is Köppen D, which the family list above calls
  // Continental. Kept separate because the sub-class table prints it as its own word.
  kgCold: "Cold",
};

export type ChartsDictionary = typeof chartsEn;
