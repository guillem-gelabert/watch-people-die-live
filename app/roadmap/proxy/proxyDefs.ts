// The five candidate proxies for a country's seasonal swing, in identity order. That order is the
// design's `data-proxy` index: it decides each proxy's colour and which chart carries the reader's
// "Your #N" note, so it is fixed regardless of how the reader ranks them.
//
// The copy is the story's own — these five write-ups used to sit in docs/ROADMAP.md as a static
// grid, and moved here when the card took over presenting them.
export interface ProxyDef {
  index: number;
  title: string;
  body: string;
}

export const PROXY_DEFS: ProxyDef[] = [
  {
    index: 0,
    title: "GDP per capita",
    body:
      "As flawed as GDP is, it is a surprisingly effective predictor of quality-of-life metrics " +
      "(child mortality, average number of teeth, homicide rates) and it's easily available for any " +
      "year and country. We could apply the average seasonality factor of countries with a similar " +
      "GDP per capita to a country without its own sub-year data.",
  },
  {
    index: 1,
    title: "Neighbouring countries",
    body:
      "Geographic proximity could reflect multiple factors at once. Take the Gulf countries: an " +
      "average donor country there would be rich, of Muslim majority and have a very similar " +
      "climate. Italy and Switzerland have comparable health infrastructure, similarly developed " +
      "institutions and are very close in longitude and in latitude. Some problems: neighbouring " +
      "countries sometimes differ sharply, and some clusters have no neighbour with seasonal data " +
      "at all.",
  },
  {
    index: 2,
    title: "Climatic zone",
    body:
      "If our assumption is true, this would help us group seasonality by similar climate. Climatic " +
      "classifications group regions by similar temperature and humidity values in a similar " +
      "periodicity. The data is not trivial to get — there are many different classifications — and " +
      "to apply to our mortality numbers. Furthermore, we risk choosing a classification whose " +
      "zones are too big, grouping very different countries, or too small, leaving zones with no " +
      "donor countries to take data from.",
  },
  {
    index: 3,
    title: "Latitude",
    body:
      "That was my first intuition, and it is actually a second-degree proxy that derives climate " +
      "from latitude, which is readily available for every point on earth. Nevertheless, if we take " +
      "a look at Lisbon and Beijing — both around the same parallel — we can see that extremely " +
      "different climates can coexist at a single latitude: Lisbon has a mild winter and a " +
      "moderately dry summer while Beijing registers temperatures of −27 degrees during its very " +
      "dry winter and has a very hot and humid monsoonal summer.",
  },
  {
    index: 4,
    title: "Share of population over 65",
    body:
      "Viral infections have seasonal patterns and older people are more vulnerable to those. In " +
      "summer, they are more at risk of a heat caused death. We could expect that places with an " +
      "older population experience stronger seasonality. On the other hand, countries with older " +
      "populations are often richer and therefore tend to have better health access.",
  },
];

export const PROXY_MODAL_COPY = {
  eyebrow: "Before we look at the data",
  heading: "Which of these tracks seasonality?",
  instruction:
    "Order the five candidates from the strongest predictor of a country's seasonal swing down to " +
    "the weakest. Drag a row to move it; tap i to reread the case for each.",
  closing:
    "Then we'll put each one against the countries that do report monthly deaths, and see which " +
    "holds up.",
} as const;
