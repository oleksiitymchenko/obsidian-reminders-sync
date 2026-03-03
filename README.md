# Reminders Sync — Obsidian Plugin

Two-way sync between Obsidian task checkboxes and Apple Reminders on macOS. Tag a note with a frontmatter tag and the plugin automatically creates Reminders for every unchecked task, mirrors completions back into Obsidian, and keeps everything in sync as you work.

---

## What it does

- **Push** — any unchecked `- [ ] Task` in a tagged note is created as a reminder in Apple Reminders, inside a list named after the note.
- **Push completion** — checking a task in Obsidian marks the corresponding reminder complete.
- **Pull completion** — checking a reminder in Apple Reminders checks the task off in Obsidian on the next sync.
- **Due dates** — tasks annotated with `📅 YYYY-MM-DD` have that date set as the reminder's due date.
- **Stale cleanup** — if you delete a task line from a note, its tracking entry is removed (the reminder in Apple Reminders is left as-is).

---

## Requirements

- **macOS** (the plugin uses AppleScript — it is desktop-only)
- **Obsidian** 1.0 or later
- **Automation permission** — on first sync, macOS will ask whether Obsidian can control Reminders. Grant it, or grant it later in:
  `System Settings → Privacy & Security → Automation → Obsidian → Reminders ✓`

---

## Installation

> The plugin is not yet in the Obsidian Community Plugins directory. Install manually:

1. Build the plugin (see [Development](#development)) or download a release.
2. Create the folder `<your-vault>/.obsidian/plugins/obsidian-reminders-sync/`.
3. Copy `main.js` and `manifest.json` into that folder.
4. In Obsidian: **Settings → Community plugins → Installed plugins** → enable **Reminders Sync**.

---

## Enabling sync on a note

Add **one** of the following to the note's YAML frontmatter:

```yaml
# Option 1 — tag list (recommended, composable with other tags)
---
tags:
  - sync-reminders
---

# Option 2 — boolean flag
---
sync-reminders: true
---
```

The tag name is configurable in Settings.

---

## Task format

Standard Obsidian task syntax is supported:

```markdown
- [ ] Buy groceries
- [ ] Call dentist 📅 2025-06-15
- [x] Already done (will not be pushed)
```

| Syntax | Meaning |
|---|---|
| `- [ ] Text` | Incomplete task — synced to Reminders |
| `- [x] Text` | Complete task — skipped on push; checked off if completed in Reminders first |
| `📅 YYYY-MM-DD` | Due date — passed to the reminder; stripped from the reminder name |

---

## Settings

| Setting | Default | Description |
|---|---|---|
| **Sync tag** | `sync-reminders` | Frontmatter tag or key that opts a note into syncing |
| **Auto-sync on save** | `true` | Trigger sync automatically after saving a tagged note |
| **Auto-sync debounce (ms)** | `2000` | How long to wait after the last keystroke before syncing. Increase if you notice lag while typing |
| **Periodic sync interval (s)** | `0` (disabled) | Sync all tagged notes every N seconds in the background. Useful for pulling completions from Apple Reminders without saving |

---

## Sync behaviour

### When does sync run?

1. **On save** — after you save a tagged note (debounced, see settings).
2. **Manual** — click the **↻** ribbon icon or run the command `Sync all tagged notes to Apple Reminders`.
3. **Periodic** — every N seconds if configured.

### List naming

Each note gets its own Reminders list named after the note's **basename** (filename without `.md`). The list is created automatically if it doesn't exist.

### Task identity

Each task is identified by a SHA-256 hash of its display text and note path. Renaming a task is treated as deleting the old task and creating a new one. Renaming the note file is handled gracefully — the plugin migrates state entries to the new path.

### Concurrent sync protection

If a sync is already running when another is triggered (e.g. a save fires during periodic sync), the second sync is silently skipped.

---

## Known limitations

- **macOS only** — uses AppleScript via `osascript`.
- **Renamed tasks** — changing a task's text creates a new reminder; the old one is orphaned in Apple Reminders.
- **Deleted tasks** — the sync state entry is removed but the reminder is not deleted from Apple Reminders.
- **No subtasks / priorities** — only name and due date are synced.
- **Apple Reminders must be responsive** — syncs time out after 10 seconds if the app is unresponsive.

---

## Development

```bash
# Install dependencies
npm install

# Watch mode — rebuilds main.js on every save
npm run dev

# Symlink into your vault for live testing
ln -s "$(pwd)" "/path/to/your/vault/.obsidian/plugins/obsidian-reminders-sync"
```

After enabling the plugin in Obsidian, reload it with **Ctrl/Cmd+R** (or via the community plugin toggle) whenever `main.js` changes.
