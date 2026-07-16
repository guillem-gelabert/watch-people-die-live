export default function PulseComparison() {
  return (
    <section className="chart-panel wide" aria-label="A dot blinking every 500 milliseconds">
      <div className="pulse-example">
        <div className="pulse-line" aria-hidden="true">
          <span className="pulse-dot steady" />
          <span className="pulse-dot steady delayed-one" />
          <span className="pulse-dot steady delayed-two" />
          <span className="pulse-dot steady delayed-three" />
        </div>
      </div>
    </section>
  );
}
