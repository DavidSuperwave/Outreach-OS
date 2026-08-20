# API, RPC, command, and hotkey compatibility

## Why this is a dedicated workstream

The target kernel exposes a large typed RPC surface through `cloudflare-os/packages/workshop-shared/src/api.ts`. Earlier review estimated approximately 187 methods. The exact number and disposition must be generated and reviewed; the estimate is not an acceptance criterion.

Neuwave’s command system is similarly distributed across global registrations, scoped registrations, dynamic loops, command-menu-only entries, and native/browser contexts. A grep count is not the final inventory.

## RPC ledger

Each callable surface must record:

| Field | Meaning |
|---|---|
| Interface/capability | `PublicApi`, `AuthenticatedApi`, `Overseer`, `GadgetClient`, `GatekeeperClient`, subscriber, admin, etc. |
| Method | Exact source name. |
| Source pointer | File, pin, and line. |
| Caller/surface | Which route/component/workflow uses it. |
| Input/output | Full semantic contract, not only TypeScript text. |
| Authority | State owner and authorization boundary. |
| Side effects | Writes, actions, hooks, subscriptions, external calls. |
| Ordering/idempotency | Required guarantees. |
| Target disposition | Preserve, wrap, adapt, merge, replace, defer, or remove. |
| Compatibility adapter | Required translation layer. |
| Test | Contract/parity proof. |
| Migration dependency | Data or rollout prerequisite. |

The included `scripts/inventory_cf_os_rpc.py` produces a first mechanical table. Codex must manually review multiline/generic signatures and callback capabilities.

## Command/hotkey ledger

Each command must record:

- command/token identity;
- description and discoverability text;
- hotkey(s);
- scope and parent scope;
- shadowing/priority;
- condition and hide rule;
- input-focus behavior;
- browser/native availability;
- handler intent;
- target React command ID;
- telemetry event;
- accessibility alternative;
- parity test;
- disposition.

The included `scripts/inventory_neuwave_hotkeys.py` extracts registration sites and common fields. Dynamic registrations still require source review.

## Target command architecture

Use a centralized typed registry rather than component-local key listeners:

```ts
export type CommandId = string;

export interface CommandContext {
  route: string;
  activeSurface?: string;
  activeEntity?: { type: string; id: string };
  inputFocused: boolean;
  platform: 'web' | 'desktop';
}

export interface CommandDefinition {
  id: CommandId;
  title: string;
  description?: string;
  defaultHotkeys?: string[];
  scope: string;
  priority?: number;
  keywords?: string[];
  isVisible(ctx: CommandContext): boolean;
  isEnabled(ctx: CommandContext): boolean;
  run(ctx: CommandContext): Promise<void> | void;
}
```

The registry must support nested/leader scopes, dynamic commands, shadow detection, display ordering, input-focus policy, command-palette search, hotkey rendering, and clean disposal.

## Compatibility freeze rule

Once the ledgers are accepted, changes require:

1. a ledger update;
2. an explicit compatibility note;
3. contract tests;
4. migration or deprecation behavior where relevant.
