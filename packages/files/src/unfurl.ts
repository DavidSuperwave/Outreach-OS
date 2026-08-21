import { blockedSafeFetch, type SafeFetch } from "connectivity";
import { IMAGE_PROXY, type FetchedImage, type UnfurlCard } from "./types.js";
import { FilesError } from "./errors.js";

/**
 * Unfurl + image fetch go through connectivity's blockedSafeFetch only.
 * Live global fetch on request-derived URLs is forbidden while OD-6 is open.
 * Do not duplicate a live SafeFetch here.
 */
export function defaultSafeFetch(): SafeFetch {
  return blockedSafeFetch();
}

export async function unfurl(url: string, fetch: SafeFetch = defaultSafeFetch()): Promise<UnfurlCard> {
  const response = await fetch.fetch(url, { method: "GET" });
  return parseUnfurlCard(url, response.body);
}

export async function fetchImage(url: string, fetch: SafeFetch = defaultSafeFetch()): Promise<FetchedImage> {
  const response = await fetch.fetch(url, { method: "GET" });
  return {
    url,
    contentType: "application/octet-stream",
    body: response.body,
  };
}

/** Kill-leaning: there is no `/proxy` image launderer in this node. */
export function proxyImage(): never {
  throw new FilesError("proxy_deferred", IMAGE_PROXY.note);
}

export function parseUnfurlCard(url: string, html: string): UnfurlCard {
  return {
    url,
    title: meta(html, "og:title") ?? meta(html, "twitter:title"),
    description: meta(html, "og:description") ?? meta(html, "twitter:description"),
    image: meta(html, "og:image") ?? meta(html, "twitter:image"),
    siteName: meta(html, "og:site_name"),
  };
}

function meta(html: string, property: string): string | null {
  const propertyRe = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRe(property)}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapeRe(property)}["']`,
    "i",
  );
  return html.match(propertyRe)?.[1] ?? html.match(contentFirst)?.[1] ?? null;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
