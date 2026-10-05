# Proof 2.1 local verification

Checked October 5, 2026 with fictional data only. Release metadata is 2.1.0; the project backup schema remains version 2.

This log records local release verification. Production deployment is checked separately against the Cloudflare Pages result for the published commit.

## Automated checks

`npm test` assembles the complete application and runs 40 passing tests using Node built-ins. Coverage includes:

- Version 1 migration, lossless version 2 round trips, stable IDs, strict capacity validation, and linked evidence integrity.
- Independent selections, adapted wording and reviews, proposal/simulation/prototype labels, and exclusion of private or unselected content.
- Fact-based sentence assembly, transparent opportunity suggestions, measurement arithmetic, and numeric coaching that distinguishes actual quantities from tool names or dimensional labels.
- Pure export-review suggestions with exact targets for missing details, optional dates, unreviewed selected claims, and repeated wording. These leave the state and five foundation checks unchanged.
- Strict local assignment handoffs with new IDs and unreviewed claims.
- Editable OOXML structure, semantic headings, real bullets, safe hyperlinks, Unicode/XML handling, ZIP checksums, Letter/A4 settings, and entry pagination rules.
- Explicit private interview export opt-in, source assembly, and application/hosting policies prohibiting external connections.

`npm run build` passes and emits only `dist/index.html` and `dist/_headers`; browser tooling and QA artifacts are excluded.

## Browser suites

The optional suites serve the exact assembled HTML locally and drive native controls through headless Chromium with Playwright supplied separately.

| Suite | October 5 status | Scope |
| --- | --- | --- |
| `test:browser` | 13 scenarios passed | Existing workflow, downloads, privacy, storage, migration, and responsive regression |
| `test:reliability` | 12 scenarios passed | Saving boundaries, immediate Undo, history recovery, and delayed import handling |
| `test:review` | 9 scenarios passed | Live wording/reviews, shared versus adapted scope, private reflection, adapted-only interviews, long content, continuation, export targets, evidence filters/search, and direct requirement actions |

### Existing workflow regression

The passing 13-scenario suite verifies rough memory capture, prompt changes, clearing text, sentence comparison, contact and education updates, skill links, independent versions, interview notes and timer, and real Word/text/peer-review/print downloads.

It also verifies backups, reload, clean offline downloads, contribution removal and undo, restore points, unreviewed/unselected assignment imports, shared-device mode, cross-tab conflicts, failed storage writes, corrupt draft recovery, and version 1 migration.

The eight sections and populated workflows fit 320, 390, 768, and 1440 px viewports. Checks include keyboard focus, delayed search, dialog selection, and absence of page errors or application resource requests beyond the initial local documents. Downloaded public outputs exclude private sentinel text.

### Reliability regression

The passing 12-scenario suite verifies:

- Copied hidden control characters are cleaned at entry so saving, backups, and reload remain usable. A first edit enables Undo immediately; a replacement edit clears Redo.
- Modal memory input cannot introduce an unsavable hidden character.
- Damaged restore-point history does not disable saving, reload, or backup of a valid main project.
- An oversized selected opportunity requirement must be shortened explicitly before saving, with no silent truncation.
- The largest accepted revision does not overflow into an invalid persisted project.
- Closing an import while a file is still reading cannot reopen a cancelled preview.
- Overlapping assignment and backup reads keep the latest candidate and ignore an older successful read.
- An older rejected read cannot erase or dismiss a newer import preview. Opening another dialog cancels the earlier pending read.
- Duplicating a maximum-length version name preserves complete Unicode characters and a valid project.
- If a restore point cannot be saved, resetting or opening another backup first prepares a portable backup of the original project, including private notes. The damaged restore-point history remains available and the new project saves correctly.

### Review and usability regression

The passing 9-scenario suite verifies live row wording and claim status without losing focus; private reflection/theme edits preserving a reviewed claim; shared and adapted reviews remaining independent; practice and private-safe export of adapted-only wording; and permitted long names and URLs wrapping in mobile views and full preview.

It also verifies the Continue action, exact export-review targets, evidence modes and search, and direct requirement inclusion and wording actions. Filters update when a student changes inclusion. Review buttons remain readable on desktop; permitted long names and links wrap without clipping at 320, 390, and 768 px across all eight views and full preview. No page errors or external resource requests occurred.

### Rerunning the suites

Supply Playwright and Chromium separately:

```sh
export PROOF_PLAYWRIGHT_MODULE=/absolute/path/to/playwright
export PROOF_CHROMIUM_PATH=/absolute/path/to/chromium
npm run test:browser
npm run test:review
npm run test:reliability
```

`PROOF_QA_OUTPUT` can select the directory for fictional downloads and screenshots in the browser and review suites. Their default is a temporary directory. Browser tooling is not installed into or shipped with the production app.

## Historical rendered Word checks, October 4

The exporter implementation is unchanged for this update. The following checks were performed for 2.0 on October 4, 2026, not rerendered as new October 5 evidence. Generated files were opened in LibreOffice and every page was visually inspected:

| Fixture | October 4 result |
| --- | --- |
| Letter, Arial, comfortable spacing | One clean page |
| A4, Georgia, compact spacing | One clean page |
| Longer Letter resume, 863 words | Three clean pages |

Those checks found readable stage labels, preserved accents and punctuation, headings/context kept with their first bullet, later bullets continuing across pages, and no clipping or missing text. ZIP integrity, XML parsing, and private-note searches passed. The current automated exporter tests remain passing.

## Verification limits

Microsoft Word and physical mobile devices were not available. Compatible editors can paginate differently, so students should check final page breaks. Keyboard, focus, and responsive checks are not a formal accessibility certification.

Local tests alone do not establish a production deployment. The existing Pages packaging and privacy headers are preserved. Direct retrieval of the live Pages interface is blocked in this environment; Cloudflare deployment status is available through the repository checks.

The local handoff contract is implemented in Proof. Other assignment tools need their own separately reviewed exporters. This update does not modify those tools, call AI services, or send student data elsewhere.
