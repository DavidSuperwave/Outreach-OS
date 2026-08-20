import { Shell } from "shell";
import type { SoupItem } from "soup";

export function DocumentComposePopover({ open, title }: { open: boolean; title: string }) {
  if (!open) return null;
  return (
    <form data-scope="document-compose-popover" data-command="create-menu.md">
      <label>
        Title
        <input name="title" defaultValue={title} aria-label="Document title" />
      </label>
      <button type="submit">Create document</button>
    </form>
  );
}

export function FolderComposePopover({ open, title }: { open: boolean; title: string }) {
  if (!open) return null;
  return (
    <form data-scope="folder-compose-popover" data-command="create-menu.project">
      <label>
        Name
        <input name="title" defaultValue={title} aria-label="Folder name" />
      </label>
      <button type="submit">Create folder</button>
    </form>
  );
}

export function DocumentList({ items }: { items: readonly SoupItem[] }) {
  return (
    <ul data-surface="soup.documents" role="list">
      {items.map((item) => (
        <li
          key={item.entityId}
          data-entity-id={item.entityId}
          data-entity-type={item.entityType}
          data-project-id={item.projectId ?? ""}
        >
          {item.title}
        </li>
      ))}
    </ul>
  );
}

export function DocumentWorkspace({
  items,
  folders,
  composeOpen,
  folderComposeOpen,
  draft,
  folderDraft,
}: {
  items: readonly SoupItem[];
  folders?: readonly SoupItem[];
  composeOpen: boolean;
  folderComposeOpen?: boolean;
  draft: string;
  folderDraft?: string;
}) {
  return (
    <div data-slice="documents">
      <Shell path="/documents" panes={[{ type: "documents", id: "_" }]} theme="outreach-dark" />
      <DocumentComposePopover open={composeOpen} title={draft} />
      <FolderComposePopover open={folderComposeOpen ?? false} title={folderDraft ?? ""} />
      <DocumentList items={[...(folders ?? []), ...items]} />
    </div>
  );
}
