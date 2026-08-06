import { describe, expect, it } from "vitest";
import { roadmapSections } from "./storySections";

const SECTION = "###";

describe("roadmapSections", () => {
  it("reads the key, title, sky and title treatment off the heading", () => {
    const [section] = roadmapSections(`${SECTION} who · Who · #d9dbdd · chapter\n\nBody copy.`);
    expect(section).toMatchObject({
      key: "who",
      label: "Who",
      sky: "#d9dbdd",
      heading: "chapter",
      body: "Body copy.",
    });
  });

  it("defaults the title treatment when the heading does not name one", () => {
    const [section] = roadmapSections(`${SECTION} conflicts · Conflicts · #eeb87d\n\nCopy.`);
    expect(section?.heading).toBe("default");
  });

  it("ignores a treatment it does not recognise rather than passing it through", () => {
    const [section] = roadmapSections(`${SECTION} a · A · #000000 · sideways\n\nCopy.`);
    expect(section?.heading).toBe("default");
  });

  // A section's visible title is sometimes a sentence ("A war is not a Poisson process") while
  // its name in the running order stays short ("Conflicts"). The suffix carries the second one.
  it("splits a bracketed screen name off the visible title", () => {
    const [section] = roadmapSections(
      `${SECTION} conflicts · A war is not a Poisson process [Conflicts] · #eeb87d\n\nCopy.`,
    );
    expect(section?.label).toBe("A war is not a Poisson process");
    expect(section?.screenLabel).toBe("Conflicts");
  });

  it("uses the title as its own screen name when there is no suffix", () => {
    const [section] = roadmapSections(`${SECTION} who · Who · #d9dbdd · chapter\n\nCopy.`);
    expect(section?.screenLabel).toBe("Who");
  });

  // The subtitle shares the chapter's screen, so it has to leave the prose stream — otherwise
  // it renders twice: once under the title and once as the section's opening paragraph.
  it("lifts a leading chapter-sub fence out of the body", () => {
    const [section] = roadmapSections(
      `${SECTION} who · Who · #d9dbdd · chapter\n\n:::chapter-sub\nEvery flash gets a sentence.\n:::\n\nThe body starts here.`,
    );
    expect(section?.subtitle).toBe("Every flash gets a sentence.");
    expect(section?.body).toBe("The body starts here.");
  });

  it("leaves a chapter-sub fence alone when it is not the first thing in the section", () => {
    const [section] = roadmapSections(
      `${SECTION} who · Who · #d9dbdd\n\nOpening line.\n\n:::chapter-sub\nNot a subtitle.\n:::`,
    );
    expect(section?.subtitle).toBeUndefined();
    expect(section?.body).toContain(":::chapter-sub");
  });

  it("gives each section the body that runs up to the next heading", () => {
    const sections = roadmapSections(
      `${SECTION} one · One · #111111\n\nFirst body.\n\n${SECTION} two · Two · #222222\n\nSecond body.`,
    );
    expect(sections.map((s) => s.key)).toEqual(["one", "two"]);
    expect(sections[0]?.body).toBe("First body.");
    expect(sections[1]?.body).toBe("Second body.");
  });
});
