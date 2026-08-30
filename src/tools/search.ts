import type { ToolDefinition } from "./types";

function scoreTool(tool: ToolDefinition, query: string): number {
  const name = tool.name.toLocaleLowerCase();
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 65;
  if (tool.aliases.some((alias) => alias === query)) return 60;
  if (tool.aliases.some((alias) => alias.includes(query))) return 50;
  if (tool.subcategory === query) return 45;
  if (tool.category === query) return 40;
  if (tool.tags.some((tag) => tag.startsWith(query))) return 35;
  if (tool.tags.some((tag) => tag.includes(query))) return 25;
  return 0;
}

export function searchTools(
  tools: readonly ToolDefinition[],
  rawQuery: string
): readonly ToolDefinition[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return [];

  return tools
    .map((tool, index) => {
      return { tool, score: scoreTool(tool, query), index };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ tool }) => tool);
}
