# Contributing to Khanara

Thank you for your interest in contributing. This guide covers everything you need to get a change from idea to merged PR.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Workflow](#development-workflow)
- [Commit Style](#commit-style)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Code Standards](#code-standards)
- [Running Tests](#running-tests)

---

## Code of Conduct

Be respectful and constructive. Harassment or discrimination of any kind will not be tolerated.

---

## Reporting Bugs

1. Search [existing issues](../../issues) first to avoid duplicates.
2. Open a new issue and include:
   - Steps to reproduce
   - Expected vs. actual behavior
   - Environment (OS, .NET version, Node version, browser)
   - Relevant logs or screenshots

---

## Suggesting Features

Open a GitHub Issue with the `enhancement` label. Describe the problem you are solving and the proposed solution. For significant changes, discuss the approach before writing code.

---

## Development Workflow

1. Fork the repository and clone your fork.
2. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Set up the backend and frontend following the [Getting Started](../README.md#getting-started) guide.
4. Make your changes.
5. Ensure all tests pass (see [Running Tests](#running-tests)).
6. Push your branch and open a pull request against `main`.

---

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`

Examples:
```
feat(orders): add cancellation reason field
fix(cart): prevent negative quantity on decrement
docs(readme): update getting started instructions
```

Keep the summary under 72 characters. Use the body for the "why", not the "what".

---

## Pull Request Guidelines

- **One concern per PR.** Don't bundle unrelated changes.
- **Link the relevant issue** using `Closes #<issue-number>` in the PR description.
- **All CI checks must pass** before requesting review.
- **Keep the diff focused** — avoid reformatting unrelated files.
- **Add or update tests** for any changed behavior.
- Await at least one approval before merging.

---

## Code Standards

### Backend (.NET)
- Follow the existing repository and unit-of-work patterns — controllers must not call `DbContext` directly.
- Run `dotnet format` before pushing; CI enforces formatting with `--verify-no-changes`.
- Use `ProblemDetails` (RFC 7807) for all error responses — see `ExceptionMiddleware`.
- Never store raw refresh tokens — hash with SHA-256 before persistence.
- Validate image uploads with magic-byte checks, not just content-type headers.

### Frontend (Angular)
- Use standalone components and lazy-loaded routes — no NgModules.
- Prefer Angular signals over manual `BehaviorSubject` state where appropriate.
- Run Prettier before pushing: `npx prettier --write .`
- Follow the existing service/interceptor patterns in `core/`.

For deeper guidance on each technology, see the internal dev docs in `_dev-docs/` (gitignored, local only).

---

## Running Tests

**Frontend:**
```bash
cd client
npm run test:ci       # single run
npm run test:coverage # with coverage report
```

**Backend:**
```bash
cd backend/Khanara.API.Tests
dotnet test
dotnet test --filter "Category=Unit"
```

Coverage thresholds are enforced at 70% for the frontend. The backend uses Coverlet — check `coverlet.runsettings` for configuration.
