// Some cloud hosts (incl. Railway) have a broken IPv6 path to certain upstreams.
// Node's fetch resolves AAAA first by default, so a host that publishes IPv6 (e.g.
// api.worldbank.org) can hang until the request aborts. Prefer IPv4 to avoid that.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
