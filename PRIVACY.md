# WAUX Privacy Policy

Effective 6 October 2026. Publisher: Deepak Kumar, [1619.in](https://1619.in).

## Summary

WAUX collects nothing. It has no servers, accounts, analytics or tracking, and it makes no network requests.

## Data stored on your device

WAUX saves the following in your browser's extension storage (`chrome.storage.local`) on your device only. It is never synced or uploaded.

- Settings (theme mode, privacy toggles, blur strength, Focus Mode)
- Your theme tokens
- Your quick messages
- Per-chat preferences (accent color, always-blur), keyed by chat name
- Names of chats you chose to hide from the sidebar
- A salted SHA-256 hash of your optional Hidden chats PIN (never the PIN itself)
- A compatibility check: yes/no flags for which WhatsApp page elements WAUX can find (no content)
- Profile photos are never stored or copied; while Privacy Shield is on they are covered by built-in artwork

## What WAUX reads on WhatsApp Web

WAUX runs only on `https://web.whatsapp.com`. To work, it reads the page inside your browser:

- the open chat's name, to apply per-chat preferences
- chat names in the chat list, to hide the chats you chose and to offer them in the hide picker and command palette
- the few characters you type before a `;shortcut`, to suggest quick messages
- desktop notification text, only to replace it with "New message" when notification redaction is on

This happens in memory on your device. WAUX never stores, copies or transmits messages, contacts, media, phone numbers or chat history.

## Layout report

If you choose to run **Save layout report**, WAUX saves a text file to your computer describing the page structure (element types, roles, test ids and sizes). Text, names, titles, image addresses and class names are excluded, and long digit sequences are redacted. The file is only shared if you share it.

## Permissions

- `storage`: save the data listed above, locally.
- `scripting`: attach WAUX to WhatsApp tabs already open at install or update.
- Host access to `web.whatsapp.com` only.

WAUX does not request access to other sites, tabs, browsing history, downloads or the clipboard. All code ships inside the extension; nothing is loaded remotely.

## Deleting your data

Studio, Data, **Reset everything** deletes all WAUX data. Removing the extension also deletes it.

## Children

WAUX does not knowingly collect any data from anyone, including children.

## Changes

Changes to this policy will be published with a new effective date in this file and in the extension's About page.

## Contact

[1619.in](https://1619.in)

---

WAUX is not affiliated with, endorsed by, or sponsored by WhatsApp LLC or Meta Platforms, Inc.
