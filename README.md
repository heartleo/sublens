<h1 align="center">SubLens</h1>

<p align="center">
  Track all your AI subscriptions in one place — pricing and billing cycles at a glance.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/chrome-%3E%3D88-brightgreen?logo=googlechrome&logoColor=white" alt="Chrome 88+" />
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

<p align="center">
  <img src="docs/screenshot.png" width="380" alt="SubLens screenshot" />
</p>

## Features

- **Multi-provider dashboard** — Cursor, GitHub Copilot, ChatGPT, Claude, Google One
- **Subscription cost tracking** — see plan pricing and total monthly spend
- **Billing cycle alerts** — next billing date and days remaining
- **Drag-to-reorder** — arrange cards in your preferred order
- **Dark / Light / System theme** — auto-follows OS preference
- **Privacy-first** — all data stored locally, no external analytics

## Install

### Chrome Web Store

> Coming soon

### Download from Releases

1. Go to [Releases](https://github.com/heartleo/sublens/releases) and download the latest `sublens-vX.X.X.zip`
2. Unzip the file
3. Open `chrome://extensions` → enable **Developer mode**
4. Click **Load unpacked** → select the unzipped `dist/` folder

### Manual Install (Developer Mode)

1. Clone and build:

```bash
git clone https://github.com/heartleo/sublens.git
cd sublens
npm install
npm run build
```

2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

## Supported Providers

| Provider                                                         | Price | Billing Cycle |
| ---------------------------------------------------------------- | ----- | ------------- |
| <img src="public/logos/chatgpt.svg" width="16" /> ChatGPT        | Yes   | Yes           |
| <img src="public/logos/claude.svg" width="16" /> Claude          | Yes   | —             |
| <img src="public/logos/copilot.svg" width="16" /> GitHub Copilot | Yes   | Yes           |
| <img src="public/logos/cursor.svg" width="16" /> Cursor          | Yes   | Yes           |
| <img src="public/logos/googleone.svg" width="16" /> Google One   | Yes   | —             |

## Development

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # type-check + production build
npm run build:fast   # production build (skip type-check)
npm run lint         # ESLint
npm run format       # Prettier
```

## Feedback

- If you find SubLens useful, please give it a ⭐
- For bugs or feature requests, feel free to [open an issue](https://github.com/heartleo/sublens/issues).

