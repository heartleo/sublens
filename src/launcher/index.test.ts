import { describe, expect, it } from "vitest";
import { createLauncher } from "./index";
import { getBuiltInTool } from "../tools";

describe("Launcher", () => {
  it("opens a known Tool and records its successful Launch", async () => {
    const openedUrls: string[] = [];
    const launches: Array<{ toolId: string; openedAt: string }> = [];
    const launcher = createLauncher({
      findTool: async (toolId) => getBuiltInTool(toolId),
      openTab: async (url) => {
        openedUrls.push(url);
      },
      recordLaunch: async (toolId, openedAt) => {
        launches.push({ toolId, openedAt });
      },
      now: () => new Date("2026-08-27T10:00:00.000Z"),
    });

    const result = await launcher.openTool("claude");

    expect(result).toEqual({ status: "opened", toolId: "claude" });
    expect(openedUrls).toEqual(["https://claude.ai/"]);
    expect(launches).toEqual([{ toolId: "claude", openedAt: "2026-08-27T10:00:00.000Z" }]);
  });

  it("does not open or record an unknown Tool", async () => {
    let sideEffects = 0;
    const launcher = createLauncher({
      findTool: async () => null,
      openTab: async () => {
        sideEffects += 1;
      },
      recordLaunch: async () => {
        sideEffects += 1;
      },
      now: () => new Date(),
    });

    expect(await launcher.openTool("missing")).toEqual({
      status: "not-found",
      toolId: "missing",
    });
    expect(sideEffects).toBe(0);
  });
});
