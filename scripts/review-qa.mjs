// Optional regression checks for the evidence editor and resume review workflow.
// Playwright and Chromium are provided by the tester, not the shipped app.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const modulePath=process.env.PROOF_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
const {chromium}=require(modulePath);
const html=await readFile(new URL('../index.html',import.meta.url));
const output=process.env.PROOF_QA_OUTPUT || await mkdtemp(join(tmpdir(),'proof-review-qa-'));
await mkdir(output,{recursive:true});
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.PROOF_CHROMIUM_PATH?{executablePath:process.env.PROOF_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const errors=[],requests=[],failures=[];
let checks=0;
const button=(p,action,extra='')=>p.locator('[data-action="'+action+'"]'+extra).first();
const field=(p,entity,key,id)=>p.locator('[data-entity="'+entity+'"][data-key="'+key+'"]'+(id?'[data-id="'+id+'"]':''));
const nav=(p,name)=>button(p,'navigate','[data-page="'+name+'"]').click();
const claim=(p,id)=>p.locator('#claim-text-'+id);
const status=(p,id)=>p.locator('#claim-state-'+id);
async function setup() {
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
  context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));});
  const page=await context.newPage();page.setDefaultTimeout(6000);await page.goto(origin);
  return {context,page};
}
async function fixture(p,change) {
  const result=await p.evaluate(change);
  await p.reload();
  return result;
}
async function edit(p,id) {
  const b=button(p,'edit-contribution','[data-id="'+id+'"]');
  if(await b.getAttribute('aria-expanded')!=='true')await b.click();
}
async function scenario(name,test) {
  const {context,page}=await setup();
  try {
    await test(page);
    checks++;console.log('PASS '+name);
  } catch(error) {
    failures.push({name,message:error.message});
    console.error('FAIL '+name+'\n'+error.message);
    await page.screenshot({path:join(output,'failure-'+(failures.length)+'.png'),fullPage:true}).catch(()=>{});
  } finally {await context.close();}
}
async function fit(p,label) {
  const dimensions=await p.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert.ok(dimensions.document<=dimensions.viewport,label+' exceeds viewport: '+JSON.stringify(dimensions));
  const clipped=await p.evaluate(()=>[...document.querySelectorAll('#editor p,#editor h1,#editor h2,#editor h3,.version-card strong,#progress-text,#modal h2,#modal .paper p,#modal .paper li')]
    .filter(el=>el.getClientRects().length && !el.closest('.sr-only') && el.clientWidth>0 && el.scrollWidth>el.clientWidth+1)
    .map(el=>({tag:el.tagName,class:el.className,client:el.clientWidth,scroll:el.scrollWidth,text:el.textContent.slice(0,75)})));
  assert.deepEqual(clipped,[],label+' clips or horizontally scrolls visible text.');
}
async function stored(p) {
  await p.waitForFunction(()=>document.querySelector('#status-label').textContent==='Saved');
  return p.evaluate(()=>JSON.parse(localStorage.getItem('proof-resume-v2')));
}
async function shown(p,ids) {
  await p.waitForFunction(expected=>{
    const actual=[...document.querySelectorAll('.contribution[id]')].map(el=>el.id.slice('card-'.length)).sort();
    return JSON.stringify(actual)===JSON.stringify([...expected].sort());
  },ids);
  assert.deepEqual((await p.locator('.contribution[id]').evaluateAll(nodes=>nodes.map(el=>el.id.slice('card-'.length)))).sort(),[...ids].sort());
}
async function reviewTarget(p,target,scope='.review-center') {
  const buttons=p.locator(scope+' [data-action="review-target"]');
  for(let i=0;i<await buttons.count();i++) {
    const candidate=JSON.parse(await buttons.nth(i).getAttribute('data-target'));
    if(Object.entries(target).every(([key,value])=>candidate[key]===value))return buttons.nth(i);
  }
  assert.fail('No actionable review target found for '+JSON.stringify(target));
}
async function focused(p,entity,key,id) {
  assert.deepEqual(await p.evaluate(()=>({entity:document.activeElement.dataset.entity,key:document.activeElement.dataset.key,id:document.activeElement.dataset.id})),{entity,key,id});
}

try {
  await scenario('finished wording and claim review update the open evidence row without losing focus',async p=>{
    await nav(p,'library');await button(p,'choose-source').click();await button(p,'discover-source','[data-source="course"]').click();
    await p.locator('#discovery-memory').fill('Compared class survey responses');await button(p,'capture-memory').click();
    const cid=await field(p,'contribution','text').getAttribute('data-id');
    const wording='Analyzed 24 class survey responses to compare shopping preferences.';
    await field(p,'contribution','text',cid).fill(wording);
    assert.equal(await claim(p,cid).count(),1,'The row needs an addressable live claim summary.');
    assert.equal(await claim(p,cid).textContent(),wording);
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.key),'text');
    assert.match(await p.locator('#resume-preview').textContent(),/Analyzed 24 class survey responses/);
    await field(p,'contribution','reviewed',cid).check();
    assert.match(await status(p,cid).textContent(),/Claim reviewed/);
    assert.doesNotMatch(await status(p,cid).textContent(),/Claim to review/);
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.key),'reviewed');
    await p.screenshot({path:join(output,'live-evidence-review.png'),fullPage:true});
  });

  await scenario('reflection and theme edits preserve a reviewed public claim',async p=>{
    await fixture(p,()=>{const s=ProofCore.sample(),v=ProofCore.variant(s),c=s.experiences[0].contributions[0];v.overrides={};v.reviewedOverrides=[];c.reviewed=true;localStorage.setItem('proof-resume-v2',JSON.stringify(s));});
    await nav(p,'library');const cid=await button(p,'edit-contribution').getAttribute('data-id');await edit(p,cid);
    const progress=await p.locator('#progress-text').textContent();
    const privateNotes=p.locator('#edit-'+cid+' details').filter({has:field(p,'contribution','reflection',cid)});
    if(await privateNotes.getAttribute('open')===null)await privateNotes.locator('summary').click();
    await field(p,'contribution','reflection',cid).fill('I learned to explain ambiguous answers.');
    assert.equal(await field(p,'contribution','reviewed',cid).isChecked(),true,'Reflection changed the public claim review.');
    assert.equal(await p.locator('#progress-text').textContent(),progress);
    await field(p,'contribution','tags',cid).fill('research, communication, budgeting');
    assert.equal(await field(p,'contribution','reviewed',cid).isChecked(),true,'Tags changed the public claim review.');
    assert.equal(await p.locator('#progress-text').textContent(),progress);
    assert.match(await status(p,cid).textContent(),/Claim reviewed/);
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.key),'tags');
  });

  await scenario('shared wording review and version wording review state their scope and stay independent',async p=>{
    await fixture(p,()=>{const s=ProofCore.sample(),v=ProofCore.variant(s),c=s.experiences[0].contributions[0];c.reviewed=true;v.contributionIds=[c.id];v.overrides={[c.id]:'Compared 24 survey responses to identify three research themes.'};v.reviewedOverrides=[];localStorage.setItem('proof-resume-v2',JSON.stringify(s));});
    await nav(p,'library');const cid=await button(p,'edit-contribution').getAttribute('data-id');await edit(p,cid);
    const sharedLabel=await field(p,'contribution','reviewed',cid).locator('..').textContent();
    assert.match(sharedLabel,/shared/i,'The shared review checkbox does not identify which wording it reviews.');
    assert.equal(await field(p,'contribution','reviewed',cid).isChecked(),true);
    assert.match(await status(p,cid).textContent(),/Claim to review/,'A reviewed shared bullet incorrectly approves the adapted claim.');
    await button(p,'version-wording','[data-id="'+cid+'"]').click();
    const adapted=field(p,'override-review','reviewed',cid);
    assert.match(await adapted.locator('..').textContent(),/version/i);
    assert.equal(await adapted.isChecked(),false);await adapted.check();await button(p,'close-wording').click();
    assert.match(await status(p,cid).textContent(),/Claim reviewed/);
    assert.equal(await field(p,'contribution','reviewed',cid).isChecked(),true);
    await button(p,'version-wording','[data-id="'+cid+'"]').click();
    await field(p,'override','text',cid).fill('Compared survey responses and presented three research themes.');
    assert.equal(await adapted.isChecked(),false);await p.keyboard.press('Escape');
    assert.match(await status(p,cid).textContent(),/Claim to review/,'Closing the wording dialog left the row review status stale.');
    assert.equal(await field(p,'contribution','reviewed',cid).isChecked(),true);
    assert.equal(await p.evaluate(()=>document.activeElement.dataset.action),'version-wording');
  });

  await scenario('a valid version-only bullet can be practiced and exported from Interview',async p=>{
    await fixture(p,()=>{const s=ProofCore.sample(),v=ProofCore.variant(s),c=s.experiences[0].contributions[0];ProofCore.cards(s).forEach(x=>x.contribution.text='');c.action='Compared survey responses';c.evidence='PRIVATE_ADAPTED_ONLY_EVIDENCE';c.interview.situation='PRIVATE_ADAPTED_ONLY_INTERVIEW';v.contributionIds=[c.id];v.overrides={[c.id]:'Compared 24 survey responses and presented three research themes.'};v.reviewedOverrides=[c.id];localStorage.setItem('proof-resume-v2',JSON.stringify(s));});
    await nav(p,'finish');assert.match(await p.locator('#editor').textContent(),/5 of 5 foundations ready/);
    await nav(p,'interview');
    assert.equal(await p.locator('#practice-contribution').count(),1,'Valid adapted-only contribution is unavailable for practice.');
    assert.match(await p.locator('.selected-claim').textContent(),/Compared 24 survey responses and presented three research themes/);
    assert.ok(await p.locator('.question-list li').count()>0);
    assert.equal(await button(p,'interview-export').isVisible(),true);
    assert.doesNotMatch(await p.locator('#editor').textContent(),/Your first story starts/);
    await button(p,'interview-export').click();assert.equal(await p.locator('#include-private-interview').isChecked(),false);
    const pending=p.waitForEvent('download');await button(p,'confirm-interview-export').click();const download=await pending;
    const path=join(output,'adapted-only-interview.txt');await download.saveAs(path);const exported=await readFile(path,'utf8');
    assert.match(exported,/Compared 24 survey responses and presented three research themes/);assert.doesNotMatch(exported,/PRIVATE_ADAPTED_ONLY/);
  });

  await scenario('evidence filters isolate selection, current-wording review, and drafts; search finds adapted wording and private notes',async p=>{
    const ids=await fixture(p,()=>{
      const s=ProofCore.blank(),e=ProofCore.experience('course'),v=ProofCore.variant(s);
      const cs=Array.from({length:4},()=>ProofCore.contribution());
      cs[0].text='Reviewed selected survey research.';cs[0].reviewed=true;
      cs[1].text='Shared planning contribution.';cs[1].reviewed=true;
      cs[2].text='Reviewed contribution kept for another opportunity.';cs[2].reviewed=true;cs[2].evidence='SUPPORT_EVIDENCE_SEARCH_R7';cs[2].reflection='PRIVATE_REFLECTION_SEARCH_R8';
      cs[3].action='Unfinished rough memory';e.contributions=cs;s.experiences=[e];
      v.contributionIds=[cs[0].id,cs[1].id];v.overrides={[cs[1].id]:'ADAPTED_WORDING_SEARCH_R9 for a research internship.'};v.reviewedOverrides=[];
      localStorage.setItem('proof-resume-v2',JSON.stringify(s));return cs.map(c=>c.id);
    });
    await nav(p,'library');await shown(p,ids);
    for(const [mode,expected]of [['selected',ids.slice(0,2)],['unselected',ids.slice(2)],['review',[ids[1]]],['draft',[ids[3]]],['all',ids]]) {
      await p.locator('#library-mode').selectOption(mode);await shown(p,expected);
      assert.equal(await p.evaluate(()=>document.activeElement.id),'library-mode');
    }
    for(const [query,expected]of [['ADAPTED_WORDING_SEARCH_R9',[ids[1]]],['SUPPORT_EVIDENCE_SEARCH_R7',[ids[2]]],['PRIVATE_REFLECTION_SEARCH_R8',[ids[2]]],['',ids]]) {
      await p.locator('#library-search').fill(query);await shown(p,expected);
      assert.equal(await p.evaluate(()=>document.activeElement.id),'library-search');
    }
    await p.locator('#library-mode').selectOption('selected');
    // Use a click because a correctly filtered row disappears immediately;
    // Playwright's uncheck waits to inspect that now-removed input afterward.
    await field(p,'selection','included',ids[0]).click();await shown(p,[ids[1]]);
    assert.equal((await stored(p)).variants[0].contributionIds.includes(ids[0]),false);
    await p.locator('#library-mode').selectOption('unselected');await shown(p,[ids[0],ids[2],ids[3]]);
    await p.locator('#library-mode').selectOption('review');await edit(p,ids[1]);await button(p,'version-wording','[data-id="'+ids[1]+'"]').click();
    await field(p,'override-review','reviewed',ids[1]).check();await button(p,'close-wording').click();await shown(p,[]);
  });

  await scenario('Export review opens exact missing context fields and the correct shared or adapted claim',async p=>{
    const data=await fixture(p,()=>{
      const s=ProofCore.blank(),e=ProofCore.experience('course'),v=ProofCore.variant(s),shared=ProofCore.contribution(),adapted=ProofCore.contribution();
      s.contact.name='Jordan Audit';e.role='';e.organization='';e.dates='';shared.text='Analyzed survey results to compare student preferences.';adapted.text='Prepared a class research presentation.';e.contributions=[shared,adapted];s.experiences=[e];
      v.contributionIds=[shared.id,adapted.id];v.overrides={[adapted.id]:'Presented three survey themes to a research class.'};
      localStorage.setItem('proof-resume-v2',JSON.stringify(s));return {eid:e.id,shared:shared.id,adapted:adapted.id};
    });
    await nav(p,'library');await p.locator('#library-mode').selectOption('draft');await p.locator('#library-search').fill('no matches');
    await nav(p,'finish');await p.screenshot({path:join(output,'desktop-export-review.png'),fullPage:true});
    const splitButtons=await p.locator('.check-card > .btn').evaluateAll(buttons=>buttons.filter(b=>{const range=document.createRange();range.selectNodeContents(b);return range.getClientRects().length>1;}).map(b=>b.textContent));
    assert.deepEqual(splitButtons,[],'Short foundation actions wrap across lines on a normal desktop viewport.');
    for(const key of ['organization','dates']) {
      await nav(p,'finish');await (await reviewTarget(p,{entity:'experience',id:data.eid,key})).click();
      await focused(p,'experience',key,data.eid);assert.equal(await p.locator('#library-mode').inputValue(),'all');assert.equal(await p.locator('#library-search').inputValue(),'');
      assert.equal(await p.locator('#experience-details-'+data.eid).isVisible(),true);
    }
    await nav(p,'finish');await (await reviewTarget(p,{entity:'contribution',id:data.shared,key:'reviewed'})).click();
    await focused(p,'contribution','reviewed',data.shared);assert.equal(await p.locator('#edit-'+data.shared).isVisible(),true);
    await nav(p,'finish');await (await reviewTarget(p,{action:'version-wording',id:data.adapted})).click();
    assert.equal(await p.locator('#modal').getAttribute('open'),'');assert.equal(await field(p,'override','text',data.adapted).inputValue(),'Presented three survey themes to a research class.');
    assert.equal(await field(p,'override-review','reviewed',data.adapted).isChecked(),false);await button(p,'close-modal').click();
    await nav(p,'finish');await (await reviewTarget(p,{entity:'contact',key:'email'})).click();await focused(p,'contact','email','shared');
    await nav(p,'finish');await (await reviewTarget(p,{action:'add-education'})).click();
    const educationId=await field(p,'education','school').getAttribute('data-id');await focused(p,'education','school',educationId);
  });

  await scenario('Discover continuation returns to the saved rough memory and opens its action field',async p=>{
    const cid=await fixture(p,()=>{const s=ProofCore.blank(),e=ProofCore.experience('community'),c=ProofCore.contribution();c.action='Organized supplies for a neighborhood event.';e.contributions=[c];s.experiences=[e];localStorage.setItem('proof-resume-v2',JSON.stringify(s));return c.id;});
    await nav(p,'library');await p.locator('#library-mode').selectOption('selected');await p.locator('#library-search').fill('another memory');await nav(p,'discover');
    assert.match(await p.locator('.continue-card').textContent(),/Turn a memory into your next bullet/);
    await p.screenshot({path:join(output,'desktop-continue.png'),fullPage:true});
    await (await reviewTarget(p,{entity:'contribution',id:cid,key:'action'},'.continue-card')).click();
    await focused(p,'contribution','action',cid);assert.equal(await field(p,'contribution','action',cid).isVisible(),true);
    assert.equal(await field(p,'contribution','action',cid).inputValue(),'Organized supplies for a neighborhood event.');
    assert.equal(await p.locator('#library-mode').inputValue(),'all');assert.equal(await p.locator('#library-search').inputValue(),'');
  });

  await scenario('requirement linking, resume inclusion, and adapted wording remain separate choices',async p=>{
    const data=await fixture(p,()=>{const s=ProofCore.sample(),v=ProofCore.variant(s),c=s.experiences[0].contributions[0],r={id:ProofCore.id(),text:'Present survey findings clearly.',contributionIds:[]};v.contributionIds=[];v.overrides={};v.reviewedOverrides=[];v.requirements=[r];localStorage.setItem('proof-resume-v2',JSON.stringify(s));return {rid:r.id,cid:c.id,shared:c.text};});
    await nav(p,'versions');const card=p.locator('#requirement-'+data.rid),link=field(p,'requirement-link',data.cid,data.rid);
    await card.locator('details summary').click();await link.check();
    assert.match(await card.locator('.requirement-head .tag').textContent(),/Evidence available/);
    const include=card.locator('[data-entity="selection"][data-id="'+data.cid+'"]');
    assert.equal(await include.isChecked(),false,'Linking a requirement silently selected the contribution.');
    await include.check();assert.match(await card.locator('.requirement-head .tag').textContent(),/Evidence included/);assert.equal(await link.isChecked(),true);
    await card.locator('[data-action="version-wording"][data-id="'+data.cid+'"]').click();
    const wording='Presented three survey findings to explain student preferences.';await field(p,'override','text',data.cid).fill(wording);await field(p,'override-review','reviewed',data.cid).check();await button(p,'close-wording').click();
    assert.equal(await card.locator('.connected-evidence p').textContent(),wording);
    let state=await stored(p);assert.equal(state.experiences[0].contributions[0].text,data.shared);assert.deepEqual(state.variants[0].requirements[0].contributionIds,[data.cid]);
    await include.uncheck();assert.match(await card.locator('.requirement-head .tag').textContent(),/Evidence available/);
    state=await stored(p);assert.deepEqual(state.variants[0].requirements[0].contributionIds,[data.cid]);assert.equal(state.variants[0].contributionIds.includes(data.cid),false);
    await include.check();await card.locator('details summary').click();await link.uncheck();
    assert.equal(await card.locator('.connected-evidence').count(),0);assert.match(await card.locator('.requirement-head .tag').textContent(),/Choose evidence/);
    state=await stored(p);assert.equal(state.variants[0].contributionIds.includes(data.cid),true,'Removing a requirement link silently deselected the resume claim.');assert.deepEqual(state.variants[0].requirements[0].contributionIds,[]);
    assert.match(await p.locator('#resume-preview').textContent(),/Presented three survey findings/);
  });

  await scenario('permitted long names and URLs fit every mobile view and full preview',async p=>{
    await fixture(p,()=>{
      const s=ProofCore.sample(),v=ProofCore.variant(s),c=s.experiences[0].contributions[0];
      v.name='MarketingInternship'.repeat(16);s.experiences[0].organization='CommunityProject'.repeat(20);
      c.text='https://example.com/portfolio/'+('project'.repeat(70));
      if(v.name.length>ProofCore.LIMITS.contact||s.experiences[0].organization.length>ProofCore.LIMITS.field||c.text.length>ProofCore.LIMITS.text)throw new Error('Stress fixture exceeds a permitted input length.');
      localStorage.setItem('proof-resume-v2',JSON.stringify(s));
    });
    const overflow=[];
    for(const width of [320,390,768]) {
      await p.setViewportSize({width,height:950});
      for(const name of ['discover','details','education','library','skills','versions','interview','finish']) {
        await nav(p,name);
        try{await fit(p,width+'px '+name);}catch(error){overflow.push(error.message);}
      }
      await button(p,'preview').click();
      try {
        await fit(p,width+'px full preview');
        const preview=await p.locator('#modal').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
        assert.ok(preview.scroll<=preview.client+1,width+'px full preview has internal horizontal overflow: '+JSON.stringify(preview));
      } catch(error) {overflow.push(error.message);}
      await p.keyboard.press('Escape');
    }
    await p.setViewportSize({width:390,height:950});await nav(p,'library');await p.screenshot({path:join(output,'long-evidence-mobile.png'),fullPage:true});
    await nav(p,'versions');await p.screenshot({path:join(output,'long-versions-mobile.png'),fullPage:true});
    assert.deepEqual(overflow,[]);
  });

  assert.deepEqual(errors,[],'Browser JavaScript errors.');
  assert.equal(requests.every(url=>url===origin+'/'),true,'Unexpected application resource requests: '+requests.filter(url=>url!==origin+'/').join(', '));
  console.log('PASS no page errors or external resource requests');
  assert.equal(failures.length,0,'Review workflow regression failures: '+failures.map(x=>x.name).join('; '));
  console.log(checks+' review scenarios passed. QA artifacts: '+output);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
