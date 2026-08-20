import { encodeSplits, type SplitPane } from "./splits.js";
import { isWebServed, wellKnownResponse } from "./routes.js";
import { OKLCH_TOKENS, THEME_LABELS, type ThemeId } from "./theme.js";

export interface ShellProps {
  path: string;
  panes?: readonly SplitPane[];
  theme?: ThemeId;
  username?: string;
}

/** Original React shell (OD-11). Not a SolidJS port and not a workshop-frontend fork. */
export function Shell({ path, panes, theme = "outreach-dark", username = "admin" }: ShellProps) {
  if (!isWebServed(path) || wellKnownResponse() !== null) {
    return <div data-shell="outreach-os" data-unserved="true" />;
  }
  const layout = panes ?? [{ type: "home", id: "_" }];
  const tokens = theme === "outreach-light" ? OKLCH_TOKENS["outreach-light"] : OKLCH_TOKENS["outreach-dark"];
  return (
    <div
      data-shell="outreach-os"
      data-theme={theme}
      data-theme-label={THEME_LABELS[theme] ?? theme}
      data-path={encodeSplits(layout)}
      style={{
        background: tokens.surface,
        color: tokens.text,
        borderColor: tokens.border,
      }}
    >
      <header data-chrome="sidebar">Outreach OS</header>
      <main data-route={layout[0]?.type ?? "home"}>
        {layout.map((pane) => (
          <section key={`${pane.type}:${pane.id}`} data-split={pane.type} data-split-id={pane.id} />
        ))}
      </main>
      <footer data-actor={username} />
    </div>
  );
}
