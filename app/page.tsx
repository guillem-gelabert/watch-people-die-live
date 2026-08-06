import { readFile } from "node:fs/promises";
import { join } from "node:path";
import StoryClient from "./roadmap/StoryClient";

export default async function Page() {
  // The whole story — running order, section skies and prose — is authored in this one
  // markdown file and sliced client-side by roadmapSections().
  const markdown = await readFile(join(process.cwd(), "docs", "ROADMAP.md"), "utf8");
  return <StoryClient markdown={markdown} />;
}
