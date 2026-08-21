const SECRET_KEYS = /(?:api[_-]?key|token|password|secret|authorization|cookie)/i;

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_KEYS.test(value) ? "[redacted]" : value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? "[redacted]" : redactSecrets(nested);
    }
    return out;
  }
  return value;
}

export function assertNoSecretInLogs(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (/(?:sk-|Bearer\s+[A-Za-z0-9._-]{12,})/.test(json)) {
    throw new Error("secret leaked into log payload");
  }
}
