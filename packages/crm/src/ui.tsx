import { Shell } from "shell";
import type { SoupItem } from "soup/browser";
import { KANBAN_NONE } from "./types.js";
import type { ActivitySlot, CompanyKanbanColumn, CompanyView, ContactRecord, EmailLinkSlot } from "./types.js";

export function CompanyComposePopover({ open, domain }: { open: boolean; domain: string }) {
  if (!open) return null;
  return (
    <form data-scope="company-compose-popover" data-command="block-company">
      <label>
        Domain
        <input name="domain" defaultValue={domain} aria-label="Company domain" />
      </label>
      <button type="submit">Create company</button>
    </form>
  );
}

export function ContactComposePopover({ open, email }: { open: boolean; email: string }) {
  if (!open) return null;
  return (
    <form data-scope="contact-compose-popover" data-command="block-contact">
      <label>
        Email
        <input name="email" defaultValue={email} aria-label="Contact email" />
      </label>
      <button type="submit">Add contact</button>
    </form>
  );
}

export function CompanyList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.companies" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function CompanyKanban({ columns }: { columns: readonly CompanyKanbanColumn[] }) {
  return (
    <div data-surface="soup.companies.kanban" data-view="kanban" role="list">
      {columns.map((column) => (
        <section
          key={column.optionId}
          data-kanban-column={column.optionId}
          data-empty={column.items.length === 0 ? "true" : "false"}
        >
          <h3>{column.label}</h3>
          <ul>
            {column.items.map((item) => (
              <li
                key={item.id}
                data-entity-id={item.id}
                data-entity-type="crm_company"
                data-column={column.optionId === KANBAN_NONE ? "none" : column.optionId}
              >
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function CompanyDetail({
  view,
}: {
  view: CompanyView | null;
}) {
  if (!view) return null;
  const { company, contacts, properties, emailLinks, activity } = view;
  return (
    <article data-surface="crm.company-view" data-entity-id={company.id} data-domain={company.domain}>
      <h2>{company.title}</h2>
      <dl data-surface="crm.properties">
        <dt>Stage</dt>
        <dd data-property="stage" data-source={properties.stage.source ?? ""}>
          {properties.stage.value ?? ""}
        </dd>
        <dt>Owner</dt>
        <dd data-property="owner" data-source={properties.owner.source ?? ""}>
          {properties.owner.value ?? ""}
        </dd>
        <dt>Revenue</dt>
        <dd data-property="revenue" data-source={properties.revenue.source ?? ""}>
          {properties.revenue.value ?? ""}
        </dd>
      </dl>
      <ContactList contacts={contacts} />
      <EmailLinkSlotList links={emailLinks} />
      <ActivitySlotList facts={activity} />
    </article>
  );
}

export function ContactList({ contacts }: { contacts: readonly ContactRecord[] }) {
  return (
    <ul data-surface="crm.contacts" role="list">
      {contacts.map((contact) => (
        <li
          key={contact.id}
          data-entity-id={contact.id}
          data-entity-type="crm_contact"
          data-company-id={contact.companyId}
        >
          {contact.name} ({contact.email})
        </li>
      ))}
    </ul>
  );
}

export function EmailLinkSlotList({ links }: { links: readonly EmailLinkSlot[] }) {
  return (
    <ul data-surface="crm.email-links" data-empty={links.length === 0 ? "true" : "false"} role="list">
      {links.map((link) => (
        <li key={link.id} data-evidence-id={link.evidenceId} data-thread-id={link.threadId ?? ""}>
          {link.evidenceId}
        </li>
      ))}
    </ul>
  );
}

export function ActivitySlotList({ facts }: { facts: readonly ActivitySlot[] }) {
  return (
    <ul data-surface="crm.activity" data-empty={facts.length === 0 ? "true" : "false"} role="list">
      {facts.map((fact) => (
        <li key={fact.id} data-action={fact.action}>
          {fact.action}
        </li>
      ))}
    </ul>
  );
}

export function CompanyWorkspace({
  items,
  columns,
  view,
  composeOpen,
  contactComposeOpen,
  draft,
  contactDraft,
}: {
  items: readonly SoupItem[];
  columns: readonly CompanyKanbanColumn[];
  view?: CompanyView | null;
  composeOpen: boolean;
  contactComposeOpen?: boolean;
  draft: string;
  contactDraft?: string;
}) {
  return (
    <div data-slice="crm">
      <Shell path="/companies" panes={[{ type: "companies", id: "_" }]} theme="outreach-dark" />
      <CompanyComposePopover open={composeOpen} domain={draft} />
      <ContactComposePopover open={contactComposeOpen ?? false} email={contactDraft ?? ""} />
      <CompanyList items={items} />
      <CompanyKanban columns={columns} />
      <CompanyDetail view={view ?? null} />
    </div>
  );
}
