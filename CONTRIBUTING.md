# Contributing to Proof

Useful contributions include clearer reflection questions, cross-major examples, keyboard usability, translations, document compatibility, and improvements to the evidence-to-resume workflow.

## Product boundaries

- Keep the production app fully offline. Do not add accounts, telemetry, external fonts, CDNs, AI services, remote checks, or runtime network requests.
- Start with a student's rough memory. Keep deeper reflection optional rather than making every detail a prerequisite for a first contribution.
- Never invent accomplishments, numbers, or outcomes. Identify proposals, simulations, and prototypes as that kind of work.
- Preserve the student's voice and choices. Examples stay clearly fictional. Sentence assembly uses supplied facts and remains editable.
- Keep the evidence collection separate from resume versions. Versions have independent selections, adapted wording, and reviews. Shared fact changes must invalidate affected claim reviews.
- Keep private evidence, reflection, and interview notes out of resume Word, text, print, and peer review exports. Backups include private notes. Interview exports require an explicit choice to include them.
- Opportunity mapping stays transparent and student controlled. Phrase and vocabulary matches suggest connections without asserting qualification or producing ATS or hiring scores.
- Skill practice descriptions record the student's experience. They are not inferred proficiency ratings.
- Preserve stable IDs and links in version 2 backups. Maintain version 1 migration, including old bullets, notes, inclusion choices, and truthful review state. Reject invalid data rather than silently dropping or truncating it.
- Assignment handoffs follow [the strict local contract](docs/handoff.md), receive new IDs, start unreviewed, and remain unselected until the student chooses them.
- Keep Word exports editable, with semantic headings, real bullets, safe contact links, and Letter/A4 support.
- Keep recovery predictable. Do not silently overwrite another tab's saved work or remove a user's only recoverable stored copy.

## Source workflow

Edit modules in `src/`. `npm run assemble` generates self-contained `index.html`; it is a distributable artifact, not the primary editing surface. `npm test` reassembles and tests the app. `npm run build` runs those checks before creating `dist`.

Runtime dependencies are not allowed. Development tooling stays separate from shipped HTML. The production CSP blocks Vite's client, so source changes require reassembly and a manual refresh.

## Before submitting a change

1. Explain the student problem, resulting behavior, and affected workflow.
2. Run `npm test` and `npm run build`.
3. Check the first-memory path, keyboard use, a narrow viewport, and a normal laptop viewport.
4. For data or workflow changes, verify relevant migrations, stable links, variant selections and wording, reviews, undo, and recovery.
5. For exporter changes, open a generated document in a real Word-compatible editor and inspect every page. Verify exclusion of private notes and unselected evidence.
6. Confirm that the standalone app makes no external requests and that its clean offline download excludes current user data.
7. Use fictional fixtures. Never attach real student contact information, resumes, notes, or backups to a commit, issue, or pull request.

Keep changes focused. Tests should protect observable behavior and data boundaries rather than reproduce the implementation.
