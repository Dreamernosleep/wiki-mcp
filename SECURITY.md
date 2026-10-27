# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@wiki-mcp.dev** (or create a private security advisory on GitHub).

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
- **Initial Assessment**: We will provide an initial assessment within **7 days**.
- **Resolution**: We aim to release a fix within **30 days** for critical vulnerabilities.
- **Disclosure**: We will coordinate disclosure with you and credit you in the security advisory (unless you prefer to remain anonymous).

## Security Best Practices for Users

When self-hosting Wiki MCP:

1. **Change default keys**: Always change `MEILISEARCH_KEY` from the default
2. **Use HTTPS**: Put the service behind a reverse proxy with TLS
3. **Restrict access**: Use firewall rules to limit access to the API
4. **Keep updated**: Regularly update Docker images
5. **Backup data**: Regularly backup `content/` and `data/` directories
6. **Environment variables**: Never commit `.env` files with secrets

## Scope

### In Scope

- Authentication/authorization bypass
- Remote code execution
- SQL injection
- Cross-site scripting (XSS)
- Path traversal
- Server-side request forgery (SSRF)
- Insecure default configurations

### Out of Scope

- Issues in third-party dependencies (report to them directly)
- Social engineering attacks
- Physical security issues
- Denial of service attacks
- Issues requiring physical access to the server

## Bug Bounty

We currently do not have a formal bug bounty program, but we deeply appreciate
security researchers who help keep Wiki MCP safe. We will gladly credit you in
our security advisories and release notes.

Thank you for helping keep Wiki MCP and our users safe! 🛡️
