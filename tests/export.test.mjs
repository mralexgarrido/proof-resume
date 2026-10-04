import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, DataView, URL, crypto });
vm.runInContext(fs.readFileSync(new URL('../src/core.js', import.meta.url), 'utf8') + '\nthis.core = ProofCore;', context);
vm.runInContext(fs.readFileSync(new URL('../src/export.js', import.meta.url), 'utf8') + '\nthis.exporter = ProofExport;', context);
const C = context.core, E = context.exporter;

function fixture() {
  const state = C.blank(), variant = C.variant(state);
  state.contact = { name: 'José Núñez', email: 'jose@example.com', phone: '(956) 555-0123', location: 'Edinburg, TX', linkedin: 'linkedin.com/in/jose-example', portfolio: 'https://example.org/work?q=one&category=two' };
  state.education.push({ ...C.education(), school: 'Example University', degree: 'BBA in Marketing', dates: 'Expected May 2027' });
  const experience = C.experience('course');
  Object.assign(experience, { role: 'Research Lead', organization: 'Campus Café Project', dates: 'January to May 2026' });
  const contribution = C.contribution();
  Object.assign(contribution, { text: 'Analyzed 86 survey responses in Excel to identify three purchase barriers.', action: 'PRIVATE_DRAFT_ACTION_739', evidence: 'PRIVATE_EVIDENCE_731', reflection: 'PRIVATE_REFLECTION_732', reviewed: true, interview: { situation: 'PRIVATE_STAR_733', task: 'PRIVATE_TASK_734', action: 'PRIVATE_ACTION_735', result: 'PRIVATE_RESULT_736', lesson: 'PRIVATE_LESSON_737' } });
  experience.contributions.push(contribution);
  state.experiences.push(experience);
  variant.contributionIds.push(contribution.id);
  const hidden = C.contribution();
  hidden.text = 'HIDDEN_LIBRARY_CLAIM_738';
  experience.contributions.push(hidden);
  const skill = { id: C.id(), name: 'Excel (pivot tables)', category: 'tools', practice: 'independent', contributionIds: [contribution.id] };
  state.skills.push(skill);
  variant.skillIds.push(skill.id);
  return { state, variant, contribution, experience, hidden };
}

function entries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), result = {};
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50, 'ZIP end record exists');
  const directoryStart = view.getUint32(end + 16, true);
  let position = 0;
  while (position < directoryStart) {
    assert.equal(view.getUint32(position, true), 0x04034b50, 'Local ZIP record exists');
    assert.equal(view.getUint16(position + 8, true), 0, 'ZIP uses STORE mode');
    const size = view.getUint32(position + 18, true), nameLength = view.getUint16(position + 26, true), extraLength = view.getUint16(position + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(position + 30, position + 30 + nameLength));
    const start = position + 30 + nameLength + extraLength, data = bytes.subarray(start, start + size);
    assert.equal(E.crc32(data), view.getUint32(position + 14, true), 'ZIP entry checksum is valid');
    result[name] = new TextDecoder().decode(data);
    position = start + size;
  }
  assert.equal(position, directoryStart);
  assert.equal(view.getUint32(position, true), 0x02014b50, 'ZIP central directory exists');
  assert.equal(Object.keys(result).length, view.getUint16(end + 10, true));
  return result;
}

test('resume exports use only the selected public projection, excluding private and hidden data', () => {
  const { state } = fixture();
  const zip = entries(E.docx(state)), plain = E.text(state);
  assert.doesNotMatch(JSON.stringify(zip) + plain, /PRIVATE_|HIDDEN_LIBRARY_CLAIM/);
  assert.match(zip['word/document.xml'], /86 survey responses/);
  assert.match(plain, /Excel \(pivot tables\)/);
  assert.equal(Object.keys(zip).length, 7);
});

test('editable Word export contains semantic headings, real bullet lists and no image or table layout', () => {
  const zip = entries(E.docx(fixture().state));
  assert.match(zip['word/document.xml'], /<w:pStyle w:val="Heading1"\/>/);
  assert.match(zip['word/document.xml'], /<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="1"\/><\/w:numPr>/);
  assert.match(zip['word/numbering.xml'], /<w:numFmt w:val="bullet"\/>/);
  assert.match(zip['word/styles.xml'], /<w:outlineLvl w:val="0"\/>/);
  assert.doesNotMatch(zip['word/document.xml'], /<w:tbl|<w:drawing|<w:txbxContent/);
});

test('Unicode and XML punctuation survive, while invalid XML characters are removed', () => {
  const { state, contribution } = fixture();
  state.contact.name = 'José 李 & <Rivera> "Test"\u0000\ud800';
  contribution.text = 'Created español résumé examples and a café guide 🌱.';
  const zip = entries(E.docx(state));
  assert.match(zip['word/document.xml'], /José 李 &amp; &lt;Rivera&gt; &quot;Test&quot;/);
  assert.match(zip['word/document.xml'], /español résumé examples and a café guide 🌱/u);
  assert.doesNotMatch(zip['word/document.xml'], /\u0000|\ud800/u);
  assert.match(E.text(state), /Created español/);
});

test('contact hyperlinks are explicit, escaped, and limited to safe web or email targets', () => {
  const { state } = fixture();
  let zip = entries(E.docx(state));
  assert.match(zip['word/document.xml'], /<w:hyperlink r:id="contact1"/);
  assert.match(zip['word/_rels/document.xml.rels'], /Target="mailto:jose@example.com"/);
  assert.match(zip['word/_rels/document.xml.rels'], /Target="https:\/\/linkedin.com\/in\/jose-example"/);
  assert.match(zip['word/_rels/document.xml.rels'], /q=one&amp;category=two/);
  state.contact.linkedin = 'javascript:alert(1)';
  state.contact.portfolio = 'https://user:password@example.org/path';
  state.contact.email = 'jose@example.com?bcc=other@example.org';
  zip = entries(E.docx(state));
  assert.doesNotMatch(zip['word/_rels/document.xml.rels'], /javascript|password|bcc=|hyperlink/);
  assert.match(zip['word/document.xml'], /javascript:alert\(1\)/, 'Unsafe link remains ordinary text');
});

test('subtitle and first bullet stay together without chaining all bullets into an unbreakable block', () => {
  const { state, contribution, experience, variant } = fixture();
  const extra = C.contribution(); extra.text = 'Created a second deliverable.';
  experience.contributions.push(extra); variant.contributionIds.push(extra.id);
  const xml = entries(E.docx(state))['word/document.xml'];
  const paragraphs = xml.match(/<w:p>[\s\S]*?<\/w:p>/g);
  const roleIndex = paragraphs.findIndex(paragraph => paragraph.includes('Research Lead'));
  assert.match(paragraphs[roleIndex], /<w:keepNext w:val="1"\/>/);
  assert.match(paragraphs[roleIndex + 1], /<w:pStyle w:val="Subtitle"\/><w:keepNext w:val="1"\/>/);
  assert.match(paragraphs[roleIndex + 2], /86 survey responses/);
  assert.doesNotMatch(paragraphs[roleIndex + 2], /<w:keepNext/);
  assert.ok(contribution.id);
});

test('variant overrides, section order, font, density and Letter or A4 page size control exports', () => {
  const { state, contribution, variant } = fixture();
  const second = C.variantFactory('Second version');
  Object.assign(second, { contributionIds: [contribution.id], skillIds: [], headline: 'Marketing intern', summary: 'A focused project portfolio.', order: ['projects', 'education', 'experience', 'leadership', 'skills', 'extras'], style: 'classic', density: 'compact', paperSize: 'a4', overrides: { [contribution.id]: 'Presented an actionable research brief.' } });
  state.variants.push(second);
  const zip = entries(E.docx(state, second.id)), plain = E.text(state, second.id);
  assert.match(zip['word/document.xml'], /w:w="11906" w:h="16838"/);
  assert.match(zip['word/styles.xml'], /w:ascii="Georgia"/);
  assert.match(zip['word/styles.xml'], /<w:sz w:val="21"\/>/);
  assert.match(plain, /Presented an actionable research brief/);
  assert.doesNotMatch(plain, /86 survey responses|Excel \(pivot tables\)/);
  assert.ok(plain.indexOf('Projects') < plain.indexOf('Education'));
  assert.match(entries(E.docx(state, variant.id))['word/document.xml'], /w:w="12240" w:h="15840"/);
  assert.equal(contribution.text, 'Analyzed 86 survey responses in Excel to identify three purchase barriers.');
});

test('interview practice exports include selected public bullets, with private notes only on explicit true', () => {
  const { state, contribution, variant } = fixture();
  variant.overrides[contribution.id] = 'Presented a research brief to the café owner.';
  const standard = E.interviewText(state), explicit = E.interviewText(state, true);
  assert.match(standard, /Presented a research brief/);
  assert.doesNotMatch(standard, /PRIVATE_|HIDDEN_LIBRARY_CLAIM|86 survey responses/);
  assert.match(explicit, /PRIVATE_EVIDENCE_731/);
  assert.match(explicit, /PRIVATE_STAR_733/);
  assert.match(explicit, /PRIVATE_LESSON_737/);
  assert.doesNotMatch(E.interviewText(state, 'true'), /PRIVATE_/);
});

test('ZIP bytes use known CRC32 and round-trip Unicode file names and payloads', () => {
  assert.equal(E.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bytes = E.zip([['résumé.txt', 'José Núñez & 東京']]);
  assert.equal(entries(bytes)['résumé.txt'], 'José Núñez & 東京');
  assert.throws(() => E.zip([['same.txt', 'one'], ['same.txt', 'two']]), /Invalid export file name/);
});
