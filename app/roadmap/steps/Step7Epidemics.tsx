import RoadmapMarkdown from "../roadmapMarkdown";

export default function Step7Epidemics({ copy }: { copy: string }) {
  return (
    <section className="step step-07 todo">
      <header className="step-header">
        <span className="step-sphere" aria-hidden="true" />
        <div>
          <p className="step-eyebrow">Step 07 · Planned</p>
          <h2>Ongoing Epidemics</h2>
        </div>
      </header>
      <div className="step-body">
        <RoadmapMarkdown source={copy} />
      </div>
    </section>
  );
}
