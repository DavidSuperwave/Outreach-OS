import { Shell } from "shell";
import type { ConvertJob } from "./types.js";

export function JobList({ jobs }: { jobs: readonly ConvertJob[] }) {
  return (
    <ul data-surface="converter.jobs" role="list">
      {jobs.map((job) => (
        <li
          key={job.job_id}
          data-job-id={job.job_id}
          data-job-type={job.type}
          data-job-state={job.state}
          data-fixture={job.fixture ?? "none"}
        >
          <span data-label="job-id">{job.job_id}</span>
          {job.fixture === "golden" ? <span data-label="golden">golden</span> : null}
          {job.fixture === "poison" ? <span data-label="poison">poison</span> : null}
          <span data-label="state">{job.state}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Status surface for conversion jobs. Chrome is N7 documents (ConvertedPdf
 * viewer) — Shell path `/documents`. No converter-owned commands.
 */
export function ConverterWorkspace({ jobs }: { jobs: readonly ConvertJob[] }) {
  return (
    <div data-slice="converter">
      <Shell path="/documents" panes={[{ type: "documents", id: "_" }]} theme="outreach-dark">
        <JobList jobs={jobs} />
      </Shell>
    </div>
  );
}
