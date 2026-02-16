# Contributing to WinClaw

Welcome to the lobster tank! 🦞

## Quick Links

- **GitHub:** https://github.com/winclaw/winclaw
- **Discord:** https://discord.gg/qkhbAGHRBT
- **X/Twitter:** [@steipete](https://x.com/steipete) / [@winclaw](https://x.com/winclaw)

## Contributors

See [Credits & Maintainers](https://docs.openclaw.ai/reference/credits) for the full list.

## How to Contribute

1. **Bugs & small fixes** → Open a PR!
2. **New features / architecture** → Start a [GitHub Discussion](https://github.com/winclaw/winclaw/discussions) or ask in Discord first
3. **Questions** → Discord #setup-help

## Before You PR

- Test locally with your WinClaw instance
- Run tests: `pnpm build && pnpm check && pnpm test`
- Ensure CI checks pass
- Keep PRs focused (one thing per PR)
- Describe what & why

## Control UI Decorators

The Control UI uses Lit with **legacy** decorators (current Rollup parsing does not support
`accessor` fields required for standard decorators). When adding reactive fields, keep the
legacy style:

```ts
@state() foo = "bar";
@property({ type: Number }) count = 0;
```

The root `tsconfig.json` is configured for legacy decorators (`experimentalDecorators: true`)
with `useDefineForClassFields: false`. Avoid flipping these unless you are also updating the UI
build tooling to support standard decorators.

## AI/Vibe-Coded PRs Welcome! 🤖

Built with Codex, Claude, or other AI tools? **Awesome - just mark it!**

Please include in your PR:

- [ ] Mark as AI-assisted in the PR title or description
- [ ] Note the degree of testing (untested / lightly tested / fully tested)
- [ ] Include prompts or session logs if possible (super helpful!)
- [ ] Confirm you understand what the code does

AI PRs are first-class citizens here. We just want transparency so reviewers know what to look for.

## Current Focus & Roadmap 🗺

We are currently prioritizing:

- **Stability**: Fixing edge cases in channel connections (WhatsApp/Telegram).
- **UX**: Improving the onboarding wizard and error messages.
- **Skills**: For skill contributions, head to [ClawHub](https://clawhub.ai/) — the community hub for WinClaw skills.
- **Performance**: Optimizing token usage and compaction logic.

Check the [GitHub Issues](https://github.com/winclaw/winclaw/issues) for "good first issue" labels!

## Report a Vulnerability

We take security reports seriously. Report vulnerabilities directly to the repository where the issue lives:

- **Core CLI and gateway** — [winclaw/winclaw](https://github.com/winclaw/winclaw)
- **macOS desktop app** — [winclaw/winclaw](https://github.com/winclaw/winclaw) (apps/macos)
- **iOS app** — [winclaw/winclaw](https://github.com/winclaw/winclaw) (apps/ios)
- **Android app** — [winclaw/winclaw](https://github.com/winclaw/winclaw) (apps/android)
- **ClawHub** — [winclaw/clawhub](https://github.com/winclaw/clawhub)
- **Trust and threat model** — [winclaw/trust](https://github.com/winclaw/trust)

For issues that don't fit a specific repo, or if you're unsure, email **security@openclaw.ai** and we'll route it.

### Required in Reports

1. **Title**
2. **Severity Assessment**
3. **Impact**
4. **Affected Component**
5. **Technical Reproduction**
6. **Demonstrated Impact**
7. **Environment**
8. **Remediation Advice**

Reports without reproduction steps, demonstrated impact, and remediation advice will be deprioritized. Given the volume of AI-generated scanner findings, we must ensure we're receiving vetted reports from researchers who understand the issues.
