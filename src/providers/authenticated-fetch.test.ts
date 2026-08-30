import { afterEach, describe, expect, it, vi } from "vitest";
import { chatgptProvider } from "./chatgpt";
import { claudeProvider } from "./claude";
import { copilotProvider } from "./copilot";
import { cursorProvider } from "./cursor";
import { providers } from "./index";

function requestHeaders(init?: RequestInit): Headers {
  return new Headers(init?.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authenticated provider requests", () => {
  it("resolves a ChatGPT subscription through the session and account chain", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ accessToken: "access-token", user: {}, account: { planType: "plus" } })
      )
      .mockResolvedValueOnce(
        Response.json({
          account_ordering: ["personal"],
          accounts: {
            personal: {
              account: { plan_type: "plus" },
              entitlement: {
                has_active_subscription: true,
                subscription_plan: "chatgptplusplan",
                billing_period: "month",
                renews_at: "2026-09-30T00:00:00.000Z",
                expires_at: null,
                cancels_at: null,
              },
            },
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatgptProvider.fetch();

    expect(result).toMatchObject({
      plan: "Plus",
      price: "$20/mo",
      active: true,
      nextBillingDate: "2026-09-30",
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("include");
    expect(requestHeaders(fetchMock.mock.calls[1][1]).get("Authorization")).toBe(
      "Bearer access-token"
    );
  });

  it("resolves a Claude subscription through organization and billing details", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([
          {
            uuid: "personal-org",
            name: "Personal",
            capabilities: ["claude_pro"],
            billing_type: "stripe",
          },
        ])
      )
      .mockResolvedValueOnce(
        Response.json({
          next_charge_date: "2026-09-30T00:00:00.000Z",
          status: "active",
          billing_interval: "month",
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await claudeProvider.fetch();

    expect(result).toMatchObject({
      plan: "Pro",
      price: "$20/mo",
      active: true,
      nextBillingDate: "2026-09-30",
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe("include");
    }
  });

  it("lets Chrome attach GitHub cookies without exposing them as request headers", async () => {
    vi.stubGlobal("chrome", {});

    const billingHtml = `
      <script data-target="react-app.embeddedData">
        {"payload":{"copilotForIndividualsData":{"onFreeTier":false,"subscriptionItem":{"name":"Copilot Pro","price":10,"billingCycle":"month"}},"nextPaymentTileData":{"nextPaymentDate":"Sep 30, 2026"},"customer":{"customerId":123}}}
      </script>
    `;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(billingHtml, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({ userPremiumRequestEntitlement: 300, discountQuantity: 30 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await copilotProvider.fetch();

    expect(result.error).toBeNull();
    expect(result.plan).toBe("Copilot Pro");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(requestHeaders(init).has("Cookie")).toBe(false);
      expect(requestHeaders(init).has("User-Agent")).toBe(false);
    }
  });

  it("lets Chrome attach Cursor cookies without exposing them as request headers", async () => {
    vi.stubGlobal("chrome", {});
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          membershipType: "pro",
          billingCycleStart: "2026-08-01T00:00:00.000Z",
          billingCycleEnd: "2026-09-01T00:00:00.000Z",
          individualUsage: {
            plan: { used: 20, limit: 500, totalPercentUsed: 4 },
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          membershipType: "pro",
          subscriptionStatus: "active",
          isYearlyPlan: false,
          cancelAtPeriodEnd: false,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await cursorProvider.fetch();

    expect(result.error).toBeNull();
    expect(result.plan).toBe("PRO");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(requestHeaders(init).has("Cookie")).toBe(false);
      expect(requestHeaders(init).has("User-Agent")).toBe(false);
    }
  });

  it("keeps the active subscription registry limited to the four supported services", () => {
    expect(providers.map((provider) => provider.id)).toEqual([
      "chatgpt",
      "claude",
      "copilot",
      "cursor",
    ]);
    expect(
      providers.every((provider) => !provider.permissions.permissions?.includes("cookies"))
    ).toBe(true);
  });
});
