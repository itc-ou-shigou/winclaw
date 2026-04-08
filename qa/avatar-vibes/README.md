# avatar-vibes — character vibes scenario library

**Status**: informational only. Additive scenario library ported from openclaw `qa-lab`.
**Owner**: avatar-ext (additive migration P7)
**Created**: 2026-04-09

A library of "character vibes" scenarios used to grade an agent's naturalness, vibe, and funniness on multi-turn improv conversations. Originally introduced upstream in openclaw commits `97dfbe0fe1` and `1baf5533aa`.

This directory **does not** modify any winclaw-avatar runtime, UI, Digital Human, ClawMem, LCM, or GRC code. Scenarios are not gating for any release.

## Layout

```
qa/avatar-vibes/
├── README.md
├── scenarios/character-vibes-gollum.md
└── profiles/digital-human.profile.yaml
```

## Removal

```
git rm -r qa/avatar-vibes .github/workflows/avatar-vibes.yml
```
