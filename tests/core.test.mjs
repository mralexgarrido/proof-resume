import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/core.js',import.meta.url),'utf8');
const context=vm.createContext({crypto});
vm.runInContext(source+'\nthis.core=ProofCore;',context);
const C=context.core;
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
  const state=C.sample(),current=C.variant(state),claim=state.experiences[0].contributions[0];
  current.requirements.push({id:C.id(),text:'Excel research',contributionIds:[claim.id]});
  current.jobDescription='PRIVATE_JOB_DESCRIPTION_831';
  return {state,current,claim};
}
function legacy(){
  return {app:'proof-resume',version:1,contact:{name:'José Núñez',email:'jose@example.com',phone:'',location:'Edinburg, TX',linkedin:'',portfolio:'',headline:'Marketing student',summary:'A specific introduction.'},education:[{id:'old-education',school:'Example University',degree:'BBA in Marketing',dates:'Expected May 2027',location:'',gpa:'',courses:'x'.repeat(1800),honors:''}],experiences:[{id:'old-visible',source:'course',section:'projects',role:'Research Lead',organization:'Café Proposal',dates:'May 2026',location:'',action:'Analyzed a survey',method:'Excel',result:'identified purchase barriers',evidence:'PRIVATE_OLD_EVIDENCE',reflection:'PRIVATE_OLD_REFLECTION',bullets:'• Analyzed student survey responses in Excel.\nCreated a content calendar for a campaign proposal.',verified:true,include:true},{id:'old-hidden',source:'work',section:'experience',role:'Associate',organization:'Store',dates:'',location:'',action:'',method:'',result:'',evidence:'PRIVATE_HIDDEN_NOTE',reflection:'',bullets:'Resolved customer order questions and explained suitable alternatives.',verified:false,include:false}],skills:{tools:'Excel (pivot tables), Canva',methods:'Survey analysis',languages:'English (fluent), Spanish (conversational)'},extras:'Course award, 2026',order:['skills','projects','education','experience','leadership','extras'],style:'classic',density:'compact',remember:false};
}

test('factories produce independent v2 projects, safe IDs, and explicit empty selections',()=>{
  const a=C.blank(),b=C.blank();assert.equal(a.version,2);assert.notEqual(a.id,b.id);assert.notEqual(a.selectedVariantId,b.selectedVariantId);assert.equal(C.cards(a).length,0);assert.equal(C.variant(a).contributionIds.length,0);assert.equal(C.variant(a).reviewedOverrides.length,0);assert.match(C.contribution().id,/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/);assert.throws(()=>C.experience('unknown'),/known experience/);assert.throws(()=>C.variant(a,'missing'),/does not exist/);
});

test('draft frames assemble only supplied facts and do not invent an outcome',()=>{
  const claim=C.contribution();claim.action='Created a survey';claim.method='Google Forms';assert.equal(C.draft(claim),'Created a survey using Google Forms.');assert.equal(C.draft(claim,'method'),'Using Google Forms, created a survey.');assert.equal(C.draft(C.contribution()),'');assert.doesNotMatch(C.draft(claim),/increased|improved|\d/);claim.result='identified three themes';assert.equal(C.draft(claim,'result'),'Identified three themes; created a survey using Google Forms.');claim.method='with Excel';assert.equal(C.draft(claim),'Created a survey with Excel; identified three themes.');
});

test('v2 JSON roundtrip is lossless for stable IDs, long fields, and linked evidence',()=>{
  const {state,current,claim}=fixture();state.education[0].courses='a'.repeat(3500);claim.text='b'.repeat(11000);claim.evidence='c'.repeat(11000);current.overrides[claim.id]='Adapted wording for this version.';current.reviewedOverrides.push(claim.id);state.updatedAt='2026-10-04T17:00:00.000Z';state.revision=7;
  const restored=C.normalize(plain(state));assert.deepEqual(plain(restored),plain(state));assert.equal(restored.education[0].courses.length,3500);assert.equal(restored.experiences[0].contributions[0].text.length,11000);assert.equal(restored.variants[0].requirements[0].contributionIds[0],claim.id);assert.equal(restored.skills[0].contributionIds[0],claim.id);assert.notEqual(restored,state);
});

test('public projection excludes every private coaching field and unselected library card',()=>{
  const {state,current,claim}=fixture();Object.assign(claim,{action:'PRIVATE_ACTION_741',method:'PRIVATE_METHOD_742',result:'PRIVATE_RESULT_743',evidence:'PRIVATE_EVIDENCE_744',reflection:'PRIVATE_REFLECTION_745',tags:['PRIVATE_TAG_746'],interview:{situation:'PRIVATE_STAR_747',task:'PRIVATE_TASK_748',action:'PRIVATE_STAR_ACTION_749',result:'PRIVATE_STAR_RESULT_750',lesson:'PRIVATE_LESSON_751'}});state.skills[0].practice='taught';current.requirements[0].text='PRIVATE_REQUIREMENT_752';const hidden=C.contribution();hidden.text='HIDDEN_LIBRARY_753';state.experiences[0].contributions.push(hidden);const result=JSON.stringify(C.content(state));assert.doesNotMatch(result,/PRIVATE_|HIDDEN_LIBRARY/);assert.match(result,/survey responses/);assert.equal(C.content(state).sections.flatMap(s=>s.entries.flatMap(e=>e.bulletIds)).includes(claim.id),true);
});

test('named variants select and adapt independently without mutating the evidence library',()=>{
  const {state,current,claim}=fixture();const original=claim.text,adapted=C.variantFactory('Research internship');adapted.contributionIds=[claim.id];adapted.overrides[claim.id]='Compared survey responses in Excel for a course proposal.';adapted.skillIds=[state.skills[0].id];state.variants.push(adapted);const base=JSON.stringify(C.content(state,current.id)),second=JSON.stringify(C.content(state,adapted.id));assert.match(base,/Analyzed 86/);assert.doesNotMatch(base,/Compared survey/);assert.match(second,/Compared survey/);assert.doesNotMatch(second,/returns guide/);assert.equal(claim.text,original);assert.equal(C.variant(state).id,current.id);assert.deepEqual(plain(C.normalize(plain(state))),plain(state));
});

test('adapted wording has an independent review in each version',()=>{
  const {state,current,claim}=fixture();assert.equal(C.assessments(state)[3].ready,true);const second=C.variantFactory('Second version');second.contributionIds=[claim.id];second.overrides[claim.id]='Presented research recommendations based on student survey responses.';state.variants.push(second);state.selectedVariantId=second.id;assert.equal(C.assessments(state)[3].ready,false);second.reviewedOverrides.push(claim.id);assert.equal(C.assessments(state)[3].ready,true);const third=C.variantFactory('Third version');third.contributionIds=[claim.id];third.overrides[claim.id]='Analyzed student survey data for a course marketing proposal.';state.variants.push(third);state.selectedVariantId=third.id;assert.equal(C.assessments(state)[3].ready,false);assert.equal(claim.reviewed,true);state.selectedVariantId=current.id;assert.equal(C.assessments(state)[3].ready,true);
});

test('empty selections hide all evidence and skills, and blank overrides omit one selected bullet',()=>{
  const state=C.sample(),current=C.variant(state);current.contributionIds=[];current.skillIds=[];assert.equal(C.content(state).sections.some(s=>s.key==='experience'||s.key==='projects'||s.key==='skills'),false);assert.equal(C.assessments(state)[2].ready,false);const claim=C.cards(state)[0].contribution;current.contributionIds=[claim.id];current.overrides[claim.id]=' ';assert.equal(C.content(state).sections.some(s=>s.key==='projects'),false);assert.equal(C.assessments(state)[2].ready,false);
});

test('v1 migration retains all bullets, private notes, original IDs, inclusion, style, and long education',()=>{
  const old=legacy(),state=C.normalize(plain(old)),again=C.normalize(plain(old)),current=C.variant(state),visible=state.experiences[0],hidden=state.experiences[1];assert.equal(state.version,2);assert.equal(state.remember,false);assert.equal(state.education[0].id,'old-education');assert.equal(state.education[0].courses.length,1800);assert.equal(visible.id,'old-visible');assert.equal(visible.contributions.length,2);assert.deepEqual(plain(visible.contributions.map(c=>c.text)),['Analyzed student survey responses in Excel.','Created a content calendar for a campaign proposal.']);assert.equal(visible.contributions[0].evidence,'PRIVATE_OLD_EVIDENCE');assert.equal(visible.contributions[0].reflection,'PRIVATE_OLD_REFLECTION');assert.equal(visible.contributions[0].reviewed,true);assert.equal(visible.contributions[1].reviewed,true);assert.equal(hidden.contributions[0].reviewed,false);assert.equal(current.contributionIds.includes(hidden.contributions[0].id),false);assert.equal(hidden.contributions[0].evidence,'PRIVATE_HIDDEN_NOTE');assert.equal(current.headline,old.contact.headline);assert.equal(current.summary,old.contact.summary);assert.equal(current.style,'classic');assert.equal(current.density,'compact');assert.deepEqual(plain(current.order),old.order);assert.equal(current.reviewedOverrides.length,0);assert.equal(visible.contributions[0].id,again.experiences[0].contributions[0].id);assert.deepEqual(plain(C.normalize(plain(state))),plain(state));
});

test('legacy notes without a finished bullet survive migration and are never marked reviewed',()=>{
  const old=legacy();old.experiences[0].bullets='';old.experiences[0].verified=true;const state=C.normalize(old),claim=state.experiences[0].contributions[0];assert.equal(claim.text,'');assert.equal(claim.action,'Analyzed a survey');assert.equal(claim.evidence,'PRIVATE_OLD_EVIDENCE');assert.equal(claim.reviewed,false);assert.equal(C.variant(state).contributionIds.includes(claim.id),false);
});

test('legacy skill text is retained without shortening a large unsplit skill',()=>{
  const old=legacy();old.skills.tools='x'.repeat(1900);const state=C.normalize(old);assert.equal(state.skills.find(skill=>skill.category==='tools').name.length,1900);assert.match(JSON.stringify(C.content(state)),/Spanish \(conversational\)/);
});

test('legacy skill migration keeps comma-separated context inside parentheses attached to its skill',()=>{
  const old=legacy();old.skills.tools='Excel (formulas, pivot tables), Canva; Tableau\nPython (data frames (joins, groups), plots)';const state=C.normalize(old);assert.deepEqual(plain(state.skills.filter(skill=>skill.category==='tools').map(skill=>skill.name)),['Excel (formulas, pivot tables)','Canva','Tableau','Python (data frames (joins, groups), plots)']);assert.match(JSON.stringify(C.content(state)),/Excel \(formulas, pivot tables\)/);assert.deepEqual(plain(C.normalize(plain(state))),plain(state));
});

test('normalization rejects unsupported versions, malformed objects, unsafe or duplicate IDs',()=>{
  assert.throws(()=>C.normalize({app:'other',version:2}),/valid Proof backup/);assert.throws(()=>C.normalize({app:'proof-resume',version:3}),/valid Proof backup/);const bad=C.sample();bad.contact=[];assert.throws(()=>C.normalize(bad),/Contact details must be an object/);const duplicate=C.sample();duplicate.education[0].id=duplicate.id;assert.throws(()=>C.normalize(duplicate),/duplicate ID/);const unsafe=C.sample();unsafe.experiences[0].id='evil\" id';assert.throws(()=>C.normalize(unsafe),/invalid ID/);const extra=C.sample();extra.remoteEndpoint='https://example.org';assert.throws(()=>C.normalize(extra),/unsupported field/);const control=C.sample();control.contact.name='Bad\u0000name';assert.throws(()=>C.normalize(control),/unsupported characters/);const lone=C.sample();lone.contact.name='Bad\ud800name';assert.throws(()=>C.normalize(lone),/unsupported characters/);const unicode=C.sample();unicode.contact.name='José & 李 😄';assert.equal(C.normalize(unicode).contact.name,unicode.contact.name);
});

test('oversized fields and collections fail before changing the source, never truncate',()=>{
  const {state,claim}=fixture();claim.text='x'.repeat(C.LIMITS.text);assert.equal(C.normalize(state).experiences[0].contributions[0].text.length,C.LIMITS.text);claim.text+='x';const snapshot=JSON.stringify(state);assert.throws(()=>C.normalize(state),/exceeds 12,000 characters/);assert.equal(JSON.stringify(state),snapshot);const many=C.blank();many.education=Array.from({length:C.LIMITS.education+1},()=>C.education());assert.throws(()=>C.normalize(many),/Education entries exceeds/);const lots=C.blank(),experience=C.experience();experience.contributions=Array.from({length:C.LIMITS.contributionsPerExperience+1},()=>C.contribution());lots.experiences.push(experience);assert.throws(()=>C.normalize(lots),/Contributions in one experience exceeds/);
});

test('all evidence and version references must remain resolvable and unique',()=>{
  const mutations=[s=>s.skills[0].contributionIds.push('missing'),s=>C.variant(s).contributionIds.push('missing'),s=>C.variant(s).skillIds.push('missing'),s=>C.variant(s).overrides.missing='Unresolved wording',s=>C.variant(s).requirements[0].contributionIds.push('missing'),s=>C.variant(s).reviewedOverrides.push('missing'),s=>C.variant(s).contributionIds.push(C.variant(s).contributionIds[0])];for(const mutate of mutations){const {state}=fixture();mutate(state);assert.throws(()=>C.normalize(state),/missing|duplicate selection/);}const {state,claim,current}=fixture();current.reviewedOverrides.push(claim.id);assert.throws(()=>C.normalize(state),/no adapted wording/);current.reviewedOverrides=[];state.selectedVariantId='missing';assert.throws(()=>C.normalize(state),/selected résumé version is missing/);
});

test('section order validation and public projection preserve the chosen order',()=>{
  const state=C.sample(),current=C.variant(state);current.order=['skills','education','projects','experience','leadership','extras'];assert.equal(C.content(state).sections[0].key,'skills');assert.equal(C.content(state).sections.some(s=>s.key==='extras'),false);current.order=['skills','skills','projects','experience','leadership','extras'];assert.throws(()=>C.normalize(state),/each section exactly once/);
});

test('proposal, simulation, and prototype stage labels survive the public resume projection',()=>{
  const state=C.sample(),project=state.experiences[0];for(const [status,label] of [['proposal','Proposal'],['simulation','Simulation'],['prototype','Prototype']]){project.status=status;const entry=C.content(state).sections.find(section=>section.key==='projects').entries[0];assert.match(entry.sub,new RegExp(label+'$'));}project.status='live';assert.doesNotMatch(C.content(state).sections.find(section=>section.key==='projects').entries[0].sub,/Proposal|Simulation|Prototype/);
});

test('feedback observes finished wording rather than treating worksheet result presence as quality',()=>{
  const claim=C.contribution();claim.text='Created an onboarding guide that three new team members used for returns.';assert.equal(C.feedback(claim).some(item=>/Consider what changed/.test(item.text)),false);claim.result='Previously supplied result';claim.text='I am a person.';assert.equal(C.feedback(claim).some(item=>!item.good),true);claim.text='Trained new interns responsible for customer order checks and returns.';assert.equal(C.feedback(claim).some(item=>/Start with your own action/.test(item.text)),false);claim.text='Responsible for inventory';assert.equal(C.feedback(claim).some(item=>/Start with your own action/.test(item.text)),true);claim.text='Measured 27 order discrepancies and documented them for the shift lead.';assert.equal(C.feedback(claim).some(item=>/Check numbers/.test(item.text)),true);
});

test('local requirement suggestions use bounded literal phrases and curated signals, not private notes',()=>{
  const state=C.blank(),experience=C.experience(),literal=C.contribution(),similar=C.contribution(),privateOnly=C.contribution();literal.text='Analyzed survey results in Excel for a class marketing proposal.';similar.text='Created excellent diagrams and clear project documentation.';privateOnly.text='Prepared project materials and explained the process to classmates.';privateOnly.evidence='Excel data analysis';experience.contributions=[literal,similar,privateOnly];state.experiences=[experience];assert.deepEqual(plain(C.requirementMatches(state,'Excel')),[literal.id]);assert.deepEqual(plain(C.requirementMatches(state,'Experience using Excel')),[literal.id]);assert.deepEqual(plain(C.requirementMatches(state,'spreadsheets')),[literal.id]);assert.equal(C.requirementMatches(state,'missing skill').length,0);assert.equal(C.requirementMatches(state,'').length,0);literal.tags.push('survey design');assert.deepEqual(plain(C.requirementMatches(state,'Survey Design')),[literal.id]);assert.equal(C.requirementMatches(state,'Excel').includes(privateOnly.id),false);
});

test('rehearsal prompts challenge attribution and numbers without embedding private notes',()=>{
  const claim=C.contribution();claim.text='Supported a team campaign with 40 mockups.';claim.attribution='team';claim.evidence='PRIVATE_TOKEN';claim.interview.situation='PRIVATE_STAR';const questions=C.rehearsal(claim);assert.ok(questions.some(question=>/team accomplish/.test(question)));assert.ok(questions.some(question=>/number measured/.test(question)));assert.doesNotMatch(questions.join(' '),/PRIVATE_/);assert.equal(C.rehearsal(claim,'Created a content calendar for a proposal.').some(question=>/number measured/.test(question)),false);
});

test('metric helper computes change, treats zero baseline explicitly, and rejects invalid values',()=>{
  assert.deepEqual(plain(C.metric(100,125)),{difference:25,percent:25});assert.deepEqual(plain(C.metric('80','60')),{difference:-20,percent:-25});assert.deepEqual(plain(C.metric(0,10)),{difference:10,percent:null});assert.equal(C.metric(0.1,0.2).difference,0.1);assert.equal(C.metric(1e-12,2e-12).difference,1e-12);assert.throws(()=>C.metric('',20),/finite before/);assert.throws(()=>C.metric(Infinity,20),/finite before/);assert.throws(()=>C.metric(10,NaN),/finite after/);assert.throws(()=>C.metric(-1e308,1e308),/calculator range/);
});

test('strict local handoff imports new IDs, preserves stage and private notes, and never reviews claims',()=>{
  const raw={app:'proof-evidence',version:1,title:'Campus campaign planning',source:'course',status:'simulation',contributions:[{action:'Prepared a campaign plan',method:'a class simulator',result:'documented audience choices',evidence:'PRIVATE_SUBMISSION',reflection:'A simulation only.'}]};const first=C.normalizeHandoff(raw),second=C.normalizeHandoff(raw);assert.equal(first.length,1);assert.equal(first[0].organization,raw.title);assert.equal(first[0].source,'course');assert.equal(first[0].section,'projects');assert.equal(first[0].status,'simulation');assert.equal(first[0].role,'');assert.equal(first[0].contributions[0].reviewed,false);assert.match(first[0].contributions[0].text,/Prepared a campaign plan/);assert.equal(first[0].contributions[0].evidence,'PRIVATE_SUBMISSION');assert.notEqual(first[0].id,second[0].id);assert.notEqual(first[0].contributions[0].id,second[0].contributions[0].id);assert.throws(()=>C.normalizeHandoff({...raw,reviewed:true}),/unsupported field/);assert.throws(()=>C.normalizeHandoff({...raw,contributions:[{text:'A bullet',reviewed:true}]}),/unsupported field/);assert.throws(()=>C.normalizeHandoff({...raw,contributions:[{evidence:'Only notes'}]}),/action or finished text/);assert.throws(()=>C.normalizeHandoff({...raw,title:' '}),/project title/);assert.throws(()=>C.normalizeHandoff({...raw,status:'published-ad-results'}),/unsupported choice/);assert.throws(()=>C.normalizeHandoff({...raw,contributions:[]}),/at least one/);assert.throws(()=>C.normalizeHandoff({...raw,contributions:[{text:{html:'markup'}}]}),/must be text/);
});

test('samples and templates are separate from blank state and public text is safely escaped',()=>{
  assert.equal(C.blank().experiences.length,0);assert.equal(C.assessments(C.sample()).filter(item=>item.ready).length,5);assert.ok(C.content(C.template()).sections.length>=3);assert.equal(C.template().experiences[0].contributions[0].reviewed,false);assert.equal(C.esc('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');assert.equal(C.countWords(C.sample())>150,true);
});

test('pure core contains no network APIs, external assets, or model calls',()=>{
  assert.doesNotMatch(source,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bsendBeacon\s*\(/);assert.doesNotMatch(source,/<(?:script|img|iframe)[^>]+src=["']https?:/);
});
