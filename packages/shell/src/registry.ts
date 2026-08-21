export type LeaderKey = "g" | "o" | "c";

export type ScopeId =
  | "global"
  | "command-scope-go-to"
  | "command-scope-command-menu-category"
  | "command-scope-create-menu"
  | "command-scope-favorites"
  | "split"
  | "block"
  | "detached";

export type RegistrationType = "override" | "add";

export interface KeyEvent {
  chord: string;
  inputFocused: boolean;
  touch: boolean;
  platform: "mac" | "non-mac";
}

export interface CommandHandler {
  id: string;
  scope: ScopeId;
  chord: string;
  priority: number;
  registrationType: RegistrationType;
  runWithInputFocused: boolean;
  handle: () => boolean;
}

const LEADERS: Record<LeaderKey, ScopeId> = {
  g: "command-scope-go-to",
  o: "command-scope-command-menu-category",
  c: "command-scope-create-menu",
};

const PARENT: Record<ScopeId, ScopeId | null> = {
  global: null,
  "command-scope-go-to": "global",
  "command-scope-command-menu-category": "global",
  "command-scope-create-menu": "global",
  "command-scope-favorites": "global",
  split: "global",
  block: "split",
  detached: null,
};

/**
 * Central command registry (ADR-001). Dispatch walks active → parent.
 * First capturing handler (true) wins. override replaces same-chord in a scope; add stacks.
 * Disabled on touch. cmd → ctrl on non-mac. Unhandled non-modifier in a leader scope jettisons.
 */
export class CommandRegistry {
  #handlers = new Map<ScopeId, CommandHandler[]>();
  #active: ScopeId = "global";
  #leader: LeaderKey | null = null;
  #parentBeforeLeader: ScopeId = "global";

  get activeScope(): ScopeId {
    return this.#active;
  }

  get leader(): LeaderKey | null {
    return this.#leader;
  }

  register(handler: CommandHandler): () => void {
    const list = this.#handlers.get(handler.scope) ?? [];
    const chord = handler.chord;
    if (handler.registrationType === "override") {
      this.#handlers.set(handler.scope, [...list.filter((item) => item.chord !== chord), handler]);
    } else {
      this.#handlers.set(handler.scope, [...list, handler]);
    }
    return () => {
      const current = this.#handlers.get(handler.scope) ?? [];
      this.#handlers.set(
        handler.scope,
        current.filter((item) => item !== handler),
      );
    };
  }

  setActive(scope: ScopeId): void {
    this.#active = scope;
  }

  activateLeader(key: LeaderKey): void {
    this.#parentBeforeLeader = this.#active;
    this.#leader = key;
    this.#active = LEADERS[key];
  }

  jettison(): void {
    this.#leader = null;
    this.#active = this.#parentBeforeLeader === "detached" ? "global" : this.#parentBeforeLeader;
    if (this.#active.startsWith("command-scope-")) this.#active = "global";
  }

  translateChord(chord: string, platform: "mac" | "non-mac"): string {
    if (platform === "non-mac") return chord.replaceAll("cmd+", "ctrl+");
    return chord;
  }

  dispatch(event: KeyEvent): string | null {
    if (event.touch) return null;
    const chord = this.translateChord(event.chord, event.platform);
    const chain = this.#chain(this.#active);
    for (const scope of chain) {
      const candidates = (this.#handlers.get(scope) ?? [])
        .filter((handler) => this.translateChord(handler.chord, event.platform) === chord)
        .filter((handler) => handler.runWithInputFocused || !event.inputFocused)
        .sort((a, b) => b.priority - a.priority);
      for (const handler of candidates) {
        if (handler.handle()) {
          if (this.#leader && scope.startsWith("command-scope-") && !["g", "o", "c"].includes(chord)) {
            this.jettison();
          }
          return handler.id;
        }
      }
    }
    if (this.#leader && !event.inputFocused && !chord.includes("+")) {
      this.jettison();
    }
    return null;
  }

  #chain(start: ScopeId): ScopeId[] {
    const out: ScopeId[] = [];
    let cursor: ScopeId | null = start;
    while (cursor) {
      out.push(cursor);
      cursor = PARENT[cursor];
    }
    return out;
  }
}
