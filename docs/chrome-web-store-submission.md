# Chrome Web Store submission — v0.2.1

Copy-paste reference for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) listing at
https://chromewebstore.google.com/detail/sublens/ckhnoellkkppjdcdkcombflmkehabdnh (currently live at 0.1.1).

## Package

- `npm run build` produces `dist/`.
- Zip the **contents** of `dist/`, not the folder itself — `manifest.json` must sit at the root of the
  uploaded zip. The `release.yml` GitHub Actions zip (`sublens-vX.X.X.zip`) is **not** upload-ready as-is:
  it zips `dist/` as a subfolder for the unpacked-extension install flow in the README, so build a separate
  zip for the Store (`cd dist && zip -r ../sublens-store-v0.2.1.zip .`).

## Store listing

**Category:** Productivity

**Language:** English (primary listing); UI also ships Simplified Chinese.

**Single purpose:** SubLens is a launcher for AI tools that can optionally show the subscription plans
you connect.

**Short description** (132 char max — this is 116):
> Launch your AI tools in one click and see the subscriptions you connect. Everything stays on your device.

**Detailed description:**
```
Your AI tools, one shortcut away.

SubLens is a fast, keyboard-first launcher for AI tools: search, favorite, and open ChatGPT, Claude,
Gemini, Cursor, GitHub Copilot, and 14 built-in tools without hunting for tabs or bookmarks. Add any
other AI tool by URL and it launches alongside the built-in catalog.

Connect a subscription provider only if you want it: SubLens can show your plan, price, and next
billing date for ChatGPT, Claude, GitHub Copilot, and Cursor, plus a running total of what you're
paying across them.

- Fast search across tool names, aliases, and categories
- Ctrl/Cmd+K keyboard workflow: search, arrow keys, Enter, Escape
- Favorites and recent launches, saved locally
- Add, hide, or reorder tools from Settings
- Light, dark, or system theme
- English and Simplified Chinese

Privacy: SubLens only requests access to a provider when you click Connect. All data — favorites,
recents, subscription snapshots — stays in chrome.storage.local on your device. No external servers,
no analytics, no tracking. Full policy: https://heartleo.github.io/sublens/privacy.html
```

**What's new in this version** (the store has been stuck at 0.1.1; this update ships two feature
generations at once, so say so instead of writing a one-line patch note):
```
Major update since 0.1.1 — the popup was rebuilt around a launcher-first design:

- New: search, keyboard navigation (Ctrl/Cmd+K), favorites, and recently-launched tools
- New: add any AI tool by URL as a Custom Tool, with automatic/favicon/upload/letter icons
- New: Settings page for tools, subscription connections, and preferences (theme/language)
- New: subscription cards refresh right when you open the panel and every 60s while it's open,
  not just on the 15-minute background timer
- Changed: provider access is requested per-provider on demand instead of at install time
```

**Homepage URL:** https://heartleo.github.io/sublens/
**Support URL:** https://github.com/heartleo/sublens/issues
**Privacy policy URL:** https://heartleo.github.io/sublens/privacy.html

## Privacy practices tab

Mirror `docs/privacy.html` §05 word-for-word — it's the single source of truth, update both together.

| Permission | Justification |
| --- | --- |
| `storage` | Save favorites, recent launches, usage counts, preferences, and subscription snapshots locally using `chrome.storage.local`. |
| `alarms` | Schedule a background refresh of subscription data every 15 minutes. |
| `favicon` (optional) | Show a custom tool's site icon next to its name when the user chooses the favicon icon option while adding it. |
| Host permissions (optional): `cursor.com`, `github.com`, `chatgpt.com`, `claude.ai` | Make authenticated requests only to the subscription provider the user clicks Connect on, using the browser's existing session for that site. Requested per-provider at the moment of connection, not at install. |

**Are you using remote code?** No — everything ships in the extension bundle.

**Data usage disclosure:** Declare no categories collected (personally identifiable info, health,
financial, authentication, personal communications, location, web history, user activity, website
content) — nothing SubLens touches leaves the device; `chrome.storage.local` never syncs to a server
SubLens controls. Check all three certification boxes (no selling data, no use outside the single
purpose, no use for credit/lending decisions).

## Screenshots — need to be recaptured

`docs/screenshot_dark.png` / `docs/screenshot_light.png` are 760×1000 (popup-only crops used on the
landing page). The Store requires 1280×800 or 640×400 (16:10) screenshots, 1–5 of them. Recommended
set once the popup is open in a normal browser tab/window at the right size:

1. Home tab — favorites + recents + subscription summary (dark)
2. Home tab — same (light)
3. Tools tab — search results or category grid
4. Subscriptions panel — connected providers with plan/price
5. Settings page — Tools tab (Custom Tool add flow)

I can't capture these myself (browser automation is blocked from `chrome-extension://` pages); they
need to be taken manually, e.g. via OS screenshot tools with the popup pinned open ("Inspect popup" in
DevTools keeps it open) or the options page in a normal tab.

## Promo images (optional, only needed if requesting a featured placement)

- Small tile: 440×280
- Marquee: 1400×560

## Icon

128×128 required — already covered: `vite.config.ts`'s build plugin generates `icons/icon{16,48,128}.png`
from `public/icons/icon.png` on every `npm run build`. Nothing to prepare here.
