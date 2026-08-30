import { builtInTools } from "./catalog";
import { createCustomTool, normalizeToolUrl, suggestToolFromUrl } from "./custom";
import { searchTools } from "./search";
import type { ToolDefinition } from "./types";

const toolsById = new Map<string, ToolDefinition>(builtInTools.map((tool) => [tool.id, tool]));

export function listBuiltInTools(): readonly ToolDefinition[] {
  return builtInTools;
}

export function getBuiltInTool(id: string): ToolDefinition | null {
  return toolsById.get(id) ?? null;
}

export function searchBuiltInTools(
  query: string,
  orderedTools: readonly ToolDefinition[] = builtInTools
): readonly ToolDefinition[] {
  return searchTools(orderedTools, query);
}

export function listTools(
  customTools: readonly ToolDefinition[],
  hiddenBuiltInTools: readonly string[] = []
): readonly ToolDefinition[] {
  const hidden = new Set(hiddenBuiltInTools);
  return [...builtInTools.filter((tool) => !hidden.has(tool.id)), ...customTools];
}

export function findTool(
  toolId: string,
  customTools: readonly ToolDefinition[]
): ToolDefinition | null {
  return getBuiltInTool(toolId) ?? customTools.find((tool) => tool.id === toolId) ?? null;
}

export function orderTools(
  tools: readonly ToolDefinition[],
  toolOrder: readonly string[]
): readonly ToolDefinition[] {
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  const ordered: ToolDefinition[] = [];
  const seen = new Set<string>();

  for (const toolId of toolOrder) {
    const tool = toolsById.get(toolId);
    if (!tool || seen.has(toolId)) continue;
    ordered.push(tool);
    seen.add(toolId);
  }

  for (const tool of tools) {
    if (!seen.has(tool.id)) ordered.push(tool);
  }
  return ordered;
}

export { createCustomTool, normalizeToolUrl, searchTools, suggestToolFromUrl };

export type { CustomToolInput, ToolSuggestion } from "./custom";
export type { ToolCategory, ToolDefinition, ToolIconSource, ToolSubcategory } from "./types";
