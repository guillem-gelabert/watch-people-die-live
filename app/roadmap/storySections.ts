// Slicing the story's markdown into its sections. Kept apart from the renderer because it is
// pure text-in / data-out: the running order — names, order, colour and typographic weight —
// is parsed here and read by the composition root, while roadmapMarkdown turns each section's
// body into elements.

// How a section wears its title. `chapter` is the full-screen Bebas slab that opens Where,
// When and Who; `chapter-small` is the reduced version for the closing sections; `hidden` is for
// the two sections whose own copy is the opening line, so a title would only repeat it.
export type SectionHeadingKind = "default" | "chapter" | "chapter-small" | "hidden";

const HEADING_KINDS = new Set<string>(["chapter", "chapter-small", "hidden"]);

export interface StorySection {
  // Stable identifier the section components key their figures off, so renaming a heading
  // never silently unmounts a chart the way matching on the title did.
  key: string;
  label: string;
  // What the section is called in the running order, where the visible title is a sentence
  // rather than a name ("A war is not a Poisson process" is the screen "Conflicts").
  screenLabel: string;
  // The section's palette seed. Everything else it wears is generated from this.
  sky: string;
  heading: SectionHeadingKind;
  // The line that shares the chapter's screen, standing under the title rather than opening
  // the prose. Authored as a `:::chapter-sub` fence at the top of the section.
  subtitle?: string;
  body: string;
}

// Pulls a leading `:::chapter-sub … :::` fence off a section body. It has to come out of the
// prose stream because the design sets it inside the chapter block, centred with the title,
// not as the first paragraph after it.
const CHAPTER_SUB = /^:::chapter-sub[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/;

function takeSubtitle(body: string): { subtitle?: string; body: string } {
  const m = CHAPTER_SUB.exec(body);
  if (!m) return { body };
  return { subtitle: (m[1] as string).trim(), body: body.slice(m[0].length).trim() };
}

// Sections are declared as `### <key> · <Label> · <#sky>` with an optional fourth field for the
// title treatment. Carrying all of it in the heading keeps the whole running order in the
// markdown rather than split between the document and a table in the composition root.
const SECTION_HEADING = /^### ([a-z0-9-]+) · (.+?) · (#[0-9a-fA-F]{3,6})(?: · ([a-z-]+))?[ \t]*$/gm;

export function roadmapSections(markdown: string): StorySection[] {
  const out: StorySection[] = [];
  const matches = [...markdown.matchAll(SECTION_HEADING)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m) continue;
    const start = m.index + m[0].length;
    const end = matches[i + 1]?.index ?? markdown.length;
    const kind = m[4];
    const { subtitle, body } = takeSubtitle(markdown.slice(start, end).trim());
    // `Title [Screen name]` splits the two; without the suffix the title is both.
    const titled = /^(.*?)[ \t]*\[([^\]]+)\]$/.exec(m[2] as string);
    const label = (titled ? titled[1] : m[2]) as string;
    out.push({
      key: m[1] as string,
      label,
      screenLabel: (titled ? titled[2] : label) as string,
      sky: m[3] as string,
      heading: kind && HEADING_KINDS.has(kind) ? (kind as SectionHeadingKind) : "default",
      ...(subtitle ? { subtitle } : {}),
      body,
    });
  }
  return out;
}
