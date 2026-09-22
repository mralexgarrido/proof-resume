import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="proof-core">([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({TextEncoder,Uint8Array,DataView,crypto});
vm.runInContext(script + '\nthis.core = ProofCore;', ctx);
const C = ctx.core;
function entries(bytes) {
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), result = {};
 let p=0;
 while(view.getUint32(p,true)===0x04034b50){
  const size=view.getUint32(p+18,true),nameLen=view.getUint16(p+26,true),extra=view.getUint16(p+28,true);
  const name=new TextDecoder().decode(bytes.subarray(p+30,p+30+nameLen));
  const start=p+30+nameLen+extra,data=bytes.subarray(start,start+size);
  assert.equal(C.crc32(data),view.getUint32(p+14,true),'ZIP CRC must match');
  result[name]=new TextDecoder().decode(data);p=start+size;
 }
 assert.equal(view.getUint32(p,true),0x02014b50,'ZIP central directory exists');
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50,'ZIP end record exists');
 return result;
}
test('draft assembly uses only supplied evidence and leaves unknown outcomes absent',()=>{
 const e=C.experience();e.action='Created a survey';e.method='Google Forms';
 assert.equal(C.draft(e),'Created a survey using Google Forms.');
 assert.equal(C.draft(C.experience()),'');
 assert.doesNotMatch(C.draft(e),/increased|improved|\d/);
});
test('private reflections and hidden experiences never enter Word export',()=>{
 const s=C.sample();s.experiences[0].evidence='PRIVATE_EVIDENCE_283';s.experiences[0].reflection='PRIVATE_REFLECTION_929';
 s.experiences[1].include=false;s.experiences[1].bullets='HIDDEN_EXPERIENCE_789';
 const z=entries(C.docx(s));
 assert.doesNotMatch(JSON.stringify(z),/PRIVATE_|HIDDEN_EXPERIENCE/);
 assert.match(z['word/document.xml'],/survey responses/);
});
test('Word export contains editable paragraphs, semantic headings and true bullets',()=>{
 const z=entries(C.docx(C.sample()));assert.equal(Object.keys(z).length,7);
 assert.match(z['word/document.xml'],/<w:pStyle w:val="Heading1"/);
 assert.match(z['word/document.xml'],/<w:numPr>/);
 assert.match(z['word/numbering.xml'],/w:numFmt w:val="bullet"/);
 assert.doesNotMatch(z['word/document.xml'],/<w:tbl|<w:drawing|<w:txbxContent/);
});
test('Unicode and XML punctuation remain safe in content and Word export',()=>{
 const s=C.blank();s.contact.name='José Núñez & <Rivera>';s.skills.languages='Español';
 const z=entries(C.docx(s));assert.match(z['word/document.xml'],/José Núñez &amp; &lt;Rivera&gt;/);
 assert.match(z['word/document.xml'],/Español/);
 assert.equal(C.esc('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
});
test('backup validation rejects unsupported files and normalizes untrusted values',()=>{
 assert.throws(()=>C.normalize({app:'other',version:1}),/valid Proof backup/);
 const s=C.sample();s.order=['skills'];s.experiences[0].source='__proto__';s.experiences[0].section='bogus';s.contact.name='Jordan\u0000Rivera';
 const restored=C.normalize(JSON.parse(JSON.stringify(s)));
 assert.equal(restored.order.length,6);assert.equal(restored.experiences[0].source,'work');
 assert.equal(restored.contact.name,'JordanRivera');
 assert.throws(()=>C.normalize({...s,experiences:Array(61).fill({})}),/too many/);
});
test('export follows section order and omits empty sections',()=>{
 const s=C.sample();s.order=['skills','education','projects','experience','leadership','extras'];
 const text=entries(C.docx(s))['word/document.xml'];assert.ok(text.indexOf('>Skills<')<text.indexOf('>Education<'));
 assert.doesNotMatch(text,/Additional Highlights/);
});
test('template is a usable skeleton, while sample is explicitly separate from blank state',()=>{
 assert.equal(C.blank().experiences.length,0);assert.ok(C.content(C.template()).sections.length>=3);
 assert.equal(C.assessments(C.blank()).filter(x=>x.ready).length,0);
 assert.equal(C.assessments(C.sample()).filter(x=>x.ready).length,5);
});
test('production source prevents connections and contains no external runtime assets',()=>{
 assert.match(html,/connect-src 'none'/);assert.match(html,/font-src 'none'/);
 assert.doesNotMatch(html,/<(?:script|img|iframe)[^>]+src=["']https?:/);
 assert.doesNotMatch(html,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bsendBeacon\s*\(/);
});
