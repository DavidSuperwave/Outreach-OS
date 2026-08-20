import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { CalendarWorkspace } from "calendar";
import { ChannelWorkspace } from "channels";
import { CompanyWorkspace, STAGE_OPTION_IDS } from "crm";
import { FileWorkspace } from "files";
import { MailboxWorkspace } from "mailbox";
import { STATUS_OPTION_IDS, TaskPropertiesWorkspace } from "task-properties";
import { FIXTURE_PAGES, FixtureApp } from "./FixtureApp.js";

describe("UI fixtures gallery", () => {
  it("names the N10/N6/N7/N8/N9/N11/N12/N13/N14 fixture pages", () => {
    expect(FIXTURE_PAGES).toEqual([
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
    ]);
    const html = renderToString(createElement(FixtureApp));
    expect(html).toContain("data-fixtures=\"outreach-os\"");
    expect(html).toContain("data-fixture-link=\"settings\"");
    expect(html).toContain("data-fixture-link=\"tasks\"");
    expect(html).toContain("data-fixture-link=\"channels\"");
    expect(html).toContain("data-fixture-link=\"files\"");
    expect(html).toContain("data-fixture-link=\"mail\"");
    expect(html).toContain("data-fixture-link=\"calendar\"");
    expect(html).toContain("data-fixture-link=\"calls\"");
    expect(html).toContain("data-fixture-link=\"companies\"");
  });

  it("renders TaskGrid and KanbanBoard on Shell /tasks", () => {
    const rows = [
      {
        entityId: "doc_task_1",
        title: "Ship N10 settings tabs",
        facet: "task" as const,
        values: { pdef_status: { kind: "select" as const, optionId: STATUS_OPTION_IDS.todo } },
      },
    ];
    const html = renderToString(
      createElement(TaskPropertiesWorkspace, {
        gridRows: rows,
        kanbanColumns: [
          { optionId: STATUS_OPTION_IDS.todo, label: "Not Started", items: rows },
          { optionId: STATUS_OPTION_IDS.inProgress, label: "In Progress", items: [] },
        ],
        composeOpen: true,
        draft: "Verify settings connections tab",
        editorOpen: true,
      }),
    );
    expect(html).toContain("data-split=\"tasks\"");
    expect(html).toContain("data-surface=\"soup.tasks.grid\"");
    expect(html).toContain("data-surface=\"soup.tasks.kanban\"");
    expect(html).toContain("Ship N10 settings tabs");
  });

  it("renders ChannelWorkspace on Shell /channels", () => {
    const html = renderToString(
      createElement(ChannelWorkspace, {
        items: [
          {
            entityId: "chn_fixture_1",
            entityType: "channel",
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
        ],
        messages: [
          {
            id: "msg_fixture_1",
            channelId: "chn_fixture_1",
            seq: 1,
            senderId: "usr_fixture_1",
            senderKind: "user",
            body: "first line",
            parentId: null,
            deleted: false,
            edited: false,
            version: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        composeOpen: true,
        draft: "Outreach stand-up",
        findOpen: true,
      }),
    );
    expect(html).toContain("data-split=\"channel\"");
    expect(html).toContain("data-surface=\"soup.channels\"");
    expect(html).toContain("Outreach stand-up");
    expect(html).toContain("first line");
  });

  it("renders FileWorkspace on Shell /file", () => {
    const html = renderToString(
      createElement(FileWorkspace, {
        files: [
          {
            id: "file_00000000000000000000000000000001",
            tenantId: "team_fixture",
            ownerId: "usr_fixture_1",
            name: "brief.pdf",
            contentType: "application/pdf",
            extensionData: {},
            state: "ready",
            blobKey: "r2:file_fixture_1",
            size: 8,
            sha: "abc",
            createdAt: 1,
            updatedAt: 1,
            failReason: null,
          },
        ],
        uploadOpen: true,
        draft: "brief.pdf",
      }),
    );
    expect(html).toContain("data-split=\"files\"");
    expect(html).toContain("data-surface=\"files.list\"");
    expect(html).toContain("brief.pdf");
    expect(html).toContain("href=\"/file\"");
  });

  it("renders CalendarWorkspace on Shell /calendar and /calls", () => {
    const event = {
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
    const calHtml = renderToString(
      createElement(CalendarWorkspace, {
        surface: "calendar",
        events: [
          {
            entityId: "cal_fixture_1",
            entityType: "calendar_event",
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
        ],
        openEvent: event,
        composeOpen: true,
        reminderOpen: true,
        draft: "ICP review",
        view: "week",
      }),
    );
    expect(calHtml).toContain("data-split=\"calendar\"");
    expect(calHtml).toContain("data-surface=\"soup.calendar\"");
    expect(calHtml).toContain("ICP review");
    expect(calHtml).toContain("href=\"/calendar\"");

    const callHtml = renderToString(
      createElement(CalendarWorkspace, {
        surface: "calls",
        events: [],
        calls: [
          {
            entityId: "call_fixture_1",
            entityType: "call",
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
        ],
        openCall: {
          id: "call_fixture_1",
          tenantId: "team_fixture",
          title: "Stand-up",
          status: "live",
          participantIds: ["usr_fixture_1"],
          channelId: null,
          calendarEventId: null,
          room: null,
          transcriptId: null,
          recordingHandle: null,
          finalized: false,
          version: 1,
          createdAt: 1,
        },
        composeOpen: false,
        draft: "",
      }),
    );
    expect(callHtml).toContain("data-split=\"call\"");
    expect(callHtml).toContain("data-surface=\"soup.calls\"");
    expect(callHtml).toContain("Stand-up");
    expect(callHtml).toContain("href=\"/calls\"");
  });

  it("renders MailboxWorkspace on Shell /mail", () => {
    const html = renderToString(
      createElement(MailboxWorkspace, {
        items: [
          {
            entityId: "eth_fixture_1",
            entityType: "email_thread",
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
        ],
        thread: {
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
        },
        messages: [
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
            direction: "inbound",
            createdAt: 1,
          },
        ],
        composeOpen: true,
        draft: "Re: Intraplex ICP",
        path: "/mail",
      }),
    );
    expect(html).toContain("data-split=\"email\"");
    expect(html).toContain("data-surface=\"soup.mail\"");
    expect(html).toContain("Intraplex ICP");
    expect(html).toContain("Can we inspect the playbook?");
  });

  it("renders CompanyWorkspace and CompanyKanban on Shell /companies", () => {
    const company = {
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
    };
    const html = renderToString(
      createElement(CompanyWorkspace, {
        items: [
          {
            entityId: "co_fixture_1",
            entityType: "crm_company",
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
        ],
        columns: [{ optionId: STAGE_OPTION_IDS.lead, label: "Lead", items: [company] }],
        view: {
          company,
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
          properties: company.properties,
          emailLinks: [],
          activity: [],
        },
        composeOpen: true,
        contactComposeOpen: true,
        draft: "intraplex.example",
        contactDraft: "ada@intraplex.example",
      }),
    );
    expect(html).toContain("data-split=\"companies\"");
    expect(html).toContain("data-surface=\"soup.companies.kanban\"");
    expect(html).toContain("data-surface=\"crm.company-view\"");
    expect(html).toContain("Intraplex");
    expect(html).toContain("Ada");
  });
});
