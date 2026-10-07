# Changelog

## 1.1.0 (2026-10-07)

- New Prism theme and a Soft 3D style: rounded surfaces on a bottom lip, a press that sinks, colored lips on selected chats, tabs and sent bubbles. Any palette can switch between Hard and Soft 3D in Theme Studio.
- New Secondary color token for unread badges and search focus. Existing themes keep their primary there, so nothing changes until you set it.
- Wallpapers: Soft is now a still color wash with a fine dot grid (no animation), and you can use your own image, blurred and dimmed, globally or per chat.
- Customize this chat: private nickname, text size (90 to 125%), wallpaper and wide bubbles, next to accent and always-blur.
- Menu and button hovers in WhatsApp show again under every theme.
- Cipher text now matches the real text's width, so revealing a message no longer resizes it, and the decode animation no longer changes letter spacing.
- Holding Alt reveals only the open chat, not the chat list.
- Message bubbles cap their corner radius so quote and link-preview blocks stay inside.

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
