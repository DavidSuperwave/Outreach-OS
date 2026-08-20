/**
 * Corrected bus contract (01 §2.5 E3): 12 product topics + `example`.
 * `macro.com` is a cookie domain. `macro.activity_events` is a UUIDv5 namespace, not a topic.
 * Activity flows via the fact log (see activity.ts).
 */
export const PRODUCT_TOPICS = [
  "bots",
  "calls",
  "documents",
  "soup",
  "projects",
  "properties",
  "teams",
  "channels",
  "email",
  "webhooks",
  "mentions",
  "chats",
] as const;

export type ProductTopic = (typeof PRODUCT_TOPICS)[number];

export const EXAMPLE_TOPIC = "example" as const;

export const ALL_TOPICS = [...PRODUCT_TOPICS, EXAMPLE_TOPIC] as const;
export type Topic = (typeof ALL_TOPICS)[number];

export function isProductTopic(value: string): value is ProductTopic {
  return (PRODUCT_TOPICS as readonly string[]).includes(value);
}

export const FORBIDDEN_TOPICS = ["com", "activity_events"] as const;
