# Security policy

## Reporting a vulnerability

Please report security issues privately, not in public issues.

- Use GitHub's **Report a vulnerability** button on the [Security tab](https://github.com/KumarDeepak16/waux/security/advisories/new), or
- contact the maintainer through [1619.in](https://1619.in).

Include the WAUX version, browser and version, steps to reproduce, and the impact you observed. You should receive an acknowledgement within a few days.

## Scope

In scope: anything that lets a web page, another extension or a network party read WAUX data, run code through WAUX, or bypass the Hidden chats PIN by means other than access to the browser profile.

Out of scope: the visual privacy features themselves. Privacy Shield, cipher text, hidden chats and the PIN protect against people looking at your screen. They are not designed to stop someone with access to your browser profile, your phone or your WhatsApp account.

## Design notes

- No network requests, no remote code, no analytics.
- Data is stored in `chrome.storage.local`. The PIN is stored as a salted SHA-256 hash.
- Minimal permissions: `storage`, `scripting`, and host access to `web.whatsapp.com` only.
- The in-page interface runs in a closed shadow root and never uses `innerHTML`.
