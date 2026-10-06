# Chrome Web Store listing

Copy for the WAUX store submission. Assets in this folder.

## Name

WAUX: WhatsApp Web, redesigned

## Summary (132 characters max)

A premium theme engine, privacy blur and quick messages for WhatsApp Web. Local only, no tracking, never sends for you.

## Category

Productivity

## Description

WAUX turns WhatsApp Web into a calm, premium desktop app, and keeps everything on your device.

THEME
- Obsidian: deep graphite surfaces, one ember accent, Geist typography, crisp borders and subtle depth
- Light, dark or follow your system
- Theme Studio: nine color tokens plus radius, depth, glass blur, density and typeface, with a live preview
- Import tweakcn and shadcn CSS variables, export and share themes as JSON

PRIVACY
- Privacy Shield: one key (Alt+Shift+S) hides messages, names, photos and media
- Cipher text: hidden text becomes dot-matrix glyphs; layout stays intact
- 3D avatars replace profile photos while the Shield is on
- Read on hover or click, or hold Alt to see everything
- Desktop notifications can say "New message" instead of the text
- Hide chats from the chat list into a PIN-protected Hidden chats area. Nothing is archived or deleted.

SPEED
- Quick messages: type ;shortcut and press Tab. WAUX inserts the text, you decide when to send.
- Command palette: Ctrl+K (Cmd+K on Mac) for every action
- Focus Mode hides the chat list
- Per-chat accent colors and always-blur

PRIVATE BY DESIGN
- No servers, no accounts, no analytics, no network requests
- Settings and quick messages stay in your browser
- Runs only on web.whatsapp.com

WAUX is an independent project, not affiliated with, endorsed by, or sponsored by WhatsApp LLC or Meta Platforms, Inc.

Made by Deepak Kumar, 1619.in

## Single purpose

Customize the appearance and privacy of WhatsApp Web in the user's browser: theming, on-screen blur, and local quick-reply templates.

## Permission justifications

- storage: Saves the user's settings, theme and quick messages locally in chrome.storage.local. Nothing leaves the device.
- scripting: Attaches the extension to WhatsApp Web tabs that were already open when the extension is installed or updated, so the user does not need to reload.
- Host permission (https://web.whatsapp.com/*): The only site the extension modifies. Required to apply the theme, blur and quick-message insertion.

## Remote code

No. All JavaScript, CSS and fonts are packaged in the extension.

## Data usage disclosures

The extension does not collect or transmit any user data. Select none of the data categories. Certify: not sold, not used for unrelated purposes, not used for creditworthiness.

## Privacy policy URL

Host PRIVACY.md (for example at https://1619.in/waux/privacy) and enter that URL.

## Assets

| File | Use |
|---|---|
| ../static/icons/128.png | Store icon |
| promo-440x280.png | Small promo tile |
| marquee-1400x560.png | Marquee promo tile |
| screenshot-*-1280x800.png | Screenshots (generate with `node scripts/verify.mjs --store`) |

Source code: https://github.com/KumarDeepak16/waux (MIT)
