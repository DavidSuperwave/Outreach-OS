import { useEffect, useState } from "react";
import { ChannelWorkspace } from "channels/browser";
import { DocumentWorkspace } from "documents/browser";
import { Shell } from "shell";
import { STATUS_OPTION_IDS, TaskPropertiesWorkspace } from "task-properties/browser";

export const FIXTURE_PAGES = ["home", "settings", "mcp", "bots", "documents", "tasks", "channels"] as const;
export type FixturePage = (typeof FIXTURE_PAGES)[number];

function pageFromHash(): FixturePage {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash.replace(/^#/, "");
  return (FIXTURE_PAGES as readonly string[]).includes(hash) ? (hash as FixturePage) : "home";
}

const DOC_ITEMS = [
  {
    entityId: "doc_fixture_1",
    entityType: "document" as const,
    tenantId: "team_fixture",
    title: "Playbook: Intraplex ICP",
    body: "Inspect then ask.",
    facet: null,
    projectId: "proj_fixture_1",
    updatedAt: 1,
    createdAt: 1,
    version: 1,
    unread: false,
    done: false,
    tombstoned: false,
  },
];

const FOLDER_ITEMS = [
  {
    entityId: "proj_fixture_1",
    entityType: "project" as const,
    tenantId: "team_fixture",
    title: "Outreach",
    body: "",
    facet: null,
    projectId: null,
    updatedAt: 1,
    createdAt: 1,
    version: 1,
    unread: false,
    done: false,
    tombstoned: false,
  },
];

const TASK_GRID_ROWS = [
  {
    entityId: "doc_task_1",
    title: "Ship N10 settings tabs",
    facet: "task" as const,
    values: {
      pdef_status: { kind: "select" as const, optionId: STATUS_OPTION_IDS.todo },
    },
  },
];

const TASK_KANBAN = [
  { optionId: STATUS_OPTION_IDS.todo, label: "Not Started", items: TASK_GRID_ROWS },
  { optionId: STATUS_OPTION_IDS.inProgress, label: "In Progress", items: [] },
];

const CHANNEL_ITEMS = [
  {
    entityId: "chn_fixture_1",
    entityType: "channel" as const,
    tenantId: "team_fixture",
    title: "Outreach stand-up",
    body: "first line",
    facet: null,
    projectId: null,
    updatedAt: 1,
    createdAt: 1,
    version: 1,
    unread: false,
    done: false,
    tombstoned: false,
  },
];

const CHANNEL_MESSAGES = [
  {
    id: "msg_fixture_1",
    channelId: "chn_fixture_1",
    seq: 1,
    senderId: "usr_fixture_1",
    senderKind: "user" as const,
    body: "first line",
    parentId: null,
    deleted: false,
    edited: false,
    version: 1,
    createdAt: 1,
    updatedAt: 1,
  },
];

const CHANNEL_PRESENCE = {
  entityType: "channel",
  entityId: "chn_fixture_1",
  trackPath: "/track/channel/chn_fixture_1",
  sessions: [
    {
      sessionId: "s1",
      actorId: "usr_fixture_1",
      entityType: "channel",
      entityId: "chn_fixture_1",
      action: "open" as const,
      lastSeen: 1,
    },
  ],
};

export function FixtureApp() {
  const [page, setPage] = useState<FixturePage>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div data-fixtures="outreach-os">
      <nav
        aria-label="Fixtures"
        style={{
          display: "flex",
          gap: "0.75rem",
          padding: "0.6rem 1rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#111",
          color: "#eee",
        }}
      >
        {FIXTURE_PAGES.map((id) => (
          <a key={id} href={`#${id}`} data-fixture-link={id} style={{ color: "#9cf" }}>
            {id}
          </a>
        ))}
      </nav>
      {page === "home" ? <Shell path="/" panes={[{ type: "home", id: "_" }]} /> : null}
      {page === "settings" ? <Shell path="/settings" panes={[{ type: "home", id: "_" }]} /> : null}
      {page === "mcp" ? <Shell path="/mcp" panes={[{ type: "home", id: "_" }]} /> : null}
      {page === "bots" ? <Shell path="/settings?tab=bots" panes={[{ type: "home", id: "_" }]} /> : null}
      {page === "documents" ? (
        <DocumentWorkspace
          items={DOC_ITEMS}
          folders={FOLDER_ITEMS}
          composeOpen
          folderComposeOpen
          draft="Weekly inspect notes"
          folderDraft="ICP"
        />
      ) : null}
      {page === "tasks" ? (
        <TaskPropertiesWorkspace
          gridRows={TASK_GRID_ROWS}
          kanbanColumns={TASK_KANBAN}
          composeOpen
          draft="Verify settings connections tab"
          editorOpen
        />
      ) : null}
      {page === "channels" ? (
        <ChannelWorkspace
          items={CHANNEL_ITEMS}
          messages={CHANNEL_MESSAGES}
          presence={CHANNEL_PRESENCE}
          composeOpen
          draft="Outreach stand-up"
          findOpen
        />
      ) : null}
    </div>
  );
}
