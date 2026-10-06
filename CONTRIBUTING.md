# Contributing to WAUX

Thanks for helping. Issues and pull requests are welcome.

## Before you start

- Open an issue first for anything larger than a small fix, so the approach can be agreed.
- WAUX is local-only by design. Changes that add network requests, analytics, accounts or remote code will not be accepted.
- Keep permissions minimal. New permissions need a clear reason.

## Setup

```bash
npm install
npm run dev        # watch build into dist/, then Load unpacked in chrome://extensions
```

## Checks

Run these before opening a pull request:

```bash
npm test           # unit tests
npm run typecheck
npm run build
npm run verify     # optional: end-to-end checks in Chromium, screenshots in verify/
```

## Where things live

- **WhatsApp selectors** belong in `src/adapter/` and `src/content/skin.css` only. Use ids, `data-testid`, ARIA roles or `data-icon`. Never hashed class names.
- **Pure logic** (theme math, importers, matching) lives in `src/engines/` with tests in `tests/`.
- **UI** uses the design tokens in `src/ui/`. No hard-coded colors outside the theme engine.

## Fixing breakage after a WhatsApp update

Ask the reporter for a **layout report** (Ctrl K in WhatsApp, Save layout report). It shows the page structure without any personal content. Update `src/adapter/selectors.ts` or the markers, and extend `scripts/mock-whatsapp.html` so `npm run verify` covers the change.

## Style

- TypeScript, Preact, plain CSS with `--waux-*` tokens.
- Small, focused commits with clear messages.
- By contributing you agree your work is released under the [MIT License](LICENSE).
