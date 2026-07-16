"use client";

import { Fragment, type ReactNode } from "react";

interface RoadmapMarkdownProps {
  source: string;
  slots?: Record<string, ReactNode>;
  hiddenCodeBlockStarts?: string[];
}

export function roadmapSection(markdown: string, title: string) {
  const escapedTitle = title.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
  const heading = new RegExp("^### [●○] \\d+ · " + escapedTitle + "$", "m");
  const match = heading.exec(markdown);
  if (!match) return "";
  const start = match.index + match[0].length;
  const next = markdown.slice(start).search(/^### [●○] \d+ · /m);
  return markdown.slice(start, next === -1 ? undefined : start + next).trim();
}

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|_[^_]+_|(?<!\*)\*[^*]+\*(?!\*))/g);
  return parts.filter(Boolean).map((part, index) => {
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
      const className = divStart[1];
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
      output.push(
        <div className={className} key={"div-" + output.length}>
          {renderLines(inner, slots, hiddenCodeBlockStarts)}
        </div>,
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
      if (!hiddenCodeBlockStarts.some((prefix) => value.startsWith(prefix))) {
        output.push(
          <pre className="roadmap-code" key={"code-" + output.length}>
            <code>{value}</code>
          </pre>,
        );
      }
      continue;
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
