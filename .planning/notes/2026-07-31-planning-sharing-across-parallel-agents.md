---
date: "2026-07-31 10:44"
promoted: false
---

# Open decision: sharing `.planning` across parallel agents

Deferred on 2026-07-31 ("we'll have to solve this later"). Recorded because it blocks parallel
execution of Phase 4's waves across worktrees, and because the reasoning otherwise exists only in
a chat transcript.

## The situation

- `.planning/` is gitignored (`.gitignore:121`, _"GSD planning docs are local-only for this
  project"_) and `config.json` sets `commit_docs: false`.
- Work happens in Orca worktrees under `/Users/guillem/orca/workspaces/watch-people-die-live/<name>`.
  A worktree's `.git` is a file pointing at the main checkout's `.git/worktrees/<name>`.
- Because `.planning/` is ignored, it does not exist in new worktrees at all. `gsd-sdk query
  init.todos` run from a worktree reports `planning_exists: false` and resolves `project_root` to
  the worktree — so a naive capture would create a second, divergent, orphaned planning directory.

**Root cause:** `commit_docs: false` plus the gitignore entry is what disabled GSD's *native*
mechanism for keeping planning consistent across worktrees, which is git. Every workaround below is
a substitute for that one setting.

## GSD already has answers — for a different shape of the problem

- `references/workstream-flag.md` describes this exact failure mode: _"The shared
  `.planning/active-workstream` file is fundamentally unsafe when multiple Claude/Codex instances
  are active on the same repo at the same time. One session can silently repoint another session's
  `STATE.md`, `ROADMAP.md`, and phase paths."_ Its fix is the `--ws <name>` flag plus session-scoped
  pointers keyed off `GSD_SESSION_KEY`, `CODEX_THREAD_ID`, `CLAUDE_CODE_SSE_PORT`, `TMUX_PANE`, TTY.
- `gsd-new-workspace` creates isolated workspaces with worktrees **and "an independent `.planning/`
  directory"** — GSD isolates planning per workspace by design.

| Situation                                | GSD's answer                                  |
| ---------------------------------------- | --------------------------------------------- |
| Many agent sessions, **one checkout**    | `--ws` workstreams. Solved.                   |
| Many **worktrees** (the current setup)   | Independent `.planning` per workspace, by design. |

So sharing one `.planning` across worktrees is not a gap GSD left open — it is a deliberate
departure from GSD's model.

## Options

1. **Shared symlink, off-git.** One real `.planning` outside every checkout, symlinked in; its own
   git repo for history. Meets both stated constraints (shared, never in main) but departs from
   GSD's isolation model and needs a single-writer rule for `STATE.md`/`ROADMAP.md`.
2. **GSD-native isolation.** Use `gsd-new-workspace` as designed. Paved path, `files_modified`
   conflict checking already works — but todos and `STATE.md` diverge per workspace until merge.
3. **Turn `commit_docs` back on.** Git does the sharing for free, with real merge conflicts and full
   history. Planning docs then land in main, which was explicitly ruled out.

Constraints 1 and 3 (share it; never commit it to main) are **jointly unsatisfiable inside GSD's
native model**, which is why option 1 keeps coming up.

## Two verified facts that constrain any solution

**A trailing slash in the ignore pattern does not protect a symlink.** Git treats a symlink as a
symlink blob, not a directory, so `.planning/` fails to match one. Tested:

| pattern      | `.planning` is | `git status` | `git add -A` |
| ------------ | -------------- | ------------ | ------------ |
| `.planning/` | real directory | ignored      | not staged   |
| `.planning/` | **symlink**    | `?? .planning` | **`A .planning`** |
| `.planning`  | symlink        | ignored      | not staged (and explicit `git add` refuses without `-f`) |

The current entry is `.planning/`. Any symlink approach **must** drop the trailing slash first.

**`git clean -xdf` blast radius.** Tested:

```
real .planning inside the checkout   -> DELETED
.planning outside, symlinked in      -> link removed, target intact
```

The current layout is the first row. `.planning` today holds `PROJECT.md`, `ROADMAP.md`,
`STATE.md`, `REQUIREMENTS.md`, `v1.0-MILESTONE-AUDIT.md`, three completed phase directories, Phase
4's plans and 04-CONTEXT.md, nine todos and this note — **all unversioned**, so one `git clean -xdf`
in the main checkout loses the lot with nothing to recover from.

## Independent guards if option 1 is chosen

1. `.gitignore` → `.planning` (no trailing slash). Tracked, so it follows every branch and worktree.
2. `$(git rev-parse --git-common-dir)/info/exclude` → same entry. Worktrees share the common git
   dir, so one file covers all of them, and it survives someone editing `.gitignore` on a branch.
3. A `.husky/pre-commit` guard on `git diff --cached --name-only` for a `^\.planning` prefix. The
   hook already runs `set -e`. This is the only guard that catches a deliberate `-f`.

## Recommendation when this is picked up

Regardless of which option wins, **`git init` the planning directory**. It is the cheapest fix to
the real present risk, which is not divergence but total loss. One precision: with a single shared
working tree, git there buys an audit trail and recoverability — **not** conflict detection, since
all agents write the same tree. Real conflict detection needs per-worktree clones that push and
pull, which adds merge burden to a directory whose value is being quick to jot in.

Also worth checking before designing anything: whether the parallel work actually needs separate
worktrees, or whether `--ws` names in **one checkout** would cover it. If they would, the entire
sharing problem disappears and none of the above is needed.

## Interim workaround in place

A self-contained snapshot lives at
`/Users/guillem/vault/projects/personal/watch-people-die-live-STATE.md` — `STATE.md` plus all Phase
4 plans and all source todos inlined, outside the repo so it cannot be committed to main. It is a
snapshot, not a mirror: it drifts the moment `.planning` changes, and has already had to be
regenerated twice.
