// Opens the dev server in Mobile Safari on the iOS Simulator, because a good half of what
// this page does — the globe running under the status bar, the scroll-driven story steps,
// touch on the charts — only behaves like the real thing in a real mobile browser. Chrome's
// device emulation runs neither WebKit nor a status bar, so it cannot answer those questions.
//
// Run as `pnpm dev:ios`; the optional first argument is the path to open (default `/`, so
// `pnpm dev:ios "/roadmap?lang=ca"` lands straight on the story). SIM_DEVICE picks the
// simulator to boot when none is running yet.
//
// The simulator shares the host's loopback, so http://localhost:<port> just works — no LAN
// address and no `allowedDevOrigins` entry needed.

import { execFileSync, spawn, type ChildProcess } from "node:child_process";

const PORT = process.env.PORT ?? "3000";
const TARGET = `http://localhost:${PORT}${process.argv[2] ?? "/"}`;
const DEVICE = process.env.SIM_DEVICE ?? "iPhone 17";
const READY_TIMEOUT_MS = 180_000;

function xcrun(...args: string[]): string {
  return execFileSync("xcrun", args, { encoding: "utf8" });
}

// Whatever is already open wins over SIM_DEVICE: booting a second device to serve the same
// URL is slow, and `openurl booted` would then have to guess which one was meant.
function bootedUdid(): string | undefined {
  const list: { devices: Record<string, { udid: string }[]> } = JSON.parse(
    xcrun("simctl", "list", "devices", "booted", "-j"),
  );
  return Object.values(list.devices).flat()[0]?.udid;
}

async function serving(): Promise<boolean> {
  try {
    await fetch(TARGET, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

// Started first so `next dev` compiles while the simulator boots, which is the slow half on
// a cold machine. `pnpm run dev` rather than `next dev` directly, so `predev` still runs.
let dev: ChildProcess | undefined;
if (await serving()) {
  console.log(`dev:ios: reusing the server already on :${PORT}`);
} else {
  const child = spawn("pnpm", ["run", "dev"], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
  // Ctrl-C should stop the dev server, not orphan it behind this wrapper.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => child.kill(signal));
  }
  dev = child;
}

// `bootstatus -b` boots a shut-down device and blocks until the OS is up, which is what makes
// the `openurl` below land in a Safari that is ready to receive it.
xcrun("simctl", "bootstatus", bootedUdid() ?? DEVICE, "-b");
execFileSync("open", ["-a", "Simulator"]);

const deadline = Date.now() + READY_TIMEOUT_MS;
while (dev && !(await serving())) {
  if (Date.now() > deadline) {
    console.error(`dev:ios: nothing answered on :${PORT} within ${READY_TIMEOUT_MS / 1000}s`);
    dev.kill("SIGINT");
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

xcrun("simctl", "openurl", "booted", TARGET);
console.log(`dev:ios: opened ${TARGET}`);
