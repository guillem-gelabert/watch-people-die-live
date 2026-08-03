"use client";

import { Fragment, type ReactNode } from "react";
import Katex from "./Katex";
import Accordion, { type AccordionItem } from "./Accordion";
import RandModal, { RandPill } from "./RandModal";

// The running order is parsed next door; re-exported here so the composition root can keep
// taking the whole story from one import.
export { roadmapSections } from "./storySections";
export type { SectionHeadingKind, StorySection } from "./storySections";

interface RoadmapMarkdownProps {
  source: string;
  slots?: Record<string, ReactNode>;
  hiddenCodeBlockStarts?: string[];
}

// Slices an `:::accordion` fence into its panels. A `## Title · Status` line opens one and
// everything up to the next `##` is its body, rendered as ordinary markdown.
function accordionItems(
  lines: string[],
  slots: Record<string, ReactNode>,
  hiddenCodeBlockStarts: string[],
): AccordionItem[] {
  const items: AccordionItem[] = [];
  let title: string | null = null;
  let status: string | undefined;
  let body: string[] = [];

  const flush = () => {
    if (title === null) return;
    items.push({
      id: title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      title,
      ...(status ? { status } : {}),
      body: <>{renderLines(body, slots, hiddenCodeBlockStarts)}</>,
    });
    title = null;
    status = undefined;
    body = [];
  };

  for (const line of lines) {
    const head = /^##[ \t]+(.*)$/.exec(line.trim());
    if (head) {
      flush();
      const [name, ...rest] = (head[1] as string).split("·");
      title = (name as string).trim();
      const sub = rest.join("·").trim();
      if (sub) status = sub;
      continue;
    }
    body.push(line);
  }
  flush();
  return items;
}

function inline(text: string): ReactNode[] {
  const parts = text.split(
    /(\{\{[^}]+\}\}|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|_[^_]+_|(?<!\*)\*[^*]+\*(?!\*))/g,
  );
  return parts.filter(Boolean).map((part, index) => {
    // `{{word}}` is the word that opens the section's aside — see RandModal.
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return <RandPill key={index}>{part.slice(2, -2)}</RandPill>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a href={link[2]} key={index} target="_blank" rel="noopener">
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (
      (part.startsWith("_") && part.endsWith("_")) ||
      (part.startsWith("*") && part.endsWith("*"))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

// Renders a run of markdown lines to React nodes. Recursive so a `:::classname` fenced
// div (closed by a lone `:::`) can wrap a nested run of lines in a styled container —
// e.g. `:::proxy-copy` around the proxy write-ups, indented via .proxy-copy in roadmap.css.
function renderLines(
  lines: string[],
  slots: Record<string, ReactNode>,
  hiddenCodeBlockStarts: string[],
): ReactNode[] {
  const output: ReactNode[] = [];
  const fence = String.fromCharCode(96).repeat(3);
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (/^https?:\/\//.test(text)) {
      output.push(
        <p key={"link-" + output.length}>
          <a href={text} target="_blank" rel="noopener">
            {text}
          </a>
        </p>,
      );
    } else {
      output.push(<p key={"paragraph-" + output.length}>{inline(text)}</p>);
    }
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    output.push(
      <ul key={"list-" + output.length}>
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const divStart = /^:::(\S+)$/.exec(trimmed);
    if (divStart) {
      flushParagraph();
      flushList();
      // `.`-joined tokens (e.g. `chart-panel.wide`) become multiple space-separated
      // classes, mirroring CSS shorthand — lets a fence opt into a modifier class
      // (like the grid-spanning `.wide`) without a new fence-syntax feature.
      const className = divStart[1]!.split(".").join(" ");
      const inner: string[] = [];
      // Tracks nested `:::x` opens so an outer fence (e.g. a grid) can contain inner
      // fences (e.g. its cards) without the outer one closing on the first inner `:::`.
      let depth = 1;
      while (index + 1 < lines.length && depth > 0) {
        index += 1;
        const nextLine = lines[index] ?? "";
        const nextTrimmed = nextLine.trim();
        if (/^:::(\S+)$/.test(nextTrimmed)) depth += 1;
        else if (nextTrimmed === ":::") depth -= 1;
        if (depth > 0) inner.push(nextLine);
      }
      // The one fence whose contents are a component rather than a container: its `##` lines
      // are the panels, `Title · Status`, and everything under one is its body.
      // The Poisson aside: authored here, shown only when the pill in the prose asks for it.
      if (className === "rand-modal") {
        output.push(
          <RandModal key={"rand-" + output.length}>
            {renderLines(inner, slots, hiddenCodeBlockStarts)}
          </RandModal>,
        );
        continue;
      }
      if (className === "accordion") {
        output.push(
          <Accordion
            key={"accordion-" + output.length}
            items={accordionItems(inner, slots, hiddenCodeBlockStarts)}
          />,
        );
        continue;
      }
      output.push(
        <div className={className} key={"div-" + output.length}>
          {renderLines(inner, slots, hiddenCodeBlockStarts)}
        </div>,
      );
      continue;
    }

    // Block math: a `$$` line opens (optionally followed by a caption title on the same
    // line), a lone `$$` line closes, KaTeX renders what's between.
    const mathOpen = /^\$\$\s*(.*)$/.exec(trimmed);
    if (mathOpen) {
      flushParagraph();
      flushList();
      const title = mathOpen[1]?.trim();
      const mathLines: string[] = [];
      while (index + 1 < lines.length && (lines[index + 1] ?? "").trim() !== "$$") {
        index += 1;
        mathLines.push(lines[index] ?? "");
      }
      index += 1; // skip the closing $$
      output.push(
        <Katex
          key={"math-" + output.length}
          tex={mathLines.join("\n").trim()}
          title={title || undefined}
          display
        />,
      );
      continue;
    }

    if (trimmed.startsWith(fence)) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      while (index + 1 < lines.length && !(lines[index + 1] ?? "").trim().startsWith(fence)) {
        index += 1;
        code.push(lines[index] ?? "");
      }
      index += 1;
      const value = code.join("\n");

      // A two-line "Q: … / A: …" code fence (Step 1's intro) renders as a chat exchange
      // instead of a preformatted block — same copy, no prose wording changes.
      const question = code[0]?.trim();
      const answer = code[1]?.trim();
      if (code.length === 2 && question?.startsWith("Q:") && answer?.startsWith("A:")) {
        const reply = answer.slice(2).trim();
        output.push(
          <div className="chat" key={"chat-" + output.length}>
            <div className="chat-bubble-user">{inline(question.slice(2).trim())}</div>
            <div className="chat-bubble-assistant-row">
              <span className="chat-avatar" aria-hidden="true" />
              {/* The answer types itself out on scroll (see storyMotion). The spacer holds the
                  full text at zero opacity: it reserves the exact box the typed line will need,
                  so nothing below it shifts, and it is what a screen reader reads — the node
                  being typed into is hidden from assistive tech so it cannot announce
                  keystrokes. */}
              <div className="chat-bubble-assistant chat-typing">
                <span className="chat-type-spacer">{reply}</span>
                <span className="chat-type" data-type={reply} aria-hidden="true" />
              </div>
            </div>
          </div>,
        );
        continue;
      }

      if (!hiddenCodeBlockStarts.some((prefix) => value.startsWith(prefix))) {
        output.push(
          <pre className="roadmap-code" key={"code-" + output.length}>
            <code>{value}</code>
          </pre>,
        );
      }
      continue;
    }

    // GFM table: a `| … |` header row immediately followed by a `| --- | :-: | … |`
    // alignment row, then any number of `| … |` body rows. Rendered as a real <table>.
    if (trimmed.startsWith("|")) {
      const splitRow = (line: string) =>
        line
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const sepLine = (lines[index + 1] ?? "").trim();
      const sepCells = sepLine.startsWith("|") ? splitRow(sepLine) : [];
      const isSeparator = sepCells.length > 0 && sepCells.every((c) => /^:?-+:?$/.test(c));
      if (isSeparator) {
        flushParagraph();
        flushList();
        const headers = splitRow(trimmed);
        const aligns = sepCells.map((c) => {
          const left = c.startsWith(":");
          const right = c.endsWith(":");
          return right && left ? "center" : right ? "right" : left ? "left" : "";
        });
        const alignClass = (i: number) => (aligns[i] ? `ta-${aligns[i]}` : undefined);
        const bodyRows: string[][] = [];
        let cursor = index + 2;
        while (cursor < lines.length && (lines[cursor] ?? "").trim().startsWith("|")) {
          bodyRows.push(splitRow(lines[cursor] ?? ""));
          cursor += 1;
        }
        index = cursor - 1; // the loop's `index += 1` steps past the last body row
        output.push(
          <div className="roadmap-table-wrap" key={"table-" + output.length}>
            <table className="roadmap-table">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className={alignClass(i)} scope="col">
                      {inline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((cells, ri) => (
                  <tr key={ri}>
                    {cells.map((c, ci) => (
                      <td key={ci} className={alignClass(ci)}>
                        {inline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    if (slots[trimmed]) {
      flushParagraph();
      flushList();
      output.push(<Fragment key={"slot-" + trimmed}>{slots[trimmed]}</Fragment>);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      output.push(
        <span className="source" key={"source-" + output.length}>
          {inline(trimmed.slice(2))}
        </span>,
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      output.push(
        <h4 className="roadmap-subheading" key={"heading-" + output.length}>
          {trimmed.slice(3)}
        </h4>,
      );
      continue;
    }

    // A single `#` is the section-heading tier — the 36px line the design uses to open a
    // movement inside a section, above `##`'s 26px sub-heading.
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      output.push(
        <h3 className="story-heading story-heading-inline" key={"heading-" + output.length}>
          {trimmed.slice(2)}
        </h3>,
      );
      continue;
    }

    if (trimmed === "PROS:" || trimmed === "CONS:") {
      flushParagraph();
      flushList();
      output.push(
        <h5 className="roadmap-list-heading" key={"label-" + output.length}>
          {trimmed.slice(0, -1)}
        </h5>,
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }

    if (trimmed === "---") {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return output;
}

export default function RoadmapMarkdown({
  source,
  slots = {},
  hiddenCodeBlockStarts = [],
}: RoadmapMarkdownProps) {
  const lines = source.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  return <>{renderLines(lines, slots, hiddenCodeBlockStarts)}</>;
}
