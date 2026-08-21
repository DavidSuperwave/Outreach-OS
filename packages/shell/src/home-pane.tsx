import type { CSSProperties, ReactNode } from "react";
import type { TaskPaneAlert } from "./task-pane.js";

const card: CSSProperties = {
  border: "1px solid var(--outreach-border)",
  borderRadius: "0.75rem",
  padding: "0.85rem 1rem",
  background: "var(--outreach-popover)",
  display: "grid",
  gap: "0.35rem",
};

const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.45rem 0.55rem",
  background: "var(--outreach-surface)",
  color: "var(--outreach-text)",
  border: "1px solid var(--outreach-border)",
  borderRadius: "0.4rem",
};

const PLAYBOOKS = [
  { id: "intraplex-icp", title: "Intraplex ICP", hint: "Ideal customer profile for Outreach" },
  { id: "inspect-ask", title: "Inspect → ask", hint: "Read standing instructions, then ask" },
] as const;

const TABLE_ROWS = [
  { company: "Intraplex", fit: "ICP", status: "active" },
] as const;

/** N5 home: bound chrome (Playbooks + ICP → inspect → ask → table gadget → Instantly reads). */
export function HomePane({
  alerts = [],
}: {
  alerts?: readonly TaskPaneAlert[];
}): ReactNode {
  return (
    <div data-surface="home.bound" style={{ display: "grid", gap: "0.85rem", maxWidth: "52rem" }}>
      <h1 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>Home</h1>
      <section data-surface="playbooks" aria-label="Playbooks" style={card}>
        <strong>Playbooks</strong>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {PLAYBOOKS.map((row) => (
            <li key={row.id} data-playbook={row.id}>
              {row.title}
              <span style={{ color: "var(--outreach-muted)" }}> — {row.hint}</span>
            </li>
          ))}
        </ul>
      </section>
      <section data-surface="icp" data-icp="intraplex" aria-label="Intraplex ICP" style={card}>
        <strong>Intraplex ICP</strong>
        <p style={{ margin: 0, color: "var(--outreach-muted)" }}>
          Seed ICP for Outreach. Standing instructions stay on kernel /admin. No Instantly send.
        </p>
      </section>
      <section data-surface="inspect" aria-label="Inspect" style={card}>
        <strong>Inspect</strong>
        <p style={{ margin: 0, color: "var(--outreach-muted)" }}>
          Open Tasks for the Soup list, or Settings for governed connector reads.
        </p>
        <p style={{ margin: 0 }}>
          <a href="/tasks" data-command="go-to.tasks" style={{ color: "var(--outreach-accent)" }}>
            Inspect tasks
          </a>
        </p>
      </section>
      <section data-surface="ask" aria-label="Ask" style={card}>
        <strong>Ask</strong>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          Ask
          <input
            name="ask"
            aria-label="Ask"
            data-command="home.focus-chat-input"
            autoComplete="off"
            style={field}
          />
        </label>
      </section>
      <section data-surface="table-gadget" aria-label="Table gadget" style={card}>
        <strong>Table gadget</strong>
        <table data-gadget="icp" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--outreach-muted)", textAlign: "left", fontSize: "0.8rem" }}>
              <th style={{ padding: "0.3rem 0.4rem" }}>Company</th>
              <th style={{ padding: "0.3rem 0.4rem" }}>Fit</th>
              <th style={{ padding: "0.3rem 0.4rem" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row) => (
              <tr key={row.company} data-company={row.company}>
                <td style={{ padding: "0.35rem 0.4rem" }}>{row.company}</td>
                <td style={{ padding: "0.35rem 0.4rem" }}>{row.fit}</td>
                <td style={{ padding: "0.35rem 0.4rem" }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section data-surface="instantly.reads" data-posture="reads-only" aria-label="Instantly reads" style={card}>
        <strong>Instantly</strong>
        <em data-posture="reads-only">reads only</em>
        <p style={{ margin: 0, color: "var(--outreach-muted)" }}>
          Campaign / account / lead / analytics reads. Send, activate, and start are out of scope.
        </p>
        <a href="/settings" data-command="settings.connections" style={{ color: "var(--outreach-accent)" }}>
          Open connections
        </a>
      </section>
      {alerts.length > 0 ? (
        <ul data-surface="operator.alerts" role="status" aria-label="Operator alerts">
          {alerts.map((alert) => (
            <li key={alert.id} data-alert-kind={alert.kind} data-entity-id={alert.entityId}>
              {alert.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
