# Contributing to Module to CLI

Thank you for your interest in contributing to Module to CLI! This document provides guidelines to help make the contribution process smooth and effective for everyone.

## IDE Setup

For the best development experience, we recommend using Visual Studio Code with the Deno extension.

1. **Install the Deno extension for VSCode**
   - Extension ID: `denoland.vscode-deno`
   - This extension is already listed in the recommended extensions (`.vscode/extensions.json`)

2. **Use the workspace settings**
   - The project comes with pre-configured VSCode settings in `.vscode/settings.json`
   - These settings enable the Deno language server and set up proper formatting

## Development Workflow

### Setting Up the Project

1. **Fork the repository** to your GitHub account
2. **Clone your fork** to your local machine

   ```bash
   git clone https://github.com/YOUR_USERNAME/module-to-cli.git
   cd module-to-cli
   ```

3. **Install dependencies**

   ```bash
   deno cache --reload mod.ts
   ```

### Feature Development

1. **Create a feature branch** from the main branch

   ```bash
   git checkout -b feature/my-new-feature
   ```

   Use a descriptive branch name that reflects the feature or fix you're working on. Prefix your branch with:
   - `feature/` for new features
   - `fix/` for bug fixes
   - `docs/` for documentation changes
   - `refactor/` for code refactoring
   - `test/` for changes to tests

2. **Make your changes** and ensure they follow the project's code style

3. **Write tests** for your changes when applicable

4. **Run tests** to ensure everything works as expected

   ```bash
   deno test
   ```

5. **Commit your changes** using semantic commit messages (see below)

6. **Push your branch** to your fork

   ```bash
   git push origin feature/my-new-feature
   ```

7. **Create a pull request** to the main repository's main branch

## Semantic Commit Messages

This project follows semantic versioning and uses commit messages to automatically determine version bumps. **No manual version changes are needed!**

### Commit Message Format

Each commit message should have a **header**, an optional **body**, and an optional **footer**:

```text
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

### Supported Types

| Type         | Description                                            | Version Bump |
|--------------|--------------------------------------------------------|--------------|
| `fix:`       | A bug fix                                              | Patch        |
| `perf:`      | A performance improvement                              | Patch        |
| `feat:`      | A new feature                                          | Minor        |
| `refactor:`  | Code change that neither fixes a bug nor adds a feature| None*        |
| `style:`     | Changes that do not affect the meaning of the code     | None*        |
| `docs:`      | Documentation only changes                             | None*        |
| `test:`      | Adding missing tests or correcting existing tests      | None*        |
| `build:`     | Changes that affect the build system or dependencies   | None*        |
| `ci:`        | Changes to CI configuration files and scripts          | None*        |
| `chore:`     | Other changes that don't modify src or test files      | None*        |

\* Unless combined with `BREAKING CHANGE:` or `!:`

### Breaking Changes

To indicate a breaking change, either:

1. Add `BREAKING CHANGE:` in the commit body

   ```text
   feat: change API signature
   
   BREAKING CHANGE: The API now requires an options object instead of multiple parameters
   ```

2. Add `!` after the type/scope

   ```text
   feat!: complete API redesign
   ```

Both methods will trigger a major version bump.

### Optional Scope

You can add an optional scope in parentheses:

```text
feat(parser): add ability to parse arrays
fix(cli): resolve issue with argument parsing
```

### Skip Releases

To skip a release regardless of commit type, include `[skip release]` anywhere in the commit message:

```text
docs: update README [skip release]
```

## Pull Request Process

1. **Fill out the PR template** with all requested information
2. **Link to related issues** if applicable
3. **Wait for CI checks** to pass
4. **Address review feedback** if requested
5. Once approved, your PR will be merged by a maintainer

After merging to the main branch, the project's automated pipeline will:

1. Analyze commit messages to determine the version bump
2. Update the version in configuration files
3. Update the CHANGELOG.md
4. Tag the release and publish to JSR automatically

## Questions?

If you have any questions about contributing, please open an issue or reach out to the maintainers.

Thank you for contributing to Module to CLI!
