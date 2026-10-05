// Optional focused browser regressions. Playwright and Chromium are supplied
// by the tester and are never shipped with the offline application.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const modulePath=process.env.PROOF_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
const {chromium}=require(modulePath);
const html=await readFile(new URL('../index.html',import.meta.url));
const server=createServer((request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.PROOF_CHROMIUM_PATH?{executablePath:process.env.PROOF_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const errors=[];
let checks=0;
const pass=message=>{checks++;console.log('PASS '+message);};
const button=(page,action,scope='')=>page.locator(scope+'[data-action="'+action+'"]');
const field=(page,entity,key)=>page.locator('[data-entity="'+entity+'"][data-key="'+key+'"]');
async function setup(fixture) {
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});
  if(fixture)await context.addInitScript(fixture=>{
    if(location.protocol==='http:'&&!localStorage.getItem('proof-resume-v2')) {
      localStorage.setItem('proof-resume-v2',JSON.stringify(fixture.state));
      if(fixture.history!==undefined)localStorage.setItem('proof-resume-recovery-v2',fixture.history);
    }
  },fixture);
  const page=await context.newPage();page.setDefaultTimeout(6000);
  page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);
  return {page,context};
}
async function navigate(page,name){await page.locator('#steps [data-page="'+name+'"]').click();}
async function saved(page){await page.waitForFunction(()=>document.querySelector('#status-label').textContent==='Saved');return page.evaluate(()=>JSON.parse(localStorage.getItem('proof-resume-v2')));}
async function downloadedState(downloading) {
  const file=await downloading;
  const stream=await file.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function backup(page) {
  await button(page,'data').first().click();
  const downloading=page.waitForEvent('download');await button(page,'backup','#modal ').click();
  const state=await downloadedState(downloading);
  await button(page,'close-modal','#modal ').click();return state;
}
const handoff=title=>({app:'proof-evidence',version:1,title,source:'course',status:'simulation',contributions:[{action:'Analyzed a local dataset'}]});
async function deferredReads(page) {
  await page.evaluate(()=>{
    const original=File.prototype.text;window.proofQaReads={};
    File.prototype.text=async function(){
      const contents=await original.call(this);
      return new Promise((resolve,reject)=>{window.proofQaReads[this.name]={resolve:()=>resolve(contents),reject:()=>reject(new Error('Stale read failed'))};});
    };
  });
}
async function startImport(page,mode,name,data) {
  if(!await page.locator('#modal').evaluate(dialog=>dialog.open))await button(page,'data').first().click();
  await button(page,'import-'+mode,'#modal ').click();
  await page.locator('#import-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(name=>Boolean(window.proofQaReads?.[name]),name);
}
async function finishRead(page,name,result='resolve') {
  await page.evaluate(({name,result})=>window.proofQaReads[name][result](),{name,result});
  // A browser task boundary ensures both the read continuation and a possible
  // stale catch handler have completed before asserting the visible dialog.
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
}
try {
  const first=await setup(),page=first.page;
  await navigate(page,'details');
  assert.equal(await button(page,'undo').isDisabled(),true);
  await field(page,'contact','name').fill('Name\u000bwith copied separator');
  assert.equal(await button(page,'undo').isDisabled(),false);
  let state=await saved(page);
  assert.equal(state.contact.name,'Name with copied separator');
  assert.equal((await backup(page)).contact.name,state.contact.name);
  assert.equal(await button(page,'undo').isDisabled(),false);
  await button(page,'undo').click();assert.equal(await field(page,'contact','name').inputValue(),'');
  assert.equal(await button(page,'redo').isDisabled(),false);
  await button(page,'redo').click();assert.equal(await field(page,'contact','name').inputValue(),'Name with copied separator');
  await button(page,'undo').click();await field(page,'contact','name').fill('A replacement edit');
  assert.equal(await button(page,'redo').isDisabled(),true);
  state=await saved(page);assert.equal(state.contact.name,'A replacement edit');
  await page.reload();await navigate(page,'details');assert.equal(await field(page,'contact','name').inputValue(),'A replacement edit');
  pass('copied controls leave saving and backups usable; first edit enables Undo and new edits clear Redo');
  await navigate(page,'discover');await button(page,'discover-source').first().click();
  await page.locator('#discovery-memory').fill('Organized\u000bproject notes');
  await button(page,'capture-memory','#modal ').click();state=await saved(page);
  assert.equal(state.experiences[0].contributions[0].action,'Organized project notes');
  assert.equal((await backup(page)).experiences[0].contributions[0].action,'Organized project notes');
  pass('modal memory input cannot introduce an unsavable hidden character');
  const fixture=await page.evaluate(()=>ProofCore.blank());
  const originalProject=await page.evaluate(()=>{
    const state=ProofCore.sample();state.contact.name='Original project before replacement';
    state.experiences[0].contributions[0].evidence='PORTABLE_RECOVERY_PRIVATE_NOTE';return state;
  });
  await first.context.close();

  const recovery=await setup({state:{...fixture,contact:{...fixture.contact,name:'Valid stored project'}},history:'not valid JSON'});
  await navigate(recovery.page,'details');
  assert.equal(await field(recovery.page,'contact','name').inputValue(),'Valid stored project');
  await field(recovery.page,'contact','name').fill('Edits survive damaged history');
  state=await saved(recovery.page);assert.equal(state.contact.name,'Edits survive damaged history');
  await recovery.page.reload();await navigate(recovery.page,'details');
  assert.equal(await field(recovery.page,'contact','name').inputValue(),'Edits survive damaged history');
  assert.equal((await backup(recovery.page)).contact.name,'Edits survive damaged history');
  pass('damaged restore-point history cannot disable saving or recovery of a valid main project');
  await recovery.context.close();

  const fresh=await setup({state:originalProject,history:'damaged reset history'});
  await button(fresh.page,'data').first().click();await button(fresh.page,'reset','#modal ').click();
  const resetDownload=fresh.page.waitForEvent('download');await button(fresh.page,'confirm-reset','#modal ').click();
  const beforeReset=await downloadedState(resetDownload);
  assert.equal(beforeReset.contact.name,originalProject.contact.name);
  assert.equal(beforeReset.experiences[0].contributions[0].evidence,'PORTABLE_RECOVERY_PRIVATE_NOTE');
  assert.match(await fresh.page.locator('#toast').textContent(),/backup/i);
  state=await saved(fresh.page);assert.equal(state.contact.name,'');assert.equal(state.experiences.length,0);
  assert.equal(await fresh.page.evaluate(()=>localStorage.getItem('proof-resume-recovery-v2')),'damaged reset history');
  await fresh.page.reload();assert.equal((await saved(fresh.page)).contact.name,'');
  pass('starting fresh with damaged history first downloads the complete original project and then saves a valid blank');
  await fresh.context.close();

  const replacementProject=await setup({state:originalProject,history:'damaged replacement history'});
  const incoming={...fixture,contact:{...fixture.contact,name:'Incoming replacement project'}};
  await button(replacementProject.page,'data').first().click();
  await button(replacementProject.page,'import-backup','#modal ').click();
  await replacementProject.page.locator('#import-file').setInputFiles({name:'replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
  await replacementProject.page.waitForFunction(()=>document.querySelector('#modal-title').textContent==='Review this project backup.');
  const replacementDownload=replacementProject.page.waitForEvent('download');
  await button(replacementProject.page,'confirm-import','#modal ').click();
  const beforeReplacement=await downloadedState(replacementDownload);
  assert.equal(beforeReplacement.contact.name,originalProject.contact.name);
  assert.equal(beforeReplacement.experiences[0].contributions[0].evidence,'PORTABLE_RECOVERY_PRIVATE_NOTE');
  assert.match(await replacementProject.page.locator('#toast').textContent(),/backup/i);
  state=await saved(replacementProject.page);assert.equal(state.contact.name,incoming.contact.name);assert.equal(state.experiences.length,0);
  assert.equal(await replacementProject.page.evaluate(()=>localStorage.getItem('proof-resume-recovery-v2')),'damaged replacement history');
  await replacementProject.page.reload();assert.equal((await saved(replacementProject.page)).contact.name,incoming.contact.name);
  pass('opening a backup with damaged history first downloads the original project before committing the replacement');
  await replacementProject.context.close();

  const requirement=await setup(),opportunity=requirement.page;
  await navigate(opportunity,'versions');
  const description=field(opportunity,'variant','jobDescription');
  await description.fill('Analyze customer research. '.repeat(220));await saved(opportunity);
  await description.evaluate(input=>{input.focus();input.setSelectionRange(0,input.value.length);});
  await button(opportunity,'add-requirement').click();
  if(await opportunity.locator('#modal').evaluate(dialog=>dialog.open)) {
    await button(opportunity,'confirm-requirement','#modal ').click();
    assert.equal(await opportunity.locator('#modal').evaluate(dialog=>dialog.open),true,'An overlong selection must be shortened explicitly before adding');
    assert.equal((await opportunity.evaluate(()=>JSON.parse(localStorage.getItem('proof-resume-v2')))).variants[0].requirements.length,0);
    await opportunity.locator('#requirement-text').fill('Analyze customer research');
  } else {
    await description.evaluate(input=>{input.focus();input.setSelectionRange(0,25);});
    await button(opportunity,'add-requirement').click();
  }
  await button(opportunity,'confirm-requirement','#modal ').click();state=await saved(opportunity);
  assert.equal(state.variants[0].requirements.length,1);
  assert.ok(state.variants[0].requirements[0].text.length<=4000);
  assert.equal((await backup(opportunity)).variants[0].requirements.length,1);
  pass('large opportunity selections cannot introduce an unsavable requirement or silently shorten it');
  await requirement.context.close();

  const revision=await setup({state:{...fixture,revision:Number.MAX_SAFE_INTEGER}});
  await navigate(revision.page,'details');await field(revision.page,'contact','name').fill('Revision boundary edit');
  await revision.page.waitForFunction(()=>document.querySelector('#status-label').textContent!=='Saving');
  const persisted=await revision.page.evaluate(()=>JSON.parse(localStorage.getItem('proof-resume-v2')));
  assert.ok(Number.isSafeInteger(persisted.revision),'Saving may not persist a revision rejected by its own schema');
  await revision.page.evaluate(()=>ProofCore.normalize(JSON.parse(localStorage.getItem('proof-resume-v2'))));
  assert.equal((await backup(revision.page)).contact.name,'Revision boundary edit');
  pass('the largest accepted revision cannot overflow into an unreadable saved project');
  await revision.context.close();

  const unicode=await setup();await navigate(unicode.page,'versions');
  const longName='x'.repeat(394)+'😀'+'xxxx';
  await field(unicode.page,'variant','name').fill(longName);await saved(unicode.page);
  await button(unicode.page,'duplicate-variant').click();state=await saved(unicode.page);
  assert.equal(state.variants.length,2);
  assert.equal(state.variants[0].name,longName);assert.match(state.variants[1].name,/ copy$/);
  assert.ok(state.variants[1].name.length<=400);
  await unicode.page.evaluate(()=>ProofCore.normalize(JSON.parse(localStorage.getItem('proof-resume-v2'))));
  assert.equal((await backup(unicode.page)).variants.length,2);
  pass('duplicating a maximum-length Unicode version name preserves the source and never splits an emoji');
  await unicode.context.close();

  const cancel=await setup();await deferredReads(cancel.page);
  await startImport(cancel.page,'assignment','cancelled.json',handoff('Cancelled project'));
  await cancel.page.keyboard.press('Escape');assert.equal(await cancel.page.locator('#modal').evaluate(dialog=>dialog.open),false);
  await finishRead(cancel.page,'cancelled.json');assert.equal(await cancel.page.locator('#modal').evaluate(dialog=>dialog.open),false);
  assert.equal(await cancel.page.locator('.contribution').count(),0);
  pass('closing an import while its file is reading cannot reopen a cancelled preview');
  await cancel.context.close();

  const replacement=await setup(),later=replacement.page;await deferredReads(later);
  await button(later,'import-assignment','#editor ').click();
  await later.locator('#import-file').setInputFiles({name:'background-read.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(handoff('Background project')))});
  await later.waitForFunction(()=>Boolean(window.proofQaReads?.['background-read.json']));
  await button(later,'examples','#editor ').click();
  const laterTitle=await later.locator('#modal-title').textContent();
  await finishRead(later,'background-read.json');
  assert.equal(await later.locator('#modal-title').textContent(),laterTitle);
  assert.doesNotMatch(await later.locator('#modal').textContent(),/Background project/);
  pass('opening another tool supersedes an unfinished file read instead of replacing the new dialog');
  await replacement.context.close();

  const overlap=await setup(),race=overlap.page;await deferredReads(race);
  const candidate=await race.evaluate(()=>{const state=ProofCore.blank();state.contact.name='Latest project';return state;});
  await startImport(race,'assignment','old-assignment.json',handoff('Old assignment'));
  await startImport(race,'backup','new-backup.json',candidate);
  await finishRead(race,'new-backup.json');await race.waitForFunction(()=>document.querySelector('#modal-title').textContent==='Review this project backup.');
  await finishRead(race,'old-assignment.json');
  assert.equal(await race.locator('#modal-title').textContent(),'Review this project backup.');
  assert.match(await race.locator('#modal').textContent(),/Latest project/);
  await button(race,'confirm-import','#modal ').click();state=await saved(race);
  assert.equal(state.contact.name,'Latest project');assert.equal(state.experiences.length,0);
  pass('overlapping file modes keep the latest candidate and ignore an older successful read');
  await startImport(race,'assignment','old-error.json',handoff('Stale error'));
  await startImport(race,'assignment','latest-assignment.json',handoff('Latest assignment'));
  await finishRead(race,'latest-assignment.json');await race.waitForFunction(()=>document.querySelector('#modal-title').textContent==='Review the assignment before adding it.');
  await finishRead(race,'old-error.json','reject');
  assert.match(await race.locator('#modal').textContent(),/Latest assignment/);
  assert.doesNotMatch(await race.locator('#toast').textContent(),/Stale read failed/);
  await button(race,'confirm-import','#modal ').click();state=await saved(race);
  assert.equal(state.experiences.length,1);assert.equal(state.experiences[0].organization,'Latest assignment');
  pass('an older rejected file read cannot erase or dismiss a newer import preview');
  await overlap.context.close();
  assert.deepEqual(errors,[],'No browser page errors');
  console.log(checks+' reliability scenarios passed.');
} finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
