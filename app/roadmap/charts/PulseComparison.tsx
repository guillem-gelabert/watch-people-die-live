export default function PulseComparison() {
  return (
    <section
      className="chart-panel wide pulse-line"
      aria-label="A dot blinking every 500 milliseconds"
    >
      <span className="pulse-dot steady" aria-hidden="true" />
      <span className="pulse-dot steady delayed-one" aria-hidden="true" />
      <span className="pulse-dot steady delayed-two" aria-hidden="true" />
      <span className="pulse-dot steady delayed-three" aria-hidden="true" />
    </section>
  );
}
