import { builtInTools } from "./catalog";
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

export type { ToolCategory, ToolDefinition, ToolSubcategory } from "./types";
