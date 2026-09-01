# Chrome Web Store submission — v0.2.1

Copy-paste reference for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) listing at
https://chromewebstore.google.com/detail/sublens/ckhnoellkkppjdcdkcombflmkehabdnh (live at 0.1.1).

## Package

```bash
npm run build
cd dist && zip -r ../sublens-store-v0.2.1.zip . && cd ..
```

Zip the **contents** of `dist/`, not the folder — `manifest.json` must sit at the zip root. The
`release.yml` GitHub Actions artifact zips `dist/` as a subfolder for the unpacked-install flow in the
README, so it is deliberately not the file you upload here.

Two things worth trimming before a release build if package size ever matters: `dist/icons/icon.png`
is the 865 KB source art that the manifest never references (only the generated 16/48/128 sizes), and
`dist/logos/huggingface.ico` is 200 KB. Neither blocks submission — the whole package is ~1.6 MB.

## Store listing

**Category:** Productivity · **Language:** English (UI also ships Simplified Chinese)

**Single purpose:** SubLens is a launcher for AI tools that can optionally show the subscription
plans you connect.

**Short description** (132 max — this is 116):

```
Launch your AI tools in one click and see the subscriptions you connect. Everything stays on your device.
```

**Detailed description:**

```
Your AI tools, one shortcut away.

You probably have five AI tools open in five tabs. SubLens puts them behind one popup: search,
favorite, and launch ChatGPT, Claude, Gemini, Cursor, GitHub Copilot and 14 built-in tools without
hunting through bookmarks. Add any other AI site by URL and it launches right alongside them.

Then, only if you want it, connect a subscription: SubLens shows your plan, price and next billing
date for ChatGPT, Claude, GitHub Copilot and Cursor, plus what you're paying across all of them each
month.

FEATURES
• Search across names, aliases, categories and tags
• Ctrl/Cmd+K, arrow keys, Enter — the whole flow works without a mouse
• Favorites and recently launched tools, saved locally
• Add, hide, reorder, and re-icon tools from Settings
• Light, dark, or follow your system
• English and Simplified Chinese

PRIVACY
SubLens has no backend. Favorites, recents, custom tools and subscription snapshots stay in
chrome.storage.local on your machine. No analytics, no tracking, no account. Access to a provider is
requested only when you click Connect, uses the session you're already signed in with, and never
reads or stores cookie values. Disconnecting revokes it.

Open source (MIT): https://github.com/heartleo/sublens
Privacy policy: https://heartleo.github.io/sublens/privacy.html
```

**What's new in this version** — the store has been at 0.1.1 while two feature generations shipped,
so the note says that rather than pretending it's a patch:

```
A big update since 0.1.1 — the popup is now a launcher first.

• New: search, keyboard navigation (Ctrl/Cmd+K), favorites, and recently launched tools
• New: add any AI tool by URL as a custom tool, with automatic/favicon/upload/letter icons
• New: Settings page for tools, subscription connections, theme and language
• New: subscription cards refresh when you open the panel and every 60s while it's open, instead of
  waiting for the 15-minute background refresh
• Changed: provider access is requested per provider when you connect, not at install time
```

**Homepage:** https://heartleo.github.io/sublens/
**Support:** https://github.com/heartleo/sublens/issues
**Privacy policy:** https://heartleo.github.io/sublens/privacy.html

## Privacy practices tab

Mirrors `docs/privacy.html` §05 — that page is the single source of truth, so update both together.

| Permission | Justification |
| --- | --- |
| `storage` | Save favorites, recent launches, usage counts, preferences, and subscription snapshots locally using `chrome.storage.local`. |
| `alarms` | Schedule a background refresh of subscription data every 15 minutes. |
| `favicon` (optional) | Show a custom tool's site icon next to its name when the user chooses the favicon icon option while adding it. |
| Host permissions (optional): `cursor.com`, `github.com`, `chatgpt.com`, `claude.ai` | Make authenticated requests only to the subscription provider the user clicks Connect on, using the browser's existing session for that site. Requested per provider at the moment of connection, not at install. |

**Remote code:** No — everything ships in the package.

**Data usage:** Declare no collected categories (personally identifiable info, health, financial,
authentication, personal communications, location, web history, user activity, website content).
Nothing SubLens touches leaves the device. Check all three certifications (no data sold or
transferred, no use outside the single purpose, no use for creditworthiness or lending).

## Assets — ready to upload

All generated from the real 0.2.1 build (`docs/screenshots/`):

| File | Size | Use |
| --- | --- | --- |
| `store-1-launcher.png` | 1280×800 | Screenshot 1 — launcher home |
| `store-2-subscriptions.png` | 1280×800 | Screenshot 2 — connected subscriptions |
| `store-3-search.png` | 1280×800 | Screenshot 3 — search and keyboard launch |
| `store-4-custom.png` | 1280×800 | Screenshot 4 — settings and custom tools |
| `store-5-themes.png` | 1280×800 | Screenshot 5 — light and dark |
| `promo-440x280.png` | 440×280 | Small promo tile |

Store icon (128×128) needs nothing prepared: the build plugin in `vite.config.ts` generates
`icons/icon{16,48,128}.png` from `public/icons/icon.png` on every `npm run build`.

A 1400×560 marquee is only needed if you request featured placement; there isn't one yet.

### Regenerating the assets

Screenshots are rendered from the built extension with Playwright against a mocked `chrome.*` API, so
they can be regenerated after any UI change rather than recaptured by hand:

1. `npm run build && npm run preview` (serves `dist/` on :4173)
2. Drive `popup.html?theme=dark|light&view=home|tools` and `options.html` with an init script that
   stubs `chrome.storage.local`, `chrome.permissions`, and `chrome.runtime` with seeded state
3. Capture the popup at its real 400×600 box, then composite onto the 1280×800 branded frame

## Before you submit

- [ ] `manifest.json` version is higher than the published one (0.2.1 > 0.1.1) ✅
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass
- [ ] Store zip has `manifest.json` at its root
- [ ] GitHub Pages is publishing `docs/`, so the privacy policy URL resolves
- [ ] Screenshots reflect the version being uploaded
