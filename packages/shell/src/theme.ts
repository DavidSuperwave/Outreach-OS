/** OD-24 governed token layer. No Macro names. Storage keys are outreach-*. */

export const THEME_IDS = [
  "outreach-dark",
  "void",
  "ember",
  "spirit",
  "moon",
  "rain",
  "outreach-light",
  "satsuma",
  "lapis",
  "flora",
  "paper",
  "decepticon",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_LABELS: Record<ThemeId, string> = {
  "outreach-dark": "Outreach Dark",
  void: "Void",
  ember: "Ember",
  spirit: "Spirit",
  moon: "Moon",
  rain: "Rain",
  "outreach-light": "Outreach Light",
  satsuma: "Satsuma",
  lapis: "Lapis",
  flora: "Flora",
  paper: "Paper",
  decepticon: "Decepticon",
};

export const STORAGE_KEYS = {
  userThemes: "outreach-user-themes",
  theme: "outreach-theme",
  defaultLight: "outreach-default-light",
  defaultDark: "outreach-default-dark",
  themeMode: "outreach-theme-mode",
  sidebarCollapsed: "outreach-sidebar-collapsed",
} as const;

export type TokenSet = {
  surface: string;
  text: string;
  border: string;
  accent: string;
  status: string;
  muted: string;
  overlay: string;
  popover: string;
};

export interface UserTheme {
  id: string;
  label: string;
  tokens: TokenSet;
}

/** One OKLCH palette per THEME_IDS row. Names are Outreach-governed (OD-24). */
export const OKLCH_TOKENS: Record<ThemeId, TokenSet> = {
  "outreach-dark": {
    surface: "oklch(0.18 0.02 260)",
    text: "oklch(0.96 0.01 260)",
    border: "oklch(0.32 0.02 260)",
    accent: "oklch(0.72 0.14 250)",
    status: "oklch(0.75 0.16 145)",
    muted: "oklch(0.70 0.02 260)",
    overlay: "oklch(0.14 0.02 260 / 0.72)",
    popover: "oklch(0.22 0.025 260)",
  },
  void: {
    surface: "oklch(0.12 0.005 260)",
    text: "oklch(0.94 0.01 260)",
    border: "oklch(0.24 0.01 260)",
    accent: "oklch(0.78 0.02 260)",
    status: "oklch(0.72 0.12 145)",
    muted: "oklch(0.62 0.01 260)",
    overlay: "oklch(0.08 0.005 260 / 0.78)",
    popover: "oklch(0.16 0.01 260)",
  },
  ember: {
    surface: "oklch(0.18 0.04 40)",
    text: "oklch(0.96 0.02 70)",
    border: "oklch(0.32 0.05 40)",
    accent: "oklch(0.72 0.18 45)",
    status: "oklch(0.74 0.15 145)",
    muted: "oklch(0.70 0.04 50)",
    overlay: "oklch(0.12 0.04 40 / 0.72)",
    popover: "oklch(0.22 0.045 40)",
  },
  spirit: {
    surface: "oklch(0.18 0.05 310)",
    text: "oklch(0.96 0.02 310)",
    border: "oklch(0.32 0.06 310)",
    accent: "oklch(0.74 0.16 320)",
    status: "oklch(0.75 0.14 165)",
    muted: "oklch(0.70 0.04 310)",
    overlay: "oklch(0.12 0.04 310 / 0.72)",
    popover: "oklch(0.23 0.05 310)",
  },
  moon: {
    surface: "oklch(0.22 0.015 250)",
    text: "oklch(0.95 0.01 250)",
    border: "oklch(0.36 0.02 250)",
    accent: "oklch(0.78 0.06 250)",
    status: "oklch(0.76 0.12 145)",
    muted: "oklch(0.72 0.02 250)",
    overlay: "oklch(0.16 0.015 250 / 0.7)",
    popover: "oklch(0.26 0.02 250)",
  },
  rain: {
    surface: "oklch(0.20 0.03 230)",
    text: "oklch(0.95 0.015 230)",
    border: "oklch(0.34 0.04 230)",
    accent: "oklch(0.70 0.10 230)",
    status: "oklch(0.74 0.13 160)",
    muted: "oklch(0.68 0.03 230)",
    overlay: "oklch(0.14 0.03 230 / 0.72)",
    popover: "oklch(0.24 0.035 230)",
  },
  "outreach-light": {
    surface: "oklch(0.98 0.01 95)",
    text: "oklch(0.22 0.02 260)",
    border: "oklch(0.86 0.02 95)",
    accent: "oklch(0.55 0.14 250)",
    status: "oklch(0.52 0.16 145)",
    muted: "oklch(0.45 0.02 260)",
    overlay: "oklch(0.30 0.02 260 / 0.36)",
    popover: "oklch(0.99 0.01 95)",
  },
  satsuma: {
    surface: "oklch(0.97 0.03 60)",
    text: "oklch(0.24 0.04 50)",
    border: "oklch(0.86 0.05 60)",
    accent: "oklch(0.62 0.18 50)",
    status: "oklch(0.52 0.15 145)",
    muted: "oklch(0.48 0.04 55)",
    overlay: "oklch(0.40 0.04 50 / 0.32)",
    popover: "oklch(0.99 0.02 60)",
  },
  lapis: {
    surface: "oklch(0.19 0.06 260)",
    text: "oklch(0.96 0.02 250)",
    border: "oklch(0.34 0.07 260)",
    accent: "oklch(0.72 0.16 255)",
    status: "oklch(0.76 0.14 170)",
    muted: "oklch(0.70 0.04 255)",
    overlay: "oklch(0.12 0.05 260 / 0.74)",
    popover: "oklch(0.24 0.06 260)",
  },
  flora: {
    surface: "oklch(0.20 0.04 145)",
    text: "oklch(0.96 0.02 140)",
    border: "oklch(0.34 0.05 145)",
    accent: "oklch(0.74 0.16 145)",
    status: "oklch(0.78 0.14 145)",
    muted: "oklch(0.70 0.04 145)",
    overlay: "oklch(0.14 0.04 145 / 0.72)",
    popover: "oklch(0.25 0.045 145)",
  },
  paper: {
    surface: "oklch(0.97 0.015 90)",
    text: "oklch(0.26 0.03 70)",
    border: "oklch(0.84 0.03 90)",
    accent: "oklch(0.50 0.12 70)",
    status: "oklch(0.50 0.14 145)",
    muted: "oklch(0.48 0.03 80)",
    overlay: "oklch(0.36 0.03 80 / 0.34)",
    popover: "oklch(0.99 0.01 90)",
  },
  decepticon: {
    surface: "oklch(0.16 0.07 300)",
    text: "oklch(0.95 0.04 100)",
    border: "oklch(0.32 0.08 300)",
    accent: "oklch(0.78 0.20 95)",
    status: "oklch(0.72 0.18 145)",
    muted: "oklch(0.68 0.05 300)",
    overlay: "oklch(0.10 0.06 300 / 0.76)",
    popover: "oklch(0.21 0.07 300)",
  },
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && (THEME_IDS as readonly string[]).includes(value));
}

const TOKEN_KEYS = ["surface", "text", "border", "accent", "status", "muted", "overlay", "popover"] as const;

function isUserTheme(value: unknown): value is UserTheme {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !/^[a-z\d][a-z\d._-]*$/i.test(row.id)) return false;
  if (typeof row.label !== "string" || !row.label.trim()) return false;
  if (!row.tokens || typeof row.tokens !== "object" || Array.isArray(row.tokens)) return false;
  const tokens = row.tokens as Record<string, unknown>;
  return TOKEN_KEYS.every((key) => typeof tokens[key] === "string" && Boolean((tokens[key] as string).trim()));
}

/** Non-reactive mount-time user-theme read, matching the frozen ledger loop. */
export function readUserThemes(storage?: Pick<Storage, "getItem">): UserTheme[] {
  const source = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  if (!source) return [];
  try {
    const value: unknown = JSON.parse(source.getItem(STORAGE_KEYS.userThemes) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(isUserTheme).filter((theme) => {
      assertNoMacroBrand(theme.id);
      assertNoMacroBrand(theme.label);
      return !isThemeId(theme.id);
    });
  } catch {
    return [];
  }
}

export function isUserThemeId(value: string | null | undefined, themes: readonly UserTheme[]): boolean {
  return Boolean(value && themes.some((theme) => theme.id === value));
}

/** Semantic token custom properties applied once on the shell root (07-UI-UX). */
export function tokenVars(theme: ThemeId): Record<`--outreach-${string}`, string> {
  const tokens = OKLCH_TOKENS[theme];
  return {
    "--outreach-surface": tokens.surface,
    "--outreach-text": tokens.text,
    "--outreach-border": tokens.border,
    "--outreach-accent": tokens.accent,
    "--outreach-status": tokens.status,
    "--outreach-muted": tokens.muted,
    "--outreach-overlay": tokens.overlay,
    "--outreach-popover": tokens.popover,
  };
}

export function tokenVarsForTheme(
  theme: string,
  userThemes: readonly UserTheme[] = [],
): Record<`--outreach-${string}`, string> {
  if (isThemeId(theme)) return tokenVars(theme);
  const tokens = userThemes.find((item) => item.id === theme)?.tokens;
  if (!tokens) return tokenVars("outreach-dark");
  return {
    "--outreach-surface": tokens.surface,
    "--outreach-text": tokens.text,
    "--outreach-border": tokens.border,
    "--outreach-accent": tokens.accent,
    "--outreach-status": tokens.status,
    "--outreach-muted": tokens.muted,
    "--outreach-overlay": tokens.overlay,
    "--outreach-popover": tokens.popover,
  };
}

export function themeLabel(theme: string, userThemes: readonly UserTheme[] = []): string {
  if (isThemeId(theme)) return THEME_LABELS[theme];
  return userThemes.find((item) => item.id === theme)?.label ?? theme;
}

export function assertNoMacroBrand(value: string): void {
  if (/macro[-_]/i.test(value) || /macro dark|macro light/i.test(value)) {
    throw new Error(`OD-24 brand tripwire: ${value}`);
  }
}
