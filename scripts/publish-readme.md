# Deno & JSR Automated Release

> Automated semantic versioning and JSR publishing based on commit messages.

## Commit Message Keywords

| Pattern            | Example                                                  | Effect        | Version Change    |
| ------------------ | -------------------------------------------------------- | ------------- | ----------------- |
| `fix:`             | `fix: resolve null pointer`                              | Patch release | `1.2.3` → `1.2.4` |
| `perf:`            | `perf: improve algorithm efficiency`                     | Patch release | `1.2.3` → `1.2.4` |
| `feat:`            | `feat: add dark mode`                                    | Minor release | `1.2.3` → `1.3.0` |
| `BREAKING CHANGE:` | `feat: new API\n\nBREAKING CHANGE: incompatible with v1` | Major release | `1.2.3` → `2.0.0` |
| `!:`               | `feat!: complete rewrite`                                | Major release | `1.2.3` → `2.0.0` |
| `refactor:`        | `refactor: reorganize directory structure`               | No release*   | No change         |
| `style:`           | `style: format code`                                     | No release*   | No change         |
| `docs:`            | `docs: update readme`                                    | No release*   | No change         |
| `test:`            | `test: add unit tests`                                   | No release*   | No change         |
| `build:`           | `build: update dependencies`                             | No release*   | No change         |
| `ci:`              | `ci: configure GitHub Actions`                           | No release*   | No change         |
| `chore:`           | `chore: clean up temporary files`                        | No release*   | No change         |
| `[skip release]`   | `chore: update README [skip release]`                    | Skip release  | No change         |

\* Unless combined with `BREAKING CHANGE:` or `!:`

### Scopes (Optional)

You can add an optional scope in parentheses:

```text
feat(auth): add OAuth support
fix(api): resolve timeout issue
```

## Developer Workflow

1. **Write commits using semantic format** (see table above)
2. **Create pull request from feature branch**
   - CI workflow (if installed) validates code quality and checks publication
   - Prevents merging PRs that would fail to publish
3. **Merge PR to main branch** → this triggers the JSR publish workflow
4. **Automation handles the rest:**
   - Determines version bump from commits
   - Updates config files and CHANGELOG.md
   - Tags, commits, and publishes to JSR

## How It Works

The script:

1. Analyzes commits since the last tag (or all commits if no tag exists) for
   semantic version patterns
   - Examines **all commits** in a PR, not just merge commits
   - Uses the highest priority bump type found (major > minor > patch)
2. Updates version in config files (`deno.json`, `deno.jsonc`, or `jsr.json`)
3. Updates or creates CHANGELOG.md with commit history
   - Creates a new file with standard header if none exists
   - Organizes commits by type (breaking changes, features, fixes, etc.)
   - Includes **all commits** from the PR in the changelog
4. Commits changes with `chore(release): v{version}`
5. Tags the release and pushes to GitHub
6. Runs a dry-run and then publishes to JSR

## CHANGELOG Format

The script generates a structured CHANGELOG.md with commits organized by type:

```markdown
# CHANGELOG (package-name)

All notable changes to this project will be documented in this file.

## [1.2.3](https://github.com/orgName/repoName/tree/v1.2.3)

### BREAKING CHANGES

- feat!: completely redesign API

### Features

- feat: add dark mode support
- feat(auth): implement OAuth login

### Bug Fixes

- fix: resolve null pointer in parser
- fix(api): fix timeout on long requests

### Performance Improvements

- perf: optimize database queries

## [1.2.2](https://github.com/orgName/repoName/tree/v1.2.2)

...{older version changelog here}
```

Note:

- Only commits that trigger version changes are included in the changelog
  (breaking changes, features, fixes, and performance improvements).
- Version numbers are clickable links that point to the corresponding tag on
  GitHub, automatically generated from the repository URL.
- Full commit messages, including multi-line descriptions, are preserved in the
  changelog.
- The package name is automatically included in the changelog title.
- Version entries are ordered chronologically with newest versions at the top.

## Multiple Commits in PRs

When a PR with multiple commits is merged:

1. All commits are analyzed to determine the version bump
2. The highest priority change type dictates the version bump
3. All commits are included in the changelog
4. Commits are grouped by type (breaking, features, fixes, etc.)

This means you can include multiple types of changes in a single PR and each
will be properly categorized in the changelog.

## Quick Setup

### Prerequisites

- Deno v2.x
- Git configured
- JSR access (`deno login jsr.io`)

### Installation Options

When running the installation script, you'll be prompted to:

1. **Add JSR Publish Workflow:** Automatically publishes to JSR when merging to
   main branch
2. **Add CI Workflow:** Runs code quality checks and publishing dry-runs on pull
   requests
   - This workflow helps prevent merging PRs that would fail to publish
   - Recommended when using the JSR publish workflow
   - Targets feature branches (ignores PRs to main)
   - Validates formatting, linting, type checking, and dry-run publishing

Both workflows can be added to enhance your development and publishing process:

- The JSR Publish Workflow handles the actual releases
- The CI Workflow ensures quality control before merging

### Manual Run

```bash
deno run --allow-run --allow-read --allow-write --allow-env ./scripts/publish.ts
```

### Command Line Options

The script supports the following command-line options:

```bash
--dry-run, -d      Don't actually make changes, just report what would happen
--skip-publish, -s Skip the JSR publication step
--allow-dirty, -a  Allow publishing with uncommitted changes (automatically enabled in dry-run mode)
--help, -h         Show this help message
```

Note that when using `--dry-run`, the `--allow-dirty` flag is automatically
enabled by default. This means you can test the full publication process without
having to commit your changes first. If you want to disable this behavior, you
can explicitly set `--allow-dirty=false`.

## Troubleshooting

- **No release happening?** Check your commit message format
- **JSR publish fails?** Verify JSR login and package metadata
- **Need more details?** Run the script manually to see full logs

## Advanced

- **Skip releases:** Use non-semantic commit messages or use types like `docs:`,
  `chore:`, etc.
- **Force skip release:** Include `[skip release]` anywhere in a commit message
  to bypass the entire release process, regardless of other commits.
- **Customize:** Edit `CONFIG_FILES`, `determineBumpType()`, or
  `updateChangelog()`
