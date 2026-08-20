import { useEffect, useState } from "react";
import { ActivityWorkspace } from "activity/browser";
import { CalendarWorkspace } from "calendar/browser";
import { ChannelWorkspace } from "channels/browser";
import { ConverterWorkspace } from "converter/browser";
import { CompanyWorkspace, STAGE_OPTION_IDS } from "crm/browser";
import { DocumentWorkspace } from "documents/browser";
import { FileWorkspace } from "files/browser";
import { MailboxWorkspace } from "mailbox/browser";
import { NotificationWorkspace } from "notifications/browser";
import { SearchWorkspace } from "search/browser";
import { Shell } from "shell";
import { STATUS_OPTION_IDS, TaskPropertiesWorkspace } from "task-properties/browser";

export const FIXTURE_PAGES = [
  "home",
  "settings",
  "mcp",
  "bots",
  "documents",
  "tasks",
  "channels",
  "files",
  "mail",
  "calendar",
  "calls",
  "companies",
  "search",
  "activity",
  "notifications",
  "converter",
] as const;
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

const FILE_ITEMS = [
  {
    id: "file_00000000000000000000000000000001",
    tenantId: "team_fixture",
    ownerId: "usr_fixture_1",
    name: "brief.pdf",
    contentType: "application/pdf",
    extensionData: {},
    state: "ready" as const,
    blobKey: "r2:file_fixture_1",
    size: 8,
    sha: "abc",
    createdAt: 1,
    updatedAt: 1,
    failReason: null,
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

const MAIL_ITEMS = [
  {
    entityId: "eth_fixture_1",
    entityType: "email_thread" as const,
    tenantId: "team_fixture",
    title: "Intraplex ICP",
    body: "Can we inspect the playbook?",
    facet: null,
    projectId: null,
    updatedAt: 1,
    createdAt: 1,
    version: 1,
    unread: true,
    done: false,
    tombstoned: false,
  },
];

const MAIL_THREAD = {
  id: "eth_fixture_1",
  tenantId: "team_fixture",
  accountId: "acct_fixture_1",
  mailboxId: "mbox_fixture_1",
  gmailThreadId: "gmail_th_1",
  subject: "Intraplex ICP",
  snippet: "Can we inspect the playbook?",
  unread: true,
  done: false,
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};

const CALENDAR_ITEMS = [
  {
    entityId: "cal_fixture_1",
    entityType: "calendar_event" as const,
    tenantId: "team_fixture",
    title: "ICP review",
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

const CALENDAR_EVENT = {
  id: "cal_fixture_1",
  tenantId: "team_fixture",
  title: "ICP review",
  startsAt: 1,
  endsAt: 2,
  providerEventId: null,
  connectionId: null,
  recurrenceRule: null,
  deleted: false,
  version: 1,
  createdAt: 1,
};

const CALL_ITEMS = [
  {
    entityId: "call_fixture_1",
    entityType: "call" as const,
    tenantId: "team_fixture",
    title: "Stand-up",
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

const CALL_RECORD = {
  id: "call_fixture_1",
  tenantId: "team_fixture",
  title: "Stand-up",
  status: "live" as const,
  participantIds: ["usr_fixture_1"],
  channelId: null,
  calendarEventId: null,
  room: null,
  transcriptId: null,
  recordingHandle: null,
  finalized: false,
  version: 1,
  createdAt: 1,
};

const COMPANY_ITEMS = [
  {
    entityId: "co_fixture_1",
    entityType: "crm_company" as const,
    tenantId: "team_fixture",
    title: "Intraplex",
    body: "intraplex.example",
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

const COMPANY_KANBAN = [
  {
    optionId: STAGE_OPTION_IDS.lead,
    label: "Lead",
    items: [
      {
        id: "co_fixture_1",
        tenantId: "team_fixture",
        domain: "intraplex.example",
        title: "Intraplex",
        hidden: false,
        deleted: false,
        derived: false,
        version: 1,
        createdAt: 1,
        properties: {
          stage: { value: STAGE_OPTION_IDS.lead, source: "user" as const },
          owner: { value: null, source: null },
          revenue: { value: null, source: null },
        },
        enrichment: null,
      },
    ],
  },
];

const COMPANY_VIEW = {
  company: COMPANY_KANBAN[0]!.items[0]!,
  contacts: [
    {
      id: "ctc_fixture_1",
      tenantId: "team_fixture",
      companyId: "co_fixture_1",
      email: "ada@intraplex.example",
      name: "Ada",
      derived: false,
      deleted: false,
      version: 1,
      createdAt: 1,
    },
  ],
  properties: COMPANY_KANBAN[0]!.items[0]!.properties,
  emailLinks: [] as const,
  activity: [] as const,
};

const MAIL_MESSAGES = [
  {
    id: "gmail_msg_in_1",
    threadId: "eth_fixture_1",
    gmailMessageId: "gmail_msg_in_1",
    gmailThreadId: "gmail_th_1",
    historyId: "10",
    from: "prospect@example.com",
    to: ["hello@superwave.example"],
    cc: [],
    subject: "Intraplex ICP",
    body: "Can we inspect the playbook?",
    direction: "inbound" as const,
    createdAt: 1,
  },
];

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
          folderUpload={{ jobId: "job_folder_1", progress: 50, state: "running" }}
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
      {page === "files" ? (
        <FileWorkspace
          files={FILE_ITEMS}
          uploadOpen
          draft="brief.pdf"
        />
      ) : null}
      {page === "mail" ? (
        <MailboxWorkspace
          items={MAIL_ITEMS}
          thread={MAIL_THREAD}
          messages={MAIL_MESSAGES}
          composeOpen
          draft="Re: Intraplex ICP"
          path="/mail"
        />
      ) : null}
      {page === "calendar" ? (
        <CalendarWorkspace
          surface="calendar"
          events={CALENDAR_ITEMS}
          openEvent={CALENDAR_EVENT}
          composeOpen
          reminderOpen
          draft="ICP review"
          view="week"
        />
      ) : null}
      {page === "calls" ? (
        <CalendarWorkspace
          surface="calls"
          events={[]}
          calls={CALL_ITEMS}
          openCall={CALL_RECORD}
          composeOpen={false}
          draft=""
        />
      ) : null}
      {page === "companies" ? (
        <CompanyWorkspace
          items={COMPANY_ITEMS}
          columns={COMPANY_KANBAN}
          view={COMPANY_VIEW}
          composeOpen
          contactComposeOpen
          draft="intraplex.example"
          contactDraft="ada@intraplex.example"
        />
      ) : null}
      {page === "search" ? (
        <SearchWorkspace
          query="intraplex"
          hits={[
            {
              entityType: "crm_company",
              entityId: "co_fixture_1",
              tenantId: "team_fixture",
              title: "Intraplex",
              snippet: "intraplex.example",
              score: 3,
              updatedAt: 1,
            },
          ]}
        />
      ) : null}
      {page === "activity" ? (
        <ActivityWorkspace
          mine={[
            {
              id: "act_fixture_1",
              action: "created",
              entityType: "document",
              entityId: "doc_fixture_1",
              actorId: "usr_fixture_1",
              occurredAt: 1,
            },
          ]}
          recents={[
            {
              entityId: "doc_fixture_1",
              entityType: "document",
              score: 1,
              frequency: 1,
              recency: 1,
              lastOccurredAt: 1,
              eventCount: 1,
            },
          ]}
          favorites={[
            {
              entityId: "doc_fixture_1",
              entityType: "document",
              title: "Playbook: Intraplex ICP",
              sortOrder: 1,
            },
          ]}
        />
      ) : null}
      {page === "notifications" ? (
        <NotificationWorkspace
          unreadCount={1}
          items={[
            {
              id: "ntf_fixture_1",
              eventId: "evt_fixture_1",
              recipientId: "usr_fixture_1",
              type: "channel_mention",
              entityId: "chn_fixture_1",
              meta: { title: "Outreach stand-up" },
              title: "Mentioned: Outreach stand-up",
              seen: false,
              done: false,
              deleted: false,
              createdAt: 1,
            },
          ]}
        />
      ) : null}
      {page === "converter" ? (
        <ConverterWorkspace
          jobs={[
            {
              job_id: "job_golden_1",
              type: "doc-convert",
              fromKey: "r2:docx/golden",
              toKey: "r2:pdf/golden",
              state: "succeeded",
              attempts: 1,
              error: null,
              fixture: "golden",
              createdAt: 1,
              updatedAt: 2,
            },
            {
              job_id: "job_poison_1",
              type: "doc-convert",
              fromKey: "r2:docx/poison",
              toKey: "r2:pdf/poison",
              state: "failed",
              attempts: 1,
              error: "convert_failed",
              fixture: "poison",
              createdAt: 1,
              updatedAt: 2,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
