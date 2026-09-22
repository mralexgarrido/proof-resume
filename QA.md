# Release verification

Verified September 22, 2026 with fictional data only.

## Cloudflare Pages packaging

The GitHub version includes a Pages Wrangler configuration, Node 22 selection, and response headers that preserve the existing content security policy. Its production build runs the core tests and emits only `index.html` and `_headers`. It needs no installed dependencies to build. The app's editing and export code is unchanged from the verified release below. An actual Cloudflare deployment still requires connecting this GitHub repository in the Cloudflare dashboard.

## Passed

- Eight automated core tests covering draft assembly, private-note exclusion, hidden experiences, editable OOXML structure, Unicode/XML safety, ZIP checksums, backup validation, section ordering, template generation, and network restrictions.
- Desktop browser flow: contact details, education, experience discovery, reflection prompts, editable bullet assembly, private evidence notes, claim confirmation, skills, and final review.
- The live preview updated with the entered content. The five foundation checks reflected completed data and claim review.
- Browser reload restored the fictional draft from local storage.
- A 390 px iframe viewport (375 px usable width with scrollbar) displayed the responsive navigation and source cards without horizontal document overflow; the details form remained usable. An unlabeled mobile data-control button found during this check was fixed.
- The sample Word résumé and blank Word template were rendered in LibreOffice and visually inspected. Each rendered to one clean US Letter page. Both contain selectable text, semantic headings, and true list bullets.
- Production source has no remote script, image, font, API, or analytics dependencies. The content security policy blocks connections.

## Verification limits

- The cloud browser confirmed that the export UI prepared the file, but its download-event API timed out before returning a saved file path. The actual exporter bytes were independently generated from the identical application core, tested for ZIP integrity and private-note exclusion, and rendered in LibreOffice.
- Desktop Microsoft Word was not available. Pagination can differ across Word-compatible editors. Users should check final page breaks.
- The browser did not expose `document.modelContext`. Optional WebMCP navigation registration could not be tested in a supported context. Ordinary app functionality does not depend on it.
- Mobile checking used an actual browser iframe at narrow viewport width, not a physical phone. No formal accessibility certification is claimed.

## Release contents

The downloadable source archive contains the self-contained application, MIT license, development configuration, tests, contribution guidance, and product rationale. It excludes test student backups, private notes, dependency folders, Git credentials, and host-specific identity files.
