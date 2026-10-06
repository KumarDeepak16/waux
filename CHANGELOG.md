# Changelog

## 1.0.1 (2026-10-06)

- Fix a start-up crash ("Cannot read properties of undefined (reading 'length')") when WAUX attaches to a WhatsApp tab that is already open, for example right after install or update.
- A copy of WAUX left in an open tab after the extension is reloaded or updated now shuts itself down cleanly instead of throwing errors.
- The Shield hides phone numbers next to unsaved group senders; contacts without a photo get 3D avatars; Focus Mode hides overlay edge lines.

## 1.0.0 (2026-10-06)

First public release.

- Obsidian theme, plus Cobalt and Moss presets, in light and dark.
- Theme Studio: nine tokens, radius, depth, glass blur, density, typeface, wallpaper; live preview; import tweakcn / shadcn CSS variables and WAUX JSON; export and reset.
- Ambient wallpaper, chat cards, soft-brutalist bubbles and composer.
- Privacy Shield with cipher text (bundled dot-matrix font) or blur, 3D avatars, frosted media, hover / click reveal, hold-Alt peek, notification text redaction.
- Hidden chats with optional PIN.
- Quick messages with `;shortcut` insertion, categories, favorites, search, JSON import and export.
- Command palette, WAUX dock on WhatsApp's rail, Focus Mode, declutter options, WAUX start screen.
- Settings on one page; minimal toolbar popup with an on/off key and a grey toolbar icon when off.
- Compatibility panel and privacy-safe layout report for diagnosing WhatsApp updates.
