import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Shell } from "shell";
import type { TaskPaneActivity, TaskPaneAlert, TaskPaneItem } from "shell";
import {
  KERNEL_AUTH_TOKEN_KEY,
  ORIGIN_MOUNTS,
  TASK_TENANT_STORAGE_KEY,
} from "./live-session.js";

export interface OutreachBootConfig {
  kernelApi: typeof ORIGIN_MOUNTS.kernelApi;
  domainApi: typeof ORIGIN_MOUNTS.domainApi;
  subscribe: typeof ORIGIN_MOUNTS.subscribe;
  authTokenKey: typeof KERNEL_AUTH_TOKEN_KEY;
  tenantKey: typeof TASK_TENANT_STORAGE_KEY;
  path: string;
}

export function outreachBootConfig(path: string): OutreachBootConfig {
  return {
    ...ORIGIN_MOUNTS,
    authTokenKey: KERNEL_AUTH_TOKEN_KEY,
    tenantKey: TASK_TENANT_STORAGE_KEY,
    path,
  };
}

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
      taskComposeOpen: true,
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
</body>
</html>`;
}
