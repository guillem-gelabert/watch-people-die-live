// Make `pnpm dev` always come up on the port it says it will.
//
// Next's own behaviour when the port is taken is to quietly pick another one ("Port 3000 is in
// use, using 3002 instead"), which is worse than failing: every bookmark, every MCP browser
// session and every note saying localhost:3000 now points at a stale server, and two dev servers
// then fight over the same .next directory until one of them panics.
//
// So: look at what is holding the port, and clear it — but only when it is this project's own
// leftover. Someone else's server on the same port is a decision for the person at the keyboard,
// not for a predev hook, so that case stops with an explanation instead.
//
// Usage: node --import tsx scripts/free-port.ts   (runs from predev)

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 3000;

function sh(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return ""; // no matches, or the tool is missing — both mean "nothing to clear"
  }
}

// PIDs listening on the port. lsof is on macOS and most Linux images; without it we simply skip.
function listenersOn(port: number): number[] {
  const out = sh("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  return [
    ...new Set(
      out
        .split("\n")
        .map(Number)
        .filter((pid) => pid > 0 && pid !== process.pid),
    ),
  ];
}

// The working directory a process was started in, which is how we tell our own stale server from
// somebody else's. `lsof -d cwd` reports it without needing elevated privileges.
function cwdOf(pid: number): string | null {
  const line = sh("lsof", ["-a", "-d", "cwd", "-p", String(pid), "-Fn"])
    .split("\n")
    .find((l) => l.startsWith("n"));
  return line ? line.slice(1) : null;
}

function describe(pid: number): string {
  return (
    sh("ps", ["-o", "command=", "-p", String(pid)])
      .trim()
      .split("\n")[0] ?? `pid ${pid}`
  );
}

const holders = listenersOn(PORT);
if (!holders.length) process.exit(0);

const foreign: number[] = [];
for (const pid of holders) {
  const cwd = cwdOf(pid);
  if (cwd && (cwd === ROOT || cwd.startsWith(`${ROOT}${path.sep}`))) {
    process.stdout.write(`free-port: clearing :${PORT}, held by this project (pid ${pid}).\n`);
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone between listing and killing; the wait below settles it either way.
    }
  } else {
    foreign.push(pid);
  }
}

if (foreign.length) {
  const lines = foreign.map((pid) => `  pid ${pid}  ${describe(pid).slice(0, 100)}`).join("\n");
  process.stderr.write(
    `\nPort ${PORT} is held by something outside this project:\n${lines}\n\n` +
      `Stop it, or start on another port with PORT=3001 pnpm dev.\n\n`,
  );
  process.exit(1);
}

// SIGTERM is not instant, and next would otherwise race it back to "port in use". Poll rather
// than sleep a flat interval, so the common case (already gone) costs nothing.
const deadline = Date.now() + 5000;
while (listenersOn(PORT).length && Date.now() < deadline) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
}
if (listenersOn(PORT).length) {
  process.stderr.write(`free-port: :${PORT} did not come free after 5s; next dev may relocate.\n`);
}
