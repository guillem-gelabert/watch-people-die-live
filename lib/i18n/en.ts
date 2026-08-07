// The English dictionary, and the shape every other one has to match.
//
// Everything a reader can see that is *not* in docs/ROADMAP.md lives here: the story's own prose
// is authored per language as a markdown file, and this covers the chrome around it — the hero,
// the interactive figures' own copy, the proxy card, the chart panels.
//
// Values are plain strings only. The resolved dictionary is handed from the server component to
// the client tree as a prop, so a function in here would not survive serialisation; `{name}`
// placeholders and lib/i18n/fill.ts do the interpolation instead.

import { chartsEn } from "./en.charts";

export const en = {
  meta: {
    title: "Watch People Die Live",
    description:
      "A real-time statistical mortality globe: each flash is modeled from public death-rate, " +
      "population-density, and demographic data, with representative personas rather than " +
      "individual records.",
    ogDescription:
      "A real-time statistical mortality globe built from public demographic data. Each persona " +
      "is representative, not an identifiable individual.",
    twitterDescription:
      "A statistical mortality globe with representative personas, not individual death records.",
  },

  chrome: {
    hero: "Every flash is a death.",
    cue: "What?",
    globe: "Globe",
    language: "Language",
    languageChoose: "Read this in another language",
    pull: {
      idle: "Pull up for the globe",
      keepPulling: "Keep pulling",
      ready: "Let go for the globe",
    },
  },

  globe: {
    waiting: "Waiting for the first flash",
    latest: "Latest death",
    justNow: "Just now",
    resume: "Resume",
    pause: "Pause",
    close: "Close",
    // The persona line, e.g. "Woman 78, breast cancer – Spain". The cause is a Global Burden of
    // Disease label and arrives in English from the data file; everything around it is ours.
    persona: "{who} {age}, {cause} – {country}",
    baby: "Baby",
    girl: "Girl",
    boy: "Boy",
    woman: "Woman",
    man: "Man",
    where: "{country} · {lat}° {ns}, {lon}° {ew}",
    north: "north",
    south: "south",
    east: "east",
    west: "west",
  },

  proxy: {
    cardTitle: "Potential seasonality proxies",
    best: "Best predictor",
    worst: "Worst",
    reorder: "Reorder the proxies",
    infoLabel: " — the case for {title}",
    currentOrder: "Current order, best first: {order}",
    rankNote: "Your #{n}",
    rankNoteSr: " ranking for this proxy",
    modal: {
      eyebrow: "Before we look at the data",
      heading: "Which of these tracks seasonality?",
      instruction:
        "Order the five candidates from the strongest predictor of a country's seasonal swing " +
        "down to the weakest. Drag a row to move it; tap i to reread the case for each.",
      closing:
        "Then we'll put each one against the countries that do report monthly deaths, and see " +
        "which holds up.",
      skip: "Skip",
      submit: "Submit my ranking",
    },
    dnd: {
      instructions:
        "Press space or enter to pick up this proxy. Use the up and down arrow keys to move it " +
        "through the ranking, space or enter to drop it, and escape to cancel.",
      pickedUp: "Picked up {title}. It is ranked {rank} of {total}.",
      over: "{title} would be ranked {rank}.",
      dropped: "{title} is now ranked {rank} of {total}.",
      cancelled: "Dropped {title}. The ranking is unchanged.",
    },
    defs: [
      {
        title: "GDP per capita",
        body:
          "As flawed as GDP is, it is a surprisingly effective predictor of quality-of-life " +
          "metrics (child mortality, average number of teeth, homicide rates) and it's easily " +
          "available for any year and country. We could apply the average seasonality factor of " +
          "countries with a similar GDP per capita to a country without its own sub-year data.",
      },
      {
        title: "Neighbouring countries",
        body:
          "Geographic proximity could reflect multiple factors at once. Take the Gulf countries: " +
          "an average donor country there would be rich, of Muslim majority and have a very " +
          "similar climate. Italy and Switzerland have comparable health infrastructure, " +
          "similarly developed institutions and are very close in longitude and in latitude. " +
          "Some problems: neighbouring countries sometimes differ sharply, and some clusters " +
          "have no neighbour with seasonal data at all.",
      },
      {
        title: "Climatic zone",
        body:
          "If our assumption is true, this would help us group seasonality by similar climate. " +
          "Climatic classifications group regions by similar temperature and humidity values in " +
          "a similar periodicity. The data is not trivial to get — there are many different " +
          "classifications — and to apply to our mortality numbers. Furthermore, we risk " +
          "choosing a classification whose zones are too big, grouping very different countries, " +
          "or too small, leaving zones with no donor countries to take data from.",
      },
      {
        title: "Latitude",
        body:
          "That was my first intuition, and it is actually a second-degree proxy that derives " +
          "climate from latitude, which is readily available for every point on earth. " +
          "Nevertheless, if we take a look at Lisbon and Beijing — both around the same parallel " +
          "— we can see that extremely different climates can coexist at a single latitude: " +
          "Lisbon has a mild winter and a moderately dry summer while Beijing registers " +
          "temperatures of −27 degrees during its very dry winter and has a very hot and humid " +
          "monsoonal summer.",
      },
      {
        title: "Share of population over 65",
        body:
          "Viral infections have seasonal patterns and older people are more vulnerable to " +
          "those. In summer, they are more at risk of a heat caused death. We could expect that " +
          "places with an older population experience stronger seasonality. On the other hand, " +
          "countries with older populations are often richer and therefore tend to have better " +
          "health access.",
      },
    ],
    scorecard: {
      titleScored: "How your ranking held up",
      titleSkipped: "What the data says",
      intro:
        "Each proxy scored by how closely it tracks observed seasonal amplitude across the " +
        "countries that report a curve — |r| for the four numeric proxies, the correlation " +
        "ratio η for the climate classes. Both run 0 to 1.",
      unavailable:
        "The seasonality tables have not loaded, so there is nothing to score the ranking " +
        "against yet.",
      scoreLabel: "of {total} in the right slot",
      skipped:
        "You skipped the ranking, so there is nothing to mark — here is the order the data puts " +
        "the five in.",
      verdictPerfect: "You called it exactly.",
      verdictClose: "Close — a swap or two away from what the data says.",
      verdictRough: "Roughly right. Most of your order survives the data.",
      verdictHalf: "Half right. The data agrees with about half of your ordering.",
      verdictPoor: "Not close — the data reads these almost the other way round.",
      footruleOne:
        "Your ranking is {n} place out in total, against {worst} for a perfectly reversed one.",
      footruleOther:
        "Your ranking is {n} places out in total, against {worst} for a perfectly reversed one.",
      topPickRight: "You picked the strongest proxy first.",
      topPickWrong: "The strongest proxy is {title}.",
      hadItHere: "you had it here",
      hadItAt: "you had it {ordinal}",
      ordinals: ["1st", "2nd", "3rd", "4th", "5th"],
      countryCount: "{n} countries",
      note:
        "This is not the same test as the hold-one-out table above: agreement asks whether a " +
        "proxy tracks how big a country's swing is, while leave-one-out asks how well it " +
        "rebuilds the whole shape of the curve. They put the same three proxies on top in the " +
        "same order, which is the useful part — though neighbours and climate finish close " +
        "enough here that the gap between first and second is not worth defending. Coverage " +
        "differs by row: a country with no bordering donor cannot be scored on the neighbour " +
        "proxy at all.",
    },
  },

  rand: {
    label: "What randomly means here",
    close: "Close",
  },

  concept: {
    clock: [
      {
        kind: "Method",
        title: "One global clock",
        body:
          "Total deaths per year become a rate per second. Each interval is drawn from an " +
          "exponential distribution, so bursts and gaps happen for the same reason they do in " +
          "reality.",
      },
      {
        kind: "Why it failed",
        title: "Deaths in the ocean",
        body:
          "A uniform point on a sphere puts seven in ten deaths in water and most of the rest " +
          "in empty land. Right total, meaningless map.",
      },
      {
        kind: "Concept",
        title: "Poisson process",
        body:
          "Independent events, exponential waiting times. This is why the rhythm looks broken " +
          "and is not.",
      },
    ],
  },

  panels: {
    samplingOrder: "Sampling order",
    deathsByAgeCauseLabel: "Deaths by age band and cause",
    deathsByAgeCauseTitle: "Deaths by age, and what they die of",
    deathsByAgeCauseCopy: "Share of deaths in each age band, and the cause mix within it.",
    densityClusterLabel: "Vector border and raster density close-up",
    ewmaLabel: "Robust exponentially-weighted moving average of conflict fatalities",
    ewmaTitle: "Monthly fatalities, and the weighted mean the globe uses",
    ewmaCopy:
      "Solid bars are reported fatalities and the line is the exponentially weighted mean. The " +
      "hollow bar at the right is today — the number the globe would use. Move either slider and " +
      "it is what moves.",
    conflictMapLabel: "Conflict fatalities on the sampling grid",
    conflictMapTitle: "Where the trailing year's fatalities are",
    conflictMapCopy: "ACLED fatal events aggregated onto the sampling grid.",
    westAfrica: "West Africa",
    benelux: "Benelux",
    figureLatitude: "Latitude correlation",
    figureClimate: "Amplitude by climate zone",
    figurePop65: "Amplitude vs. population 65+",
    figureGdp: "Amplitude vs. GDP per capita",
    figureNeighbour: "Amplitude vs. neighbouring countries",
  },

  ewma: {
    empty:
      "No conflict fatalities have been reported in the trailing {n} days (or the live ACLED " +
      "layer is unavailable), so there is no recent series for the prediction to run on.",
    ariaLabel:
      "Daily conflict fatalities over the last {n} days, stacked by country (each day's " +
      "sub-10% countries grouped as Others at the bottom), with a {weighting} weighted " +
      "prediction of {prediction} deaths for today{clamp}",
    weightingFlat: "flat",
    weightingHalfLife: "{halfLife}-day half-life",
    clampOn: ", outliers clamped to P{lo}–P{hi}",
    clampOff: ", outliers unclamped",
    today: "today",
    todayApprox: "today ≈ {value}/day",
    halfLifeName: "Half-life",
    halfLifeFlat: "flat mean",
    halfLifeDays: "{n} days",
    halfLifeFlatSpoken: "flat mean, every day weighted equally",
    halfLifeNote:
      "How many days it takes for a day's influence on the prediction to halve. At zero every " +
      "day in the window counts the same.",
    dampingName: "Damping",
    dampingOff: "off",
    dampingBand: "P{lo}–P{hi}",
    dampingSpokenOn: "clamped to P{lo} and P{hi}",
    dampingSpokenOff: "no clamp on the totals",
    dampingNote:
      "How far in from each end the outlier clamp bites, before any weighting. At zero the " +
      "massacre counts in full.",
    readout: "Predicted today:",
    readoutUnit: "deaths/day",
    readoutAsidePlain: "(plain average of the fortnight: {mean}",
    readoutAsideClamped: ", totals clamped to P{lo}–P{hi}",
    readoutAsideUnclamped: ", nothing clamped",
    readoutAsideFlat: ", every day weighted the same",
    others: "Others",
    tooltipDeaths: "{country}: {n} deaths",
    tooltipMore: "+{n} more: {total}",
  },

  // English is the identity map: the labels in data/causes.json are already English. Typed as an
  // open record so ca.ts and de.ts can fill it, and so an unmapped cause is a miss rather than a
  // type error — see lib/i18n/causes.ts.
  causes: {} as Record<string, string>,

  charts: chartsEn,
};

// The contract every other language has to satisfy: English is the schema as well as the source,
// so a key added here is a type error in ca.ts and de.ts until it is translated.
export type Dictionary = typeof en;
