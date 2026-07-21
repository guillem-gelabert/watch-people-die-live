import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Globe from "./globe/Globe";

export default async function Page() {
  // Read the same markdown the /roadmap route uses, so the globe page can prerender the roadmap
  // as an in-page overlay (revealed by the info button) without a second fetch.
  const roadmapMarkdown = await readFile(join(process.cwd(), "docs", "ROADMAP.md"), "utf8");
  return <Globe roadmapMarkdown={roadmapMarkdown} />;
}
