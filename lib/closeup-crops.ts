// The three regional crops the story zooms into, and the one place their bounds are written.
//
// They live here rather than next to the figures because scripts/build-closeup-outlines.ts needs
// the same numbers: it bakes a country outline clipped to each of these boxes, and an outline
// clipped to a box the figure no longer draws is an outline that stops mid-panel. One definition
// means moving a crop moves its geometry with it.

export type Bbox = [[number, number], [number, number]];

export interface CloseupCrop {
  key: string;
  bbox: Bbox;
}

// West Africa, where the borders are straight lines a grid can almost follow, and the Low
// Countries, where they are not. Both are drawn by BorderRasterCloseup.
export const WEST_AFRICA: CloseupCrop = {
  key: "west-africa",
  bbox: [
    [-6, 4],
    [6, 14],
  ],
};

export const BENELUX: CloseupCrop = {
  key: "benelux",
  bbox: [
    [-3, 43.5],
    [16, 53],
  ],
};

// Japan, Okinawa to Hokkaido, drawn by SubnationalChoroplethMap.
export const JAPAN: CloseupCrop = {
  key: "japan",
  bbox: [
    [127, 29],
    [147, 46],
  ],
};

export const CLOSEUP_CROPS: CloseupCrop[] = [WEST_AFRICA, BENELUX, JAPAN];

// Slack for the figure to overscan into, beyond the square panel's own long edge.
// Covers BorderRasterCloseup's one-cell (0.5°) window pad and the choropleth's 8px fitProjection
// pad, with room left over — this is cheap, and a border that stops short of the panel edge is not.
const CROP_MARGIN_DEG = 1;

// The box geometry actually has to be clipped to, which is not the crop.
//
// Every panel is square and no crop is, so `fitExtent` contains the crop and the projection then
// shows the crop's *longer* span on both axes: Benelux is 19° wide by 9.5° tall, so its panel
// reaches 4.75° above and below the box it was asked for. Clipping to the crop plus a constant
// would have cut the Low Countries off mid-panel and drawn the clip rectangle's own straight edge
// across the map as if it were a border — which is exactly what a first pass at this did.
//
// So: square the box on its longer side, then add the margin.
export function clipBbox(crop: CloseupCrop): Bbox {
  const [[x0, y0], [x1, y1]] = crop.bbox;
  const half = Math.max(x1 - x0, y1 - y0) / 2 + CROP_MARGIN_DEG;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [
    [cx - half, cy - half],
    [cx + half, cy + half],
  ];
}
