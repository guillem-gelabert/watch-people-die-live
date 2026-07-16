import RoadmapMarkdown from "../roadmapMarkdown";

export default function Step7Epidemics({ copy }: { copy: string }) {
  return (
    <li className="step todo">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">7</span> Ongoing Epidemics
        </h3>
        <RoadmapMarkdown source={copy} />
      </div>
    </li>
  );
}
