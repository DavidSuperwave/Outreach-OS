import { Shell } from "shell";
import type { SoupItem } from "soup/browser";
import { LIFTED_WORKERS, type FolderUploadJob } from "./workers.js";

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

export function LiftedWorkersPanel({
  workers = LIFTED_WORKERS,
  folderUpload,
}: {
  workers?: readonly string[];
  folderUpload?: Pick<FolderUploadJob, "jobId" | "progress" | "state">;
}) {
  return (
    <section data-surface="documents.workers" aria-label="Lifted document workers">
      <ul>
        {workers.map((id) => (
          <li key={id} data-worker={id}>
            {id}
          </li>
        ))}
      </ul>
      {folderUpload ? (
        <p
          data-surface="documents.folder-upload"
          data-job-id={folderUpload.jobId}
          data-progress={folderUpload.progress}
          data-state={folderUpload.state}
        >
          {folderUpload.jobId} {folderUpload.progress}%
        </p>
      ) : null}
    </section>
  );
}

export function DocumentWorkspace({
  items,
  folders,
  composeOpen,
  folderComposeOpen,
  draft,
  folderDraft,
  folderUpload,
}: {
  items: readonly SoupItem[];
  folders?: readonly SoupItem[];
  composeOpen: boolean;
  folderComposeOpen?: boolean;
  draft: string;
  folderDraft?: string;
  folderUpload?: Pick<FolderUploadJob, "jobId" | "progress" | "state">;
}) {
  return (
    <div data-slice="documents">
      <Shell path="/documents" panes={[{ type: "documents", id: "_" }]} theme="outreach-dark">
        <DocumentComposePopover open={composeOpen} title={draft} />
        <FolderComposePopover open={folderComposeOpen ?? false} title={folderDraft ?? ""} />
        <LiftedWorkersPanel folderUpload={folderUpload} />
        <DocumentList items={[...(folders ?? []), ...items]} />
      </Shell>
    </div>
  );
}
