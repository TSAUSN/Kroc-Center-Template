# Setup (once per machine)

Run everything from the Kroc-Center-Template root. `Z=.claude/skills/zesty/scripts`.

## 1. Instance config + token

The scripts reuse the **Zesty VS Code extension**'s files rather than having their own:

1. Install the extension: `code --install-extension zesty-io.zesty-vscode-extension`.
2. The repo root needs `zesty.config.json` containing at least `{ "instance_zuid": "8-80c0bba6b8-lhkcc7" }`.
3. Right-click `zesty.config.json` → **Sync to Instance** (or `ctrl+alt+i`) and enter a developer token when asked. That writes:
   - the token to `.vscode/settings.json` as `zesty.editor.token`;
   - the file → ZUID map into `zesty.config.json` (`instance.views/styles/scripts`), which `zesty-sync.mjs` uses to know where each file goes;
   - every view, stylesheet and script into `webengine/`. ⚠ It overwrites local files, so commit or stash first.

Without VS Code, set `ZESTY_TOKEN` in the environment instead; the file map still has to come from one Sync to Instance.

Requires Node 18+ (global `fetch`/`FormData`).

## 2. Gitignore

These must stay ignored (they are, in the repo's `.gitignore`): `.vscode` and `zesty.config.json` (token, file map), and `.zesty-sync.json` / `.zesty-sync.lock` (the sync baseline and lock). `.claude/settings.local.json` is personal too — Claude Code keeps it out of git, but check before committing.

## 3. Baseline

```bash
node $Z/zesty-sync.mjs status
```

The first run records what the instance holds (`.zesty-sync.json`), then lists anything that differs from local. A clean result shows only `styles/tailwind.css` as local-only (it's build output that's never uploaded). If files differ, `pull` brings instance changes down, and `push <file>` sends local ones. `init` re-baselines from the instance and drops pending changes.

## 4. The auto-sync hook

The extension only uploads on an editor save. This hook pushes everything else (Claude's edits, `npm run format`, `npm run build:css`, git) by running `zesty-sync.mjs hook` after every Edit/Write/Bash tool call. It's a three-way check, so it never overwrites an edit someone made in the Manager. It pushes nothing if more than 15 files change at once, and it never creates or deletes files.

**Claude can't install it.** The auto-mode classifier blocks Claude from editing its own settings, so the user pastes this into **`.claude/settings.local.json`**, merged alongside any existing keys such as `"permissions"`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/skills/zesty/scripts/zesty-sync.mjs\" hook",
            "timeout": 90
          }
        ]
      }
    ]
  }
}
```

Then open **`/hooks`** once (or restart Claude Code). Hooks are loaded at session start and changes need that review.

Why the local file and not the committed `.claude/settings.json`: the hook writes to the shared dev instance on every edit, so each person should opt in. (Without a config or token the script exits silently, so a committed hook would be harmless, just surprising.)

The extension's own upload-on-save can stay on. Both converge, and the hook just sees "in sync".

**Check it works:** ask Claude to add a blank line to a scratch or test view and then remove it. Both steps should report `Synced to Zesty: views/…` (a `systemMessage` for the user, plus `additionalContext` for Claude). With no changes, `echo '{}' | node $Z/zesty-sync.mjs hook` prints nothing and exits 0.

## 5. Test modules (for `ssr-check.cjs`)

```bash
npm i --prefix ~/.cache/kroc-ssr react@18.3.1 react-dom@18.3.1 @babel/standalone@7
```

They live outside the repo, since its devDependencies are only Tailwind, ESLint and Prettier. Point `KROC_SSR_MODULES` at another `node_modules` to override.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Hook never reports anything after edits | Not loaded: open `/hooks` or restart. Or the edited file isn't under `webengine/views|styles|scripts`, or it's gitignored (`tractionrec/`, `_runner/`). |
| `Cannot find module …/tools/zesty-sync.mjs` | The hook still points at the old path. The scripts moved from `tools/` into this skill on 2026-10-07; update the `command` above. |
| `developer token rejected (expired?)` | Re-enter the token: run the extension's Sync to Instance (or update `ZESTY_TOKEN`). |
| `new: views/… not on the instance` | New file; create it with `node $Z/zesty-sync.mjs push <file>` (scans never create). |
| `conflict: …` / `remote-newer: …` | Someone changed it on the instance. `status` shows which, then `pull` (or `push --force` only if overwriting is intended). |
| `N files … changed at once; nothing pushed` | Branch switch or stash. `scan --allow-many` to push them, or `init` to drop them. |
| A new class looks "missing" right after `build:css` | `styles.html` takes a few seconds to reach stage; see api-facts.md. |
