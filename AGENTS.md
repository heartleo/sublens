# Repository Guidelines

## Project Structure & Architecture

SubLens is a Chrome Manifest V3 extension built with React, TypeScript, and Vite. The popup starts at `popup.html` and `src/popup/main.tsx`; the settings page (opened in its own tab) starts at `options.html` and `src/options/main.tsx`. The background service worker is `src/background/index.ts`. Provider integrations belong in `src/providers/`, the tool catalog in `src/tools/`, runtime host-permission handling in `src/permissions/`, launch/recording logic in `src/launcher/`, versioned `chrome.storage.local` state in `src/storage/`, theme/locale prefs in `src/preferences/`, and translations in `src/i18n/`. Put source assets in `public/` (`public/logos/` for provider logos); Vite produces the loadable extension in `dist/`. The `docs/` directory contains the GitHub Pages site, privacy policy, and screenshots.

Providers authenticate with `fetch(url, { credentials: "include" })`, relying on Chrome to attach the connected site's existing session cookies — they never read cookie values directly. Fetches should return `SubscriptionInfo` with its `error` field populated on failure. When adding a provider, implement `SubscriptionProvider`, register it in `src/providers/index.ts`, add its origin to `optional_host_permissions` in `manifest.json` (host access is requested at runtime on Connect, not granted statically), and supply a logo.

## Build, Test, and Development Commands

- `npm ci`: install the locked dependency set; CI uses Node 20.
- `npm run dev`: start the Vite development server for popup work.
- `npm run typecheck`: run strict TypeScript checks without emitting files.
- `npm run lint`: check `src/` with ESLint and React Hooks rules.
- `npm run format:check`: verify Prettier formatting.
- `npm run build`: type-check and create the complete extension in `dist/`.
- `npm run build:fast`: build without type-checking; use only for quick iteration.

Load `dist/` through `chrome://extensions` in Developer mode for extension-level testing.

## Coding Style & Naming Conventions

Prettier enforces 2-space indentation, semicolons, double quotes, trailing ES5 commas, and a 100-character line width. Use PascalCase for React components and TypeScript types, camelCase for functions and variables, and lowercase provider or locale filenames such as `googleone.ts` and `zh.ts`. Preserve strict typing and existing provider/storage patterns; keep changes focused.

## Testing Guidelines

Run `npm test` (Vitest) for logic modules — tests live next to their source as `*.test.ts`. No coverage target is enforced. Before submitting changes, also run `npm run lint`, `npm run format:check`, `npm run typecheck`, and `npm run build`. Smoke-test the unpacked extension in Chrome, especially refresh messaging, storage persistence, provider error states, theme/locale switching, and any UI interaction you changed.

## Commits & Pull Requests

History follows Conventional Commit-style subjects such as `feat:`, `fix:`, `docs:`, `chore:`, and `refactor:`. Keep commits scoped and imperative. Pull requests should explain user-visible behavior, list validation performed, link relevant issues, and include before/after screenshots for popup or documentation UI changes. Call out new permissions, provider endpoints, or data-handling changes explicitly.
