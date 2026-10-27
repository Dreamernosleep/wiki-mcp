# Contributing to Wiki MCP

First off, thank you for considering contributing to Wiki MCP! 🎉

It's people like you that make open source great. We welcome contributions of all kinds:

- 🐛 Bug reports
- 💡 Feature requests
- 📝 Documentation improvements
- 🔧 Code contributions
- 🌍 Translations
- ⭐ Starring the repo

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/wiki-mcp.git
   cd wiki-mcp
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/original-owner/wiki-mcp.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/my-awesome-feature
   ```

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Docker version, Node version)

### Suggesting Features

Feature requests are welcome! Please use our [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md) and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Code Contributions

1. Pick an issue or create one
2. Comment on the issue to let others know you're working on it
3. Fork and create a branch (see [Getting Started](#getting-started))
4. Make your changes
5. Write/update tests
6. Update documentation
7. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 22+ (for `node:sqlite`)
- Docker & Docker Compose (recommended)
- Git

### Local Development

```bash
# Install dependencies
npm install

# Start Meilisearch (Docker)
docker run -d -p 7700:7700 getmeili/meilisearch

# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Docker Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Rebuild after changes
docker compose up -d --build

# Stop all services
docker compose down
```

## Pull Request Process

1. **Update the README.md** with details of changes if applicable
2. **Update the CHANGELOG.md** with your changes under "Unreleased"
3. **Ensure all tests pass**: `npm test`
4. **Ensure the build succeeds**: `npm run build`
5. **Request review** from maintainers
6. **Squash commits** if requested before merging

### PR Title Format

Use conventional commits format:

```
feat: add new feature
fix: fix bug in search
fix: correct typo in README
docs: update installation guide
style: format code
refactor: restructure API handlers
test: add tests for file watcher
chore: update dependencies
```

## Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public functions
- Keep functions small and focused

### Code Formatting

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas
- Max line length: 100 characters

### Git Commits

- Use conventional commits (see above)
- Keep commits atomic (one logical change per commit)
- Write clear commit messages

## Questions?

Feel free to:
- Open an issue with the `question` label
- Start a discussion in GitHub Discussions
- Reach out to maintainers

## Recognition

Contributors will be added to the README.md and release notes. Thank you for making Wiki MCP better! 🙏
