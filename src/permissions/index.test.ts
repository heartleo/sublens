import { describe, expect, it } from "vitest";
import { createPermissionManager, type PermissionAdapter } from "./index";

describe("Permission Manager", () => {
  it("requests only the selected Subscription Provider permissions", async () => {
    const requests: chrome.permissions.Permissions[] = [];
    const adapter: PermissionAdapter = {
      contains: async () => false,
      request: async (permissions) => {
        requests.push(permissions);
        return true;
      },
      remove: async () => true,
    };
    const manager = createPermissionManager(
      [
        {
          providerId: "cursor",
          permissions: { origins: ["https://cursor.com/*"] },
        },
        {
          providerId: "chatgpt",
          permissions: { origins: ["https://chatgpt.com/*"] },
        },
      ],
      adapter
    );

    expect(await manager.connect("cursor")).toEqual({ status: "connected" });
    expect(requests).toEqual([{ origins: ["https://cursor.com/*"] }]);
  });

  it("reports whether a Subscription Provider is connected", async () => {
    const adapter: PermissionAdapter = {
      contains: async (permissions) => permissions.origins?.[0] === "https://claude.ai/*",
      request: async () => false,
      remove: async () => false,
    };
    const manager = createPermissionManager(
      [
        {
          providerId: "claude",
          permissions: { origins: ["https://claude.ai/*"] },
        },
      ],
      adapter
    );

    expect(await manager.isConnected("claude")).toBe(true);
    expect(await manager.isConnected("missing")).toBe(false);
  });

  it("removes only the selected Provider host access", async () => {
    const removals: chrome.permissions.Permissions[] = [];
    const adapter: PermissionAdapter = {
      contains: async (permissions) => permissions.origins?.[0] === "https://github.com/*",
      request: async () => false,
      remove: async (permissions) => {
        removals.push(permissions);
        return true;
      },
    };
    const manager = createPermissionManager(
      [
        {
          providerId: "cursor",
          permissions: { origins: ["https://cursor.com/*"] },
        },
        {
          providerId: "copilot",
          permissions: { origins: ["https://github.com/*"] },
        },
      ],
      adapter
    );

    expect(await manager.disconnect("cursor")).toEqual({ status: "disconnected" });
    expect(removals).toEqual([{ origins: ["https://cursor.com/*"] }]);
  });
});
