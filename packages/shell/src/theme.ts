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
} as const;

export const OKLCH_TOKENS = {
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
} as const;

/** Semantic token custom properties applied once on the shell root (07-UI-UX). */
export function tokenVars(theme: ThemeId): Record<`--outreach-${string}`, string> {
  const tokens = theme === "outreach-light" ? OKLCH_TOKENS["outreach-light"] : OKLCH_TOKENS["outreach-dark"];
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

export function assertNoMacroBrand(value: string): void {
  if (/macro[-_]/i.test(value) || /macro dark|macro light/i.test(value)) {
    throw new Error(`OD-24 brand tripwire: ${value}`);
  }
}
