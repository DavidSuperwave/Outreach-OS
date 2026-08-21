import type { IcpTableRow } from "./fixture.js";

export function TableGadget({
  rows,
  caption = "Instantly campaigns × Intraplex ICP",
}: {
  rows: readonly IcpTableRow[]
  caption?: string
}) {
  return (
    <section data-gadget="table" data-bound="os-pilot">
      <h2>Table gadget</h2>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Company</th>
            <th>Contact</th>
            <th>Campaign</th>
            <th>Status</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.source}:${row.campaign}:${row.contact}`} data-source={row.source}>
              <td>{row.company}</td>
              <td>{row.contact}</td>
              <td>{row.campaign}</td>
              <td>{row.status}</td>
              <td>{row.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
