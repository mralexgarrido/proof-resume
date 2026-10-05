/* Proof student workshop. All processing and exports stay in this browser. */
(() => {
  'use strict';
  const C = ProofCore, P = ProofContent, X = ProofExport;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY = 'proof-resume-v2', OLD_KEY = 'proof-resume-v1', HISTORY_KEY = 'proof-resume-recovery-v2', MODE_KEY = 'proof-save-mode';
  const pages = [['discover','Discover'],['details','Your details'],['education','Education'],['library','My evidence'],['skills','Skills'],['versions','Resume versions'],['interview','Interview practice'],['finish','Export']];
  let state = C.blank(), page = 'discover', openExperience = null, openContribution = null, search = '', filter = 'all', libraryMode = 'all';
  let remember = true, lastStored = null, conflict = false, dirty = false, storageError = '', historyError = '', notice = '', saveTimer, toastTimer;
  let undo = [], redo = [], snapshots = [], pendingImport = null, importMode = 'backup', importRequest = 0, editSession = null, modalReturn = null;
  let discovery = null, lens = null, exampleIndex = 0, interviewId = null, timerHandle = null, elapsed = 0;
  try {
    lastStored = localStorage.getItem(KEY);
    const old = !lastStored ? localStorage.getItem(OLD_KEY) : null;
    if (lastStored || old) {
      state = C.normalize(JSON.parse(lastStored || old));
      notice = old ? 'Welcome back. Your existing resume and private notes are ready in the expanded workshop.' : 'Welcome back. Your work was restored on this device.';
    }
    remember = state.remember;
    if (sessionStorage.getItem(MODE_KEY) === 'session') remember = false;
  } catch (error) {
    remember = false;
    storageError = 'Saved work could not be opened. It is still in browser storage. Download a copy before clearing it.';
  }
  if(remember)try {
    const storedHistory=localStorage.getItem(HISTORY_KEY);
    if(storedHistory)snapshots=normalizeSnapshots(JSON.parse(storedHistory));
  } catch {
    historyError='Your draft is open and can still save. Older restore points could not be read; their saved copy is available to download.';
  }
  state.remember = remember;
  const v = () => C.variant(state);
  const cards = () => C.cards(state);
  const findCard = id => cards().find(x => x.contribution.id === id);
  const chosen = id => v().contributionIds.includes(id);
  const textFor = c => Object.hasOwn(v().overrides, c.id) ? v().overrides[c.id] : c.text;
  const reviewedFor = c => Object.hasOwn(v().overrides,c.id) ? v().reviewedOverrides.includes(c.id) : c.reviewed;
  const statusLabel = value => P.statuses.find(x => x.value === value)?.label || value;
  const itemOptions = values => values.map(x => [x.value,x.label]);
  function toast(message) {
    $('#toast').textContent = message; $('#toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
  }
  function status(message, warn = false) {
    $('#status-label').textContent = message;
    $('#save-state').classList.toggle('conflict',warn);
  }
  function syncHistoryButtons() {
    document.querySelectorAll('[data-action="undo"]').forEach(el=>el.disabled=!undo.length);
    document.querySelectorAll('[data-action="redo"]').forEach(el=>el.disabled=!redo.length);
  }
  function takeUndo(snapshot=JSON.stringify(state)) {
    undo.push(snapshot); if (undo.length > 35) undo.shift();
    redo = []; editSession = null;
    syncHistoryButtons();
  }
  function change(fn, options = {}) {
    const before=JSON.stringify(state),view={page,openExperience,openContribution,search,filter,libraryMode};
    try{fn();C.normalize(state);}catch(error){
      state=JSON.parse(before);({page,openExperience,openContribution,search,filter,libraryMode}=view);
      throw error;
    }
    takeUndo(before);save();render(options.focus || false,options.target);
  }
  function historyButtons() {
    return '<div class="page-actions"><button class="btn compact" data-action="undo" '+(!undo.length?'disabled':'')+'>↶ Undo</button><button class="btn compact" data-action="redo" '+(!redo.length?'disabled':'')+'>↷ Redo</button><button class="btn compact" data-action="snapshot">Save a restore point</button><button class="btn compact" data-action="data">Backup &amp; restore</button></div>';
  }
  function save() {
    state.remember = remember;
    dirty = true;
    clearTimeout(saveTimer);
    if (!remember) { status('Session only'); return; }
    if (conflict) { status('Review changes',true); return; }
    status('Saving'); saveTimer = setTimeout(flush, 400);
  }
  function flush() {
    clearTimeout(saveTimer);
    if (!remember || conflict || !dirty) return;
    try {
      const current = localStorage.getItem(KEY);
      if (current !== lastStored) {
        conflict = true; status('Review changes',true); render();
        toast('Another tab changed the saved work. Your current edits are still here.'); return;
      }
      const checked = C.normalize(state);
      let storedRevision=0;try{storedRevision=Number(JSON.parse(current)?.revision)||0;}catch{}
      checked.revision = Math.min(Number.MAX_SAFE_INTEGER,Math.max(Number(state.revision)||0,storedRevision) + 1); checked.updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(C.normalize(checked)); localStorage.setItem(KEY,serialized); lastStored = serialized;
      dirty = false;
      state.revision = checked.revision; state.updatedAt = checked.updatedAt;
      status('Saved');
    } catch (error) {
      status('Backup needed',true);
      toast('This draft could not be saved on the device. Download a project backup to keep it.');
    }
  }
  function normalizeSnapshots(raw) {
    if(!Array.isArray(raw))throw new Error('Restore points must be a list.');
    return raw.slice(-5).map(s=>{
      if(!s||typeof s.at!=='string'||!Number.isFinite(Date.parse(s.at)))throw new Error('A restore point has an invalid date.');
      return {...(typeof s.id==='string'?{id:s.id}:{}),name:String(s.name || 'Restore point').slice(0,100),at:s.at,data:C.normalize(s.data)};
    });
  }
  function refreshSnapshots() {
    if(!remember||conflict)return;
    const raw=localStorage.getItem(HISTORY_KEY);if(!raw)return;
    const points=normalizeSnapshots(JSON.parse(raw)),merged=new Map();
    for(const point of [...points,...snapshots]) {
      const key=point.id || JSON.stringify([point.at,point.name,point.data.id,point.data.revision]);
      merged.set(key,point);
    }
    snapshots=[...merged.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).slice(-5);
  }
  function preserve(name) {
    let canPersist=remember&&!conflict;
    try{refreshSnapshots();}catch{canPersist=false;toast('Existing restore points could not be read. The new point will stay in this session. Save a project backup too.');}
    const entry = {id:C.id(),name:name || 'Before a change',at:new Date().toISOString(),data:C.normalize(state)};
    snapshots.push(entry); snapshots = snapshots.slice(-5);
    if(canPersist)try{localStorage.setItem(HISTORY_KEY,JSON.stringify(snapshots));return true;}catch{toast('Restore point is kept for this session. Save a backup too.');}
    return false;
  }
  function head(k,title,description) {
    return '<div class="page-lead"><p class="eyebrow">'+esc(k)+'</p><h1 tabindex="-1">'+title+'</h1><p>'+description+'</p></div>';
  }
  function next(previous,following,label) {
    return '<div class="footer-next">'+(previous?'<button class="btn subtle" data-action="navigate" data-page="'+previous+'">← Back</button>':'<span class="subtle-note">Start with one memory. You can return anytime.</span>')+'<button class="btn primary" data-action="navigate" data-page="'+following+'">'+(label || 'Continue')+' →</button></div>';
  }
  function field(entity,id,key,label,value,options = {}) {
    const fid = 'f-'+entity+'-'+id+'-'+key;
    const attrs = ' id="'+esc(fid)+'" data-entity="'+entity+'" data-id="'+esc(id)+'" data-key="'+key+'" maxlength="'+(options.max || C.LIMITS.field)+'" '+(options.placeholder?'placeholder="'+esc(options.placeholder)+'" ':'')+(options.hint?'aria-describedby="'+esc(fid)+'-hint" ':'')+'autocomplete="'+(options.auto || 'off')+'"';
    let input;
    if (options.select) input = '<select'+attrs+'>'+options.select.map(([key,text])=>'<option value="'+esc(key)+'" '+(value===key?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select>';
    else if (options.area) input = '<textarea'+attrs+' rows="'+(options.rows || 3)+'">'+esc(value)+'</textarea>';
    else input = '<input'+attrs+' type="'+(options.type || 'text')+'" value="'+esc(value)+'">';
    return '<div class="field '+(options.wide?'wide':'')+' '+(options.finished?'finished':'')+'"><label for="'+esc(fid)+'">'+esc(label)+(options.optional?' <span class="optional">Optional</span>':'')+'</label>'+input+(options.hint?'<p class="hint" id="'+esc(fid)+'-hint">'+options.hint+'</p>':'')+'</div>';
  }
  function check(entity,id,key,label,yes,extra='') {
    return '<label class="check-label"><input type="checkbox" data-entity="'+entity+'" data-id="'+esc(id)+'" data-key="'+key+'" '+(yes?'checked':'')+' '+extra+'><span>'+label+'</span></label>';
  }
  function nav() {
    $('#steps').innerHTML = pages.map(([key,label],i)=>'<button class="nav-step '+(key===page?'active':'')+'" data-action="navigate" data-page="'+key+'" '+(key===page?'aria-current="page"':'')+'><span class="step-num">'+String(i+1).padStart(2,'0')+'</span>'+label+'</button>').join('');
    const a = C.assessments(state), count = a.filter(x=>x.ready).length;
    $('#progress-text').textContent = count+' of '+a.length+' foundations ready · '+v().name;
    $('#progress').setAttribute('aria-valuenow',count); $('#progress').setAttribute('aria-valuemax',a.length);
    $('#progress-fill').style.width = (count/a.length*100)+'%';
  }
  function banner() {
    if (conflict) return '<div class="notice" role="status"><strong>Another tab has saved changes.</strong> Your current edits are still here. Save a backup, then choose which work to continue.<br><button class="btn compact" data-action="backup">Back up this draft</button><button class="btn compact" data-action="load-other">Open saved changes</button><button class="btn compact" data-action="keep-current">Keep this draft instead</button></div>';
    if (storageError) return '<div class="notice">'+esc(storageError)+'<br><button class="btn compact" data-action="recover-raw">Download saved copy</button><button class="btn compact" data-action="data">Manage saved work</button></div>';
    if (historyError) return '<div class="notice">'+esc(historyError)+'<br><button class="btn compact" data-action="recover-history">Download restore-point copy</button><button class="btn compact" data-action="data">Backup &amp; restore</button></div>';
    if (notice) return '<div class="notice good">'+esc(notice)+' <button class="btn link" data-action="dismiss">Dismiss</button></div>';
    return '';
  }
  function targetButton(target,label,classes='btn') {
    return '<button class="'+classes+'" data-action="review-target" data-target="'+esc(JSON.stringify(target))+'">'+esc(label)+'</button>';
  }
  function continueCard() {
    if(!cards().length&&!state.contact.name.trim()&&!state.education.length&&!state.skills.length)return '';
    const draft=cards().find(({contribution:c})=>!c.text.trim()&&!Object.hasOwn(v().overrides,c.id)&&(c.action.trim()||c.reflection.trim()));
    const issue=C.exportReview(state)[0];
    const target=draft?{page:'library',entity:'contribution',id:draft.contribution.id,key:'action'}:issue?.target || {page:'finish'};
    const title=draft?'Turn a memory into your next bullet':issue?.text || 'Read your resume and make it yours';
    const detail=draft?'Your notes are saved. Add what you did, how you did it, and what you delivered.':issue?.detail || 'Your basic information is in place. Review the wording, then download an editable copy.';
    return '<section class="continue-card"><p class="eyebrow">CONTINUE '+esc(v().name)+'</p><h2>'+esc(title)+'</h2><p>'+esc(detail)+'</p><div class="button-group">'+targetButton(target,'Continue my resume','btn primary')+'<button class="btn" data-action="navigate" data-page="finish">Review this version</button></div></section>';
  }
  function reviewCenter() {
    const issues=C.exportReview(state);
    return '<section class="review-center"><h2>Before you share this version</h2><p class="subtle-note">'+(issues.length?issues.length+' items to consider. Open any item to work on that exact part. You can download a draft at any time.':'The checks below found no missing basics or unreviewed selected claims. Read the final wording and check the layout before sharing.')+'</p>'+
      issues.map(issue=>'<article class="review-item"><div><h3>'+esc(issue.text)+'</h3><p>'+esc(issue.detail)+'</p></div>'+targetButton(issue.target,issue.kind==='missing'?'Add detail':'Review','btn compact')+'</article>').join('')+'</section>';
  }
  function followTarget(target) {
    closeModal();
    if(target.page==='library') {
      search='';filter='all';libraryMode='all';
      if(target.entity==='experience')openExperience=target.id;
      else if(target.id){const item=findCard(target.id);if(item){openContribution=target.id;openExperience=item.experience.id;}}
    }
    navigate(target.page);
    if(target.action==='version-wording'){wordingModal(target.id);return;}
    if(['add-education','add-skill'].includes(target.action)){$('#editor [data-action="'+target.action+'"]')?.click();return;}
    if(target.entity) {
      const field=[...$('#editor').querySelectorAll('[data-entity]')].find(el=>el.dataset.entity===target.entity&&(!target.id||el.dataset.id===target.id)&&el.dataset.key===target.key);
      if(field){field.closest('details')?.setAttribute('open','');field.focus();}
    }
  }
  function discoverView() {
    return head('01 / START WITH WHAT YOU KNOW','You have more to work with<br>than you think.','You do not need the perfect words yet. Choose somewhere you contributed, then capture one real moment.')+
      continueCard()+
      '<div class="source-grid">'+Object.entries(C.SOURCES).map(([key,s])=>'<button class="source-card" data-action="discover-source" data-source="'+key+'"><span class="source-icon" aria-hidden="true">'+({course:'▤',work:'▣',campus:'◎',volunteer:'♡',personal:'✦',community:'⌂'}[key])+'</span><span class="plus" aria-hidden="true">+</span><strong>'+esc(s.label)+'</strong><p>'+esc(s.description)+'</p></button>').join('')+'</div>'+
      '<div class="insight"><div><strong>A useful contribution can be ordinary.</strong><p>Think of something you made clearer, organized, finished, maintained, or helped someone understand. We will help you find the details.</p></div></div>'+
      '<div class="page-actions"><button class="btn" data-action="examples">Show me examples</button><button class="btn" data-action="projects">Help me build new evidence</button><button class="btn" data-action="import-assignment">Open an assignment file</button></div>'+
      (cards().length?'<p class="subtle-note">You have '+cards().length+' contribution'+(cards().length===1?'':'s')+' in your collection. <button class="btn link" data-action="navigate" data-page="library">Continue working on them →</button></p>':'')+next(null,'details','Add my details');
  }
  function detailsView() {
    const c=state.contact;
    return head('02 / YOUR INTRODUCTION','Make it easy to reach you.','These details are shared across your resume versions. Add only the contact information you want employers to see.')+
      '<div class="field-grid">'+field('contact','shared','name','Full name',c.name,{wide:true,auto:'name',max:C.LIMITS.contact,placeholder:'The name you use professionally'})+
      field('contact','shared','email','Email address',c.email,{type:'email',auto:'email',max:C.LIMITS.contact,placeholder:'you@example.com'})+
      field('contact','shared','phone','Phone',c.phone,{optional:true,type:'tel',auto:'tel',max:C.LIMITS.contact})+
      field('contact','shared','location','City and state',c.location,{optional:true,max:C.LIMITS.contact,placeholder:'Edinburg, TX'})+
      field('contact','shared','linkedin','LinkedIn profile',c.linkedin,{optional:true,max:C.LIMITS.contact,placeholder:'linkedin.com/in/your-name'})+
      field('contact','shared','portfolio','Portfolio or project URL',c.portfolio,{wide:true,optional:true,max:C.LIMITS.contact,placeholder:'yourname.com',hint:'Use a link to work you are ready to share. Contact links are clickable in the Word export.'})+'</div><p id="email-error" class="inline-error" hidden></p>'+
      '<div class="subheading"><h2>Your focus for this version</h2><p>A headline or introduction is optional. Use it when it adds useful context.</p></div><p class="tag">'+esc(v().name)+'</p><div class="field-grid mt16">'+
      field('variant',v().id,'headline','Professional focus',v().headline,{wide:true,optional:true,max:C.LIMITS.contact,placeholder:'Marketing student with experience in survey research'})+
      field('variant',v().id,'summary','Short introduction',v().summary,{area:true,wide:true,optional:true,max:C.LIMITS.summary,hint:'One or two specific sentences about what you have practiced and what you are ready to contribute.'})+'</div>'+next('discover','education');
  }
  function educationView() {
    return head('03 / EDUCATION','Build on what you are learning.','Add your current program and relevant studies. Use the arrows to put the most recent entry first.')+
      state.education.map((e,i)=>'<div class="card"><div class="card-title"><h2>'+esc(e.school || 'School or program')+'</h2><div class="education-actions"><button class="icon-btn" data-action="move-education" data-id="'+e.id+'" data-dir="-1" aria-label="Move education up" '+(i===0?'disabled':'')+'>↑</button><button class="icon-btn" data-action="move-education" data-id="'+e.id+'" data-dir="1" aria-label="Move education down" '+(i===state.education.length-1?'disabled':'')+'>↓</button><button class="btn subtle compact danger" data-action="remove-education" data-id="'+e.id+'">Remove</button></div></div><div class="field-grid">'+
      field('education',e.id,'school','School or institution',e.school,{wide:true,placeholder:'University or college name'})+
      field('education',e.id,'degree','Degree and major',e.degree,{wide:true,placeholder:'Bachelor of Business Administration in Marketing'})+
      field('education',e.id,'dates','Graduation date',e.dates,{placeholder:'Expected May 2027'})+
      field('education',e.id,'location','Location',e.location,{optional:true})+
      field('education',e.id,'gpa','GPA',e.gpa,{optional:true,placeholder:'3.7 / 4.0',hint:'Include the scale, or leave this out.'})+
      field('education',e.id,'honors','Honors or distinction',e.honors,{optional:true})+
      field('education',e.id,'courses','Relevant coursework',e.courses,{optional:true,wide:true,hint:'Select courses that help explain your preparation.'})+'</div></div>').join('')+
      (!state.education.length?'<div class="empty-state"><h2>Your studies belong here.</h2><p>Add a degree, certificate program, or other relevant education.</p></div>':'')+
      '<button class="add-btn" data-action="add-education">+ Add education</button>'+next('details','library','Work on my evidence');
  }
  function contributionForm(e,c) {
    const override = Object.hasOwn(v().overrides,c.id);
    return '<div class="contribution-edit" id="edit-'+c.id+'">'+
      field('contribution',c.id,'text',override?'Shared resume bullet':'Your resume bullet',c.text,{area:true,finished:true,max:C.LIMITS.text,hint:override?'Shared wording is available to your other versions. Review the adapted wording below for the current resume.':'Edit in your own voice. Versions without adapted wording use this shared bullet.'})+
      '<p class="word-count" id="words-'+c.id+'">'+c.text.trim().split(/\s+/).filter(Boolean).length+' words</p>'+
      (override?'<div class="notice">This resume version uses different wording for this accomplishment. <button class="btn link" data-action="version-wording" data-id="'+c.id+'">Review version wording</button></div>':'')+
      '<div class="feedback" id="feedback-'+c.id+'">'+C.feedback(c,c.text).map(x=>'<p class="'+(x.good?'good':'')+'">'+(x.good?'✓ ':'○ ')+esc(x.text)+'</p>').join('')+'</div>'+
      '<details '+(!c.text?'open':'')+'><summary>Find the facts behind the sentence</summary><div>'+
      field('contribution',c.id,'action','What did you personally do?',c.action,{area:true,max:C.LIMITS.text,placeholder:C.SOURCES[e.source].action})+
      field('contribution',c.id,'method','How did you do it?',c.method,{area:true,max:C.LIMITS.text,hint:'A tool, approach, decision, or constraint can make your contribution clearer.'})+
      field('contribution',c.id,'result','What changed or what did you deliver?',c.result,{area:true,max:C.LIMITS.text,hint:'A useful deliverable or reliable process counts. Use the result you can support.'})+
      '<div class="button-group"><button class="btn" data-action="build-bullet" data-id="'+c.id+'" data-mode="action">Build from my answers</button><button class="btn compact" data-action="build-bullet" data-id="'+c.id+'" data-mode="result">Lead with the result</button><button class="btn compact" data-action="verbs" data-id="'+c.id+'">Find an action verb</button><button class="btn compact" data-action="detail-prompts" data-id="'+c.id+'">Find a missing detail</button></div></div></details>'+
      '<details '+(c.reflection.startsWith('Project plan:')?'open':'')+'><summary>Keep supporting details privately</summary><div>'+
      field('contribution',c.id,'evidence','How do you know?',c.evidence,{area:true,max:C.LIMITS.note,hint:'Record an artifact name, feedback, a witness, or the basis for a measurement. These notes stay out of resume exports.'})+
      field('contribution',c.id,'reflection','What did you decide or learn?',c.reflection,{area:true,max:C.LIMITS.note,placeholder:'What was your judgment call? What would you do differently?'})+
      field('contribution',c.id,'attribution','Your contribution',c.attribution,{select:itemOptions(P.attribution)})+
      field('contribution',c.id,'tags','Skills or themes to remember',c.tags.join(', '),{optional:true,hint:'Separate with commas, for example: research, communication, budgeting.'})+
      '<button class="btn compact mt16" data-action="metric" data-id="'+c.id+'">Check a measurement</button></div></details>'+
      '<div class="form-divider">'+check('contribution',c.id,'reviewed','I reviewed the shared wording and can explain and support this claim.',c.reviewed)+'</div>'+
      '<div class="button-group"><button class="btn compact" data-action="version-wording" data-id="'+c.id+'">Wording for this version</button><button class="btn compact" data-action="practice" data-id="'+c.id+'">Practice explaining it</button><button class="btn compact danger" data-action="remove-contribution" data-id="'+c.id+'">Remove from collection</button></div></div>';
  }
  function feedbackHTML(c) {
    return C.feedback({...c,reviewed:reviewedFor(c)},textFor(c)).map(x=>'<p class="'+(x.good?'good':'')+'">'+(x.good?'✓ ':'○ ')+esc(x.text)+'</p>').join('');
  }
  function syncClaim(id) {
    const c=findCard(id)?.contribution;if(!c)return;
    const text=$('#claim-text-'+id),label=$('#claim-state-'+id);
    if(text)text.textContent=textFor(c)||c.action||'A memory waiting for your words.';
    if(label)label.textContent=(reviewedFor(c)?'Claim reviewed':'Claim to review')+(Object.hasOwn(v().overrides,id)?' · Version wording':'')+(c.evidence?' · Supporting note saved':'');
    const shared=document.querySelector('[data-entity="contribution"][data-id="'+id+'"][data-key="reviewed"]');
    if(shared)shared.checked=c.reviewed;
  }
  function matchesLibraryMode(c) {
    if(libraryMode==='selected')return chosen(c.id);
    if(libraryMode==='unselected')return !chosen(c.id);
    if(libraryMode==='review')return !!textFor(c).trim()&&!reviewedFor(c);
    if(libraryMode==='draft')return !textFor(c).trim();
    return true;
  }
  function libraryView() {
    const query=search.toLowerCase();
    const matching=c=>[textFor(c),c.text,c.action,c.method,c.result,c.evidence,c.reflection,c.tags.join(' ')].join(' ').toLowerCase().includes(query);
    const visible=e=>e.contributions.filter(c=>matchesLibraryMode(c)&&(!query||[e.role,e.organization].join(' ').toLowerCase().includes(query)||matching(c)));
    const entries=state.experiences.filter(e=>(filter==='all'||e.source===filter)&&(visible(e).length||(!e.contributions.length&&libraryMode==='all'&&(!query||[e.role,e.organization].join(' ').toLowerCase().includes(query)))));
    return head('04 / YOUR EVIDENCE COLLECTION','Keep the accomplishments.<br>Choose the best ones.','Collect work, projects, and everyday contributions here. Checked bullets appear in '+esc(v().name)+'. Everything else stays available for later.')+
      '<div class="toolbar"><label for="library-search" class="sr-only">Search your evidence</label><input id="library-search" value="'+esc(search)+'" placeholder="Find a project, skill, or contribution"><label for="library-filter" class="sr-only">Experience source</label><select id="library-filter"><option value="all">All experiences</option>'+Object.entries(C.SOURCES).map(([key,s])=>'<option value="'+key+'" '+(filter===key?'selected':'')+'>'+esc(s.label)+'</option>').join('')+'</select></div>'+
      '<div class="toolbar"><label for="library-mode">Show</label><select id="library-mode">'+[['all','All contributions'],['selected','In this resume'],['unselected','Not selected'],['review','Claims to review'],['draft','Draft memories']].map(([key,label])=>'<option value="'+key+'" '+(key===libraryMode?'selected':'')+'>'+label+'</option>').join('')+'</select><p class="subtle-note">'+entries.reduce((n,e)=>n+visible(e).length,0)+' of '+cards().length+' contributions shown</p></div>'+
      '<div class="page-actions"><button class="btn primary" data-action="choose-source">+ Find another experience</button><button class="btn" data-action="import-assignment">Open an assignment file</button><button class="btn" data-action="navigate" data-page="versions">Choose resume version</button></div>'+
      (!state.experiences.length?'<div class="empty-state"><h2>Start with one real moment.</h2><p>A project, a shift at work, a club event, or a family responsibility can give you somewhere to begin.</p><button class="btn primary" data-action="choose-source">Find an experience</button></div>':
      !entries.length?'<div class="empty-state"><h2>No matching experiences yet.</h2><p>Try another word or select all experiences.</p></div>':'')+
      entries.map(e=>'<article class="library-card" id="experience-'+e.id+'"><div class="library-heading"><div><h2>'+esc(e.role || e.organization || C.SOURCES[e.source].label)+'</h2><p>'+esc([e.role?e.organization:'',e.dates].filter(Boolean).join(' · ') || 'Add a title and dates when you are ready.')+'</p></div><span class="tag">'+esc(statusLabel(e.status))+'</span><button class="btn compact" data-action="toggle-experience" data-id="'+e.id+'" aria-expanded="'+(openExperience===e.id)+'" aria-controls="experience-details-'+e.id+'">Details</button></div>'+
      '<div class="library-body"><div id="experience-details-'+e.id+'" '+(openExperience===e.id?'':'hidden')+'><div class="compact-grid">'+
      field('experience',e.id,'role','Your role',e.role,{placeholder:C.SOURCES[e.source].role})+
      field('experience',e.id,'organization','Organization or project',e.organization,{placeholder:C.SOURCES[e.source].org})+
      field('experience',e.id,'dates','Dates',e.dates,{placeholder:'January 2026 to Present'})+
      field('experience',e.id,'location','Location',e.location,{optional:true})+
      field('experience',e.id,'status','Type of work',e.status,{select:itemOptions(P.statuses)})+
      field('experience',e.id,'section','Resume section',e.section,{select:[['experience','Experience'],['projects','Projects'],['leadership','Leadership & Service']]})+'</div>'+
      '<p class="subtle-note">Describe coursework, prototypes, and simulated campaigns as the work you completed. Your decisions and deliverables can demonstrate real skills.</p>'+
      '<div class="button-group"><button class="btn compact" data-action="move-experience" data-id="'+e.id+'" data-dir="-1">↑ Move up</button><button class="btn compact" data-action="move-experience" data-id="'+e.id+'" data-dir="1">↓ Move down</button><button class="btn compact danger" data-action="remove-experience" data-id="'+e.id+'">Remove experience</button></div><div class="form-divider"></div></div>'+
      visible(e).map(c=>{const i=e.contributions.indexOf(c);return '<div class="contribution '+(chosen(c.id)?'selected':'')+'" id="card-'+c.id+'"><div class="contribution-row">'+check('selection',c.id,'included','<span class="sr-only">Include contribution '+(i+1)+' from '+esc(e.organization || C.SOURCES[e.source].label)+' in '+esc(v().name)+'</span>',chosen(c.id))+
      '<div><p id="claim-text-'+c.id+'">'+esc(textFor(c) || c.action || 'A memory waiting for your words.')+'</p><p class="subtle-note" id="claim-state-'+c.id+'">'+(reviewedFor(c)?'Claim reviewed':'Claim to review')+(Object.hasOwn(v().overrides,c.id)?' · Version wording':'')+(c.evidence?' · Supporting note saved':'')+'</p></div><button class="btn compact" data-action="edit-contribution" data-id="'+c.id+'" aria-expanded="'+(openContribution===c.id)+'">Edit</button></div>'+
      (openContribution===c.id?contributionForm(e,c):'')+
      '<div class="mini-actions" style="padding:0 12px 10px"><button class="icon-btn" data-action="move-contribution" data-id="'+c.id+'" data-dir="-1" aria-label="Move contribution up" '+(i===0?'disabled':'')+'>↑</button><button class="icon-btn" data-action="move-contribution" data-id="'+c.id+'" data-dir="1" aria-label="Move contribution down" '+(i===e.contributions.length-1?'disabled':'')+'>↓</button><button class="btn subtle compact" data-action="duplicate-contribution" data-id="'+c.id+'">Duplicate</button></div></div>';}).join('')+
      '<button class="add-btn" data-action="add-contribution" data-id="'+e.id+'">+ Add a contribution from this experience</button></div></article>').join('')+
      '<p class="subtle-note">Move entries within a section into the order you want employers to read. Your full collection stays here even when a bullet is hidden from a resume version.</p>'+next('education','skills','Connect my skills');
  }
  function skillLinks(skill) {
    const options=cards().filter(x=>x.contribution.text || x.contribution.action);
    return '<div class="evidence-link-list">'+(!options.length?'<p>Capture an experience first, then connect it here.</p>':'')+
      options.map(({experience:e,contribution:c})=>check('skill-link',skill.id,c.id,esc((c.text || c.action).slice(0,160))+'<br><span class="muted">'+esc(e.organization || C.SOURCES[e.source].label)+'</span>',skill.contributionIds.includes(c.id))).join('')+'</div>';
  }
  function skillsView() {
    return head('05 / SKILLS WITH CONTEXT','Know where you have used it.','Name concrete tools, methods, or languages. Connect them to your work so you can show what you have practiced.')+
      state.skills.map(skill=>'<article class="skills-card" id="skill-'+skill.id+'"><div class="card-title"><h2>'+esc(skill.name || 'A skill you can demonstrate')+'</h2><button class="btn subtle compact danger" data-action="remove-skill" data-id="'+skill.id+'">Remove</button></div><div class="field-grid">'+
      field('skill',skill.id,'name','Skill name',skill.name,{wide:true,placeholder:'Excel (pivot tables), survey design, or Spanish'})+
      field('skill',skill.id,'category','Category',skill.category,{select:[['tools','Tools and technology'],['methods','Methods and practical skills'],['languages','Languages']]})+
      field('skill',skill.id,'practice','Your practice with this skill',skill.practice,{select:itemOptions(P.practiceLevels)})+'</div>'+
      '<div class="mt16">'+check('selection-skill',skill.id,'included','Include in '+esc(v().name),v().skillIds.includes(skill.id))+'</div>'+
      '<p class="subtle-note">'+(skill.contributionIds.length?skill.contributionIds.length+' contribution'+(skill.contributionIds.length===1?'':'s')+' connected.':'Where have you used this? Connect an example, or make a plan to practice it.')+'</p>'+
      '<details><summary>Connect evidence for this skill</summary>'+skillLinks(skill)+'</details>'+
      (!skill.contributionIds.length?'<button class="btn compact mt16" data-action="projects">Find a practice project</button>':'')+'</article>').join('')+
      (!state.skills.length?'<div class="empty-state"><h2>Start with one concrete skill.</h2><p>Think of a tool, technique, or language you have actually used. You can add the example behind it.</p></div>':'')+
      '<button class="add-btn" data-action="add-skill">+ Add a skill</button>'+
      '<div class="subheading"><h2>Other meaningful highlights</h2><p>Relevant certifications, awards, and specific interests can add useful context.</p></div>'+
      field('state','shared','extras','Additional highlights',state.extras,{area:true,optional:true,max:C.LIMITS.extras,placeholder:'Certification name, issuer, year\nAward name, organization, year',hint:'One item per line. These highlights are shared across resume versions.'})+
      next('library','versions','Choose my resume version');
  }
  function requirementsView() {
    const current=v();
    return '<div class="subheading"><h2>Connect an opportunity to your evidence</h2><p>Paste a description, select a requirement, then choose the work that demonstrates it. The description stays on this device.</p></div>'+
      field('variant',current.id,'jobDescription','Job, internship, or opportunity description',current.jobDescription,{area:true,rows:5,max:C.LIMITS.jobDescription,optional:true,hint:'Highlight a useful phrase, then choose “Add a requirement.” You can also enter requirements yourself.'})+
      '<button class="btn mt16" data-action="add-requirement">+ Add a requirement</button>'+
      current.requirements.map(r=>{
        const linked=cards().filter(x=>r.contributionIds.includes(x.contribution.id));
        const included=linked.filter(x=>chosen(x.contribution.id)&&textFor(x.contribution).trim());
        const matches=C.requirementMatches(state,r.text);
        return '<article class="requirement-card" id="requirement-'+r.id+'"><div class="requirement-head"><h3>'+esc(r.text)+'</h3><span class="tag '+(included.length?'green':linked.length?'':'amber')+'">'+(included.length?'Evidence included':linked.length?'Evidence available':'Choose evidence')+'</span></div>'+
          '<div class="requirement-evidence">'+requirementEvidence(r)+'</div>'+
          '<details><summary>Choose supporting contributions</summary><p class="subtle-note">Possible connections use words and a small local vocabulary. You decide which examples genuinely support this requirement.</p><div class="evidence-link-list">'+
          cards().filter(x=>textFor(x.contribution)||x.contribution.action).map(({experience:e,contribution:c})=>check('requirement-link',r.id,c.id,esc((textFor(c)||c.action).slice(0,160))+(matches.includes(c.id)?' <span class="tag">Possible text connection</span>':'')+'<br><span class="muted">'+esc(e.organization || C.SOURCES[e.source].label)+'</span>',r.contributionIds.includes(c.id))).join('')+'</div></details>'+
          '<button class="btn subtle compact danger mt16" data-action="remove-requirement" data-id="'+r.id+'">Remove requirement</button></article>';
      }).join('');
  }
  function requirementEvidence(r) {
    const linked=cards().filter(x=>r.contributionIds.includes(x.contribution.id));
    if(!linked.length)return '<p class="subtle-note">Which contribution could help you demonstrate this requirement?</p>';
    return '<p class="subtle-note">'+linked.length+' connected example'+(linked.length===1?'':'s')+'. Choose what belongs in this resume.</p><div class="evidence-link-list">'+linked.map(({contribution:c})=>'<div class="connected-evidence"><p>'+esc(textFor(c)||c.action||'Finish this contribution in My evidence.')+'</p>'+check('selection',c.id,'included','Include in '+esc(v().name),chosen(c.id))+'<button class="btn compact" data-action="version-wording" data-id="'+c.id+'">Edit wording for this version</button></div>').join('')+'</div>';
  }
  function refreshRequirementStatus() {
    for(const r of v().requirements) {
      const node=$('#requirement-'+r.id+' .requirement-head .tag');if(!node)continue;
      const included=r.contributionIds.some(id=>{const item=findCard(id);return item&&chosen(id)&&textFor(item.contribution).trim();});
      node.textContent=included?'Evidence included':r.contributionIds.length?'Evidence available':'Choose evidence';
      node.className='tag '+(included?'green':r.contributionIds.length?'':'amber');
    }
  }
  function versionsView() {
    return head('06 / RESUME VERSIONS','Choose what this opportunity<br>needs to see.','Keep a general resume and make focused versions. Your full evidence collection stays available while each version keeps its own selection and wording.')+
      '<div class="version-grid">'+state.variants.map(item=>'<button class="version-card '+(item.id===v().id?'active':'')+'" data-action="select-variant" data-id="'+item.id+'" aria-pressed="'+(item.id===v().id)+'"><strong>'+esc(item.name)+'</strong><p>'+item.contributionIds.length+' contributions · '+item.skillIds.length+' skills</p></button>').join('')+'</div>'+
      '<div class="page-actions"><button class="btn primary" data-action="new-variant">+ Create a version</button><button class="btn" data-action="duplicate-variant">Duplicate this version</button><button class="btn subtle danger" data-action="remove-variant" '+(state.variants.length===1?'disabled':'')+'>Remove this version</button></div>'+
      field('variant',v().id,'name','Name of this version',v().name,{max:C.LIMITS.contact,placeholder:'Marketing internship'})+
      '<p class="subtle-note">The collection and education are shared. Selected contributions, skills, headline, introduction, and presentation settings belong to this version.</p>'+
      '<button class="btn mt16" data-action="navigate" data-page="library">Select contributions for '+esc(v().name)+'</button>'+
      requirementsView()+next('skills','finish','Review and export');
  }
  function interviewView() {
    const available=cards().filter(x=>textFor(x.contribution).trim());
    if (!available.some(x=>x.contribution.id===interviewId)) interviewId=available.find(x=>chosen(x.contribution.id))?.contribution.id || available[0]?.contribution.id || null;
    const card=findCard(interviewId);
    return head('07 / INTERVIEW PRACTICE','Be ready to explain your words.','Choose a contribution and practice the story behind it. Your answers stay private and never appear on your resume.')+
      (!card?'<div class="empty-state"><h2>Your first story starts with a contribution.</h2><p>Finish one bullet in My evidence, then return here to practice explaining it.</p><button class="btn primary" data-action="navigate" data-page="library">Work on my evidence</button></div>':
      '<div class="field"><label for="practice-contribution">Contribution to practice</label><select id="practice-contribution">'+available.map(({experience:e,contribution:c})=>'<option value="'+c.id+'" '+(c.id===interviewId?'selected':'')+'>'+esc((e.organization || C.SOURCES[e.source].label)+' · '+(textFor(c)||c.text).slice(0,95))+'</option>').join('')+'</select></div>'+
      '<p class="selected-claim mt16">'+esc(textFor(card.contribution)||card.contribution.text)+'</p>'+
      '<h2>Questions worth being ready for</h2><ul class="question-list">'+C.rehearsal(card.contribution,textFor(card.contribution)).map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>'+
      '<details><summary>Review my supporting notes</summary><p>'+esc(card.contribution.evidence || 'No evidence note yet. You can add one in My evidence.')+'</p><p>'+esc(card.contribution.reflection)+'</p></details>'+
      '<div class="practice-panel"><h2>Make a few notes, then speak naturally.</h2>'+
      [['situation','What was happening?'],['task','What needed to be done?'],['action','What did you personally do and decide?'],['result','What happened or what did you deliver?'],['lesson','What did you learn or what would you change?']].map(([key,label])=>field('interview',card.contribution.id,key,label,card.contribution.interview[key],{area:true,rows:2,max:C.LIMITS.note})).join('')+
      '<div class="timer"><span id="timer-display" aria-label="Practice time">'+timerText()+'</span></div><div class="timer-controls"><button class="btn" data-action="timer">'+(timerHandle?'Pause':'Start speaking timer')+'</button><button class="btn" data-action="timer-reset">Reset timer</button></div><p class="subtle-note">Try a clear one-minute explanation. The timer helps you practice at your own pace.</p></div>'+
      '<div class="review-list"><label class="check-label"><input type="checkbox"><span>I explained my own part clearly.</span></label><label class="check-label"><input type="checkbox"><span>I could explain the evidence behind the result.</span></label><label class="check-label"><input type="checkbox"><span>I described a decision or something I learned.</span></label></div>'+
      '<button class="btn mt16" data-action="interview-export">Export interview preparation</button>')+
      next('versions','finish','Return to my resume');
  }
  function finishView() {
    const a=C.assessments(state),words=C.countWords(state),selected=cards().filter(x=>chosen(x.contribution.id)&&textFor(x.contribution).trim());
    return head('08 / REVIEW AND EXPORT','Make it unmistakably yours.','Read the selected version as someone meeting you for the first time. Take an editable copy and check its final layout.')+
      '<p class="tag">'+esc(v().name)+'</p><p class="finish-intro mt16">'+a.filter(x=>x.ready).length+' of '+a.length+' foundations ready. These checks show the presence of basic content and your claim review.</p>'+
      a.map(item=>'<div class="check-card '+(item.ready?'ready':'')+'"><span class="check-icon" aria-hidden="true">'+(item.ready?'✓':'○')+'</span><div><h3>'+esc(item.name)+'</h3><p>'+esc(item.ready?'In place for this version.':item.description)+'</p></div><button class="btn subtle compact" data-action="navigate" data-page="'+item.step+'">'+(item.ready?'Edit':'Review')+'</button></div>').join('')+
      reviewCenter()+
      '<div class="subheading"><h2>Presentation for this version</h2><p>Use clear headings and readable type. Your content remains selectable and editable.</p></div><div class="compact-grid">'+
      field('variant',v().id,'style','Type style',v().style,{select:[['modern','Modern · Arial'],['classic','Classic · Georgia']]})+
      field('variant',v().id,'density','Spacing',v().density,{select:[['comfortable','Comfortable'],['compact','Compact']]})+
      field('variant',v().id,'paperSize','Paper size',v().paperSize,{select:[['letter','US Letter'],['a4','A4']]})+'</div>'+
      '<details class="mt16"><summary>Arrange resume sections</summary><p>Move the sections that best explain your preparation higher. Empty sections are omitted.</p><ol class="section-order">'+v().order.map((key,i)=>'<li><span>'+esc(C.LABELS[key])+'</span><button class="icon-btn" data-action="move-section" data-key="'+key+'" data-dir="-1" aria-label="Move '+esc(C.LABELS[key])+' up" '+(i===0?'disabled':'')+'>↑</button><button class="icon-btn" data-action="move-section" data-key="'+key+'" data-dir="1" aria-label="Move '+esc(C.LABELS[key])+' down" '+(i===v().order.length-1?'disabled':'')+'>↓</button></li>').join('')+'</ol></details>'+
      '<div class="export-card"><h2>Your resume. Yours to edit.</h2><p>'+selected.length+' selected contributions · '+words+' words. Private evidence and interview notes are excluded.</p>'+
      '<button class="btn primary" data-action="export-word">Download Word resume</button><div class="button-group"><button class="btn" data-action="print">Print / Save PDF</button><button class="btn" data-action="export-text">Download plain text</button><button class="btn" data-action="preview">Full preview</button></div>'+
      '<p class="subtle-note">'+(words>600?'This version is getting long. Select your most relevant evidence and check the page breaks. ':'A focused first resume is often one page. ')+'Word and browser print can paginate differently. Review the downloaded file before submitting.</p></div>'+
      '<div class="review-list"><label class="check-label"><input type="checkbox"><span>I read the wording aloud and checked names, dates, and measurements.</span></label><label class="check-label"><input type="checkbox"><span>I checked that this version shows the evidence relevant to my opportunity.</span></label></div>'+
      '<div class="page-actions"><button class="btn" data-action="backup">Save project backup</button><button class="btn" data-action="template">Download blank Word template</button><button class="btn" data-action="peer-review">Prepare a peer review copy</button></div>'+next('versions','discover','Find another experience');
  }
  function resumeHTML(s=state,interactive=true) {
    const output=C.content(s),current=C.variant(s);
    let html='<div class="resume-name '+(!output.name?'ghost':'')+'">'+esc(output.name || 'Your name')+'</div><div class="resume-contact">'+esc(output.contact.join(' · '))+'</div>';
    if (output.headline) html+='<div class="resume-headline">'+esc(output.headline)+'</div>';
    if (output.summary) html+='<p>'+esc(output.summary)+'</p>';
    if (!output.sections.length) return html+'<section class="resume-section ghost"><h3>Your story starts here</h3><p>Add your education and one contribution. Only the content you select will appear in your export.</p><div class="ghost-lines"><i></i><i></i><i></i></div></section>';
    for (const section of output.sections) {
      const sectionPage=section.key==='education'?'education':section.key==='skills'||section.key==='extras'?'skills':'library';
      html+='<section class="resume-section"><h3 '+(interactive?'tabindex="0" role="button" data-action="navigate" data-page="'+sectionPage+'" aria-label="Edit '+esc(section.title)+'"':'')+'>'+esc(section.title)+'</h3>';
      for (const e of section.entries) {
        html+='<div class="resume-entry">'+(e.title?'<div class="resume-title">'+esc(e.title)+'</div>':'')+(e.sub?'<div class="resume-sub">'+esc(e.sub)+'</div>':'');
        if (e.bullets.length) html+='<ul>'+e.bullets.map((text,i)=>'<li '+(interactive&&e.bulletIds[i]?'tabindex="0" role="button" data-action="preview-edit" data-id="'+esc(e.bulletIds[i])+'" aria-label="Edit contribution: '+esc(text.slice(0,80))+'"':'')+'>'+esc(text)+'</li>').join('')+'</ul>';
        html+='</div>';
      }
      html+='</section>';
    }
    return html;
  }
  function preview() {
    const current=v(),paper=$('#resume-preview');paper.className='paper '+current.style+' '+current.density+' '+current.paperSize;
    paper.innerHTML=resumeHTML();$('#active-version').textContent=current.name;$('#preview-tip').textContent=P.tips[page] || '';
  }
  function render(focus=false,target=null) {
    const active=document.activeElement;
    const fieldToken=active?.dataset.entity?{entity:active.dataset.entity,id:active.dataset.id,key:active.dataset.key,start:active.selectionStart,end:active.selectionEnd}:null;
    const token=target || (active?.dataset.action?{action:active.dataset.action,id:active.dataset.id,key:active.dataset.key,dir:active.dataset.dir}:null);
    nav();$('#editor').innerHTML=banner()+({discover:discoverView,details:detailsView,education:educationView,library:libraryView,skills:skillsView,versions:versionsView,interview:interviewView,finish:finishView}[page])()+historyButtons();
    preview();
    if (focus) { $('#editor h1')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});$('.nav-step.active')?.scrollIntoView({block:'nearest',inline:'nearest'}); }
    else if (fieldToken&&!target) {
      const el=[...document.querySelectorAll('[data-entity]')].find(x=>x.dataset.entity===fieldToken.entity&&x.dataset.id===fieldToken.id&&x.dataset.key===fieldToken.key);
      (el || $('#editor h1'))?.focus({preventScroll:true});
      if(el&&typeof fieldToken.start==='number'&&el.setSelectionRange&&(['text','email','tel','search'].includes(el.type)||el.tagName==='TEXTAREA'))try{el.setSelectionRange(fieldToken.start,fieldToken.end);}catch{}
    } else if (token) {
      const candidates=[...$('#editor').querySelectorAll('[data-action]')];
      const el=candidates.find(x=>x.dataset.action===token.action&&(!token.id||x.dataset.id===token.id)&&(!token.key||x.dataset.key===token.key)&&(!token.dir||x.dataset.dir===token.dir));
      (el || $('#editor h1'))?.focus({preventScroll:true});
    }
  }
  function navigate(key) {
    if (!pages.some(([k])=>k===key)) return;
    clearTimeout(searchTimer);
    if (key!=='interview'&&timerHandle) {clearInterval(timerHandle);timerHandle=null;}
    editSession=null;page=key;render(true);
  }
  function modal(title,body,options={}) {
    if(!options.preserveImport){importRequest++;pendingImport=null;}
    const m=$('#modal');
    if (!m.open) modalReturn=document.activeElement;
    m.className=options.preview?'dialog-preview':'';
    m.innerHTML='<div class="dialog-head"><div><h2 id="modal-title">'+esc(title)+'</h2>'+(options.subtitle?'<p>'+esc(options.subtitle)+'</p>':'')+'</div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">×</button></div>'+body;
    if (!m.open) m.showModal();
    if (options.focus) $('#'+options.focus)?.focus();
  }
  function closeModal() {
    const m=$('#modal'),wording=m.open&&m.querySelector('[data-entity="override"]');
    const returnToken=modalReturn?.dataset.action?{action:modalReturn.dataset.action,id:modalReturn.dataset.id}:null;
    importRequest++;pendingImport=null;m.close();
    if(wording){render(false,returnToken);return;}
    if(modalReturn?.isConnected)modalReturn.focus({preventScroll:true});else $('#editor h1')?.focus({preventScroll:true});
  }
  function confirm(title,message,action,id='') {
    modal(title,'<p class="dialog-copy">'+esc(message)+'</p><div class="dialog-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="'+action+'" data-id="'+esc(id)+'">Continue</button></div>');
  }
  function chooseSource() {
    modal('Where did this experience happen?','<div class="source-select">'+Object.entries(C.SOURCES).map(([key,s])=>'<button class="btn" data-action="discover-source" data-source="'+key+'">'+esc(s.label)+'</button>').join('')+'</div>',{subtitle:'Choose a starting point. First, we will capture one memory.'});
  }
  function discoverModal(source) {
    if (!Object.hasOwn(C.SOURCES,source)) return;
    discovery={source,memory:discovery?.source===source?discovery.memory:'',method:discovery?.source===source?discovery.method:'',result:discovery?.source===source?discovery.result:''};
    const selected=P.lenses.find(x=>x.id===lens);
    modal('Start with one real moment.',
      '<p class="dialog-copy">'+esc(selected?.question || C.SOURCES[source].prompt)+'</p>'+
      '<div class="field mt16"><label for="discovery-memory">What is one thing you did here?</label><textarea id="discovery-memory" rows="3" maxlength="'+C.LIMITS.text+'" placeholder="Write it roughly. You can polish it later.">'+esc(discovery.memory)+'</textarea></div>'+
      '<details class="mt16"><summary>Need a different way to remember?</summary><div class="lenses">'+P.lenses.map(x=>'<button class="chip '+(x.id===lens?'active':'')+'" data-action="discovery-lens" data-id="'+x.id+'">'+esc(x.label)+'</button>').join('')+'</div></details>'+
      (selected?'<p class="subtle-note">'+esc(selected.followup)+'</p>':'')+
      '<details class="mt16"><summary>Add a method or outcome now</summary><div class="field mt16"><label for="discovery-method">How did you do it?</label><textarea id="discovery-method" rows="2" maxlength="'+C.LIMITS.text+'">'+esc(discovery.method)+'</textarea></div><div class="field mt16"><label for="discovery-result">What changed or what did you deliver?</label><textarea id="discovery-result" rows="2" maxlength="'+C.LIMITS.text+'">'+esc(discovery.result)+'</textarea></div></details>'+
      '<div class="dialog-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="capture-memory">Save this memory →</button></div>',{subtitle:C.SOURCES[source].label,focus:'discovery-memory'});
  }
  function captureDiscoveryValues() {
    if (!discovery) return;
    discovery.memory=$('#discovery-memory')?.value ?? discovery.memory;
    discovery.method=$('#discovery-method')?.value || '';
    discovery.result=$('#discovery-result')?.value || '';
  }
  function examplesModal(index=exampleIndex) {
    exampleIndex=index;
    const x=P.examples[index];
    modal('From a responsibility to a contribution.',
      '<div class="example-tabs" role="group" aria-label="Fictional examples">'+P.examples.map((item,i)=>'<button class="chip '+(i===index?'active':'')+'" data-action="example" data-index="'+i+'" aria-pressed="'+(i===index)+'">'+esc(item.label)+'</button>').join('')+'</div>'+
      '<div class="example-block"><h3>The starting thought</h3><p>'+esc(x.before)+'</p><h3 class="mt16">With specific facts</h3><p>'+esc(x.after)+'</p><p class="small">'+esc(x.why)+'</p></div>'+
      '<p class="subtle-note">Every example is fictional. Use the structure and your own facts.</p><div class="dialog-actions"><button class="btn" data-action="sample-preview">See a full sample resume</button><button class="btn primary" data-action="close-modal">Return to my work</button></div>');
  }
  function projectsModal() {
    modal('Build an example you can point to.',
      '<p class="dialog-copy">Choose a small practice project. Record what you actually complete, the decisions you make, and an artifact you can show.</p><div class="project-picker">'+P.projects.map((x,i)=>'<button data-action="project-prompt" data-index="'+i+'"><strong>'+esc(x.title)+'</strong><span>'+esc(x.category)+'</span></button>').join('')+'</div>');
  }
  function projectModal(index) {
    const x=P.projects[index];
    modal(x.title,'<p class="dialog-copy">'+esc(x.prompt)+'</p><p class="subtle-note">You can record this as a plan now. Add an accomplishment after you complete work you can describe.</p><div class="dialog-actions"><button class="btn" data-action="projects">Other projects</button><button class="btn primary" data-action="start-project" data-index="'+index+'">Save a project plan</button></div>');
  }
  function detailPrompts(id) {
    modal('Find the detail that makes this yours.',
      '<div class="examples-grid">'+[
        ['Scope','What people, items, deadlines, or responsibilities were involved?'],
        ['Audience','Who needed this work, and what did they need to understand or do?'],
        ['Constraint','What limitation changed how you approached the task?'],
        ['Decision','What alternatives did you consider, and why did you choose this one?'],
        ['Deliverable','What usable thing did you finish?'],
        ['Use','Who used the work, and how do you know?']
      ].map(([title,q])=>'<div class="example-block"><h3>'+title+'</h3><p>'+q+'</p></div>').join('')+'</div><div class="dialog-actions"><button class="btn primary" data-action="return-to-contribution" data-focus="facts" data-id="'+id+'">Add a detail to my answers</button></div>');
  }
  function verbsModal(id) {
    modal('Choose the action you actually took.',
      '<p class="dialog-copy">Use a verb that accurately describes your part. Selecting one inserts it into your action notes so you can finish the thought.</p>'+
      P.verbs.map(x=>'<h3 class="mt16">'+esc(x.label)+'</h3><div class="lenses">'+x.words.map(word=>'<button class="chip" data-action="insert-verb" data-id="'+id+'" data-verb="'+word+'">'+word+'</button>').join('')+'</div>').join(''));
  }
  function wordingModal(id) {
    const card=findCard(id);if(!card)return;
    const c=card.contribution,adapted=Object.hasOwn(v().overrides,id);
    modal('Wording for '+v().name,
      '<p class="dialog-copy">Keep the same underlying facts while choosing how to explain them for this opportunity. This wording belongs only to this resume version.</p>'+
      '<p class="subtle-note">Shared wording: '+esc(c.text || '(Not yet written)')+'</p>'+
      field('override',id,'text','Wording in this version',textFor(c),{area:true,max:C.LIMITS.text})+
      '<div class="feedback" id="override-feedback">'+feedbackHTML(c)+'</div>'+
      '<div class="mt16">'+check('override-review',id,'reviewed','I reviewed this version of the claim and can support it.',adapted?v().reviewedOverrides.includes(id):c.reviewed)+'</div>'+
      '<div class="dialog-actions"><button class="btn" data-action="clear-override" data-id="'+id+'" '+(!adapted?'disabled':'')+'>Use shared wording</button><button class="btn primary" data-action="close-wording">Done</button></div>');
  }
  function metricModal(id) {
    modal('Check the arithmetic behind a measurement.',
      '<p class="dialog-copy">Enter values you measured or can explain. This calculator checks arithmetic; you decide whether a measurement belongs in your claim.</p>'+
      '<div class="compact-grid mt16"><div class="field"><label for="metric-before">Before value</label><input id="metric-before" type="number" step="any"></div><div class="field"><label for="metric-after">After value</label><input id="metric-after" type="number" step="any"></div></div>'+
      '<div class="field mt16"><label for="metric-basis">Where did the values come from?</label><textarea id="metric-basis" rows="2" maxlength="'+Math.floor(C.LIMITS.note/2)+'" placeholder="For example, time logs from two comparable weeks."></textarea></div>'+
      '<button class="btn mt16" data-action="calculate-metric" data-id="'+id+'">Calculate</button><div class="metric-output" id="metric-output" role="status"></div><div class="dialog-actions"><button class="btn" data-action="close-modal">Close</button><button class="btn primary" data-action="save-metric" data-id="'+id+'">Keep calculation in private notes</button></div>');
  }
  function previewModal(sample=false) {
    const s=sample?C.sample():state,current=C.variant(s);
    modal(sample?'A fictional student resume':v().name,
      '<div class="preview-scroll"><div class="paper-wrap"><article class="paper '+current.style+' '+current.density+' '+current.paperSize+'">'+resumeHTML(s,false)+'</article></div></div>'+
      '<p class="subtle-note">'+(sample?'The student and every experience here are fictional. Your work is unchanged.':'Private notes are excluded. Review final page breaks in the exported file.')+'</p>'+
      '<div class="dialog-actions"><button class="btn" data-action="close-modal">Close preview</button>'+(!sample?'<button class="btn primary" data-action="export-word">Download Word</button>':'')+'</div>',{preview:true});
  }
  function dataModal() {
    try{refreshSnapshots();}catch{toast('Existing restore points could not be read. Save a project backup too.');}
    modal('Keep your work with you.',
      '<p class="dialog-copy">Your work stays on this device. A project backup lets you continue elsewhere and includes your private evidence and interview notes.</p>'+
      '<div class="data-row"><div><strong>Remember on this device</strong><p>Turn off on a shared computer. Browser data is device-local and not encrypted.</p></div><label class="switch-label"><input id="remember-toggle" type="checkbox" '+(remember?'checked':'')+'><span>Save locally</span></label></div>'+
      '<div class="data-row"><div><strong>Download a project backup</strong><p>Includes all resume versions, evidence, and private notes.</p></div><button class="btn" data-action="backup">Save backup</button></div>'+
      (historyError?'<div class="notice">'+esc(historyError)+'<br><button class="btn" data-action="recover-history">Download restore-point copy</button></div>':'')+
      '<div class="data-row"><div><strong>Open a project backup</strong><p>Preview before replacing your current work. Older Proof backups are supported.</p></div><button class="btn" data-action="import-backup">Open backup</button></div>'+
      '<div class="data-row"><div><strong>Open an assignment file</strong><p>Add contributions from a compatible local file after reviewing them.</p></div><button class="btn" data-action="import-assignment">Open assignment</button></div>'+
      '<div class="data-row"><div><strong>Download the offline app</strong><p>A clean copy without your personal data. Save your project backup separately.</p></div><button class="btn" data-action="offline">Save app</button></div>'+
      '<div class="data-row"><div><strong>Save a restore point</strong><p>Keep up to five named versions of your whole project on this device.</p></div><button class="btn" data-action="snapshot">Save restore point</button></div>'+
      snapshots.map((s,i)=>'<div class="snapshot-row"><div><strong>'+esc(s.name)+'</strong><small>'+esc(new Date(s.at).toLocaleString())+'</small></div><button class="btn compact" data-action="restore-snapshot" data-index="'+i+'">Restore</button></div>').join('')+
      '<div class="data-row"><div><strong>Start a new project</strong><p>Save a backup first. You can undo this during the current session.</p></div><button class="btn danger" data-action="reset">Start fresh</button></div>'+
      '<div class="data-row"><div><strong>Clear saved work from this device</strong><p>Remove stored drafts and restore points. Your current session remains open.</p></div><button class="btn danger" data-action="clear-storage">Clear saved copies</button></div>');
  }
  function snapshotModal() {
    modal('Save a restore point.',
      '<div class="field"><label for="snapshot-name">Name this point</label><input id="snapshot-name" maxlength="100" placeholder="Before my internship application"></div><p class="subtle-note">Restore points include your full project and private notes. Project backups are separate files you can keep elsewhere.</p>'+
      '<div class="dialog-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-snapshot">Save restore point</button></div>',{focus:'snapshot-name'});
  }
  function aboutModal() {
    modal('A resume built from your own evidence.',
      '<div class="dialog-copy"><p>Proof helps students recognize their contributions, describe them clearly, and select relevant evidence for an opportunity. Marketing and business examples lead, with prompts for all majors.</p><h3>How the guidance works</h3><p>Bundled questions, editable sentence assembly, and visible writing checks help you think through your own work. You supply the facts and decide what to include.</p><h3>Privacy and offline use</h3><p>The app makes no external calls and uses no tracking, accounts, remote fonts, or AI services. The host receives an ordinary page request when you open a hosted copy. Download the app for offline use.</p><h3>Your exports</h3><p>Resume exports include selected public content. Project backups include private notes. Interview notes are available through a separate export with explicit choices.</p><h3>Open source</h3><p>MIT licensed. Developed by Alex Garrido to help students build resumes they can confidently explain.</p></div><div class="dialog-actions"><button class="btn" data-action="offline">Download offline app</button><button class="btn primary" data-action="close-modal">Back to my work</button></div>');
  }
  function timerText() {return String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');}
  function download(data,name,type) {
    const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  function safeName(value) {return value.trim().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,'-').slice(0,120)||'My';}
  function backup() {
    download(JSON.stringify(C.normalize(state),null,2),'Proof-'+safeName(state.contact.name || 'Project')+'-Backup.json','application/json');
    toast('Project backup prepared. It includes your private notes and all resume versions.');
  }
  function exportWord(template=false) {
    const s=template?C.template():C.normalize(state);
    download(X.docx(s),template?'Proof-Resume-Template.docx':safeName(state.contact.name)+'-'+safeName(v().name)+'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    toast('Word file prepared. Review its final page breaks before submitting.');
  }
  function offline() {
    const body=document.body.cloneNode(true),head=document.head.cloneNode(true);
    body.querySelectorAll('script').forEach(el=>el.remove());
    ['editor','steps','resume-preview','preview-tip','modal','toast','print-root','active-version','progress-text'].forEach(id=>body.querySelector('#'+id)?.replaceChildren());
    body.querySelector('#modal').removeAttribute('open');body.querySelector('#toast').hidden=true;
    body.querySelector('#progress-fill').style.width='0';body.querySelector('#progress').setAttribute('aria-valuenow','0');
    body.querySelector('#status-label').textContent='Starting';body.querySelector('#save-state').classList.remove('conflict');
    body.querySelectorAll('[inert]').forEach(el=>el.removeAttribute('inert'));
    const css=document.querySelector('style').textContent;
    head.querySelectorAll('script,style,link[rel="modulepreload"]').forEach(el=>el.remove());
    const endTag='<'+ '/script>';
    const scripts=['proof-core','proof-content','proof-export','proof-ui'].map(id=>'<script id="'+id+'">'+$('#'+id).textContent+endTag).join('');
    download('<!doctype html>\n<html lang="en"><head>'+head.innerHTML+'<style>'+css+'</style></head><body>'+body.innerHTML+scripts+'</body></html>','Proof-Resume.html','text/html');
    toast('Clean offline app prepared. Save a project backup separately to take your work with you.');
  }
  function invalidate(id,allVersions=false) {
    const c=findCard(id)?.contribution;if(c)c.reviewed=false;
    if (allVersions) for (const item of state.variants) item.reviewedOverrides=item.reviewedOverrides.filter(x=>x!==id);
  }
  function cleanCopiedText(el) {
    const original=el.value;
    const cleaned=original.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,' ').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g,'\ufffd');
    if(cleaned===original)return;
    const start=el.selectionStart,end=el.selectionEnd;el.value=cleaned;
    if(typeof start==='number')try{el.setSelectionRange(start,end);}catch{}
    toast('Cleaned an unsupported hidden character from the copied text so your work can save. Please check the wording.');
  }
  function update(el) {
    const {entity,id,key}=el.dataset;
    let value=el.type==='checkbox'?el.checked:el.value;
    let target;
    if(entity==='contact')target=state.contact;
    else if(entity==='education')target=state.education.find(x=>x.id===id);
    else if(entity==='experience')target=state.experiences.find(x=>x.id===id);
    else if(entity==='contribution')target=findCard(id)?.contribution;
    else if(entity==='skill')target=state.skills.find(x=>x.id===id);
    else if(entity==='variant')target=state.variants.find(x=>x.id===id);
    else if(entity==='interview')target=findCard(id)?.contribution.interview;
    else if(entity==='state')target=state;
    if (entity==='contribution'&&key==='tags') {
      value=[...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))];
      if(value.length>C.LIMITS.tags||value.some(x=>x.length>C.LIMITS.tag)) {toast('Keep up to '+C.LIMITS.tags+' concise themes, each no longer than '+C.LIMITS.tag+' characters.');return;}
    }
    const session=entity+':'+id+':'+key;
    if(editSession!==session) {takeUndo();editSession=session;}
    if(entity==='selection') {
      v().contributionIds=value?[...new Set([...v().contributionIds,id])]:v().contributionIds.filter(x=>x!==id);
      el.closest('.contribution')?.classList.toggle('selected',value);
    } else if(entity==='selection-skill') {
      v().skillIds=value?[...new Set([...v().skillIds,id])]:v().skillIds.filter(x=>x!==id);
    } else if(entity==='skill-link'||entity==='requirement-link') {
      const record=entity==='skill-link'?state.skills.find(x=>x.id===id):v().requirements.find(x=>x.id===id);
      if(!record)return;
      record.contributionIds=value?[...new Set([...record.contributionIds,key])]:record.contributionIds.filter(x=>x!==key);
    } else if(entity==='override') {
      v().overrides[id]=value;v().reviewedOverrides=v().reviewedOverrides.filter(x=>x!==id);
      const box=$('#modal [data-entity="override-review"]');if(box)box.checked=false;
      const clear=$('#modal [data-action="clear-override"]');if(clear)clear.disabled=false;
    } else if(entity==='override-review') {
      if(Object.hasOwn(v().overrides,id))v().reviewedOverrides=value?[...new Set([...v().reviewedOverrides,id])]:v().reviewedOverrides.filter(x=>x!==id);
      else {const c=findCard(id)?.contribution;if(c)c.reviewed=value;}
    } else {
      if(!target||!Object.hasOwn(target,key))return;
      target[key]=value;
      if(entity==='contribution'&&['text','action','method','result','evidence','attribution'].includes(key)) {
        invalidate(id,key!=='text');
        const box=document.querySelector('[data-entity="contribution"][data-id="'+id+'"][data-key="reviewed"]');if(box)box.checked=false;
      }
      if(entity==='experience'&&['role','organization','dates','location','status'].includes(key)) {
        target.contributions.forEach(c=>invalidate(c.id,true));
        target.contributions.forEach(c=>{const box=document.querySelector('[data-entity="contribution"][data-id="'+c.id+'"][data-key="reviewed"]');if(box)box.checked=false;});
      }
    }
    save();nav();preview();
    if(['contribution','override','override-review'].includes(entity))syncClaim(id);
    if(entity==='experience')target.contributions.forEach(c=>syncClaim(c.id));
    if(entity==='selection')document.querySelectorAll('[data-entity="selection"][data-id="'+id+'"]').forEach(box=>box.checked=chosen(id));
    if(['selection','override','override-review'].includes(entity))refreshRequirementStatus();
    if(['override','override-review'].includes(entity)) {
      const notes=$('#override-feedback');if(notes)notes.innerHTML=feedbackHTML(findCard(id).contribution);
    }
    if(entity==='contribution') {
      const card=findCard(id),notes=$('#feedback-'+id),words=$('#words-'+id);
      if(notes)notes.innerHTML=C.feedback(card.contribution,card.contribution.text).map(x=>'<p class="'+(x.good?'good':'')+'">'+(x.good?'✓ ':'○ ')+esc(x.text)+'</p>').join('');
      if(words)words.textContent=card.contribution.text.trim().split(/\s+/).filter(Boolean).length+' words';
    }
  }
  function canAddExperience() {return state.experiences.length<C.LIMITS.experiences&&cards().length<C.LIMITS.contributions;}
  function attachContribution(e,c) {
    if(e.contributions.length>=C.LIMITS.contributionsPerExperience||cards().length>=C.LIMITS.contributions)throw new Error('This collection has reached its contribution limit. Save a backup and start another project.');
    e.contributions.push(c);v().contributionIds.push(c.id);openExperience=e.id;openContribution=c.id;
    search='';filter='all';libraryMode='all';
  }
  function removeContribution(id) {
    for(const e of state.experiences)e.contributions=e.contributions.filter(c=>c.id!==id);
    for(const item of state.variants) {
      item.contributionIds=item.contributionIds.filter(x=>x!==id);delete item.overrides[id];
      item.reviewedOverrides=item.reviewedOverrides.filter(x=>x!==id);
      item.requirements.forEach(r=>r.contributionIds=r.contributionIds.filter(x=>x!==id));
    }
    state.skills.forEach(s=>s.contributionIds=s.contributionIds.filter(x=>x!==id));
    if(openContribution===id)openContribution=null;
  }
  function move(array,id,direction) {
    const i=array.findIndex(x=>x.id===id),j=i+Number(direction);
    if(i>=0&&j>=0&&j<array.length)[array[i],array[j]]=[array[j],array[i]];
  }
  function restoreUndo(direction) {
    const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;if(!from.length)return;
    to.push(JSON.stringify(state));state=C.normalize(JSON.parse(from.pop()));state.remember=remember;editSession=null;save();render();
    toast(direction==='undo'?'Change undone.':'Change restored.');
  }
  function openImport(mode) {importRequest++;pendingImport=null;importMode=mode;$('#import-file').value='';$('#import-file').click();}
  async function readImport(file,mode,request) {
    if(file.size>C.LIMITS.backupBytes)throw new Error('Choose a file smaller than '+Math.floor(C.LIMITS.backupBytes/1000000)+' MB.');
    const text=await file.text();if(request!==importRequest)return;
    const raw=JSON.parse(text);
    if(mode==='assignment') {
      const experiences=C.normalizeHandoff(raw);
      if(state.experiences.length+experiences.length>C.LIMITS.experiences||cards().length+experiences.reduce((n,e)=>n+e.contributions.length,0)>C.LIMITS.contributions)throw new Error('This assignment would exceed the collection limit.');
      pendingImport={kind:'assignment',experiences};
      modal('Review the assignment before adding it.',
        '<p class="dialog-copy">These contributions will be added to your collection. Review and edit the claims in your own words before using them.</p><div class="import-preview">'+experiences.map(e=>'<h3>'+esc(e.organization)+'</h3><p class="tag">'+esc(statusLabel(e.status))+'</p>'+e.contributions.map(c=>'<p>'+esc(c.text || c.action)+'</p>').join('')).join('')+'</div><p class="subtle-note">Imported claims start unreviewed. Private notes stay out of resume exports.</p><div class="dialog-actions"><button class="btn" data-action="cancel-import">Cancel</button><button class="btn primary" data-action="confirm-import">Add these contributions</button></div>',{preserveImport:true});
    } else {
      const candidate=C.normalize(raw);
      pendingImport={kind:'backup',state:candidate};
      modal('Review this project backup.',
        '<p class="dialog-copy">Open '+esc(candidate.contact.name || 'this student project')+' with '+candidate.experiences.length+' experiences and '+candidate.variants.length+' resume versions? Your current project will be replaced. A recovery copy of your current work will be prepared first.</p><div class="dialog-actions"><button class="btn" data-action="cancel-import">Cancel</button><button class="btn" data-action="backup">Back up current work</button><button class="btn primary" data-action="confirm-import">Open this project</button></div>',{preserveImport:true});
    }
  }
  function interviewExportModal() {
    modal('Choose what to include in interview preparation.',
      '<p class="dialog-copy">The file includes interview questions for this resume version. You can explicitly add your supporting evidence, reflection, and rehearsal notes.</p><label class="check-label mt16"><input type="checkbox" id="include-private-interview"><span>Include my private evidence and interview notes</span></label><div class="dialog-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-interview-export">Download preparation notes</button></div>');
  }
  function calculateMetric() {
    const before=$('#metric-before').value,after=$('#metric-after').value,result=C.metric(before,after);
    $('#metric-output').textContent='Change: '+Number(result.difference.toFixed(4))+(result.percent===null?'. A percentage change cannot be calculated from zero.':'. '+Math.abs(Number(result.percent.toFixed(2)))+'% '+(result.percent<0?'decrease':result.percent>0?'increase':'change')+'.');
    return {before,after,result};
  }
  function printResume() {
    closeModal();const current=v();
    $('#print-root').innerHTML='<article class="paper '+current.style+' '+current.density+' '+current.paperSize+'">'+resumeHTML(state,false)+'</article>';
    let style=$('#print-page-style');if(!style){style=document.createElement('style');style.id='print-page-style';document.head.append(style);}
    style.textContent='@media print { @page { size: '+(current.paperSize==='a4'?'A4':'letter')+'; margin: .65in; } }';
    window.print();
  }
  document.addEventListener('focusin',e=>{if(e.target.matches('[data-entity]'))editSession=null;});
  document.addEventListener('input',e=>{
    if(e.target.matches('input:not([type="file"]):not([type="checkbox"]),textarea'))cleanCopiedText(e.target);
    if(e.target.matches('[data-entity]')&&e.target.type!=='checkbox'&&e.target.tagName!=='SELECT')update(e.target);
  });
  document.addEventListener('focusout',e=>{
    if(e.target.dataset.entity==='contact'&&e.target.dataset.key==='email') {
      const invalid=!!e.target.value.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim());
      e.target.setAttribute('aria-invalid',invalid);e.target.classList.toggle('bad-input',invalid);
      const message=$('#email-error');if(message){message.hidden=!invalid;message.textContent='Check the email address. Include a name, @ sign, and domain, such as you@example.com.';}
    }
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.matches('[data-entity]')&&(el.type==='checkbox'||el.tagName==='SELECT')) {
      update(el);
      if(el.dataset.entity==='skill-link') {
        const skill=state.skills.find(x=>x.id===el.dataset.id),node=el.closest('.skills-card')?.querySelector('p.subtle-note');
        if(node)node.textContent=skill.contributionIds.length+' contributions connected.';
      }
      if(el.dataset.entity==='requirement-link') {
        const r=v().requirements.find(x=>x.id===el.dataset.id),node=el.closest('.requirement-card')?.querySelector('.requirement-evidence');
        if(node)node.innerHTML=requirementEvidence(r);refreshRequirementStatus();
      }
      if(page==='library'&&((el.dataset.entity==='selection'&&['selected','unselected'].includes(libraryMode))||(el.dataset.entity==='contribution'&&el.dataset.key==='reviewed'&&libraryMode==='review')))render();
    }
    if(el.id==='library-filter'){filter=el.value;render();$('#library-filter').focus();}
    if(el.id==='library-mode'){libraryMode=el.value;render();$('#library-mode').focus();}
    if(el.id==='practice-contribution'){interviewId=el.value;elapsed=0;if(timerHandle){clearInterval(timerHandle);timerHandle=null;}render();$('#practice-contribution').focus();}
    if(el.id==='remember-toggle') {
      remember=el.checked;state.remember=remember;
      try{sessionStorage.setItem(MODE_KEY,remember?'local':'session');}catch{}
      if(!remember) {
        clearTimeout(saveTimer);conflict=false;snapshots=[];historyError='';
        try{localStorage.removeItem(KEY);localStorage.removeItem(OLD_KEY);localStorage.removeItem(HISTORY_KEY);lastStored=null;}catch{toast('Use browser settings to clear saved copies if storage cannot be removed.');}
        status('Session only');toast('Device saving is off. Save a project backup before closing.');
      } else {
        try{lastStored=localStorage.getItem(KEY);}catch{}conflict=false;save();toast('Saving on this device is enabled.');
      }
    }
  });
  document.addEventListener('keydown',e=>{
    const target=e.target;
    if((e.key==='Enter'||e.key===' ')&&target.matches('.paper [data-action]')){e.preventDefault();target.click();}
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'&&!target.matches('input,textarea,[contenteditable]')) {e.preventDefault();restoreUndo(e.shiftKey?'redo':'undo');}
  });
  let searchTimer;
  $('#editor').addEventListener('input',e=>{
    if(e.target.id==='library-search') {
      search=e.target.value;clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>{if(page!=='library')return;const start=e.target.selectionStart;render();const input=$('#library-search');if(input){input.focus();input.setSelectionRange(start,start);}},180);
    }
  });
  $('#import-file').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    const request=++importRequest,mode=importMode;
    try{await readImport(file,mode,request);}catch(error){if(request!==importRequest)return;pendingImport=null;toast(error.message || 'This file could not be opened. Your current work is unchanged.');}
  });
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
    const action=b.dataset.action,id=b.dataset.id;
    try {
      if(action==='navigate') {closeModal();navigate(b.dataset.page);}
      else if(action==='review-target')followTarget(JSON.parse(b.dataset.target));
      else if(action==='close-modal')closeModal();
      else if(action==='dismiss'){notice='';render();}
      else if(action==='data')dataModal();
      else if(action==='about')aboutModal();
      else if(action==='examples')examplesModal();
      else if(action==='example'){examplesModal(Number(b.dataset.index));$('#modal [data-index="'+b.dataset.index+'"]')?.focus();}
      else if(action==='sample-preview')previewModal(true);
      else if(action==='preview')previewModal();
      else if(action==='choose-source')chooseSource();
      else if(action==='discover-source'){lens=null;discovery=null;discoverModal(b.dataset.source);}
      else if(action==='discovery-lens'){captureDiscoveryValues();lens=id;discoverModal(discovery.source);}
      else if(action==='capture-memory') {
        captureDiscoveryValues();
        if(!discovery?.memory.trim()){toast('Write one thing you did. Rough words are enough to begin.');$('#discovery-memory').focus();return;}
        if(!canAddExperience())throw new Error('Save a backup and start another project before adding more experiences.');
        const e=C.experience(discovery.source),c=C.contribution();c.action=discovery.memory.trim();c.method=discovery.method.trim();c.result=discovery.result.trim();
        change(()=>{state.experiences.push(e);attachContribution(e,c);openExperience=null;page='library';search='';filter='all';libraryMode='all';},{focus:true});closeModal();
        document.getElementById('edit-'+c.id)?.scrollIntoView({block:'start',behavior:'instant'});
        document.getElementById('f-contribution-'+c.id+'-action')?.focus({preventScroll:true});
        toast('Memory saved. Add the details, then build or write your bullet.');
      }
      else if(action==='toggle-experience'){openExperience=openExperience===id?null:id;render();}
      else if(action==='edit-contribution'){openContribution=openContribution===id?null:id;render();}
      else if(action==='preview-edit'||action==='return-to-contribution') {
        closeModal();const item=findCard(id);if(!item)return;page='library';search='';filter='all';libraryMode='all';openContribution=id;openExperience=item.experience.id;render();
        document.getElementById('edit-'+id)?.scrollIntoView({block:'start',behavior:'instant'});
        if(b.dataset.focus==='facts') {
          const field=document.getElementById('f-contribution-'+id+'-action');if(field){field.closest('details').open=true;field.focus({preventScroll:true});}
        } else document.getElementById('f-contribution-'+id+'-text')?.focus({preventScroll:true});
      }
      else if(action==='add-education') {
        if(state.education.length>=C.LIMITS.education)throw new Error('This project has reached its education-entry limit.');
        const e=C.education();change(()=>state.education.push(e));document.getElementById('f-education-'+e.id+'-school')?.focus();
      }
      else if(action==='add-contribution') {
        const e=state.experiences.find(x=>x.id===id),c=C.contribution();change(()=>attachContribution(e,c));
        document.getElementById('f-contribution-'+c.id+'-action')?.focus();
      }
      else if(action==='duplicate-contribution') {
        const item=findCard(id),c=structuredClone(item.contribution);c.id=C.id();c.reviewed=false;
        change(()=>attachContribution(item.experience,c));toast('Contribution duplicated. Review the wording before using both.');
      }
      else if(action==='move-education')change(()=>move(state.education,id,b.dataset.dir));
      else if(action==='move-experience')change(()=>move(state.experiences,id,b.dataset.dir));
      else if(action==='move-contribution')change(()=>move(findCard(id).experience.contributions,id,b.dataset.dir));
      else if(action==='remove-education')confirm('Remove this education entry?','You can undo the removal during this session.','confirm-remove-education',id);
      else if(action==='confirm-remove-education'){change(()=>{state.education=state.education.filter(x=>x.id!==id);});closeModal();toast('Education entry removed. Undo is available.');}
      else if(action==='remove-contribution')confirm('Remove this contribution?','This removes its wording and private notes from the collection and resume versions. You can undo it during this session.','confirm-remove-contribution',id);
      else if(action==='confirm-remove-contribution'){change(()=>removeContribution(id));closeModal();toast('Contribution removed. Undo is available.');}
      else if(action==='remove-experience')confirm('Remove this experience?','Its contributions and private notes will also be removed. You can undo it during this session.','confirm-remove-experience',id);
      else if(action==='confirm-remove-experience') {
        change(()=>{const e=state.experiences.find(x=>x.id===id);e.contributions.map(c=>c.id).forEach(removeContribution);state.experiences=state.experiences.filter(x=>x.id!==id);openExperience=null;});closeModal();toast('Experience removed. Undo is available.');
      }
      else if(action==='build-bullet') {
        const c=findCard(id).contribution;
        if(b.dataset.mode==='result'&&!c.result.trim()){toast('Add an outcome or deliverable you can support first.');return;}
        const proposed=C.draft(c,b.dataset.mode);
        if(!proposed){toast('Describe what you personally did first.');document.getElementById('f-contribution-'+id+'-action')?.focus();return;}
        if(proposed.length>C.LIMITS.text)throw new Error('This draft is too long for one contribution. Shorten the answers or separate the work into several cards.');
        modal('Compare the wording.',
          '<p class="dialog-copy">The draft uses only your answers. Edit it to sound natural, then choose whether to use it.</p>'+(c.text?'<p class="subtle-note">Current bullet: '+esc(c.text)+'</p>':'')+
          '<div class="field mt16"><label for="assembled-bullet">Draft from my answers</label><textarea id="assembled-bullet" rows="4" maxlength="'+C.LIMITS.text+'">'+esc(proposed)+'</textarea></div>'+
          '<div class="dialog-actions"><button class="btn" data-action="close-modal">Keep my current wording</button><button class="btn primary" data-action="apply-bullet" data-id="'+id+'">Use this wording</button></div>');
      }
      else if(action==='apply-bullet') {
        const text=$('#assembled-bullet').value;if(!text.trim()){toast('Add wording before applying this draft.');return;}
        change(()=>{findCard(id).contribution.text=text;invalidate(id);});closeModal();document.getElementById('f-contribution-'+id+'-text')?.focus();toast('Bullet updated. Review the claim in your own words.');
      }
      else if(action==='detail-prompts')detailPrompts(id);
      else if(action==='verbs')verbsModal(id);
      else if(action==='insert-verb') {
        const c=findCard(id).contribution,verb=b.dataset.verb;
        if(c.action.length+verb.length+1>C.LIMITS.text)throw new Error('Shorten the action notes before inserting a verb.');
        change(()=>{c.action=verb+' '+c.action;invalidate(id,true);});closeModal();const field=document.getElementById('f-contribution-'+id+'-action');if(field){field.closest('details').open=true;field.focus();}
      }
      else if(action==='version-wording')wordingModal(id);
      else if(action==='close-wording'){closeModal();render();}
      else if(action==='clear-override'){change(()=>{delete v().overrides[id];v().reviewedOverrides=v().reviewedOverrides.filter(x=>x!==id);});closeModal();toast('This version uses the shared wording again.');}
      else if(action==='metric')metricModal(id);
      else if(action==='calculate-metric')calculateMetric();
      else if(action==='save-metric') {
        const {before,after,result}=calculateMetric(),basis=$('#metric-basis').value.trim();
        if(!basis){toast('Record where the values came from so you can explain them.');$('#metric-basis').focus();return;}
        const note='Measurement: '+before+' to '+after+'. Change: '+result.difference+(result.percent===null?'; percentage undefined from zero.':'; '+Number(result.percent.toFixed(2))+'% change.')+' Basis: '+basis;
        const c=findCard(id).contribution,full=(c.evidence?c.evidence+'\n':'')+note;
        if(full.length>C.LIMITS.note)throw new Error('The evidence note is full. Save the calculation separately or shorten the note.');
        change(()=>{c.evidence=full;invalidate(id,true);});closeModal();toast('Calculation added to private supporting notes.');
      }
      else if(action==='add-skill') {
        if(state.skills.length>=C.LIMITS.skills)throw new Error('This project has reached its skill limit.');
        const skill={id:C.id(),name:'',category:'tools',practice:'',contributionIds:[]};
        change(()=>{state.skills.push(skill);v().skillIds.push(skill.id);});document.getElementById('f-skill-'+skill.id+'-name')?.focus();
      }
      else if(action==='remove-skill')confirm('Remove this skill?','It will be removed from all resume versions. You can undo the change.','confirm-remove-skill',id);
      else if(action==='confirm-remove-skill'){change(()=>{state.skills=state.skills.filter(x=>x.id!==id);state.variants.forEach(item=>item.skillIds=item.skillIds.filter(x=>x!==id));});closeModal();}
      else if(action==='select-variant') {change(()=>state.selectedVariantId=id);toast('Now editing '+v().name+'.');}
      else if(action==='new-variant') {
        if(state.variants.length>=C.LIMITS.variants)throw new Error('This project has reached its resume-version limit.');
        modal('Create a focused resume version.',
          '<div class="field"><label for="new-variant-name">Name this version</label><input id="new-variant-name" maxlength="'+C.LIMITS.contact+'" placeholder="Marketing internship"></div><label class="check-label mt16"><input type="checkbox" id="copy-selection" checked><span>Start with the current contributions and skills</span></label><div class="dialog-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-new-variant">Create version</button></div>',{focus:'new-variant-name'});
      }
      else if(action==='confirm-new-variant') {
        const name=$('#new-variant-name').value.trim();if(!name){toast('Give this version a name.');$('#new-variant-name').focus();return;}
        const item=C.variantFactory(name),copy=$('#copy-selection').checked;
        if(copy){item.contributionIds=[...v().contributionIds];item.skillIds=[...v().skillIds];item.order=[...v().order];item.style=v().style;item.density=v().density;item.paperSize=v().paperSize;}
        change(()=>{state.variants.push(item);state.selectedVariantId=item.id;});closeModal();toast('Version created. Choose what this opportunity needs to see.');
      }
      else if(action==='duplicate-variant') {
        if(state.variants.length>=C.LIMITS.variants)throw new Error('This project has reached its resume-version limit.');
        const item=structuredClone(v());item.id=C.id();item.name=item.name.slice(0,C.LIMITS.contact-5).replace(/[\ud800-\udbff]$/,'')+' copy';item.requirements.forEach(r=>r.id=C.id());
        change(()=>{state.variants.push(item);state.selectedVariantId=item.id;});toast('A separate copy of this resume version is ready.');
      }
      else if(action==='remove-variant')confirm('Remove this resume version?','Your evidence collection remains available. You can undo the removal.','confirm-remove-variant',v().id);
      else if(action==='confirm-remove-variant'){if(state.variants.length===1)return;change(()=>{state.variants=state.variants.filter(x=>x.id!==id);state.selectedVariantId=state.variants[0].id;});closeModal();}
      else if(action==='add-requirement') {
        if(v().requirements.length>=C.LIMITS.requirements)throw new Error('This version has reached its requirement limit.');
        const field=document.getElementById('f-variant-'+v().id+'-jobDescription'),selected=field?field.value.slice(field.selectionStart,field.selectionEnd):'';
        modal('What does this opportunity need?',
          '<div class="field"><label for="requirement-text">A skill, responsibility, or requirement</label><textarea id="requirement-text" maxlength="'+C.LIMITS.field+'" rows="3" placeholder="For example, analyze customer research">'+esc(selected)+'</textarea></div><div class="dialog-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-requirement">Add requirement</button></div>',{focus:'requirement-text'});
      }
      else if(action==='confirm-requirement') {
        const text=$('#requirement-text').value.trim();if(!text){toast('Enter one requirement to connect to your evidence.');return;}
        if(text.length>C.LIMITS.field){toast('Select one focused requirement. Shorten it to '+C.LIMITS.field+' characters or fewer before adding it.');$('#requirement-text').focus();return;}
        change(()=>v().requirements.push({id:C.id(),text,contributionIds:[]}));closeModal();
      }
      else if(action==='remove-requirement')change(()=>{v().requirements=v().requirements.filter(x=>x.id!==id);});
      else if(action==='move-section') {
        change(()=>{const i=v().order.indexOf(b.dataset.key),j=i+Number(b.dataset.dir);if(j>=0&&j<v().order.length)[v().order[i],v().order[j]]=[v().order[j],v().order[i]];});
        $('#editor .section-order')?.closest('details')?.setAttribute('open','');
        const button=[...$('#editor').querySelectorAll('[data-action="move-section"]')].find(x=>x.dataset.key===b.dataset.key&&x.dataset.dir===b.dataset.dir);button?.focus({preventScroll:true});
      }
      else if(action==='practice'){interviewId=id;closeModal();navigate('interview');}
      else if(action==='timer') {
        if(timerHandle){clearInterval(timerHandle);timerHandle=null;}else timerHandle=setInterval(()=>{elapsed++;if($('#timer-display'))$('#timer-display').textContent=timerText();},1000);
        b.textContent=timerHandle?'Pause':'Start speaking timer';
      }
      else if(action==='timer-reset'){elapsed=0;if(timerHandle){clearInterval(timerHandle);timerHandle=null;}$('#timer-display').textContent=timerText();$('#editor [data-action="timer"]').textContent='Start speaking timer';}
      else if(action==='interview-export')interviewExportModal();
      else if(action==='confirm-interview-export'){const include=$('#include-private-interview').checked;download(X.interviewText(C.normalize(state),include),'Proof-'+safeName(v().name)+'-Interview.txt','text/plain;charset=utf-8');closeModal();toast(include?'Interview preparation prepared with your selected private notes.':'Interview questions prepared. Private notes excluded.');}
      else if(action==='peer-review') {
        const copy=X.text(C.normalize(state))+'\n\nPEER REVIEW QUESTIONS\nWhich contribution is most specific?\nWhich claim needs a clearer example or explanation?\nWhat skill can you see demonstrated?\nWhat would you ask this person in an interview?\n';
        download(copy,'Proof-'+safeName(v().name)+'-Peer-Review.txt','text/plain;charset=utf-8');toast('Peer review copy prepared. Private notes excluded.');
      }
      else if(action==='projects')projectsModal();
      else if(action==='project-prompt')projectModal(Number(b.dataset.index));
      else if(action==='start-project') {
        if(!canAddExperience())throw new Error('This project has reached its experience limit.');
        const item=P.projects[Number(b.dataset.index)],e=C.experience('personal'),c=C.contribution();e.organization=item.title;e.status='proposal';c.reflection='Project plan: '+item.prompt;
        change(()=>{state.experiences.push(e);attachContribution(e,c);page='library';filter='all';search='';libraryMode='all';},{focus:true});closeModal();toast('Project plan saved privately. Add your contribution as you complete the work.');
      }
      else if(action==='export-word')exportWord();
      else if(action==='template')exportWord(true);
      else if(action==='export-text'){download(X.text(C.normalize(state)),safeName(state.contact.name)+'-'+safeName(v().name)+'.txt','text/plain;charset=utf-8');toast('Plain-text resume prepared for application forms.');}
      else if(action==='print')printResume();
      else if(action==='backup')backup();
      else if(action==='offline')offline();
      else if(action==='import-backup')openImport('backup');
      else if(action==='import-assignment')openImport('assignment');
      else if(action==='cancel-import'){pendingImport=null;closeModal();}
      else if(action==='confirm-import') {
        if(!pendingImport)return;
        const incoming=pendingImport;let savedRestore=true;
        if(incoming.kind==='backup') {
          savedRestore=preserve('Before opening a backup');if(!savedRestore)backup();
          takeUndo();state=incoming.state;state.remember=remember;openContribution=null;openExperience=null;page='versions';
        }else {
          takeUndo();for(const e of incoming.experiences){state.experiences.push(e);}
          page='library';filter='all';search='';libraryMode='all';openExperience=incoming.experiences[0].id;openContribution=incoming.experiences[0].contributions[0].id;
        }
        pendingImport=null;save();render(true);closeModal();toast(incoming.kind==='backup'?(savedRestore?'Project opened. Your previous work has a restore point on this device.':'Project opened. A portable backup of your previous work was prepared. Keep that downloaded file for recovery.'):'Assignment added. Review the contributions before exporting.');
      }
      else if(action==='undo')restoreUndo('undo');
      else if(action==='redo')restoreUndo('redo');
      else if(action==='snapshot')snapshotModal();
      else if(action==='confirm-snapshot'){const name=$('#snapshot-name').value.trim()||'Restore point',saved=preserve(name);closeModal();toast(saved?'Restore point saved on this device.':'Restore point kept for this session. Save a project backup before closing.');}
      else if(action==='restore-snapshot')confirm('Restore this project?','This replaces the current project with the selected restore point. You can undo it during this session.','confirm-restore-snapshot',b.dataset.index);
      else if(action==='confirm-restore-snapshot'){const s=snapshots[Number(id)];if(!s)return;takeUndo();state=C.normalize(s.data);state.remember=remember;openContribution=null;openExperience=null;save();render(true);closeModal();toast('Restore point opened.');}
      else if(action==='reset')confirm('Start a new project?','Save a backup if you want a portable copy. A recovery copy of the current project will be prepared first.','confirm-reset');
      else if(action==='confirm-reset'){const savedRestore=preserve('Before starting fresh');if(!savedRestore)backup();takeUndo();state=C.blank();state.remember=remember;openExperience=null;openContribution=null;page='discover';save();render(true);closeModal();toast(savedRestore?'New project started. Undo and a restore point on this device are available.':'New project started. A portable backup of your previous work was prepared. Keep that downloaded file for recovery.');}
      else if(action==='clear-storage')confirm('Clear saved copies from this device?','This removes saved drafts and restore points, including older Proof drafts. Your current session and downloaded files remain.','confirm-clear-storage');
      else if(action==='confirm-clear-storage'){clearTimeout(saveTimer);localStorage.removeItem(KEY);localStorage.removeItem(OLD_KEY);localStorage.removeItem(HISTORY_KEY);snapshots=[];lastStored=null;remember=false;state.remember=false;conflict=false;storageError='';historyError='';try{sessionStorage.setItem(MODE_KEY,'session');}catch{}status('Session only');closeModal();render();toast('Saved copies cleared. Download a backup before closing this session.');}
      else if(action==='recover-raw'){const raw=localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY);if(raw)download(raw,'Proof-Saved-Recovery.json','application/json');else toast('No saved copy was found.');}
      else if(action==='recover-history'){const raw=localStorage.getItem(HISTORY_KEY);if(raw)download(raw,'Proof-Restore-Points-Recovery.json','application/json');else toast('No saved restore points were found.');}
      else if(action==='load-other')confirm('Open the changes saved in another tab?','Save a backup of this draft first if you want to keep it.','confirm-load-other');
      else if(action==='confirm-load-other'){clearTimeout(saveTimer);const raw=localStorage.getItem(KEY);if(!raw)throw new Error('The saved draft was removed. Back up your current work or keep this draft instead.');const incoming=C.normalize(JSON.parse(raw));takeUndo();state=incoming;state.remember=remember;lastStored=raw;conflict=false;dirty=false;openContribution=null;openExperience=null;closeModal();render(true);status('Saved');}
      else if(action==='keep-current')confirm('Keep this draft as the saved project?','The changes saved by the other tab will be replaced. Download a backup first if you want both.','confirm-keep-current');
      else if(action==='confirm-keep-current'){lastStored=localStorage.getItem(KEY);conflict=false;closeModal();save();render();toast('This draft will be saved.');}
    } catch(error) {toast(error.message || 'The change could not be completed. Your work is still here.');}
  });
  window.addEventListener('storage',event=>{
    if(event.key===KEY&&remember) {
      let current;try{current=localStorage.getItem(KEY);}catch{return;}
      // A storage event can arrive after a newer save or page reload. Compare
      // against current disk data so a queued, stale event cannot block saving.
      if(current!==lastStored){clearTimeout(saveTimer);conflict=true;status('Review changes',true);render();toast('Another tab changed the saved work. Choose which version to continue.');}
    }
  });
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
  $('#modal').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
  render();
  status(remember?'Saved':'Session only',!!storageError);
  if(remember&&!lastStored&&notice)save();
})();
