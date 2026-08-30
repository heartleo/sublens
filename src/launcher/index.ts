import type { ToolDefinition } from "../tools";

export type LaunchResult =
  | { status: "opened"; toolId: string }
  | { status: "not-found"; toolId: string }
  | { status: "failed"; toolId: string; message: string };

export interface LauncherDependencies {
  findTool(toolId: string): Promise<ToolDefinition | null>;
  openTab(url: string): Promise<void>;
  recordLaunch(toolId: string, openedAt: string): Promise<void>;
  now(): Date;
}

export interface Launcher {
  openTool(toolId: string): Promise<LaunchResult>;
}

export function createLauncher(dependencies: LauncherDependencies): Launcher {
  return {
    async openTool(toolId) {
      const tool = await dependencies.findTool(toolId);
      if (!tool) return { status: "not-found", toolId };

      try {
        await dependencies.openTab(tool.url);
        await dependencies.recordLaunch(tool.id, dependencies.now().toISOString());
        return { status: "opened", toolId: tool.id };
      } catch (error) {
        return {
          status: "failed",
          toolId: tool.id,
          message: error instanceof Error ? error.message : "Failed to open tool",
        };
      }
    },
  };
}
