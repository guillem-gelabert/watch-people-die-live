"use client";

interface LayerToggleProps {
  showCountries: boolean;
  showRegions: boolean;
  onShowCountries: (value: boolean) => void;
  onShowRegions: (value: boolean) => void;
}

// Two independent layer checkboxes shared by the amplitude-proxy scatters (latitude, climate
// zone, neighbours): toggle the country-level and region-level point clouds on/off separately.
export default function LayerToggle({
  showCountries,
  showRegions,
  onShowCountries,
  onShowRegions,
}: LayerToggleProps) {
  return (
    <div className="chart-layers" role="group" aria-label="Data layers">
      <label>
        <input
          type="checkbox"
          checked={showCountries}
          onChange={(event) => onShowCountries(event.target.checked)}
        />
        Countries
      </label>
      <label>
        <input
          type="checkbox"
          checked={showRegions}
          onChange={(event) => onShowRegions(event.target.checked)}
        />
        Regions
      </label>
    </div>
  );
}
