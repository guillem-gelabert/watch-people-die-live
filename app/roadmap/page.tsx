import { readFile } from "node:fs/promises";
import { join } from "node:path";
import RoadmapClient from "./RoadmapClient";

export default async function RoadmapPage() {
  const markdown = await readFile(join(process.cwd(), "docs", "ROADMAP.md"), "utf8");
  return <RoadmapClient markdown={markdown} />;
}
