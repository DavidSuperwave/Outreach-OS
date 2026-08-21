import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Shell } from "shell";
import type { TaskPaneActivity, TaskPaneAlert, TaskPaneItem } from "shell";
import { outreachBootConfig } from "./live-session.js";

export type { OutreachBootConfig } from "./live-session.js";
export { outreachBootConfig } from "./live-session.js";

export function renderOutreachDocument(input: {
  path: string;
  username?: string;
  items?: readonly TaskPaneItem[];
  activity?: readonly TaskPaneActivity[];
  alerts?: readonly TaskPaneAlert[];
}): string {
  const body = renderToString(
    createElement(Shell, {
      path: input.path,
      theme: "outreach-dark",
      username: input.username ?? "signed-out",
      taskItems: input.items ?? [],
      taskComposeOpen: false,
      taskDraft: "",
      activityFacts: input.activity ?? [],
      operatorAlerts: input.alerts ?? [],
    }),
  );
  const boot = JSON.stringify(outreachBootConfig(input.path)).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Outreach OS</title>
</head>
<body>
<div id="root" data-origin="compositor">${body}</div>
<script type="application/json" id="outreach-boot">${boot}</script>
<script type="module" src="/assets/outreach-shell.js"></script>
</body>
</html>`;
}
