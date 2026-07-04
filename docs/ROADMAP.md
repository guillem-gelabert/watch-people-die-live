# Roadmap

People die. Every day. All the time — worldwide, nearly two people die every second (one death roughly every half-second). But deaths aren't spread evenly across time or space. The project closes the gap between reality and the best simulation one layer at a time. Green rings are implemented; white rings are still planned.

> This doc mirrors the live [/roadmap page](/roadmap) — same steps, same order. The page is the source of truth; keep them in sync.

Legend: Implemented / Planned

## Mortality

### 1. Global Death Rate

Status: Implemented

Globally, nearly two people die every second — one death roughly every half-second.

Source: World Bank Open Data - crude death rate and population (indicators SP.DYN.CDRT.IN and SP.POP.TOTL).

The first layer only matches the global average: about two deaths every second. (~61.6M deaths/year — the same total baked into `data/rate-grid.json` that the globe samples.)

We can achieve this just by

```js
import yearlyCrudeDeathRate;
const frequency = millisecondsInAYear / yearlyDeaths; // ~0.51s
setInterval(blink, frequency);
```

But we know natural events don't happen at a metronomic timing. Something more jittery will feel more realistic — even though it's as close to reality as the fixed-interval pulse. How can we make the dot pulse at random intervals while still ensuring that on average it pulses at the global rate?

```tex
\begin{aligned}
\lambda &= 1.95\ \mathrm{deaths\ s^{-1}} \\
\bar{\Delta t} &= \frac{1}{\lambda} \approx 0.51\ \mathrm{s} \\
\Delta t &= \frac{-\ln(1-u)}{\lambda}
\end{aligned}
```

Spatial randomization:

```tex
\begin{aligned}
\mathrm{lon} &= 360u - 180 \\
\mathrm{lat} &= \sin^{-1}(2v-1)\frac{180}{\pi} \\
u,v &\sim \mathrm{Uniform}(0,1)
\end{aligned}
```

Baseline Random Simulation: White dots appear at exponentially random intervals, averaging nearly two events every second, and at uniformly random points on the Earth's surface. This first layer has no country, density, or seasonality weighting.

### 2. Death Rate By Country

Status: Implemented

Country-level mortality is measured consistently across every country in the world.

Source: World Bank crude death rate by country (derived from UN World Population Prospects).

In 2000, Mexico and Lithuania both had life expectancy around 72 years, but Mexico's crude death rate was about 4 per 1,000, while Lithuania's was about 11 per 1,000. Same life expectancy, almost 3× crude death rate difference. Source: https://www.sciencedirect.com/topics/mathematics/crude-death-rate

Each country now fires deaths at its own real annual rate instead of the flat global average — populous countries pulse far more often than sparse ones. But within a country, every death still lands on the same point: its geographic center. Step 3 fixes that by spreading deaths out realistically inside each border.

### 3. Population Density

Status: Implemented

Deaths correlate strongly with population density — more people die in Paris than in Antarctica.

Source: Gridded Population of the World v4 (GPWv4, CIESIN), aggregated to a 0.5 degree density grid.

Step 2 gave each country its correct death count; density decides where inside that country those deaths land. Every 0.5 degree grid cell carries a population count, and a country's deaths are split across its cells in proportion to how many people live in each one — so a death is far more likely to land in a city than in open countryside.

Applying the raster grid to the vector country map isn't perfectly clean: country borders come from smooth vector polygons (topojson), while the population grid is a blocky 0.5 degree raster (~55 km per cell). Near a border, a single raster cell can straddle two countries — it's assigned to whichever country contributes the most population.

### 4. Death Rate By Time Of Year

Status: Implemented

Mortality varies by season - winter respiratory and cardiovascular excess, and summer heat deaths.

Source: UN Demographic Yearbook monthly deaths, with a latitude-scaled fallback for countries without monthly reports.

This is how deaths distribute through the year, month by month, in a few selected countries. It's not flat at all. People die a lot more in winter. Some countries have a summer peak, probably inflated by heat deaths. Take Spain, where someone is ~30% more likely to die in January than in August. Other countries have a less pronounced seasonality.

The seasonal layer keeps each country's annual death total unchanged. It only redistributes timing across months: a factor above 1 means deaths fire faster than the annual average, and a factor below 1 means they fire slower. Direct monthly curves are used where the UN data is stable; the fallback uses latitude because winter deviation strengthens outside the tropics and plateaus around mid-latitudes.

Seasonality is the one layer still computed in the browser at sample time (see `docs/DENSITY-MORTALITY-JOIN.md`) rather than baked into the grid, since it's the only thing that changes during a session.

Seasonal Curve: Canonical fallback multiplier by month.

Latitude Correlation: Reporting countries show stronger monthly swings farther from the equator.

Latitude Bands: The fallback is flat in the tropics, ramps through the subtropics, and reaches full winter-summer deviation by mid-latitudes.

Amplitude By Country: Only countries with a direct UN monthly curve are colored, by their own measured deviation strength. Grey countries have no direct data and use the estimated latitude fallback above instead.

Deviation is measured as the largest monthly percent difference from the annual average.

### 5. Death Rate By Region

Status: Planned

There are mortality differences between regions inside a single country, beyond the national average.

Source: TBD

### 6. Ongoing Conflicts

Status: Planned

Conflicts increase mortality in specific regions by a measurable amount.

Source: TBD

### 7. Ongoing Epidemics

Status: Planned

Epidemics raise mortality in specific regions and periods by a measurable amount.

Source: TBD

### 8. Death Rate By Time Of Day

Status: Planned

Timing shifts by hour for causes with circadian patterns, such as cardiovascular events and injuries.

Source: TBD

## Note

The globe is statistical, not a feed of individual records. A flash and persona should be read as a representative event drawn from public aggregate data, never as an identifiable death.

The **persona** attached to each death (the "who" — e.g. _"Woman 78, breast cancer – Spain"_) draws age and sex from that country's UN World Population Prospects distribution and a cause from the IHME Global Burden of Disease. That's a separate axis from the spatial/temporal layers above (which govern _where_ and _when_ a flash appears), so it isn't a ring on this track — see the README's persona section.

See the live [Roadmap page](/roadmap) for current data sources and modeling caveats.
