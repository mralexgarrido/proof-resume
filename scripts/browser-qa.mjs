// Optional development verification. Playwright and a Chromium installation are
// supplied by the tester; neither is included in the application or its build.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const modulePath=process.env.PROOF_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
const {chromium}=require(modulePath);
const root=new URL('../',import.meta.url), html=await readFile(new URL('index.html',root));
const output=process.env.PROOF_QA_OUTPUT || await mkdtemp(join(tmpdir(),'proof-browser-qa-'));
await mkdir(output,{recursive:true});
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.PROOF_CHROMIUM_PATH?{executablePath:process.env.PROOF_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const errors=[],requests=[];
let checks=0;
const pass=message=>{checks++;console.log('PASS '+message);};
async function setup(init) {
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
  context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));});
  if(init)await context.addInitScript(init);
  const page=await context.newPage();page.setDefaultTimeout(6000);await page.goto(origin);return {context,page};
}
const button=(p,action,extra='')=>p.locator('[data-action="'+action+'"]'+extra).first();
const field=(p,entity,key,id)=>p.locator('[data-entity="'+entity+'"][data-key="'+key+'"]'+(id?'[data-id="'+id+'"]':''));
async function nav(p,name){await button(p,'navigate','[data-page="'+name+'"]').click();}
async function edit(p){if(await button(p,'edit-contribution').getAttribute('aria-expanded')!=='true')await button(p,'edit-contribution').click();}
async function stored(p){try{await p.waitForFunction(()=>document.querySelector('#status-label').textContent==='Saved');}catch(error){console.log(await p.evaluate(()=>({status:document.querySelector('#status-label').textContent,toast:document.querySelector('#toast').textContent,banner:document.querySelector('.notice')?.textContent})));throw error;}return p.evaluate(()=>JSON.parse(localStorage.getItem('proof-resume-v2')));}
async function download(p,action,extra=''){
  const event=p.waitForEvent('download');await button(p,action,extra).click();const d=await event;
  const path=join(output,d.suggestedFilename());await d.saveAs(path);return {path,bytes:await readFile(path)};
}
async function importFile(p,kind,data){
  await button(p,kind).click();await p.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
}
try {
  const {page:p,context}=await setup();
  // Regression: clearing a memory after switching a prompt must not restore it.
  await button(p,'discover-source','[data-source="course"]').click();
  await p.locator('#discovery-memory').fill('A memory I will delete');
  await p.locator('#modal summary').first().click();await button(p,'discovery-lens').click();
  await p.locator('#discovery-memory').fill('');await button(p,'capture-memory').click();
  assert.equal(await p.locator('#modal').getAttribute('open'),'');
  assert.equal(await p.locator('#discovery-memory').inputValue(),'');
  await p.locator('#discovery-memory').fill('Analyzed 24 survey responses');
  await button(p,'capture-memory').click();
  const cid=await field(p,'contribution','action').getAttribute('data-id');
  assert.equal(await field(p,'contribution','text').inputValue(),'');
  await field(p,'contribution','method').fill('Excel pivot tables');
  await field(p,'contribution','result').fill('identified two recurring concerns');
  await button(p,'build-bullet','[data-mode="action"]').click();
  assert.match(await p.locator('#assembled-bullet').inputValue(),/24.*Excel.*two recurring/);
  await button(p,'apply-bullet').click();
  await p.locator('.contribution-edit details').first().locator('summary').click();
  await button(p,'detail-prompts').click();await button(p,'return-to-contribution').click();
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.key),'action');
  if(await button(p,'toggle-experience').getAttribute('aria-expanded')!=='true')await button(p,'toggle-experience').click();
  await field(p,'experience','role').fill('Student researcher');
  await field(p,'experience','organization').fill('Fictional University research course');
  await field(p,'experience','dates').fill('Fall 2026');
  await field(p,'experience','status').selectOption('coursework');
  const privateSection=p.locator('details').filter({has:p.locator('[data-key="evidence"]')});
  await privateSection.locator('summary').click();
  await field(p,'contribution','evidence').fill('PRIVATE_EVIDENCE_SENTINEL_482');
  await field(p,'contribution','reflection').fill('PRIVATE_REFLECTION_SENTINEL_483');
  await field(p,'contribution','reviewed').check();
  await nav(p,'details');await field(p,'contact','name').fill('Jordan García');await field(p,'contact','email').fill('jordan@example.com');
  await nav(p,'education');await button(p,'add-education').click();
  await field(p,'education','school').fill('Fictional University');await field(p,'education','degree').fill('BBA in Marketing');await field(p,'education','dates').fill('Expected May 2027');
  await nav(p,'skills');await button(p,'add-skill').click();await field(p,'skill','name').fill('Excel (pivot tables)');
  await field(p,'skill','practice').selectOption('independent');
  await p.locator('.skills-card details summary').click();
  await p.locator('[data-entity="skill-link"]').check();
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.entity),'skill-link');
  const first=await stored(p);assert.equal(first.experiences[0].contributions[0].reviewed,true);
  assert.deepEqual(first.skills[0].contributionIds,[cid]);pass('rough memory to supported bullet, education and linked skill; keyboard focus retained');
  await nav(p,'versions');await button(p,'new-variant').click();await p.locator('#new-variant-name').fill('Research internship');await button(p,'confirm-new-variant').click();
  await nav(p,'library');await edit(p);await button(p,'version-wording').click();
  await field(p,'override','text').fill('Compared 24 survey responses in Excel to identify two recurring concerns.');
  assert.equal(await p.locator('[data-entity="override-review"]').isChecked(),false);
  await p.locator('[data-entity="override-review"]').check();await button(p,'close-wording').click();
  await nav(p,'versions');await field(p,'variant','jobDescription').fill('Analyze survey data using Excel. Present findings clearly.');
  await button(p,'add-requirement').click();await p.locator('#requirement-text').fill('Analyze survey data using Excel');await button(p,'confirm-requirement').click();
  await p.locator('.requirement-card details summary').click();await p.locator('[data-entity="requirement-link"]').check();
  assert.match(await p.locator('.requirement-head .tag').textContent(),/Evidence included/);
  let s=await stored(p);assert.equal(s.variants.length,2);assert.equal(s.variants[0].overrides[cid],undefined);assert.equal(s.variants[1].reviewedOverrides[0],cid);
  assert.equal(s.experiences[0].contributions[0].text,first.experiences[0].contributions[0].text);
  pass('resume versions isolate adapted wording and reviews; requirement mapping uses selected evidence');
  await nav(p,'interview');await field(p,'interview','situation').fill('PRIVATE_INTERVIEW_SENTINEL_484');
  await button(p,'timer').click();await p.waitForFunction(()=>document.querySelector('#timer-display').textContent!=='00:00');await button(p,'timer').click();await button(p,'timer-reset').click();
  await button(p,'interview-export').click();assert.equal(await p.locator('#include-private-interview').isChecked(),false);
  const defaultInterview=await download(p,'confirm-interview-export');assert.doesNotMatch(defaultInterview.bytes.toString(),/PRIVATE_/);
  await button(p,'interview-export').click();await p.locator('#include-private-interview').check();
  const privateInterview=await download(p,'confirm-interview-export');assert.match(privateInterview.bytes.toString(),/PRIVATE_INTERVIEW_SENTINEL/);
  await nav(p,'finish');
  const text=await download(p,'export-text'),word=await download(p,'export-word'),peer=await download(p,'peer-review');
  for(const bytes of [text.bytes,word.bytes,peer.bytes])assert.doesNotMatch(bytes.toString(),/PRIVATE_/);
  assert.match(text.bytes.toString(),/Compared 24/);assert.equal(word.bytes.readUInt32LE(0),0x04034b50);
  await p.evaluate(()=>{window.print=()=>{};});await button(p,'print').click();
  assert.doesNotMatch(await p.locator('#print-root').textContent(),/PRIVATE_/);
  await p.emulateMedia({media:'print'});await p.pdf({path:join(output,'resume-print.pdf'),preferCSSPageSize:true});await p.emulateMedia({media:'screen'});
  pass('actual Word, text, peer review, PDF print and interview downloads respect private-note boundaries');
  const backup=await download(p,'backup');const backupState=JSON.parse(backup.bytes.toString());assert.match(backup.bytes.toString(),/PRIVATE_INTERVIEW_SENTINEL/);assert.equal(backupState.variants.length,2);
  await p.reload();await nav(p,'finish');assert.match(await p.locator('#resume-preview').textContent(),/Compared 24/);
  await button(p,'data').click();const clean=await download(p,'offline');
  assert.doesNotMatch(clean.bytes.toString(),/PRIVATE_|Jordan García|jordan@example.com|Compared 24/);
  const offlineContext=await browser.newContext();const offlinePage=await offlineContext.newPage();await offlinePage.goto('file://'+clean.path);assert.equal(await offlinePage.locator('.source-card').count(),6);await offlineContext.close();await button(p,'close-modal').click();
  pass('project backup and reload retain all links and notes; offline app download contains no student data');
  await nav(p,'library');await edit(p);await button(p,'remove-contribution').click();await button(p,'confirm-remove-contribution').click();
  s=await stored(p);assert.equal(s.experiences[0].contributions.length,0);assert.equal(s.skills[0].contributionIds.length,0);assert.equal(s.variants[1].requirements[0].contributionIds.length,0);
  await button(p,'undo').click();s=await stored(p);assert.equal(s.skills[0].contributionIds[0],cid);assert.equal(s.variants[1].requirements[0].contributionIds[0],cid);
  await button(p,'snapshot').click();await p.locator('#snapshot-name').fill('Ready for adviser');await button(p,'confirm-snapshot').click();
  await nav(p,'details');await field(p,'contact','name').fill('Temporary name');await stored(p);
  await button(p,'data').click();await button(p,'restore-snapshot').click();await button(p,'confirm-restore-snapshot').click();
  s=await stored(p);assert.equal(s.contact.name,'Jordan García');pass('removal cleans references; undo and named restore points recover complete project');
  await nav(p,'library');const handoff={app:'proof-evidence',version:1,title:'Fictional campaign simulator',source:'course',status:'simulation',contributions:[{action:'Prepared a campaign plan',result:'documented audience choices',evidence:'PRIVATE_HANDOFF_SENTINEL'}]};
  await importFile(p,'import-assignment',{...handoff,status:'invalid'});await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('unsupported choice'));
  assert.equal((await stored(p)).experiences.length,1);
  await importFile(p,'import-assignment',handoff);await p.waitForFunction(()=>document.querySelector('#modal').open&&document.querySelector('#modal-title').textContent==='Review the assignment before adding it.');assert.match(await p.locator('#modal').textContent(),/Fictional campaign simulator/);await button(p,'confirm-import').click();
  s=await stored(p);const imported=s.experiences[1].contributions[0];assert.equal(imported.reviewed,false);assert.equal(s.variants[1].contributionIds.includes(imported.id),false);assert.doesNotMatch(await p.locator('#resume-preview').textContent(),/Prepared a campaign/);
  await p.locator('[data-entity="selection"][data-id="'+imported.id+'"]').check();assert.match(await p.locator('#resume-preview').textContent(),/Simulation/);assert.doesNotMatch(await p.locator('#resume-preview').textContent(),/PRIVATE_/);
  pass('assignment import validates, previews and preserves simulation status; selection remains the student choice');
  await button(p,'data').click();await importFile(p,'import-backup',backupState);await p.waitForFunction(()=>document.querySelector('#modal-title').textContent==='Review this project backup.');await button(p,'confirm-import').click();s=await stored(p);assert.equal(s.experiences.length,1);assert.equal(s.variants.length,2);assert.equal(s.experiences[0].contributions[0].interview.situation,'PRIVATE_INTERVIEW_SENTINEL_484');
  await button(p,'data').click();await p.locator('#remember-toggle').uncheck();
  assert.equal(await p.evaluate(()=>localStorage.getItem('proof-resume-v2')),null);assert.equal(await p.locator('#status-label').textContent(),'Session only');
  await button(p,'close-modal').click();await nav(p,'finish');const sessionBackup=await download(p,'backup');assert.match(sessionBackup.bytes.toString(),/Jordan García/);
  await p.reload();assert.equal(await p.locator('#status-label').textContent(),'Session only');assert.doesNotMatch(await p.locator('#resume-preview').textContent(),/Jordan/);
  pass('backup replacement restores all variants; shared-device mode clears saved copies and still exports');
  await context.close();
  // Multi-tab: each tab retains unsaved edits until an explicit choice.
  const pair=await setup(),a=pair.page;await nav(a,'details');await field(a,'contact','name').fill('First tab');await stored(a);
  await a.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'proof-resume-v2',newValue:'stale queued notification'})));assert.equal(await a.locator('#status-label').textContent(),'Saved');
  const b=await pair.context.newPage();await b.goto(origin);await nav(b,'details');await field(b,'contact','name').fill('Second tab');await stored(b);
  await a.waitForFunction(()=>document.querySelector('#status-label').textContent==='Review changes');assert.equal(await field(a,'contact','name').inputValue(),'First tab');
  await button(a,'keep-current').click();await button(a,'confirm-keep-current').click();assert.equal((await stored(a)).contact.name,'First tab');
  await b.waitForFunction(()=>document.querySelector('#status-label').textContent==='Review changes');await button(b,'load-other').click();await button(b,'confirm-load-other').click();assert.equal(await field(b,'contact','name').inputValue(),'First tab');
  for(const [tab,name]of [[a,'First tab checkpoint'],[b,'Second tab checkpoint']]){await button(tab,'snapshot').click();await tab.locator('#snapshot-name').fill(name);await button(tab,'confirm-snapshot').click();}
  assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('proof-resume-recovery-v2')).map(x=>x.name)),['First tab checkpoint','Second tab checkpoint']);
  await button(a,'data').click();assert.equal(await a.locator('.snapshot-row').count(),2);await pair.context.close();
  pass('two-tab conflict detection preserves both drafts and requires explicit resolution');
  const quota=await setup(()=>{const original=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(k,v){if(k==='proof-resume-v2'&&fail)throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,k,v);};window.proofAllowSave=()=>{fail=false;};});
  await nav(quota.page,'details');await field(quota.page,'contact','name').fill('Recovered after quota');await quota.page.waitForFunction(()=>document.querySelector('#status-label').textContent==='Backup needed');
  await quota.page.evaluate(()=>window.proofAllowSave());await field(quota.page,'contact','email').fill('recovered@example.com');assert.equal((await stored(quota.page)).contact.name,'Recovered after quota');await quota.context.close();pass('storage failure leaves edits available and later saving recovers without a false conflict');
  const corrupt=await setup({content:'if(location.protocol==="http:")localStorage.setItem("proof-resume-v2","{Original recovery bytes}");'});
  assert.equal(await corrupt.page.locator('#status-label').textContent(),'Session only');assert.match(await corrupt.page.locator('.notice').textContent(),/could not be opened/);
  const raw=await download(corrupt.page,'recover-raw');assert.equal(raw.bytes.toString(),'{Original recovery bytes}');assert.equal(await corrupt.page.evaluate(()=>localStorage.getItem('proof-resume-v2')),'{Original recovery bytes}');await corrupt.context.close();pass('corrupt saved data remains intact and can be downloaded without an automatic overwrite');
  const legacy={app:'proof-resume',version:1,contact:{name:'Legacy student'},education:[],experiences:[{id:'old-course',source:'course',section:'projects',role:'Student',organization:'Course project',bullets:'Analyzed survey results.\nPresented two recommendations.',evidence:'PRIVATE_LEGACY_NOTE',include:true,verified:true}],skills:{tools:'Excel (charts, tables)',methods:'',languages:''},extras:'',order:['education','experience','projects','leadership','skills','extras'],style:'classic',density:'compact',remember:true};
  const migrated=await setup({content:'if(location.protocol==="http:")localStorage.setItem("proof-resume-v1",'+JSON.stringify(JSON.stringify(legacy))+');'});
  const ms=await stored(migrated.page);assert.equal(ms.version,2);assert.equal(ms.experiences[0].contributions.length,2);assert.equal(ms.experiences[0].contributions[0].evidence,'PRIVATE_LEGACY_NOTE');assert.equal(ms.skills[0].name,'Excel (charts, tables)');assert.equal(ms.variants[0].style,'classic');await migrated.context.close();pass('existing browser draft migrates v1 bullets, notes, skill context and presentation without data loss');
  const responsive=await setup();const rp=responsive.page;
  for(const width of [320,390,768,1440]){
    await rp.setViewportSize({width,height:950});
    for(const name of ['discover','details','education','library','skills','versions','interview','finish']){
      await nav(rp,name);assert.equal(await rp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width+' on '+name);
    }
    assert.equal(await rp.locator('#save-state').isVisible(),true);assert.equal(await rp.locator('#progress-text').isVisible(),true);
  }
  await rp.setViewportSize({width:390,height:900});await nav(rp,'discover');await rp.screenshot({path:join(output,'mobile-start.png'),fullPage:true});
  await rp.setViewportSize({width:1440,height:1000});await rp.screenshot({path:join(output,'desktop-start.png'),fullPage:true});
  await button(rp,'examples').click();const example=button(rp,'example','[data-index="3"]');await example.focus();await example.press('Enter');assert.equal(await rp.evaluate(()=>document.activeElement.dataset.index),'3');await button(rp,'close-modal').click();
  await nav(rp,'library');await rp.locator('#library-search').fill('survey');await nav(rp,'skills');await rp.waitForTimeout(250);
  await rp.evaluate(()=>localStorage.setItem('proof-resume-v2',JSON.stringify(ProofCore.sample())));await rp.reload();
  await nav(rp,'library');await edit(rp);await rp.evaluate(()=>window.scrollTo(0,0));await rp.screenshot({path:join(output,'proof-preview.png')});
  for(const width of [320,390,768]){
    await rp.setViewportSize({width,height:950});
    for(const name of ['library','skills','versions','interview','finish']){await nav(rp,name);assert.equal(await rp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'populated overflow at '+width+' on '+name);}
    await button(rp,'preview').click();assert.equal(await rp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await button(rp,'close-modal').click();
  }
  await rp.setViewportSize({width:390,height:950});await nav(rp,'library');await rp.screenshot({path:join(output,'mobile-evidence.png'),fullPage:true});
  await responsive.context.close();pass('all eight sections fit 320, 390, 768 and 1440 px; mobile save/progress and dialog keyboard focus remain visible');
  assert.deepEqual(errors,[]);assert.equal(requests.every(url=>url===origin+'/'),true,'unexpected resource request: '+requests.filter(url=>url!==origin+'/').join(', '));
  pass('no page errors or application network requests across the browser regression');
  console.log(checks+' browser scenarios passed. QA artifacts: '+output);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
