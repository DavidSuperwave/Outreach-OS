/**
 * Split registry. Source had 28 always + 19 LOCAL_ONLY + 5 DEV_MODE.
 * Dev-only and local-only splits are killed (OD-9 cloud web). Product registry is the 28 always set.
 */
export const ALWAYS_SPLITS = [
  "home",
  "inbox",
  "search",
  "chat",
  "md",
  "canvas",
  "code",
  "pdf",
  "image",
  "video",
  "channel",
  "email",
  "calendar",
  "companies",
  "tasks",
  "agents",
  "settings",
  "unknown",
  "project",
  "skill",
  "automation",
  "pr",
  "files",
  "documents",
  "non-member-channel",
  "preview",
  "reminder",
  "call",
] as const;

export type SplitType = (typeof ALWAYS_SPLITS)[number];

export const KILLED_DEV_SPLITS = [
  "hotkey-debugger",
  "lexical-debugger",
  "storybook",
  "token-playground",
  "rpc-inspector",
] as const;

export const KILLED_LOCAL_ONLY_SPLITS = [
  "local-fs",
  "local-terminal",
  "local-git",
] as const;

export function isProductSplit(type: string): type is SplitType {
  return (ALWAYS_SPLITS as readonly string[]).includes(type);
}

export function isKilledSplit(type: string): boolean {
  return (
    (KILLED_DEV_SPLITS as readonly string[]).includes(type) ||
    (KILLED_LOCAL_ONLY_SPLITS as readonly string[]).includes(type)
  );
}

export interface SplitPane {
  type: SplitType;
  id: string;
}

const EMPTY_ID = "_";

/** URL is the layout. Alternating {type}/{id} pairs; empty ids encode as `_`. */
export function encodeSplits(panes: readonly SplitPane[]): string {
  if (panes.length === 0) return "/";
  return `/${panes.map((pane) => `${pane.type}/${pane.id || EMPTY_ID}`).join("/")}`;
}

export function decodeSplits(pathname: string): SplitPane[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ type: "home", id: EMPTY_ID }];
  if (parts.length % 2 !== 0) throw new Error(`odd split codec path: ${pathname}`);
  const panes: SplitPane[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const type = parts[i]!;
    const id = parts[i + 1]!;
    if (isKilledSplit(type)) throw new Error(`killed split: ${type}`);
    if (!isProductSplit(type)) throw new Error(`unknown split type: ${type}`);
    panes.push({ type, id });
  }
  return panes;
}

export class SplitManager {
  #panes: SplitPane[];
  #focus = 0;
  #history: SplitPane[][] = [];
  #future: SplitPane[][] = [];

  constructor(panes: SplitPane[] = [{ type: "home", id: EMPTY_ID }]) {
    this.#panes = panes;
  }

  get panes(): readonly SplitPane[] {
    return this.#panes;
  }

  get focused(): SplitPane {
    return this.#panes[this.#focus] ?? this.#panes[0]!;
  }

  canAppend(): boolean {
    return this.#panes.length < 8;
  }

  append(pane: SplitPane, allowDuplicate = false): boolean {
    if (!this.canAppend()) return false;
    if (!allowDuplicate && this.#panes.some((item) => item.type === pane.type && item.id === pane.id)) {
      this.#focus = this.#panes.findIndex((item) => item.type === pane.type && item.id === pane.id);
      return true;
    }
    this.#pushHistory();
    this.#panes = [...this.#panes, pane];
    this.#focus = this.#panes.length - 1;
    return true;
  }

  closeFocused(): void {
    this.#pushHistory();
    if (this.#panes.length === 1) {
      this.#panes = [{ type: "home", id: EMPTY_ID }];
      this.#focus = 0;
      return;
    }
    const next = this.#panes.filter((_, index) => index !== this.#focus);
    this.#panes = next;
    this.#focus = Math.min(this.#focus, next.length - 1);
  }

  focusDelta(delta: number): void {
    if (this.#panes.length === 0) return;
    this.#focus = (this.#focus + delta + this.#panes.length) % this.#panes.length;
  }

  back(): boolean {
    const prior = this.#history.pop();
    if (!prior) return false;
    this.#future.push(this.#panes);
    this.#panes = prior;
    this.#focus = Math.min(this.#focus, this.#panes.length - 1);
    return true;
  }

  forward(): boolean {
    const next = this.#future.pop();
    if (!next) return false;
    this.#history.push(this.#panes);
    this.#panes = next;
    this.#focus = Math.min(this.#focus, this.#panes.length - 1);
    return true;
  }

  toPath(): string {
    return encodeSplits(this.#panes);
  }

  #pushHistory(): void {
    this.#history.push(this.#panes);
    this.#future = [];
  }
}
