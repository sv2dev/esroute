---
name: pr
description: Create a pull request for the current branch using `gh`. Use this skill whenever the user wants to open a PR, push their branch for review, or says "/pr". Before creating the PR, it checks that the CHANGELOG.md [Unreleased] section reflects the changes and that the README docs are up-to-date, updating them and committing if needed. For release PRs (branches with a version bump commit), it also converts [Unreleased] to a versioned release entry and ensures the version bump is the tip commit.
model: claude-sonnet-4-6
context: fork
---

# PR Skill

Create a well-documented pull request, ensuring the changelog and docs are current before opening it.

## Process

### 1. Understand the changes

Run in parallel:
- `git log main..HEAD --oneline` — commits on this branch
- `git diff main...HEAD -- src/` — what changed in source
- `git diff main...HEAD -- CHANGELOG.md README.md packages/esroute/README.md packages/esroute-lit/README.md` — what docs already changed

If `git log main..HEAD` is empty, tell the user there's nothing to PR and stop.

### 2. Detect a version bump (release PR)

Check whether any commit on this branch touched a `package.json` version field:

```bash
git log main..HEAD --oneline --diff-filter=M -- packages/esroute/package.json packages/esroute-lit/package.json
```

If this returns output, this is a **release PR**. Read the new version from `packages/esroute/package.json`.

### 3. Check and update the CHANGELOG

Open `CHANGELOG.md` and look at the `[Unreleased]` section.

**It needs an entry if** there are any user-visible changes: new features, bug fixes, behavior changes, API additions or removals. It does not need an entry for test-only changes, internal refactors with no observable effect, or CI/tooling changes.

If the `[Unreleased]` section is missing entries that match the changes, add them:

```markdown
## [Unreleased]

### Added
- Brief description of new capability (closes #N if applicable)

### Fixed
- Brief description of what was broken and how it was fixed (closes #N if applicable)

### Changed
- Brief description of behavioral or API change

### Removed
- Brief description of removed feature or API
```

Only include sections that apply. Keep entries concise — one line per item.

**If this is a release PR**, also promote `[Unreleased]` to a versioned heading. After ensuring entries are present, transform the top of the changelog from:

```markdown
## [Unreleased]

<entries>
```

to:

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

<entries>
```

where `X.Y.Z` is the version from `packages/esroute/package.json` and `YYYY-MM-DD` is today's date. The `[Unreleased]` section is left empty above it.

### 4. Check the README docs

Scan for changes that affect the public API or documented behavior:

- New exports in `src/index.ts`
- Changed type signatures that users interact with
- New options or methods on `createRouter` / `NavOpts` / `router`
- Changed defaults or behavior

If a documented example is now wrong, or a new feature has no documentation, update the relevant README (`packages/esroute/README.md` or `packages/esroute-lit/README.md`). Don't add documentation for internal implementation details.

### 5. Commit any doc updates

If you changed CHANGELOG.md or any README, commit those files:

```bash
git add CHANGELOG.md packages/esroute/README.md packages/esroute-lit/README.md
git commit -m "docs: update changelog and readme for PR"
```

Only commit docs files here — not source changes.

### 6. Ensure the version bump is the tip commit (release PRs only)

The version bump commit must be the most recent commit on the branch — the CI publisher uses it as the release trigger. Check:

```bash
git log main..HEAD --format="%H" -- packages/esroute/package.json packages/esroute-lit/package.json | head -1
```

If that hash does not match `git rev-parse HEAD`, the version bump is not at the tip. Reorder silently using cherry-pick:

```bash
CURRENT_BRANCH=$(git branch --show-current)
VERSION_COMMIT=$(git log main..HEAD --format="%H" -- packages/esroute/package.json packages/esroute-lit/package.json | head -1)

# All other commits in original order
OTHER_COMMITS=$(git log --reverse main..HEAD --format="%H" | grep -v "^${VERSION_COMMIT}$")

# Rebuild branch on top of main with version bump last
git checkout -B ${CURRENT_BRANCH}_reorder main
echo "$OTHER_COMMITS" | xargs -r git cherry-pick
git cherry-pick $VERSION_COMMIT
git branch -M ${CURRENT_BRANCH}_reorder $CURRENT_BRANCH
```

Verify with `git log main..HEAD --oneline` that the version bump commit now appears first (topmost = most recent).

### 7. Push and create the PR

Push the branch (use `--force-with-lease` to handle the reorder case safely):

```bash
git push -u origin HEAD --force-with-lease
```

Then create the PR targeting `main`:

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullet points: what this PR does and why>

## Changes
<bullet points: key technical changes — types, behavior, API>

## Changelog
<paste the versioned release section, or [Unreleased] entries, or "No user-visible changes.">
EOF
)"
```

**Title format**: for release PRs use `release: vX.Y.Z`. For non-release PRs, match the dominant commit type (`fix: ...`, `feat: ...`) or plain imperative. Keep it under 72 characters.

**Body**: be factual and brief. The summary explains the *why*, the changes section explains the *what*. Don't pad with filler.

### 8. Return the PR URL

After `gh pr create` succeeds, show the user the URL.

## Guidelines

- If there are uncommitted changes in `src/`, ask the user whether to commit them first or proceed with just the pushed commits.
- Never bump version numbers — that's handled separately before invoking this skill.
- Don't add changelog entries for `test:`, `ci:`, `build:`, or `chore:` commits unless they change observable behavior.
