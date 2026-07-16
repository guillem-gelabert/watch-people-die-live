import RoadmapMarkdown from "../roadmapMarkdown";

export default function Step8TimeOfDay({ copy }: { copy: string }) {
  return (
    <li className="step todo">
      <span className="ring" aria-hidden="true" />
      <div className="step-body">
        <h3>
          <span className="num">8</span> Death Rate By Time Of Day
        </h3>
        <RoadmapMarkdown source={copy} />
      </div>
    </li>
  );
}
