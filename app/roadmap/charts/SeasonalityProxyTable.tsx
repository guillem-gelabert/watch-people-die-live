const rows = [
  {
    proxy: "Similar climate",
    signal: "Population-weighted climate mixture",
    strengths: "Easy to source; directly reflects seasonal environment",
    limitations: "Many classification systems; hard to implement across zones; misses culture",
  },
  {
    proxy: "Neighbouring countries",
    signal: "Curves borrowed from geographically adjacent countries",
    strengths: "Simple adjacency; can capture shared culture and reporting practices",
    limitations:
      "Missing-data clusters need second-order neighbours; large countries span climates",
  },
  {
    proxy: "Similar latitude",
    signal: "Absolute latitude plus hemisphere phase",
    strengths: "Continuous, globally available, and naturally handles tropics and hemisphere flips",
    limitations: "Misses oceans, altitude, and culture; assumes amplitude changes smoothly",
  },
  {
    proxy: "Per-capita GDP",
    signal: "Economic capacity as a quality-of-life proxy",
    strengths: "Widely available across countries and years",
    limitations:
      "Indirect signal; can hide inequality and differences in prices, informality, and public services",
  },
];

export default function SeasonalityProxyTable() {
  return (
    <div className="seasonality-proxy-table-wrap">
      <table className="seasonality-proxy-table">
        <caption>Candidate proxies for countries without a measured seasonal curve</caption>
        <thead>
          <tr>
            <th scope="col">Proxy</th>
            <th scope="col">Signal</th>
            <th scope="col">Strengths</th>
            <th scope="col">Limitations</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.proxy}>
              <th scope="row">{row.proxy}</th>
              <td>{row.signal}</td>
              <td>{row.strengths}</td>
              <td>{row.limitations}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
