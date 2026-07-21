"use client";

import katex from "katex";
import "katex/dist/katex.css";

interface KatexProps {
  tex: string;
  display?: boolean;
  title?: string;
}

// Renders a TeX expression to static HTML via KaTeX. `display` picks the block
// (centered, own-line) layout used for standalone formulas over the inline one.
// `title` (display mode only) renders as a caption above the formula.
export default function Katex({ tex, display = false, title }: KatexProps) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: display });
  if (!display) {
    return <span className="roadmap-math" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <figure className="roadmap-math">
      {title && <figcaption className="roadmap-math-title">{title}</figcaption>}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}
