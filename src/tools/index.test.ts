import { describe, expect, it } from "vitest";
import { getBuiltInTool, listBuiltInTools, searchBuiltInTools } from "./index";

describe("Tool Catalog", () => {
  it("exposes the 14 curated Built-in Tools with stable unique IDs", () => {
    const tools = listBuiltInTools();

    expect(tools.map((tool) => tool.id)).toEqual([
      "chatgpt",
      "claude",
      "gemini",
      "deepseek",
      "grok",
      "midjourney",
      "runway",
      "kling",
      "cursor",
      "copilot",
      "codex",
      "huggingface",
      "openrouter",
      "notebooklm",
    ]);
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(14);
    expect(getBuiltInTool("chatgpt")?.url).toBe("https://chatgpt.com/");
    expect(getBuiltInTool("missing")).toBeNull();
  });

  it("keeps top-level groups compact and balanced for the popup", () => {
    const counts = listBuiltInTools().reduce<Record<string, number>>((groups, tool) => {
      groups[tool.category] = (groups[tool.category] ?? 0) + 1;
      return groups;
    }, {});

    expect(counts).toEqual({ chat: 5, create: 3, code: 3, explore: 3 });
  });
});

describe("Tool Search", () => {
  it("ranks a Tool whose name starts with the query first", () => {
    expect(searchBuiltInTools("cla").map((tool) => tool.id)).toEqual(["claude"]);
  });

  it("finds a Tool by an exact alias", () => {
    expect(searchBuiltInTools("gpt").map((tool) => tool.id)).toEqual(["chatgpt"]);
  });

  it("finds Tools by subcategory while preserving catalog order for ties", () => {
    expect(searchBuiltInTools("video").map((tool) => tool.id)).toEqual(["runway", "kling"]);
  });

  it("uses the custom Tool order to break equal search scores", () => {
    const reordered = [...listBuiltInTools()].sort((left, right) => {
      if (left.id === "kling") return -1;
      if (right.id === "kling") return 1;
      return 0;
    });

    expect(searchBuiltInTools("video", reordered).map((tool) => tool.id)).toEqual([
      "kling",
      "runway",
    ]);
  });

  it("ranks name, category, and tag matches deterministically", () => {
    expect(searchBuiltInTools("code").map((tool) => tool.id)).toEqual([
      "codex",
      "cursor",
      "copilot",
      "chatgpt",
      "deepseek",
    ]);
  });
});
