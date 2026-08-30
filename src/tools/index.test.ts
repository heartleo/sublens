import { describe, expect, it } from "vitest";
import {
  createCustomTool,
  getBuiltInTool,
  listBuiltInTools,
  listTools,
  normalizeToolUrl,
  orderTools,
  searchBuiltInTools,
  suggestToolFromUrl,
} from "./index";

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

describe("Custom Tool Catalog", () => {
  it("normalizes safe web destinations and rejects unsafe schemes", () => {
    expect(normalizeToolUrl("perplexity.ai")).toBe("https://perplexity.ai/");
    expect(normalizeToolUrl("http://localhost:3000/chat#draft")).toBe("http://localhost:3000/chat");
    expect(normalizeToolUrl("http://example.com/")).toBeNull();
    expect(normalizeToolUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeToolUrl("https://user:secret@example.com/")).toBeNull();
  });

  it("reuses packaged official artwork for a recognized Tool origin", () => {
    expect(suggestToolFromUrl("https://chatgpt.com/gpts")).toMatchObject({
      name: "ChatGPT",
      category: "chat",
      icon: "/logos/chatgpt.svg",
      iconSource: "packaged",
    });
  });

  it("suggests a readable name and browser favicon for an unknown Tool", () => {
    expect(suggestToolFromUrl("https://chat.mistral.ai/chat")).toMatchObject({
      name: "Mistral",
      host: "chat.mistral.ai",
      category: "explore",
      icon: "",
      iconSource: "favicon",
    });
  });

  it("combines visible Built-in Tools with Custom Tools and applies saved order", () => {
    const customTool = createCustomTool("custom-perplexity", {
      name: "Perplexity",
      url: "https://www.perplexity.ai/",
      category: "chat",
      icon: "",
      iconSource: "favicon",
    });

    const visibleTools = listTools([customTool], ["gemini"]);
    expect(visibleTools.some((tool) => tool.id === "gemini")).toBe(false);
    expect(visibleTools[visibleTools.length - 1]?.id).toBe("custom-perplexity");
    expect(orderTools(visibleTools, ["custom-perplexity", "chatgpt"]).slice(0, 2)).toEqual([
      customTool,
      getBuiltInTool("chatgpt"),
    ]);
  });
});
