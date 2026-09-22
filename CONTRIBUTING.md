# Contributing to Proof

Useful contributions include clearer coaching prompts, cross-major examples, keyboard usability, translations, document compatibility, and tests that protect student privacy.

## Product boundaries

- Keep the standalone production app fully offline, with no accounts, telemetry, external fonts, CDNs, AI APIs, or remote checks.
- Never invent accomplishments or metrics. Do not turn a project proposal into a claimed business outcome.
- Preserve the student's voice. Built-in examples remain clearly fictional and separate from the student's own draft.
- Keep private notes out of Word and print output.
- Keep Word exports editable, with semantic headings and bullets.
- Avoid pseudo-precise ATS or hiring scores.
- Preserve compatibility with existing version 1 backups, or provide an explicit migration.

## Before submitting a change

1. Explain the student problem and the resulting behavior.
2. Run `npm test` and `npm run build`.
3. Check keyboard use, a narrow viewport, and a normal laptop viewport.
4. If changing the exporter, open a generated file in a real Word-compatible editor and check every page.
5. Never attach a real student's contact information, résumé, or backup to an issue or pull request. Use fictional fixtures.
