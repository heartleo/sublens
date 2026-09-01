<h1 align="center">SubLens</h1>

<p align="center">
  Launch AI tools fast, then keep connected subscriptions in view.
</p>

<p align="center">
  <img src="https://img.shields.io/github/release/heartleo/sublens?logo=github" alt="GitHub Release" />
  <img src="https://img.shields.io/badge/chrome-%3E%3D88-brightgreen?logo=googlechrome&logoColor=white" alt="Chrome 88+" />
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

<p align="center">
  <img src="docs/screenshot_dark.png" width="380" alt="SubLens Dark Mode" />
  <img src="docs/screenshot_light.png" width="380" alt="SubLens Light Mode" />
</p>

## Features

- Home keeps favorites, recent launches, and subscription details together. Tools contains the
  complete launcher catalog.
- The catalog starts with 14 AI tools. You can add more websites without losing deep links.
- Search matches tool names, aliases, categories, subcategories, and tags.
- `Ctrl/Cmd + K`, arrow keys, Enter, and Escape cover the main keyboard workflow.
- Favorites and recent launches are saved locally.
- Drag tools to reorder them. Keyboard move controls provide the same function.
- Tool icons can use packaged artwork, a site favicon, an uploaded image, or a centered letter.
- Built-in tools can be hidden and restored later.
- ChatGPT, Claude, GitHub Copilot, and Cursor connections are optional and independent.
- The subscription summary shows connected plans, estimated monthly spend, and the number of paid
  plans.
- Choose a light or dark theme, or follow the operating system.
- The interface supports English and Simplified Chinese, including localized dates and prices.
- SubLens requests provider and favicon access only when a feature needs it. Launcher data and
  uploaded icons stay in local extension storage.

## Install

### Chrome Web Store

[Add SubLens to Chrome](https://chromewebstore.google.com/detail/sublens/ckhnoellkkppjdcdkcombflmkehabdnh)

### Download from releases

1. Go to [Releases](https://github.com/heartleo/sublens/releases) and download the latest `sublens-vX.X.X.zip`
2. Unzip the file
3. Open `chrome://extensions` → enable **Developer mode**
4. Click **Load unpacked** → select the unzipped `dist/` folder

### Manual install

1. Clone and build:

```bash
git clone https://github.com/heartleo/sublens.git
cd sublens
npm ci
npm run build
```

2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

## Built-in tools

ChatGPT, Claude, Gemini, DeepSeek, Grok, Midjourney, Runway, Kling AI, Cursor, GitHub
Copilot, Codex, Hugging Face, OpenRouter, and NotebookLM.

## Custom AI tools

Open **Settings → Tools → Add tool** to add any HTTPS website or local AI tool. SubLens keeps the
full URL, so links to a specific workspace or app route continue to work.

Each custom tool supports three icon sources:

- Automatic uses matching packaged artwork when available. Otherwise, SubLens can request access
  to the website favicon.
- Upload accepts PNG, JPEG, and WebP images up to 5 MB. Image processing happens locally.
- Letter creates a large, centered initial from the tool name.

The same page lets you edit or delete custom tools and hide individual built-in tools. Tool order
is managed directly from the **Tools** tab in the popup by dragging the visible reorder handle or
using its keyboard move controls.

## Settings

| Section       | Controls                                                             |
| ------------- | -------------------------------------------------------------------- |
| General       | Theme, language, and the default popup page                          |
| Tools         | Custom tools and built-in tool visibility                            |
| Subscriptions | Provider connections, refresh, and disconnect actions                |
| Data & About  | Recent activity, ordering, favorites, launcher data, and preferences |

## Subscription providers

| Provider                                                         | Price | Billing Cycle |
| ---------------------------------------------------------------- | ----- | ------------- |
| <img src="public/logos/chatgpt.svg" width="16" /> ChatGPT        | Yes   | Yes           |
| <img src="public/logos/claude.svg" width="16" /> Claude          | Yes   | Yes           |
| <img src="public/logos/copilot.svg" width="16" /> GitHub Copilot | Yes   | Yes           |
| <img src="public/logos/cursor.svg" width="16" /> Cursor          | Yes   | Yes           |

## Usage tips

- Click a tool to open it in a new tab.
- Switch to Tools to browse the catalog, filter by category, or search.
- Press `Ctrl/Cmd + K` from either page to open Tools and focus search. Use the arrow keys and Enter
  to launch the selected result.
- Click the star on a tool to add or remove a favorite.
- Open Subscriptions and connect only the providers you want to track.
- Connected subscription data refreshes automatically every 15 minutes.
- Open settings to manage tools, language, the default page, connections, and stored launcher data.

## Development

```bash
npm ci               # install the locked dependency set
npm run dev          # start dev server
npm run build        # type-check + production build
npm run build:fast   # production build (skip type-check)
npm run typecheck    # strict TypeScript checks
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run format       # format source files with Prettier
npm run format:check # verify Prettier formatting
```

### Adding a new provider

1. Copy `src/providers/_template.ts` to `src/providers/<provider-id>.ts`
2. Replace the provider metadata, response type guard, endpoint, and response mapping
3. Return failures through `SubscriptionInfo.error`; do not throw from `fetch()`
4. Register the provider in `src/providers/index.ts`
5. Add the required host pattern to `optional_host_permissions` in `manifest.json`
6. Add an SVG logo to `public/logos/` and update the privacy documentation when data access changes
7. Run `npm run lint`, `npm run typecheck`, and `npm run build`

Use `createSubscriptionInfo()` from `src/providers/base.ts` for complete defaults. Keep endpoint
details and response types inside the provider adapter so callers only depend on
`SubscriptionProvider`.

### Adding a new language

1. Create `src/i18n/locales/<code>.ts` (use `en.ts` as template)
2. Import and register in `src/i18n/index.ts`
3. Add the locale to the `locales` array in `src/popup/App.tsx`

## Feedback

- If you find SubLens useful, please give it a ⭐
- Found a bug or have a feature request? [Open an issue](https://github.com/heartleo/sublens/issues).
