import { builtInTools } from "./catalog";
import type { ToolCategory, ToolDefinition, ToolIconSource } from "./types";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface ToolSuggestion {
  url: string;
  host: string;
  name: string;
  category: ToolCategory;
  icon: string;
  iconSource: ToolIconSource;
  iconTone?: ToolDefinition["iconTone"];
  iconFrame?: ToolDefinition["iconFrame"];
}

export interface CustomToolInput {
  name: string;
  url: string;
  category: ToolCategory;
  icon: string;
  iconSource: ToolIconSource;
  iconTone?: ToolDefinition["iconTone"];
  iconFrame?: ToolDefinition["iconFrame"];
}

function inferredName(hostname: string): string {
  const parts = hostname.replace(/^www\./, "").split(".");
  const core = (parts.length > 1 ? parts[parts.length - 2] : parts[0]) || "AI Tool";
  return core
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function matchingBuiltIn(url: URL): ToolDefinition | null {
  return (
    builtInTools.find((tool) => {
      const knownUrl = new URL(tool.url);
      if (knownUrl.hostname !== url.hostname) return false;
      return knownUrl.pathname === "/" || url.pathname.startsWith(knownUrl.pathname);
    }) ?? null
  );
}

export function normalizeToolUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
      return null;
    }
    if (url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function suggestToolFromUrl(rawUrl: string): ToolSuggestion | null {
  const normalizedUrl = normalizeToolUrl(rawUrl);
  if (!normalizedUrl) return null;

  const url = new URL(normalizedUrl);
  const knownTool = matchingBuiltIn(url);
  return {
    url: normalizedUrl,
    host: url.host,
    name: knownTool?.name ?? inferredName(url.hostname),
    category: knownTool?.category ?? "explore",
    icon: knownTool?.icon ?? "",
    iconSource: knownTool ? "packaged" : "favicon",
    iconTone: knownTool?.iconTone,
    iconFrame: knownTool?.iconFrame,
  };
}

export function createCustomTool(id: string, input: CustomToolInput): ToolDefinition {
  return {
    id,
    name: input.name.trim(),
    url: input.url,
    icon: input.icon,
    iconSource: input.iconSource,
    iconTone: input.iconTone,
    iconFrame: input.iconFrame,
    fallback: input.name.trim().slice(0, 1).toLocaleUpperCase() || "AI",
    category: input.category,
    aliases: [],
    tags: [],
  };
}
