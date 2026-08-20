import { Shell } from "shell";
import type { FileMetadata } from "./types.js";
import { IMAGE_PROXY } from "./types.js";

export function FileUploadForm({ open, name }: { open: boolean; name: string }) {
  if (!open) return null;
  return (
    <form data-scope="file-upload" data-command="global.upload-files">
      <label>
        Name
        <input name="name" defaultValue={name} aria-label="File name" />
      </label>
      <button type="submit">Upload file</button>
    </form>
  );
}

export function FileList({ files }: { files: readonly FileMetadata[] }) {
  return (
    <ul data-surface="files.list" role="list">
      {files.map((file) => (
        <li
          key={file.id}
          data-entity-id={file.id}
          data-entity-type="static_file"
          data-upload-state={file.state}
        >
          {file.name}
        </li>
      ))}
    </ul>
  );
}

export function FileWorkspace({
  files,
  uploadOpen,
  draft,
}: {
  files: readonly FileMetadata[];
  uploadOpen: boolean;
  draft: string;
}) {
  return (
    <div data-slice="files">
      <Shell path="/file" panes={[{ type: "files", id: "_" }]} theme="outreach-dark" />
      <FileUploadForm open={uploadOpen} name={draft} />
      <FileList files={files} />
      <p data-surface="files.image-proxy" data-status={IMAGE_PROXY.status}>
        {IMAGE_PROXY.note}
      </p>
    </div>
  );
}
