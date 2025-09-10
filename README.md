# Forti Wizard Cheater — FortiGate Wizard Comment Cleaner

> **Live demo:** https://fortiwizardcheater.busselot.org/  
> **Background & article:** https://blog.busselot.org/blog/forti-wizard-cheater-article-en/

This project provides a small, client-side web tool to quickly **find and remove comments** in FortiGate configuration files. It was created for my blog at **blog.busselot.org** and is available online at **fortiwizardcheater.busselot.org**.

---

## What it does

- Parses your uploaded FortiGate config (`.conf` / `.txt`) **in the browser** (no uploads).
- Finds all `set comment` / `set comments` entries and shows them with context.
- Generates **ready-to-paste CLI** blocks to `unset comment` at the correct config path (supports VDOM nesting).
- Two search modes (mutually exclusive), plus a fallback:
  1. **Wizard mode:** show only comments containing `created by … wizard`.
  2. **Wildcard mode:** filter comments with your own wildcard (supports `*` and `?`, case-insensitive).
  3. **Neither checked:** show **all** comments.

---

## Why this exists

FortiGate “wizards” (e.g., VPN wizard) often leave comments such as “created by vpn wizard”.  
When you want a clean config—or you need to bulk-remove labels—you can do it safely and fast with this tool.

---

## Privacy & security

- **No data leaves your browser.** The app runs entirely client-side; nothing is stored or transmitted.
- Don’t take my word for it: check the code in this repo or run it locally.

---

## Quick start (online)

1. Open **https://fortiwizardcheater.busselot.org**.  
2. Upload your FortiGate config file.
3. Pick one mode:  
   - **Wizard** (`created by … wizard`) **or** **Wildcard** (e.g., `web`, `vpn*`).  
   - Leave both off to list **all** comments.
4. Click **Start analysis**.
5. Review the matches and copy/download the **CLI**.
6. Apply on the FortiGate (SSH/console). Example:
   ```bash
   # Example snippet — your output will be generated per match
   config firewall address
     edit "Some_Object"
       unset comment
     next
   end
   ```
7. (Optional) Save a config revision:
   ```bash
   execute config-revision save
   ```

---

## Run locally

No build step is required.

```bash
git clone https://github.com/Rednas1992/Forti_Wizard_Cheater.git
cd Forti_Wizard_Cheater
# Option 1: just open index.html in a browser
# Option 2: serve with any static server, e.g.:
python3 -m http.server 8080
# Then visit http://localhost:8080
```

---

## How it works (technical)

- Scans each line for:
  - `config …`, `edit …`, `next`, `end` to build the current **breadcrumb** (including VDOMs).
  - `set comment` / `set comments` to capture comment text.
- Filters the comment list per the selected mode (wizard / wildcard / all).
- For each match, generates a minimal CLI block that navigates to the same path and runs `unset comment`.

---

## Limitations & notes

- **Wildcard** uses simple globbing (`*` and `?`); it’s **not** full regex.
- Only `set comment` / `set comments` are targeted.  
  If you also want to include `set description`, extend the regex in `app.js` accordingly.
- Extremely large configs may render a lot of matches; the UI stays client-side.

---

## Contributing

Issues and PRs are welcome. If you have ideas (e.g., regex mode, include `set description`, export to `.bat`/`.sh`, dark/light themes), open an issue.

---

## License

MIT © Sander Busselot
