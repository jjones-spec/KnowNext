/* KnowNext frontend prototype — vanilla JS only.
   Render functions only build HTML. Every control carries data-action (clicks), data-input or
   data-change (form fields), and one set of delegated listeners at the bottom of this file
   dispatches them — so re-rendering never stacks duplicate listeners. */
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
let state = loadState();
let currentUser = getSession();
let currentView = '';
let viewParams = {};
let pendingConfirm = null;
const ui = {
  courseQuery:'', courseFilter:'all', assessFilter:'all', assignFilter:'all', classFilter:'upcoming', annFilter:'all',
  studentQuery:'', studentFilter:'all', taskSubject:'all', taskSort:'time', taskStatus:'all',
  calMonth:'', calSelected:'', analyticsTab:'mastery', aiTool:'quiz', aiVariant:0
};

/* ---------- Demo mastery ---------- */
function applyDemoMastery(){
  const p=loadDemoProgress();
  STUDENT_TOPICS.forEach(t=>{ if(p.topics?.[t.id]!=null) t.score=p.topics[t.id]; t.recommendation=topicRecommendation(t); });
}
function topicRecommendation(t){ return t.score<70?`Review ${t.name.toLowerCase()}`:t.score<85?`Practice ${t.name.toLowerCase()}`:'Move to the next lesson'; }
function randomizeDemo(){
  loadDemoProgress(true);
  state.courses.forEach(c=>state.lessonProgress[c.id]=lessonProgressFor(Math.floor(Math.random()*55)+42));
  saveState();
  applyDemoMastery();
}
applyDemoMastery();

/* ---------- Small helpers ---------- */
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function avg(list){ return list.length?Math.round(list.reduce((a,b)=>a+b,0)/list.length):0; }
function getStatus(score){ return score<70?'Needs Attention':score<85?'Practice Recommended':'Mastered'; }
function getPriority(score){ return score<70?'HIGH':score<85?'MEDIUM':'LOW'; }
function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(window._toast); window._toast=setTimeout(()=>el.classList.remove('show'),2600); }
function val(id){ return ($('#'+id)?.value||'').trim(); }
function fmtShort(iso){ return iso?parseISO(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—'; }
function fmtLong(iso){ return parseISO(iso).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); }
function fmtTime(t){ if(!t) return ''; const [h,m]=t.split(':').map(Number); return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`; }
function daysFromToday(iso){ return Math.round((parseISO(iso)-parseISO(todayISO()))/86400000); }
function dayLabel(iso){ const n=daysFromToday(iso); if(n===0)return 'Today'; if(n===1)return 'Tomorrow'; if(n===-1)return 'Yesterday'; if(n>1&&n<7)return parseISO(iso).toLocaleDateString('en-US',{weekday:'short'}); return fmtShort(iso); }
function relDays(iso){ const n=daysFromToday(iso); if(n===0)return 'Today'; if(n===1)return 'Tomorrow'; if(n===-1)return 'Yesterday'; return n>0?`In ${n} days`:`${-n} days ago`; }
function greeting(){ const h=new Date().getHours(); return h<12?'Good morning':h<18?'Good afternoon':'Good evening'; }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function validMeetingUrl(v){ try{ const u=new URL(v); return (u.protocol==='https:'||u.protocol==='http:') && u.hostname.includes('.'); }catch(e){ return false; } }

/* ---------- Users & roles ---------- */
function isTeacher(){ return currentUser?.role==='teacher'; }
function user(){ const base=DEMO_USERS[currentUser?.username]; return base?{...base,...(state.profiles[base.username]||{})}:null; }
function initials(name){ return name.replace(/^Prof\.\s*/i,'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join(''); }
function firstName(){ return user().name.replace(/^Prof\.\s*/i,'').split(' ')[0]; }
function passwordFor(username){ return state.credentials[username] || DEMO_USERS[username]?.password; }
function settingsFor(username){ return {assessments:true,announcements:true,weekly:false,...(state.settings[username]||{})}; }

/* ---------- Courses & lessons ---------- */
function courseById(id){ return state.courses.find(c=>c.id===id); }
function courseName(id){ return id==='all'?'All courses':courseById(id)?.name || (id?'Archived course':'General'); }
function courseOptions(selected,{all=false,general=false}={}){
  return (all?`<option value="all" ${selected==='all'?'selected':''}>All courses</option>`:'')+(general?`<option value="" ${!selected?'selected':''}>General</option>`:'')+
    state.courses.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('');
}
function lessonRecord(courseId){ return state.lessonProgress[courseId] || (state.lessonProgress[courseId]={completed:[],last:''}); }
function courseProgress(courseId){ return Math.round((state.lessonProgress[courseId]?.completed||[]).length/courseLessons().length*100); }
/* A module unlocks once the module before it is complete (teachers preview without locks). */
function moduleInfo(courseId){
  const done=new Set(state.lessonProgress[courseId]?.completed||[]);
  let prevComplete=true;
  return MODULES.map((m,index)=>{
    const lessons=m.lessons.map((title,i)=>({id:`${m.id}-${i}`,title,index:i,done:done.has(`${m.id}-${i}`)}));
    const complete=lessons.every(l=>l.done), started=lessons.some(l=>l.done);
    const locked=!isTeacher() && !prevComplete && !complete;
    prevComplete=complete;
    return {...m,index,lessons,complete,locked,status:complete?'completed':locked?'locked':'review',label:complete?'Completed':locked?'Locked':started?'In progress':'Ready to start'};
  });
}
function flatLessons(courseId){ return moduleInfo(courseId).flatMap(m=>m.lessons.map(l=>({...l,module:m}))); }
function currentLesson(courseId){
  const flat=flatLessons(courseId), last=state.lessonProgress[courseId]?.last;
  const resume=flat.find(l=>l.id===last && !l.done && !l.module.locked);
  return resume || flat.find(l=>!l.done && !l.module.locked) || flat[flat.length-1];
}
function topics(){ return STUDENT_TOPICS.filter(t=>courseById(t.id)); }
function sortedTopics(){ return [...topics()].sort((a,b)=>a.score-b.score); }
function overallMastery(){ return avg(topics().map(t=>t.score)); }

/* ---------- Students ---------- */
function studentStatus(m){ return m<70?'Needs Attention':m<85?'On Track':'Mastered'; }
function students(){
  return STUDENTS.map(s=>{
    const live=s.id===DEMO_STUDENT_ID?{...s,name:{...DEMO_USERS.student123,...(state.profiles.student123||{})}.name,mastery:overallMastery()||s.mastery}:{...s};
    return {...live,status:studentStatus(live.mastery)};
  });
}
function studentById(id){ return students().find(s=>s.id===id); }
function classMastery(courseId){ const list=students().filter(s=>s.courseId===courseId); return list.length?avg(list.map(s=>s.mastery)):null; }

/* ---------- Assignments & assessments ---------- */
function submissionFor(assignmentId,studentId=DEMO_STUDENT_ID){ return state.submissions.find(s=>s.assignmentId===assignmentId&&s.studentId===studentId); }
function studentAssignmentStatus(a){ const s=submissionFor(a.id); return s?s.status:daysFromToday(a.due)<0?'Missing':'Not Started'; }
function assignmentAverage(a){ const graded=state.submissions.filter(s=>s.assignmentId===a.id&&s.status==='Graded'); return graded.length?avg(graded.map(s=>s.score/a.points*100)):null; }
function attemptsFor(assessmentId,studentId){ return state.attempts.filter(x=>x.assessmentId===assessmentId&&(studentId==null||x.studentId===studentId)); }
function latestAttempt(assessmentId,studentId=DEMO_STUDENT_ID){ return attemptsFor(assessmentId,studentId).pop(); }
function latestAttemptsByStudent(assessmentId){ const map={}; attemptsFor(assessmentId).forEach(a=>map[a.studentId]=a); return Object.values(map); }
function assessmentAverage(assessmentId){ const l=latestAttemptsByStudent(assessmentId); return l.length?avg(l.map(a=>a.score)):null; }
function visibleAssessments(){ return isTeacher()?state.assessments:state.assessments.filter(a=>a.status==='Published'); }

/* ---------- Classes ---------- */
function classStart(c){ return new Date(`${c.date}T${c.time||'00:00'}:00`); }
function classStatus(c){
  const start=classStart(c), end=new Date(start.getTime()+(Number(c.duration)||60)*60000), now=new Date();
  if(now>end) return 'Ended'; if(now>=start) return 'Live now'; if(start-now<2*3600000) return 'Starting soon'; return 'Upcoming';
}
function visibleClasses(){
  return state.classes.filter(c=>DEMO_USERS[c.owner]?.role==='teacher' || c.owner===currentUser.username)
    .sort((a,b)=>classStart(a)-classStart(b));
}
function upcomingClasses(){ return visibleClasses().filter(c=>classStatus(c)!=='Ended'); }
function canEditClass(c){ return isTeacher()?DEMO_USERS[c.owner]?.role==='teacher':c.owner===currentUser.username; }

/* ---------- Tasks ---------- */
const PRIORITY_RANK={High:0,Medium:1,Low:2};
function myTasks(){ return state.tasks.filter(t=>t.studentId===DEMO_STUDENT_ID); }

/* ---------- Notifications & activity ---------- */
function notify(role,title,view,meta,category){
  if(role==='student' && category && !settingsFor('student123')[category]) return;
  state.notifications.unshift({id:uid('ntf'),role,title,meta,view,date:todayISO(),read:false});
  state.notifications=state.notifications.slice(0,60);
}
function myNotifications(){ return state.notifications.filter(n=>n.role===currentUser.role); }
function logActivity(text,icon){ state.activity.unshift({text,icon,date:todayISO()}); state.activity=state.activity.slice(0,30); }
function unreadAnnouncements(){ return state.announcements.filter(a=>!state.annRead.includes(a.id)).length; }

/* ---------- Calendar events (derived from real records) ---------- */
function calendarEvents(){
  const ev=[], teacher=isTeacher();
  state.assignments.forEach(a=>ev.push({date:a.due,title:a.title,type:'assignment',label:'Assignment',kind:'assignment',id:a.id,courseId:a.courseId}));
  visibleAssessments().filter(a=>a.dueDate).forEach(a=>ev.push({date:a.dueDate,title:a.title,type:'quiz',label:a.type==='mastery'?'Mastery check':'Quiz',kind:'assessment',id:a.id,courseId:a.courseId}));
  visibleClasses().forEach(c=>ev.push({date:c.date,time:c.time,title:c.title,type:'class',label:'Live class',kind:'class',id:c.id,courseId:c.courseId}));
  if(!teacher) myTasks().forEach(t=>ev.push({date:t.date,time:t.time,title:t.title,type:'task',label:'Study task',kind:'task',id:t.id,courseId:t.courseId,done:t.done}));
  return ev.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
}

/* ---------- Modal, confirmation & form errors ---------- */
function showModal(title,body,actions='',opts={}){
  $('#modal-root').innerHTML=`<div class="modal-backdrop" data-close><div class="modal ${opts.wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-label="${esc(opts.label||title.replace(/<[^>]+>/g,''))}"><button class="modal-x" data-close aria-label="Close">×</button><h2>${title}</h2><div class="modal-body">${body}</div>${actions?`<div class="modal-actions">${actions}</div>`:''}</div></div>`;
  if(opts.focus!==false){ const f=$('#modal-root .modal-body input:not([type=checkbox]), #modal-root .modal-body textarea'); f?.focus(); }
}
function closeModal(){ $('#modal-root').innerHTML=''; pendingConfirm=null; }
function confirmDialog(title,message,confirmLabel,onConfirm){
  showModal(esc(title),`<p>${message}</p>`,`<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn danger-btn" data-action="confirm-yes">${esc(confirmLabel)}</button>`,{focus:false});
  pendingConfirm=onConfirm;
}
function fail(msg,fieldId){
  $$('#modal-root .invalid').forEach(x=>x.classList.remove('invalid'));
  if(fieldId){ const el=$('#'+fieldId); el?.classList.add('invalid'); el?.focus(); }
  let box=$('#modal-error');
  if(!box){ box=document.createElement('div'); box.id='modal-error'; box.className='form-error'; box.setAttribute('role','alert'); $('#modal-root .modal-body').appendChild(box); }
  box.textContent=msg;
  return false;
}

/* ---------- Icons & illustrations ---------- */
function icon(name){
  const paths={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6"/>',
    book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/>',
    path:'<circle cx="5" cy="18" r="2.5"/><circle cx="12" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M6.7 16.2 10.4 8.1M13.6 8.1l3.7 8.1"/>',
    plan:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2M8 3.8 6 2M16 3.8 18 2"/>',
    check:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 2.5 2.5L16 9"/>',
    ai:'<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
    chart:'<path d="M4 20V4M4 20h16"/><path d="m7 16 3-4 3 2 5-7"/>',
    calendar:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
    bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    people:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 14a5 5 0 0 1 6.5 4"/>',
    assignment:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5V2h6v1.5M8 8h8M8 12h8M8 16h5"/>',
    analytics:'<path d="M5 19V9M12 19V4M19 19v-7"/><path d="M3 19h18"/>',
    video:'<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/>' ,
    plus:'<path d="M12 5v14M5 12h14"/>'
  };
  return `<span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||'<circle cx="12" cy="12" r="3"/>'}</svg></span>`;
}

function svgScene(type='study'){
  const common = `<svg viewBox="0 0 520 340" role="img" aria-label="Learning illustration" class="scene-svg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lpBlue" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1769E0"/><stop offset="1" stop-color="#4EA7F2"/></linearGradient>
      <linearGradient id="lpYellow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFC928"/><stop offset="1" stop-color="#FFE477"/></linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#123B78" flood-opacity=".14"/></filter>
    </defs>`;
  const end='</svg>';
  if(type==='login') return common + `
    <g opacity=".22"><circle cx="72" cy="64" r="40" fill="#76C7F5"/><circle cx="450" cy="64" r="26" fill="#FFC928"/><path d="M18 276C85 220 135 225 184 280S300 344 365 285s96-52 137-6" fill="none" stroke="#1769E0" stroke-width="2" stroke-dasharray="5 9"/></g>
    <g filter="url(#softShadow)"><rect x="56" y="70" width="176" height="118" rx="20" fill="#fff" stroke="#123B78" stroke-width="4"/><rect x="74" y="88" width="140" height="64" rx="12" fill="#DDF2FF"/><path d="M89 134l23-20 18 12 28-28 38 36" fill="none" stroke="#1769E0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="111" cy="111" r="6" fill="#FFC928"/><rect x="93" y="169" width="104" height="9" rx="4.5" fill="#123B78"/></g>
    <g transform="translate(260 70)"><circle cx="78" cy="62" r="42" fill="#FFD6B8" stroke="#123B78" stroke-width="5"/><path d="M39 55c6-38 75-48 82 7-18-16-43-20-82-7z" fill="#172033"/><path d="M28 118c18-25 88-25 106 0l12 82H16z" fill="url(#lpBlue)" stroke="#123B78" stroke-width="5"/><path d="M29 137l-37 34M133 137l42 19" stroke="#FFD6B8" stroke-width="17" stroke-linecap="round"/><circle cx="-9" cy="174" r="9" fill="#FFD6B8"/><circle cx="176" cy="157" r="9" fill="#FFD6B8"/></g>
    <g transform="translate(320 200)" filter="url(#softShadow)"><rect width="142" height="72" rx="18" fill="#fff" stroke="#123B78" stroke-width="4"/><text x="18" y="29" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="#1769E0">NEXT STEP</text><text x="18" y="51" font-family="Arial,sans-serif" font-size="14" font-weight="800" fill="#172033">Function Transformations</text><circle cx="119" cy="25" r="10" fill="#FFC928"/><path d="M115 25l4 4 6-8" fill="none" stroke="#123B78" stroke-width="2"/></g>
    <g fill="#FFC928"><path d="M28 30l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/><path d="M470 164l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></g>${end}`;
  if(type==='teacher') return common + `
    <g opacity=".2"><circle cx="82" cy="80" r="55" fill="#76C7F5"/><circle cx="458" cy="255" r="58" fill="#FFC928"/></g>
    <g transform="translate(35 45)"><rect x="0" y="0" width="250" height="205" rx="24" fill="#fff" stroke="#123B78" stroke-width="4" filter="url(#softShadow)"/><text x="24" y="34" font-family="Arial" font-size="11" font-weight="800" fill="#1769E0">CLASS INSIGHT</text><text x="24" y="61" font-family="Arial" font-size="23" font-weight="900" fill="#172033">23 students</text><text x="24" y="81" font-family="Arial" font-size="12" fill="#667085">need support</text><path d="M28 166h184" stroke="#E5E9F0" stroke-width="10" stroke-linecap="round"/><path d="M28 166h112" stroke="#1769E0" stroke-width="10" stroke-linecap="round"/><text x="28" y="124" font-family="Arial" font-size="11" font-weight="700" fill="#172033">Function Transformations</text><text x="185" y="124" font-family="Arial" font-size="11" font-weight="800" fill="#1769E0">61%</text><circle cx="207" cy="55" r="22" fill="#FFF3BF"/><path d="M198 55l7 7 12-16" fill="none" stroke="#123B78" stroke-width="3" stroke-linecap="round"/></g>
    <g transform="translate(310 52)"><circle cx="68" cy="58" r="42" fill="#FFD6B8" stroke="#123B78" stroke-width="5"/><path d="M30 50c5-35 72-43 78 5-15-13-42-19-78-5z" fill="#172033"/><path d="M22 112c22-28 90-27 112 0l14 113H8z" fill="#FFC928" stroke="#123B78" stroke-width="5"/><path d="M34 132l-34 54M122 132l48 36" stroke="#FFD6B8" stroke-width="16" stroke-linecap="round"/><circle cx="0" cy="186" r="9" fill="#FFD6B8"/><circle cx="170" cy="168" r="9" fill="#FFD6B8"/></g>
    <g transform="translate(330 235)" fill="#1769E0"><rect width="112" height="42" rx="12"/><text x="14" y="26" font-family="Arial" font-size="11" font-weight="800" fill="#fff">ASSIGN PRACTICE →</text></g>${end}`;
  if(type==='class') return common + `
    <g opacity=".24"><circle cx="86" cy="74" r="46" fill="#FFC928"/><circle cx="442" cy="255" r="52" fill="#76C7F5"/></g>
    <g transform="translate(48 62)" filter="url(#softShadow)"><rect x="0" y="0" width="282" height="176" rx="24" fill="#fff" stroke="#123B78" stroke-width="4"/><rect x="18" y="18" width="246" height="116" rx="16" fill="#DDF2FF"/><circle cx="74" cy="72" r="25" fill="#FFD6B8" stroke="#123B78" stroke-width="4"/><path d="M45 117c10-28 49-28 59 0" fill="#1769E0" stroke="#123B78" stroke-width="4"/><circle cx="142" cy="72" r="25" fill="#FFD6B8" stroke="#123B78" stroke-width="4"/><path d="M113 117c10-28 49-28 59 0" fill="#FFC928" stroke="#123B78" stroke-width="4"/><circle cx="210" cy="72" r="25" fill="#FFD6B8" stroke="#123B78" stroke-width="4"/><path d="M181 117c10-28 49-28 59 0" fill="#76C7F5" stroke="#123B78" stroke-width="4"/><rect x="18" y="145" width="112" height="12" rx="6" fill="#1769E0"/><rect x="138" y="145" width="80" height="12" rx="6" fill="#E5E9F0"/></g>
    <g transform="translate(360 42)"><rect width="110" height="74" rx="18" fill="#FFC928" stroke="#123B78" stroke-width="4"/><text x="17" y="31" font-family="Arial" font-size="11" font-weight="800" fill="#123B78">LIVE CLASS</text><text x="17" y="55" font-family="Arial" font-size="17" font-weight="900" fill="#123B78">JOIN →</text></g>
    <g fill="#1769E0"><circle cx="34" cy="275" r="7"/><circle cx="56" cy="275" r="7"/><circle cx="78" cy="275" r="7"/></g>${end}`;
  return common + `
    <g transform="translate(52 70)"><path d="M0 160C58 95 130 85 200 126s124 37 187-14" fill="none" stroke="#1769E0" stroke-width="8" stroke-linecap="round"/><circle cx="35" cy="146" r="20" fill="#fff" stroke="#123B78" stroke-width="4"/><circle cx="200" cy="126" r="20" fill="#FFC928" stroke="#123B78" stroke-width="4"/><circle cx="387" cy="111" r="20" fill="#fff" stroke="#123B78" stroke-width="4"/><path d="M29 146l6 7 12-16M194 126l6 7 12-16" fill="none" stroke="#123B78" stroke-width="3"/><rect x="96" y="22" width="160" height="74" rx="18" fill="#fff" stroke="#123B78" stroke-width="4" filter="url(#softShadow)"/><text x="115" y="51" font-family="Arial" font-size="11" font-weight="800" fill="#1769E0">ADAPTIVE PATH</text><text x="115" y="74" font-family="Arial" font-size="15" font-weight="900" fill="#172033">Find the next step</text></g>${end}`;
}

/* ---------- Login ---------- */
function renderLogin(){
  document.body.className='login-body';
  $('#app').innerHTML=`<main class="login-page"><section class="login-art"><div class="art-shape art-blue"></div><div class="art-shape art-yellow"></div><div class="art-dots">• • •<br>• • •</div><div class="art-copy"><span class="eyebrow">STUDY SMARTER. KNOW WHAT'S NEXT.</span><h1>Study Smarter.<br><em>Know What's Next.</em></h1><p>An adaptive learning platform that helps you understand your progress, identify what needs attention, and decide what to do next.</p></div><div class="poster-scene">${svgScene('login')}</div><div class="art-number">01</div></section><section class="login-panel"><div class="login-card"><div class="brand"><img class="brand-logo" src="assets/knownext-logo.png" alt="KnowNext logo"><span>KnowNext</span></div><div class="login-heading"><span class="eyebrow">WELCOME BACK</span><h2>Start where<br>you need to.</h2><p>Sign in to continue your learning journey.</p></div><form id="login-form" data-form="login"><label>Username<input id="login-user" autocomplete="username" placeholder="Enter username" required></label><label>Password<div class="password-wrap"><input id="login-pass" type="password" autocomplete="current-password" placeholder="Enter password" required><button type="button" id="toggle-pass" data-action="toggle-pass">Show</button></div></label><button class="primary-btn full" type="submit">Log in <span>→</span></button><div id="login-error" class="form-error" role="alert"></div></form><div class="demo-accounts"><strong>Demo Accounts</strong><div><span>Student</span><code>student123 / student123</code></div><div><span>Teacher</span><code>teacher123 / teacher123</code></div></div></div></section></main>`;
}
function handleLogin(){
  const username=$('#login-user').value.trim(), pass=$('#login-pass').value, u=DEMO_USERS[username];
  if(!username||!pass){ $('#login-error').textContent='Enter both your username and password.'; return; }
  if(!u||passwordFor(username)!==pass){ $('#login-error').textContent='Incorrect username or password. Try one of the demo accounts.'; return; }
  currentUser=setSession(u); currentView='dashboard'; viewParams={};
  renderApp();
}
function logout(){
  clearSession(); currentUser=null; currentView=''; viewParams={}; closeModal();
  renderLogin(); toast('You have been logged out.');
}

/* ---------- App shell ---------- */
const STUDENT_NAV=[['dashboard','Dashboard','home'],['courses','My Courses','book'],['learning-path','Learning Path','path'],['study-plan','Study Plan','plan'],['virtual-class','Virtual Class','video'],['assessments','Assessments','check'],['assignments','Assignments','assignment'],['ai-tools','AI Study Tools','ai'],['progress','Progress','chart'],['calendar','Calendar','calendar'],['announcements','Announcements','bell'],['profile','Profile','user']];
const TEACHER_NAV=[['dashboard','Dashboard','home'],['courses','My Courses','book'],['students','Students','people'],['assessments','Assessments','check'],['assignments','Assignments','assignment'],['analytics','Learning Analytics','analytics'],['virtual-class','Virtual Class','video'],['ai-tools','AI Teaching Tools','ai'],['announcements','Announcements','bell'],['calendar','Calendar','calendar'],['profile','Profile','user']];
function navList(){ return isTeacher()?TEACHER_NAV:STUDENT_NAV; }
function labelView(v){ if(v==='lesson') return `My Courses <span>/</span> ${esc(courseName(viewParams.courseId))}`; return navList().find(x=>x[0]===v)?.[1]||'Dashboard'; }

function renderApp(){
  document.body.className='app-body';
  const teacher=isTeacher(), u=user();
  if(!currentView || (currentView!=='lesson' && !navList().some(n=>n[0]===currentView))) currentView='dashboard';
  const activeNav=currentView==='lesson'?'courses':currentView;
  $('#app').innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="side-brand"><img class="brand-logo" src="assets/knownext-logo.png" alt="KnowNext logo"><span>KnowNext</span></div><button class="mobile-close" data-action="menu-close" aria-label="Close menu">×</button><div class="role-chip">${teacher?'TEACHER':'STUDENT'} MODE</div><nav>${navList().map(n=>`<button class="nav-item ${activeNav===n[0]?'active':''}" data-action="nav" data-view="${n[0]}" ${activeNav===n[0]?'aria-current="page"':''}>${icon(n[2])}<span>${n[1]}</span>${n[0]==='announcements'&&!teacher?'<b class="nav-dot" id="ann-dot"></b>':''}</button>`).join('')}</nav><div class="side-bottom"><button class="mini-user" data-action="nav" data-view="profile" title="Open profile"><div class="avatar">${initials(u.name)}</div><div><strong>${esc(u.name.replace(/^Prof\.\s*/i,''))}</strong><small>${teacher?'Faculty':esc(`${u.program} · ${u.year}`)}</small></div></button><button class="logout-btn" data-action="logout">Log out</button></div></aside><main class="main"><header class="topbar"><button class="menu-btn" data-action="menu-toggle" aria-label="Open menu">☰</button><div class="crumb">${teacher?'Teaching workspace':'Student workspace'} <span>/</span> ${labelView(currentView)}</div><div class="top-actions"><button class="icon-btn" title="Notifications" aria-label="Notifications" data-action="notifications">♢<i id="notify-dot"></i></button><button class="top-avatar" data-action="nav" data-view="profile" title="Profile" aria-label="Open profile">${initials(u.name)}</button></div></header><div id="content" class="content"></div></main></div>`;
  renderView();
}
function updateChrome(){
  const dot=$('#ann-dot'); if(dot){ const n=unreadAnnouncements(); dot.textContent=n; dot.hidden=!n; }
  const nd=$('#notify-dot'); if(nd) nd.hidden=!myNotifications().some(n=>!n.read);
}
function renderView(){
  const c=$('#content'); if(!c) return;
  const teacher=isTeacher();
  const map={dashboard:teacher?renderTeacherDashboard:renderStudentDashboard,courses:renderCourses,lesson:renderLesson,'learning-path':renderLearningPath,'study-plan':renderStudyPlan,assessments:renderAssessments,assignments:renderAssignments,'ai-tools':teacher?renderTeacherAI:renderStudentAI,progress:renderProgress,calendar:renderCalendar,'virtual-class':renderVirtualClass,announcements:renderAnnouncements,profile:renderProfile,students:renderStudents,analytics:renderAnalytics};
  (map[currentView]||map.dashboard)(c);
  updateChrome();
}
function navigateTo(view,params={}){
  if(!currentUser) return renderLogin();
  currentView=view; viewParams=params;
  try{ sessionStorage.setItem(VIEW_KEY,JSON.stringify({view,params})); }catch(e){}
  closeModal(); $('#app').classList.remove('menu-open');
  renderApp(); window.scrollTo({top:0,behavior:'smooth'});
}
function refresh(){ renderView(); }

function pageTitle(kicker,title,desc){return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div><div class="heading-actions"></div></div>`;}
function progressBar(p){return `<div class="progress"><span style="width:${Math.max(0,Math.min(100,p))}%"></span></div>`;}
function statusPill(score){return `<span class="status ${score<70?'danger':score<85?'warn':'good'}">${getStatus(score)}</span>`;}
function tabs(group,items,active){ return `<div class="filter-tabs" role="tablist">${items.map(([k,l])=>`<button role="tab" class="${k===active?'active':''}" aria-selected="${k===active}" data-action="set-filter" data-group="${group}" data-value="${k}">${l}</button>`).join('')}</div>`; }
function emptyState(title,text,action=''){ return `<div class="empty-state"><strong>${title}</strong><p>${text}</p>${action}</div>`; }

/* ---------- Student dashboard ---------- */
function renderStudentDashboard(c){
  const tps=sortedTopics(), next=tps[0], nextClass=upcomingClasses()[0];
  const upcoming=calendarEvents().filter(e=>daysFromToday(e.date)>=0 && !e.done).slice(0,3);
  const mastered=tps.filter(t=>t.score>=85).sort((a,b)=>b.score-a.score), rest=tps.filter(t=>t.score<85);
  const pathNodes=[...mastered.map(t=>['✓',t.name,'Mastered','']),...rest.map((t,i)=>i===0?['!',t.name,'Recommended next','current']:['○',t.name,t.score<70?'Needs review':'Practice next','locked'])];
  const hero=next?`<section class="hero-next"><div class="hero-art">${svgScene('path')}</div><div class="next-content"><div class="section-kicker">YOUR NEXT STEP <span class="priority">${getPriority(next.score)} PRIORITY</span></div><h2>${esc(next.recommendation)}</h2><p>You scored <strong>${next.score}%</strong> in ${esc(next.course)}. ${next.score<70?'This subject needs a focused review before moving forward.':next.score<85?'A little more practice can help strengthen your understanding.':'You are showing strong understanding here. Keep the momentum going.'}</p><div class="reason-row"><span>${next.score}% mastery</span>${progressBar(next.score)}</div><div class="button-row"><button class="primary-btn" data-action="continue-course" data-course="${next.id}">Start Review <span>→</span></button><button class="ghost-btn" data-action="why">Why?</button></div></div></section>`
    :`<section class="hero-next"><div class="hero-art">${svgScene('path')}</div><div class="next-content"><div class="section-kicker">YOUR NEXT STEP</div><h2>Pick a course to begin</h2><p>Your recommendations appear once you have course results.</p><div class="button-row"><button class="primary-btn" data-go="courses">Browse courses <span>→</span></button></div></div></section>`;
  c.innerHTML=pageTitle('STUDENT DASHBOARD',`${greeting()}, ${esc(firstName())}!`,'Let’s figure out what you should focus on today.')+hero+
  `<section class="section compact-live-card"><div class="live-mini-visual"><img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=500&q=80" alt="Students in a virtual class" onerror="this.style.display='none'"><div class="live-mini-fallback">${svgScene("class")}</div></div><div class="live-mini-copy">${nextClass?`<span class="eyebrow">LIVE CLASS · ${esc(dayLabel(nextClass.date).toUpperCase())} ${fmtTime(nextClass.time)}</span><h3>${esc(nextClass.title)}</h3><p>${esc(courseName(nextClass.courseId))} with ${esc(nextClass.host)} · ${esc(nextClass.platform)}</p><div><button class="primary-btn" data-action="join-class" data-id="${nextClass.id}">Join class →</button><button class="text-btn" data-go="virtual-class">See all classes</button></div>`:`<span class="eyebrow">LIVE CLASS</span><h3>No upcoming live classes</h3><p>New sessions from your teachers will appear here.</p><div><button class="primary-btn" data-go="virtual-class">See all classes →</button></div>`}</div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">01 · PRIORITIES</span><h2>What needs attention?</h2></div><button class="text-btn" data-go="learning-path">View learning path →</button></div><div class="priority-grid">${tps.slice(0,3).map((t,i)=>`<article class="priority-card p${i} clickable" data-action="open-course" data-course="${t.id}" role="button" tabindex="0" aria-label="Open ${esc(t.course)}"><div class="card-top"><span class="priority-dot ${t.score<70?'red':t.score<85?'yellow':'blue'}"></span><span>${getPriority(t.score)} PRIORITY</span></div><h3>${esc(t.name)}</h3><div class="big-score">${t.score}<small>%</small></div>${progressBar(t.score)}<p>${statusPill(t.score)} <span>${esc(t.recommendation)}</span></p></article>`).join('')}</div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">02 · SNAPSHOT</span><h2>Keep going.</h2></div><button class="text-btn" data-go="progress">View mastery & weaknesses →</button></div><div class="stats-grid">${stat(overallMastery()+'%','Overall Mastery',`Across ${tps.length} subjects`,'blue')}${stat(avg(state.courses.map(x=>courseProgress(x.id)))+'%','Course Progress',`Across ${state.courses.length} courses`,'yellow')}${stat(mastered.length+'/'+tps.length,'Topics Mastered','85% mastery target','sky')}${stat(String(state.streak),'Day Streak','Best: 12 days','navy')}</div></section>
  <section class="section path-section"><div class="section-head"><div><span class="eyebrow">03 · ADAPTIVE ENGINE</span><h2>Your learning path</h2><p>The path changes based on your performance.</p></div><button class="text-btn" data-go="learning-path">Open full path →</button></div><div class="path-line">${pathNodes.map(x=>`<div class="path-node ${x[3]}"><span>${x[0]}</span><strong>${esc(x[1])}</strong><small>${x[2]}</small></div>`).join('')}</div></section>
  <section class="section split-grid"><div><div class="section-head"><div><span class="eyebrow">04 · COURSES</span><h2>Course overview</h2></div><button class="text-btn" data-go="courses">View all courses →</button></div><div class="course-mini-list">${state.courses.map(course=>`<button class="course-mini" data-action="open-course" data-course="${course.id}"><span class="course-icon ${course.accent}">${esc(course.name[0])}</span><span class="course-mini-info"><strong>${esc(course.name)}</strong><small>${esc(course.instructor)} · Next: ${esc(currentLesson(course.id).title)}</small>${progressBar(courseProgress(course.id))}</span><b>${courseProgress(course.id)}%</b></button>`).join('')||emptyState('No courses yet','Courses your teachers create will appear here.')}</div></div><div><div class="section-head"><div><span class="eyebrow">05 · COMING UP</span><h2>Upcoming</h2></div><button class="text-btn" data-go="calendar">Open calendar →</button></div><div class="upcoming-list">${upcoming.map(e=>`<div class="upcoming clickable" data-action="open-event" data-kind="${e.kind}" data-id="${e.id}" role="button" tabindex="0"><span class="date-box"><b>${parseISO(e.date).getDate()}</b><small>${parseISO(e.date).toLocaleDateString('en-US',{month:'short'}).toUpperCase()}</small></span><div><strong>${esc(e.title)}</strong><small>${e.label.toUpperCase()} · ${relDays(e.date)}</small></div></div>`).join('')||emptyState('Nothing coming up','You have no upcoming deadlines or classes.')}</div></div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">06 · RECENT ACTIVITY</span><h2>You're making progress.</h2></div></div><div class="activity-list">${state.activity.slice(0,4).map(a=>`<div><span class="activity-icon">${a.icon}</span><p><strong>${esc(a.text)}</strong><small>${relDays(a.date)}</small></p></div>`).join('')}</div></section>`;
}
function stat(big,label,sub,accent){
  const art={
    blue:`<svg viewBox="0 0 56 44" aria-hidden="true"><path d="M7 34V20l10 7 10-15 9 7 12-12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="7" r="3" fill="#FFC928"/></svg>`,
    yellow:`<svg viewBox="0 0 56 44" aria-hidden="true"><rect x="8" y="12" width="10" height="24" rx="5" fill="currentColor" opacity=".28"/><rect x="23" y="7" width="10" height="29" rx="5" fill="currentColor" opacity=".55"/><rect x="38" y="17" width="10" height="19" rx="5" fill="currentColor"/></svg>`,
    sky:`<svg viewBox="0 0 56 44" aria-hidden="true"><circle cx="28" cy="22" r="16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M28 10v12l8 6" fill="none" stroke="#1769E0" stroke-width="4" stroke-linecap="round"/></svg>`,
    navy:`<svg viewBox="0 0 56 44" aria-hidden="true"><path d="M9 32h38M14 27V14M25 27V9M36 27v-6M47 27V12" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`
  }[accent]||'';
  return `<div class="stat-card ${accent}"><span class="stat-accent"></span><div class="stat-art">${art}</div><strong>${big}</strong><h3>${label}</h3><p>${sub}</p></div>`;
}
function showWhy(){
  const t=sortedTopics()[0]; if(!t) return;
  showModal('Why this recommendation?',`<div class="explain-list"><p>✓ Your lowest subject mastery is <strong>${esc(t.course)}</strong> at <strong>${t.score}%</strong>.</p><p>✓ Scores below 70% are prioritized for review; 70–84% get targeted practice.</p><p>✓ Complete the next lesson, then retake a mastery check in Assessments to update your score.</p></div>`,'<button class="primary-btn" data-close>Got it</button>');
}

/* ---------- Courses ---------- */
function renderCourses(c){
  const t=isTeacher();
  const items=t?[['all','All'],['mine','Taught by me']]:[['all','All'],['progress','In Progress'],['completed','Completed'],['saved','Saved']];
  if(!items.some(x=>x[0]===ui.courseFilter)) ui.courseFilter='all';
  c.innerHTML=pageTitle('MY COURSES',t?'Manage the courses you teach.':'Keep learning, one topic at a time.',t?'Create, edit, and preview course content for your classes.':'Continue a course or open its modules to see exactly what comes next.')+
  `<div class="toolbar"><div class="search"><span>⌕</span><input id="course-search" data-input="course-search" placeholder="Search courses..." aria-label="Search courses" value="${esc(ui.courseQuery)}"><button class="search-clear" data-action="clear-course-search" aria-label="Clear search" ${ui.courseQuery?'':'hidden'}>×</button></div><div class="toolbar-group">${tabs('course',items,ui.courseFilter)}${t?'<button class="primary-btn" data-action="create-course">+ Create course</button>':''}</div></div><div id="course-grid" class="course-grid"></div>`;
  renderCourseGrid();
}
function renderCourseGrid(){
  const grid=$('#course-grid'); if(!grid) return;
  const q=ui.courseQuery.toLowerCase(), me=user().name;
  const list=state.courses.filter(c=>{
    const p=courseProgress(c.id);
    const matchQ=!q||[c.name,c.desc,c.instructor].join(' ').toLowerCase().includes(q);
    const f=ui.courseFilter;
    const matchF=f==='all'||(f==='progress'&&p>0&&p<100)||(f==='completed'&&p===100)||(f==='saved'&&state.bookmarks.includes(c.id))||(f==='mine'&&c.instructor===me);
    return matchQ&&matchF;
  });
  grid.innerHTML=list.map(courseCard).join('')||emptyState('No courses match',ui.courseFilter==='saved'&&!q?'Save a course from its overview to find it here.':'Try a different search term or filter.','<button class="ghost-btn" data-action="reset-course-filters">Clear search & filters</button>');
  const clear=$('.search-clear'); if(clear) clear.hidden=!ui.courseQuery;
}
function courseCard(c){
  const n=state.courses.indexOf(c)+1, p=courseProgress(c.id), saved=state.bookmarks.includes(c.id);
  const art={
    blue:`<svg viewBox="0 0 240 145" aria-hidden="true"><rect x="54" y="38" width="116" height="76" rx="14" fill="#fff" stroke="#123B78" stroke-width="4"/><path d="M68 94h88" stroke="#DDF2FF" stroke-width="12" stroke-linecap="round"/><path d="M75 80l18-18 18 11 24-26 20 22" fill="none" stroke="#1769E0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="93" cy="62" r="5" fill="#FFC928"/><path d="M34 113h172" stroke="#123B78" stroke-width="6" stroke-linecap="round"/></svg>`,
    yellow:`<svg viewBox="0 0 240 145" aria-hidden="true"><path d="M57 37h126v78H57z" fill="#fff" stroke="#123B78" stroke-width="4"/><path d="M76 58h88M76 76h58M76 94h74" stroke="#1769E0" stroke-width="7" stroke-linecap="round"/><circle cx="166" cy="76" r="15" fill="#FFC928" stroke="#123B78" stroke-width="3"/><path d="m160 76 5 5 9-11" fill="none" stroke="#123B78" stroke-width="3"/></svg>`,
    sky:`<svg viewBox="0 0 240 145" aria-hidden="true"><circle cx="118" cy="70" r="45" fill="#DDF2FF"/><path d="M89 78h58M89 91h38" stroke="#1769E0" stroke-width="7" stroke-linecap="round"/><path d="M96 57h44" stroke="#123B78" stroke-width="7" stroke-linecap="round"/><path d="M78 111c26-19 55-19 82 0" fill="none" stroke="#123B78" stroke-width="4" stroke-linecap="round"/><circle cx="119" cy="43" r="6" fill="#FFC928"/></svg>`,
    navy:`<svg viewBox="0 0 240 145" aria-hidden="true"><rect x="60" y="43" width="120" height="76" rx="16" fill="#fff" stroke="#123B78" stroke-width="4"/><path d="M78 96c15-27 28 18 42-12s24 23 41-11" fill="none" stroke="#1769E0" stroke-width="6" stroke-linecap="round"/><circle cx="88" cy="67" r="6" fill="#FFC928"/><path d="M42 120h156" stroke="#123B78" stroke-width="6" stroke-linecap="round"/></svg>`
  }[c.accent]||'';
  return `<article class="course-card" data-action="open-course" data-course="${c.id}" role="button" tabindex="0" aria-label="Open ${esc(c.name)}"><div class="course-visual ${c.accent}"><span class="course-number">${String(n).padStart(2,'0')}</span><div class="course-svg">${art}</div></div><div class="course-body"><div class="card-label">${MODULES.length} MODULES · ${p}%${saved?' · ★ SAVED':''}</div><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><div class="course-meta"><span>${esc(c.instructor)}</span><strong>${p}%</strong></div>${progressBar(p)}<div class="next-lesson">${p===100?'DONE <b>Course complete</b>':`NEXT <b>${esc(currentLesson(c.id).title)}</b>`}<span>→</span></div></div></article>`;
}
function openCourse(id){
  const c=courseById(id); if(!c) return toast('That course no longer exists.');
  const t=isTeacher(), mods=moduleInfo(id), p=courseProgress(id), cur=currentLesson(id), saved=state.bookmarks.includes(id);
  const learners=students().filter(s=>s.courseId===id).length;
  const body=`<div class="course-modal-head"><div class="course-icon ${c.accent}">${esc(c.name[0])}</div><div><span class="eyebrow">${MODULES.length} MODULES · ${courseLessons().length} LESSONS</span><h3>${esc(c.name)}</h3><p>${esc(c.instructor)} · ${t?`${learners} enrolled student${learners===1?'':'s'}`:`${p}% complete`}</p></div></div><div class="module-list">${mods.map(m=>{const open=m.lessons.some(l=>l.id===cur.id)&&!t;return `<div class="module-row"><span class="module-status ${m.status}">${m.status==='completed'?'✓':m.status==='review'?'!':'○'}</span><div><strong>${esc(m.title)}</strong><small>${m.lessons.length} lessons · ${t?'Preview':m.label}</small></div><button class="module-expand" data-action="toggle-module" data-module="${m.id}" aria-expanded="${open}" aria-label="Show lessons in ${esc(m.title)}">${open?'−':'+'}</button><div class="module-lessons ${open?'open':''}" id="lessons-${m.id}">${m.lessons.map(l=>`<button data-action="open-lesson" data-course="${id}" data-lesson="${l.id}" ${m.locked?'disabled title="Complete the previous module to unlock"':''}>${l.done&&!t?'✓ ':''}${esc(l.title)}<span>${m.locked?'🔒':'→'}</span></button>`).join('')}</div></div>`;}).join('')}</div>`;
  const actions=t
    ?`<button class="ghost-btn danger-text" data-action="delete-course" data-course="${id}">Delete</button><button class="ghost-btn" data-action="edit-course" data-course="${id}">Edit course</button><button class="primary-btn" data-action="open-lesson" data-course="${id}" data-lesson="${MODULES[0].id}-0">Preview lessons →</button>`
    :`<button class="ghost-btn" data-action="toggle-bookmark" data-course="${id}" aria-pressed="${saved}">${saved?'★ Saved':'☆ Save course'}</button><button class="ghost-btn" data-close>Close</button><button class="primary-btn" data-action="open-lesson" data-course="${id}" data-lesson="${cur.id}">${p===100?'Review course →':p===0?'Start Learning →':'Continue Learning →'}</button>`;
  showModal('Course overview',body,actions,{focus:false});
}
function continueCourse(id){ if(!courseById(id)) return toast('That course no longer exists.'); navigateTo('lesson',{courseId:id,lessonId:currentLesson(id).id}); }
function toggleBookmark(id){
  const i=state.bookmarks.indexOf(id);
  if(i>=0) state.bookmarks.splice(i,1); else state.bookmarks.push(id);
  saveState(); toast(i>=0?'Removed from saved courses.':'Course saved. Find it under My Courses → Saved.');
  if($('.modal')) openCourse(id);
  refresh();
}
function showCourseForm(id){
  const c=id?courseById(id):null;
  showModal(c?'Edit course':'Create course',`<label>Course name<input id="course-name" maxlength="80" value="${esc(c?.name||'')}" placeholder="e.g. Statistics and Probability"></label><label>Instructor<input id="course-instructor" maxlength="60" value="${esc(c?.instructor||user().name)}"></label><label>Card color<select id="course-accent">${[['blue','Blue'],['yellow','Yellow'],['sky','Sky'],['navy','Navy']].map(([v,l])=>`<option value="${v}" ${(c?.accent||'blue')===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Description<textarea id="course-desc" maxlength="240" placeholder="What will students learn?">${esc(c?.desc||'')}</textarea></label><p class="field-hint">Every course uses the ${MODULES.length}-module KnowNext lesson template.</p>`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-course" data-course="${id||''}">${c?'Save changes':'Create course'}</button>`);
}
function saveCourse(id){
  const name=val('course-name'), instructor=val('course-instructor'), desc=val('course-desc'), accent=val('course-accent');
  if(name.length<3) return fail('Course name must be at least 3 characters.','course-name');
  if(state.courses.some(c=>c.id!==id && c.name.toLowerCase()===name.toLowerCase())) return fail('A course with this name already exists.','course-name');
  if(instructor.length<2) return fail('Enter the instructor’s name.','course-instructor');
  if(desc.length<10) return fail('Description must be at least 10 characters.','course-desc');
  if(id){ Object.assign(courseById(id),{name,instructor,desc,accent}); toast('Course updated.'); }
  else{ const nid=uid('course'); state.courses.push({id:nid,name,instructor,desc,accent}); state.lessonProgress[nid]={completed:[],last:''}; notify('student',`New course available: ${name}`,'courses','Course'); toast('Course created.'); }
  saveState(); closeModal(); refresh();
}
function deleteCourse(id){
  const c=courseById(id); if(!c) return;
  const linked=[['assignment',state.assignments.filter(a=>a.courseId===id).length],['assessment',state.assessments.filter(a=>a.courseId===id).length],['live class',state.classes.filter(x=>x.courseId===id).length]];
  const extra=linked.filter(([,n])=>n).map(([k,n])=>`${n} ${k}${n===1?'':k.endsWith('s')?'es':'s'}`).join(', ');
  confirmDialog('Delete course?',`<strong>${esc(c.name)}</strong> and its lesson progress will be removed${extra?`, along with ${extra} linked to it`:''}. This cannot be undone.`,'Delete course',()=>{
    const asg=state.assignments.filter(a=>a.courseId===id).map(a=>a.id), asm=state.assessments.filter(a=>a.courseId===id).map(a=>a.id);
    state.courses=state.courses.filter(x=>x.id!==id);
    delete state.lessonProgress[id];
    state.bookmarks=state.bookmarks.filter(b=>b!==id);
    state.assignments=state.assignments.filter(a=>a.courseId!==id);
    state.submissions=state.submissions.filter(s=>!asg.includes(s.assignmentId));
    state.assessments=state.assessments.filter(a=>a.courseId!==id);
    state.attempts=state.attempts.filter(a=>!asm.includes(a.assessmentId));
    state.classes=state.classes.filter(x=>x.courseId!==id);
    state.tasks.forEach(t=>{ if(t.courseId===id) t.courseId=''; });
    saveState(); closeModal(); refresh(); toast('Course deleted.');
  });
}

/* ---------- Lesson view ---------- */
const LESSON_COPY={
  'Key terms and concepts':['This lesson introduces the vocabulary you will use throughout the course. Focus on what each term means and how it connects to {f}.',['Read each definition, then restate it in your own words.','Look for how the terms relate to one another.','Note any term that still feels unclear so you can revisit it.'],'Write a one-sentence definition of {f} without looking at your notes.'],
  'Guided examples':['Work through a fully solved example step by step. Pause after each step and predict what comes next before reading on.',['Identify what the problem is asking.','Notice which rule or idea is applied at each step.','Check the final answer against the original question.'],'Cover the solution and try the example again on your own.'],
  'Quick knowledge check':['A short self-check to confirm you are ready to move on. Answer from memory first, then review anything you missed.',['Recall the key terms from this module.','Explain one idea about {f} out loud.','Mark the questions you were unsure about.'],'List three things you now know about {f}.'],
  'Worked examples':['Study several worked examples that apply {f} in slightly different ways. Compare how the approach changes.',['Spot the pattern shared by all examples.','Notice where each example differs.','Choose the strategy that fits each case.'],'Make up a similar example and solve it.'],
  'Common mistakes':['Most errors with {f} come from a few predictable slips. Learning them now saves points later.',['Rushing past the definition or the given information.','Mixing up two similar rules.','Skipping the final check of the answer.'],'Find a past mistake in your notes and explain how to fix it.'],
  'Practice activity':['Apply what you learned to a short set of practice items. Aim for accuracy first, then speed.',['Start with the easier items to build confidence.','Show your reasoning for each answer.','Review every item you got wrong.'],'Complete five practice items on {f} and check your answers.'],
  'Real-world application':['See how {f} shows up outside the classroom, from everyday decisions to professional work.',['Connect the idea to a situation you know.','Identify what information you would need.','Describe how the idea helps solve the problem.'],'Describe one real situation where {f} is useful.'],
  'Independent practice':['Solve problems without guidance. Use your notes only after you have made an honest attempt.',['Plan your approach before you start.','Work carefully and show each step.','Compare your result to the expected answer.'],'Finish the practice set on your own, then self-grade.'],
  'Reflection':['Step back and reflect on how your understanding of {f} has changed.',['What felt difficult at first?','What strategy helped the most?','What would you still like to practice?'],'Write a short reflection (3–4 sentences) on your progress.'],
  'Advanced examples':['Tackle more complex examples that combine {f} with earlier ideas.',['Break the problem into smaller parts.','Decide which concept applies to each part.','Combine the results carefully.'],'Try one advanced example before checking the solution.'],
  'Problem solving':['Use a structured problem-solving process: understand, plan, solve, and check.',['Restate the problem in your own words.','Choose a strategy and justify it.','Verify that the answer makes sense.'],'Solve one multi-step problem involving {f}.'],
  'Challenge quiz':['A tougher set of questions to stretch your understanding of {f}.',['Read each question twice.','Eliminate options that are clearly wrong.','Leave time to review your answers.'],'Attempt the challenge questions without notes.'],
  'Mixed practice':['Mixed practice combines everything from the course so you learn to pick the right approach.',['Identify the topic behind each question.','Switch strategies as needed.','Track which topics still need work.'],'Complete a mixed set and note your weakest topic.'],
  'Review feedback':['Review feedback from your recent work and turn it into specific next steps.',['Read every comment carefully.','Group mistakes by type.','Plan one action for each type of mistake.'],'Write down two improvements you will make.'],
  'Mastery assessment':['The final check of the course. When you finish this lesson, take the matching mastery check in Assessments to update your mastery score.',['Review your notes on {f}.','Rest before the assessment.','Answer every question and review before submitting.'],'Open Assessments and take the mastery check for this course.']
};
function lessonCopy(course,title){
  const f=STUDENT_TOPICS.find(t=>t.id===course.id)?.name.toLowerCase()||course.name;
  const [intro,points,task]=LESSON_COPY[title]||['Work through this lesson at your own pace.',['Read carefully.','Take notes.','Check your understanding.'],'Summarize what you learned.'];
  const fill=s=>esc(s).replaceAll('{f}',`<strong>${esc(f)}</strong>`);
  return {intro:fill(intro),points:points.map(fill),task:fill(task)};
}
function renderLesson(c){
  const course=courseById(viewParams.courseId);
  if(!course){ currentView='courses'; return renderCourses(c); }
  const t=isTeacher(), flat=flatLessons(course.id);
  let idx=flat.findIndex(l=>l.id===viewParams.lessonId); if(idx<0) idx=0;
  let lesson=flat[idx];
  if(lesson.module.locked){ lesson=currentLesson(course.id); idx=flat.findIndex(l=>l.id===lesson.id); toast('That module is locked. Opening your current lesson instead.'); }
  viewParams.lessonId=lesson.id;
  if(!t){ lessonRecord(course.id).last=lesson.id; saveState(); }
  const prev=flat[idx-1], next=flat[idx+1], nextLocked=!!next&&next.module.locked, p=courseProgress(course.id), copy=lessonCopy(course,lesson.title), saved=state.bookmarks.includes(course.id);
  const mods=moduleInfo(course.id);
  c.innerHTML=pageTitle(esc(course.name.toUpperCase()),esc(lesson.title),`${esc(lesson.module.title)} · Lesson ${idx+1} of ${flat.length}`)+
  `<div class="lesson-toolbar"><button class="ghost-btn" data-action="back-to-courses">← Back to courses</button><div class="toolbar-group"><button class="ghost-btn" data-action="open-course" data-course="${course.id}">Course outline</button>${t?'':`<button class="ghost-btn" data-action="toggle-bookmark" data-course="${course.id}" aria-pressed="${saved}">${saved?'★ Saved':'☆ Save course'}</button>`}</div></div>
  <div class="lesson-layout"><article class="panel lesson-main"><div class="lesson-meta"><span class="lesson-tag">MODULE ${lesson.module.index+1} · LESSON ${lesson.index+1}</span>${t?'<span class="soft-note">Teacher preview</span>':lesson.done?'<span class="status good">Completed</span>':'<span class="status warn">Not completed</span>'}</div><p class="lesson-intro">${copy.intro}</p><h3>Key points</h3><ul class="lesson-points">${copy.points.map(x=>`<li>${x}</li>`).join('')}</ul><div class="intervention"><b>Try it</b><p>${copy.task}</p></div>
  <div class="lesson-nav"><button class="ghost-btn" data-action="open-lesson" data-course="${course.id}" data-lesson="${prev?.id||''}" ${prev?'':'disabled'}>← Previous</button>${t?'':`<button class="${lesson.done?'ghost-btn':'primary-btn'}" data-action="toggle-lesson" data-course="${course.id}" data-lesson="${lesson.id}">${lesson.done?'✓ Completed · Undo':'Mark as complete'}</button>`}<button class="${lesson.done||t?'primary-btn':'ghost-btn'}" data-action="open-lesson" data-course="${course.id}" data-lesson="${next?.id||''}" ${!next||nextLocked?'disabled':''} ${nextLocked?'title="Complete this module to unlock the next one"':''}>Next →</button></div>
  ${nextLocked?'<p class="field-hint">Complete every lesson in this module to unlock the next module.</p>':''}${!t&&p===100?'<div class="result good">🎉 You have completed every lesson in this course. Take the mastery check in Assessments to update your mastery score.</div>':''}</article>
  <aside class="panel lesson-outline"><span class="eyebrow">${t?'COURSE OUTLINE':'COURSE PROGRESS'}</span>${t?'':`<div class="lesson-progress"><strong>${p}%</strong>${progressBar(p)}</div>`}${mods.map(m=>`<div class="outline-module"><h4><span class="module-status ${m.status}">${m.status==='completed'?'✓':m.status==='review'?'!':'○'}</span>${esc(m.title)}</h4>${m.lessons.map(l=>`<button class="outline-lesson ${l.id===lesson.id?'active':''} ${l.done&&!t?'done':''}" data-action="open-lesson" data-course="${course.id}" data-lesson="${l.id}" ${m.locked?'disabled title="Locked"':''}>${l.done&&!t?'✓':m.locked?'🔒':'○'} ${esc(l.title)}</button>`).join('')}</div>`).join('')}</aside></div>`;
}
function toggleLesson(courseId,lessonId){
  const rec=lessonRecord(courseId), i=rec.completed.indexOf(lessonId), title=flatLessons(courseId).find(l=>l.id===lessonId)?.title;
  if(i>=0){ rec.completed.splice(i,1); toast('Lesson marked as not completed.'); }
  else{
    rec.completed.push(lessonId);
    const p=courseProgress(courseId);
    logActivity(`Completed ${title} in ${courseName(courseId)}`,'✓');
    if(p===100){ logActivity(`Finished ${courseName(courseId)}`,'★'); notify('teacher',`${studentById(DEMO_STUDENT_ID).name} completed ${courseName(courseId)}`,'students','Course progress'); }
    toast(`Lesson completed · ${courseName(courseId)} is now ${p}% complete.`);
  }
  saveState(); refresh();
}

/* ---------- Learning path & progress ---------- */
function renderLearningPath(c){
  const tps=sortedTopics(), overall=overallMastery();
  c.innerHTML=pageTitle('ADAPTIVE ENGINE','Your Learning Path','Your path changes based on your performance—not a fixed checklist.')+`<div class="adaptive-banner"><div><span class="eyebrow">PERSONALIZED FOR YOU</span><h2>Study the gap, then move forward.</h2><p>KnowNext prioritizes the subjects where your results show the most room for improvement.</p></div><div class="adaptive-score"><strong>${overall}%</strong><span>overall mastery</span></div></div><div class="learning-path-full">${tps.map((t,i)=>`<article class="path-card ${i===0?'current':''} ${t.score<70?'needs-review':''}"><div class="path-marker">${t.score>=85?'✓':i===0?'★':'○'}</div><div class="path-card-main"><div class="card-top"><span>STEP ${String(i+1).padStart(2,'0')}</span><b>${t.score}%</b></div><h3>${esc(t.course)}</h3><p>${t.score>=85?'Mastered · Ready for the next lesson':t.score>=70?'Developing · Practice recommended':'Needs attention · Review recommended'}</p>${progressBar(t.score)}<small>${esc(t.recommendation)} · Next lesson: ${esc(currentLesson(t.id).title)}</small></div><button class="small-btn" data-action="continue-course" data-course="${t.id}">${t.score<70?'Review':'Open'} →</button></article>${i<tps.length-1?'<div class="path-connector">↓</div>':''}`).join('')||emptyState('No path yet','Your learning path appears once you are enrolled in courses.')}</div>${tps.length?`<section class="recommendation-box"><div><span class="eyebrow">WHY THIS RECOMMENDATION?</span><h2>Your next step is based on your results.</h2></div><div class="explain-list"><p><b>01</b> Your lowest mastery subject is <strong>${esc(tps[0].course)}</strong> (${tps[0].score}%).</p><p><b>02</b> Scores below 70% are prioritized for review.</p><p><b>03</b> Retake a quick mastery check to update your progress.</p></div><button class="ghost-btn" data-go="progress">View mastery & weaknesses →</button></section>`:''}`;
}
function renderProgress(c){
  const tps=topics(), ordered=[...tps].sort((a,b)=>b.score-a.score), strongest=ordered.slice(0,2), weak=[...ordered].reverse().slice(0,2), mastered=tps.filter(t=>t.score>=85).length;
  c.innerHTML=pageTitle('MY PROGRESS','Know what you know. Find what to work on.','Your mastery and weak areas are gathered in one place, so your next study step is clear.')+
  `<div class="analytics-top">${stat(overallMastery()+'%','Overall Mastery',`Average across ${tps.length} subjects`,'blue')}${stat(mastered+'/'+tps.length,'Subjects On Track','Mastery target: 85%','yellow')}${stat(tps.filter(t=>t.score<70).length,'Needs Attention','Below 70% mastery','sky')}${stat(String(state.streak),'Day Streak','Keep your momentum','navy')}</div>
  <div class="progress-tools"><div><span class="eyebrow">YOUR LEARNING SNAPSHOT</span><h2>Mastery & weaknesses</h2><p>Scores below 70% need review; scores of 85% or more are considered mastered. Mastery checks update these scores.</p></div><button class="primary-btn" data-action="randomize-progress">↻ Randomize demo progress</button></div>
  <div class="progress-layout"><section class="panel"><div class="section-head"><div><span class="eyebrow">MASTERY BY SUBJECT</span><h2>How you're doing</h2></div></div><div class="bar-chart">${tps.map(t=>`<div class="bar-row"><span>${esc(t.course)}</span><div>${progressBar(t.score)}</div><b>${t.score}%</b></div>`).join('')}</div><div class="mastery-legend"><span><i class="legend-dot weak-dot"></i> Needs review &lt;70%</span><span><i class="legend-dot mid-dot"></i> Developing 70–84%</span><span><i class="legend-dot strong-dot"></i> Mastered 85%+</span></div></section>
  <section class="panel mastery-insights"><div class="section-head"><div><span class="eyebrow">YOUR NEXT MOVE</span><h2>Strong vs. weak</h2></div></div><h4><span class="insight-icon strong">✓</span> STRONGEST AREAS</h4>${strongest.map(t=>`<div class="rank-row"><span>${esc(t.name)}<small>${esc(t.course)}</small></span><b>${t.score}%</b></div>`).join('')}<h4 class="mt"><span class="insight-icon weak">!</span> NEEDS ATTENTION</h4>${weak.map(t=>`<div class="rank-row weak"><span>${esc(t.name)}<small>${esc(t.course)}</small></span><b>${t.score}%</b></div>`).join('')}<button class="ghost-btn full insight-cta" data-go="learning-path">Open my learning path →</button></section></div>`;
}

/* ---------- Study plan ---------- */
function renderStudyPlan(c){
  const today=todayISO(), all=myTasks(), todays=all.filter(t=>t.date===today);
  const minutes=todays.reduce((a,t)=>a+(Number(t.duration)||0),0), doneToday=todays.filter(t=>t.done).length;
  let list=all.filter(t=>(ui.taskSubject==='all'||t.courseId===ui.taskSubject)&&(ui.taskStatus==='all'||(ui.taskStatus==='todo'?!t.done:t.done)));
  const deadline=(a,b)=>(a.date+a.time).localeCompare(b.date+b.time);
  list.sort(ui.taskSort==='priority'?(a,b)=>(PRIORITY_RANK[a.priority]-PRIORITY_RANK[b.priority])||deadline(a,b):ui.taskSort==='duration'?(a,b)=>(a.duration-b.duration)||deadline(a,b):deadline);
  c.innerHTML=pageTitle('STUDY PLAN','A plan built around your gaps.','Your suggested schedule updates as you complete activities.')+
  `<div class="plan-summary"><div><span class="eyebrow">TODAY · ${parseISO(today).toLocaleDateString('en-US',{month:'long',day:'numeric'}).toUpperCase()}</span><h2>${todays.length?`${minutes} minutes of focused study`:'Nothing scheduled today'}</h2><p>${todays.length?`${todays.length-doneToday} task${todays.length-doneToday===1?'':'s'} left today · ${all.filter(t=>!t.done).length} open in total.`:'Add a task or pick one from your learning path.'}</p></div><div class="plan-progress"><strong>${doneToday}/${todays.length}</strong><span>tasks complete</span></div></div>
  <div class="toolbar plan-toolbar"><div class="toolbar-group"><select data-change="task-subject" aria-label="Filter by subject"><option value="all">All subjects</option>${courseOptions(ui.taskSubject)}</select><select data-change="task-sort" aria-label="Sort tasks"><option value="time" ${ui.taskSort==='time'?'selected':''}>Sort: Deadline</option><option value="priority" ${ui.taskSort==='priority'?'selected':''}>Sort: Priority</option><option value="duration" ${ui.taskSort==='duration'?'selected':''}>Sort: Duration</option></select>${tabs('task',[['all','All'],['todo','To do'],['done','Done']],ui.taskStatus)}</div><div class="toolbar-group"><button class="ghost-btn" data-action="clear-completed" ${all.some(t=>t.done)?'':'disabled title="No completed tasks"'}>Clear completed</button><button class="primary-btn" data-action="add-task">+ Add task</button></div></div>
  <div class="study-plan-list">${list.map(t=>{const overdue=!t.done&&(t.date<today);return `<article class="plan-task ${t.done?'done':''}"><button class="task-check" data-action="toggle-task" data-id="${t.id}" aria-pressed="${t.done}" aria-label="${t.done?'Mark as not done':'Mark as done'}: ${esc(t.title)}">${t.done?'✓':''}</button><div class="task-time">${fmtTime(t.time)}<small class="${overdue?'overdue':''}">${overdue?'Overdue · ':''}${dayLabel(t.date)}</small></div><div class="task-info"><strong>${esc(t.title)}</strong><span>${t.duration} min · ${t.priority} priority · ${esc(courseName(t.courseId))}${t.assignedBy?` · Assigned by ${esc(t.assignedBy)}`:''}</span></div><button class="small-btn" data-action="start-task" data-id="${t.id}">${t.done?'Review':'Start'} →</button><button class="more-btn" data-action="task-menu" data-id="${t.id}" aria-label="More actions for ${esc(t.title)}">⋯</button></article>`}).join('')||emptyState(all.length?'No tasks match these filters':'Your plan is empty',all.length?'Change the subject or status filter to see more tasks.':'Add a task to start planning your study time.',all.length?'<button class="ghost-btn" data-action="reset-task-filters">Show all tasks</button>':'<button class="primary-btn" data-action="add-task">+ Add task</button>')}</div>`;
}
function taskById(id){ return state.tasks.find(t=>t.id===id); }
function showTaskForm(id,presetDate){
  const t=id?taskById(id):null;
  showModal(t?'Edit task':'Add study task',`<label>Task<input id="task-title" maxlength="80" value="${esc(t?.title||'')}" placeholder="e.g. Review trigonometric identities"></label><label>Subject<select id="task-course">${courseOptions(t?t.courseId:(ui.taskSubject!=='all'?ui.taskSubject:''),{general:true})}</select></label><div class="two-input"><label>Date<input id="task-date" type="date" value="${t?.date||presetDate||todayISO()}"></label><label>Time<input id="task-time" type="time" value="${t?.time||'16:00'}"></label></div><div class="two-input"><label>Duration (minutes)<input id="task-duration" type="number" min="5" max="240" step="5" value="${t?.duration||20}"></label><label>Priority<select id="task-priority">${['High','Medium','Low'].map(p=>`<option ${(t?.priority||'Medium')===p?'selected':''}>${p}</option>`).join('')}</select></label></div>`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-task" data-id="${id||''}">${t?'Save changes':'Add task'}</button>`);
}
function saveTask(id){
  const title=val('task-title'), date=val('task-date'), time=val('task-time'), duration=Number(val('task-duration'));
  if(title.length<3) return fail('Task name must be at least 3 characters.','task-title');
  if(!date) return fail('Choose a date.','task-date');
  if(!time) return fail('Choose a time.','task-time');
  if(!Number.isFinite(duration)||duration<5||duration>240) return fail('Duration must be between 5 and 240 minutes.','task-duration');
  const data={title,courseId:val('task-course'),date,time,duration,priority:val('task-priority')};
  if(id){ Object.assign(taskById(id),data); toast('Task updated.'); }
  else{ state.tasks.push({id:uid('task'),studentId:DEMO_STUDENT_ID,target:'',done:false,assignedBy:'',...data}); toast('Task added to your study plan.'); }
  saveState(); closeModal(); refresh();
}
function showTaskMenu(id){
  const t=taskById(id); if(!t) return;
  showModal(esc(t.title),`<p>${dayLabel(t.date)} at ${fmtTime(t.time)} · ${t.duration} min · ${t.priority} priority · ${esc(courseName(t.courseId))}</p><div class="menu-list"><button class="setting-row" data-action="edit-task" data-id="${id}"><span>Edit details</span><b>›</b></button><button class="setting-row" data-action="reschedule-task" data-id="${id}"><span>Reschedule</span><b>›</b></button><button class="setting-row" data-action="toggle-task" data-id="${id}"><span>${t.done?'Mark as not done':'Mark as done'}</span><b>›</b></button><button class="setting-row danger-text" data-action="delete-task" data-id="${id}"><span>Delete task</span><b>›</b></button></div>`,'',{focus:false});
}
function showReschedule(id){
  const t=taskById(id); if(!t) return;
  showModal('Reschedule task',`<p>Choose a new time for <strong>${esc(t.title)}</strong>.</p><div class="two-input"><label>Date<input id="resched-date" type="date" value="${t.date}"></label><label>Time<input id="resched-time" type="time" value="${t.time}"></label></div>`,`<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-reschedule" data-id="${id}">Save time</button>`);
}
function startTask(id){
  const t=taskById(id); if(!t) return;
  if(t.target==='assessments') return navigateTo('assessments');
  if(t.courseId && courseById(t.courseId)) return continueCourse(t.courseId);
  showTaskMenu(id);
}

/* ---------- Virtual class ---------- */
const CLASS_PHOTOS=['https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=700&q=82','https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=700&q=82'];
function renderVirtualClass(c){
  const teacher=isTeacher(), all=visibleClasses();
  const list=all.filter(x=>ui.classFilter==='all'||(ui.classFilter==='past'?classStatus(x)==='Ended':classStatus(x)!=='Ended'));
  if(ui.classFilter==='past') list.reverse();
  c.innerHTML=pageTitle('VIRTUAL CLASS','Meet, ask, learn together.',teacher?'Start or schedule live sessions for your classes.':'Join live classes, review the session details, and keep your questions ready.')+
  `<section class="virtual-hero ${teacher?'teacher':''}"><div class="virtual-copy"><span class="eyebrow">LIVE LEARNING</span><h2>${teacher?'Bring your class together.':'Your next live class is ready.'}</h2><p>${teacher?'Use a familiar video platform for live lessons, office hours, and targeted review sessions.':'Join a live session when a topic needs explanation, practice, or a little more support.'}</p><div class="virtual-actions">${teacher?'<button class="primary-btn" data-action="schedule-class">+ Schedule class</button>':'<button class="primary-btn" data-action="join-next">Join next class →</button>'}<button class="ghost-btn" data-action="class-guide">How it works</button></div></div><div class="virtual-visual"><div class="photo-frame"><img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=82" alt="Students learning together" onerror="this.style.display='none'"/><div class="photo-fallback">${svgScene("class")}</div></div><span class="live-badge"><i></i> LIVE-READY</span></div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">${teacher?'YOUR CLASSES':'YOUR LIVE CLASSES'}</span><h2>${teacher?'Manage live learning.':'Join when it matters.'}</h2></div><div class="toolbar-group">${tabs('class',[['upcoming','Upcoming'],['past','Past'],['all','All']],ui.classFilter)}<span class="soft-note">${list.length} session${list.length===1?'':'s'}</span>${teacher?'':'<button class="ghost-btn" data-action="schedule-class">+ Study session</button>'}</div></div><div class="virtual-session-grid">${list.map((x,i)=>{const st=classStatus(x), ended=st==='Ended';return `<article class="virtual-session ${i===0&&!ended?'featured':''}"><div class="session-photo"><img src="${CLASS_PHOTOS[i===0?0:1]}" alt="${esc(x.title)}" onerror="this.style.display='none'"><div class="session-fallback">${i===0?'✦':'◌'}</div><span class="session-status">${st}</span></div><div class="session-body"><span class="card-label">${esc(courseName(x.courseId))}</span><h3>${esc(x.title)}</h3><p><strong>${dayLabel(x.date)} · ${fmtTime(x.time)}</strong> · ${x.duration} min<br>${esc(x.host)}${x.owner===currentUser.username&&!teacher?' · Your session':''}</p><div class="session-footer"><span class="platform-pill">${esc(x.platform)}</span><span class="session-buttons"><button class="text-btn" data-action="class-details" data-id="${x.id}">Details</button><button class="small-btn" data-action="join-class" data-id="${x.id}" ${ended?'disabled title="This class has ended"':''}>${ended?'Ended':teacher?'Open →':'Join →'}</button></span></div></div></article>`}).join('')||emptyState(ui.classFilter==='past'?'No past sessions':'No upcoming sessions',teacher?'Schedule a class to see it here.':'When a class is scheduled it will appear here and on your calendar.',teacher?'<button class="primary-btn" data-action="schedule-class">+ Schedule class</button>':'')}</div></section>
  <section class="section virtual-tips"><div><span class="eyebrow">A SIMPLE FLOW</span><h2>Less friction. More learning.</h2></div><div class="flow-steps"><div><b>01</b><strong>See the session</strong><span>Upcoming classes appear here and on your calendar.</span></div><div><b>02</b><strong>Open the room</strong><span>Use Zoom or Google Meet without hunting for the link.</span></div><div><b>03</b><strong>Keep learning</strong><span>After class, return to your Learning Path for the next step.</span></div></div></section>`;
}
function classById(id){ return state.classes.find(c=>c.id===id); }
function joinClass(id){
  const c=classById(id); if(!c) return toast('That class no longer exists.');
  const st=classStatus(c);
  if(st==='Ended') return toast('This class has already ended.');
  if(!c.link || !validMeetingUrl(c.link)){
    const editable=canEditClass(c);
    return showModal('Meeting link not available',`<p><strong>${esc(c.title)}</strong> ${c.link?'has a saved link that is not a valid web address':'does not have a meeting link yet'}. ${editable?'Add the Google Meet, Zoom, or Teams link so participants can join.':'Your teacher has not added it yet — check back closer to the start time.'}</p>`,editable?`<button class="ghost-btn" data-close>Close</button><button class="primary-btn" data-action="edit-class" data-id="${id}">Add meeting link</button>`:'<button class="primary-btn" data-close>Got it</button>');
  }
  window.open(c.link,'_blank','noopener');
  toast(`Opening ${c.platform} in a new tab…`);
}
function showClassDetails(id){
  const c=classById(id); if(!c) return toast('That class no longer exists.');
  const st=classStatus(c), ended=st==='Ended', editable=canEditClass(c);
  showModal(esc(c.title),`<div class="join-room"><span class="live-badge"><i></i> ${st.toUpperCase()}</span><h3>${fmtLong(c.date)} · ${fmtTime(c.time)}</h3><p>${esc(courseName(c.courseId))} · ${esc(c.host)} · ${c.duration} min · ${esc(c.platform)}</p><p class="meeting-link">${c.link?`Meeting link: <a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.link)}</a>`:'No meeting link has been added yet.'}</p><div class="room-preview">${svgScene("class")}</div></div>`,
  `${editable?`<button class="ghost-btn danger-text" data-action="delete-class" data-id="${id}">Delete</button><button class="ghost-btn" data-action="edit-class" data-id="${id}">Edit</button>`:''}<button class="ghost-btn" data-close>Close</button><button class="primary-btn" data-action="join-class" data-id="${id}" ${ended?'disabled title="This class has ended"':''}>${ended?'Class ended':isTeacher()?'Open room →':'Join room →'}</button>`,{focus:false});
}
function showClassForm(id,presetDate){
  const c=id?classById(id):null, teacher=isTeacher();
  showModal(c?'Edit class':teacher?'Schedule a virtual class':'Schedule a study session',`<label>${teacher?'Class title':'Session title'}<input id="class-title" maxlength="80" value="${esc(c?.title||'')}" placeholder="e.g. Function Transformations Review"></label><label>Course<select id="class-course">${courseOptions(c?.courseId||state.courses[0]?.id)}</select></label><div class="two-input"><label>Date<input id="class-date" type="date" value="${c?.date||presetDate||todayISO()}"></label><label>Time<input id="class-time" type="time" value="${c?.time||'19:00'}"></label></div><div class="two-input"><label>Duration (minutes)<input id="class-duration" type="number" min="15" max="240" step="5" value="${c?.duration||60}"></label><label>Platform<select id="class-platform">${['Google Meet','Zoom','Microsoft Teams','Other'].map(p=>`<option ${(c?.platform||'Google Meet')===p?'selected':''}>${p}</option>`).join('')}</select></label></div><label>Meeting URL<input id="class-link" type="url" value="${esc(c?.link||'')}" placeholder="https://meet.google.com/abc-defg-hij"></label><p class="field-hint">Paste the real meeting link. Without one, the Join button explains that the link is not available yet.</p>`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-class" data-id="${id||''}">${c?'Save changes':'Schedule class'}</button>`);
}
function saveClass(id){
  const title=val('class-title'), courseId=val('class-course'), date=val('class-date'), time=val('class-time'), duration=Number(val('class-duration')), link=val('class-link');
  if(title.length<3) return fail('Title must be at least 3 characters.','class-title');
  if(!courseId) return fail('Choose a course.','class-course');
  if(!date) return fail('Choose a date.','class-date');
  if(!time) return fail('Choose a start time.','class-time');
  if(!Number.isFinite(duration)||duration<15||duration>240) return fail('Duration must be between 15 and 240 minutes.','class-duration');
  if(!id && new Date(`${date}T${time}:00`)<new Date()) return fail('A new class must start in the future.','class-date');
  if(link && !validMeetingUrl(link)) return fail('Enter a full meeting URL starting with https://','class-link');
  const data={title,courseId,date,time,duration,platform:val('class-platform'),link};
  if(id){ Object.assign(classById(id),data); toast('Class updated.'); }
  else{
    state.classes.push({id:uid('cls'),owner:currentUser.username,host:user().name,...data});
    if(isTeacher()) notify('student',`New live class: ${title} · ${dayLabel(date)} ${fmtTime(time)}`,'virtual-class','Virtual class','announcements');
    toast(isTeacher()?'Class scheduled. Students can see it now.':'Study session scheduled.');
  }
  ui.classFilter='upcoming'; saveState(); closeModal(); refresh();
}

/* ---------- Calendar ---------- */
function renderCalendar(c){
  const today=todayISO(), teacher=isTeacher();
  if(!ui.calMonth) ui.calMonth=today.slice(0,7);
  if(!ui.calSelected) ui.calSelected=today;
  const [y,m]=ui.calMonth.split('-').map(Number), first=new Date(y,m-1,1), days=new Date(y,m,0).getDate();
  const label=first.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const byDate={}; calendarEvents().forEach(e=>(byDate[e.date]=byDate[e.date]||[]).push(e));
  const sel=byDate[ui.calSelected]||[];
  c.innerHTML=pageTitle('CALENDAR',label,`Quizzes, assignments, live classes${teacher?'':', and study tasks'} in one place.`)+
  `<div class="calendar-wrap"><div class="calendar-head"><button class="ghost-btn" data-action="cal-prev" aria-label="Previous month">←</button><div class="calendar-title"><h2>${label}</h2><button class="text-btn" data-action="cal-today">Today</button></div><button class="ghost-btn" data-action="cal-next" aria-label="Next month">→</button></div><div class="calendar-grid weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<b>${x}</b>`).join('')}</div><div class="calendar-grid">${Array.from({length:first.getDay()}).map(()=>'<div></div>').join('')}${Array.from({length:days},(_,i)=>{const iso=isoDate(new Date(y,m-1,i+1)), ev=byDate[iso]||[];return `<button class="calendar-day ${iso===today?'today':''} ${iso===ui.calSelected?'selected':''}" data-action="cal-select" data-date="${iso}" aria-label="${fmtLong(iso)}, ${ev.length} item${ev.length===1?'':'s'}"><span>${i+1}</span>${ev.slice(0,2).map(e=>`<em class="event ${e.type}">${esc(e.title)}</em>`).join('')}${ev.length>2?`<small class="more-events">+${ev.length-2} more</small>`:''}</button>`}).join('')}</div></div>
  <section class="section day-panel"><div class="section-head"><div><span class="eyebrow">${ui.calSelected===today?'TODAY':'SELECTED DAY'}</span><h2>${fmtLong(ui.calSelected)}</h2></div>${teacher?`<button class="ghost-btn" data-action="schedule-class" data-date="${ui.calSelected}">+ Schedule class</button>`:`<button class="ghost-btn" data-action="add-task" data-date="${ui.calSelected}">+ Add study task</button>`}</div><div class="day-events">${sel.map(e=>`<div class="day-event"><em class="event ${e.type}">${e.label}</em><div><strong>${esc(e.title)}${e.done?' ✓':''}</strong><small>${e.time?fmtTime(e.time)+' · ':''}${esc(courseName(e.courseId))}</small></div><button class="small-btn" data-action="open-event" data-kind="${e.kind}" data-id="${e.id}">Open →</button></div>`).join('')||emptyState('Nothing scheduled','There are no deadlines, classes, or tasks on this day.')}</div></section>`;
}
function shiftMonth(delta){ const [y,m]=ui.calMonth.split('-').map(Number); const d=new Date(y,m-1+delta,1); ui.calMonth=isoDate(d).slice(0,7); refresh(); }
function openEvent(kind,id){
  if(kind==='assignment'){ navigateTo('assignments'); return isTeacher()?showSubmissions(id):showStudentAssignment(id); }
  if(kind==='assessment'){ navigateTo('assessments'); return isTeacher()?showTeacherResults(id):showAssessmentIntro(id); }
  if(kind==='class'){ navigateTo('virtual-class'); return showClassDetails(id); }
  if(kind==='task'){ navigateTo('study-plan'); return showTaskMenu(id); }
}

/* ---------- Assessments ---------- */
function renderAssessments(c){ return isTeacher()?renderTeacherAssessments(c):renderStudentAssessments(c); }
function renderStudentAssessments(c){
  const f=ui.assessFilter, today=todayISO();
  const list=visibleAssessments().filter(a=>{const att=latestAttempt(a.id);return f==='all'||(f==='upcoming'&&!att)||(f==='past'&&att)||(f==='mastery'&&a.type==='mastery');})
    .sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
  c.innerHTML=pageTitle('ASSESSMENTS','Check what you actually know.','Review results, spot weak concepts, and turn mistakes into your next step.')+
  `<div class="filter-tabs-wrap">${tabs('assess',[['all','All'],['upcoming','Upcoming'],['past','Past'],['mastery','Mastery Checks']],f).replace('filter-tabs','filter-tabs large')}</div><div class="assessment-list">${list.map(a=>{
    const att=latestAttempt(a.id), draft=state.assessmentDrafts[a.id], overdue=!att&&a.dueDate&&a.dueDate<today;
    const missed=att?a.questions.length-att.correct:0;
    return `<article class="assessment-row"><div class="assessment-icon">${att?(att.score>=85?'✓':att.score>=70?'◐':'!'):'○'}</div><div class="assessment-info"><span>${esc(courseName(a.courseId))} · ${att?`Taken ${fmtShort(att.date)}`:a.dueDate?`Due ${fmtShort(a.dueDate)}`:'No due date'}</span><h3>${esc(a.title)}</h3><p>${att?(missed?`Missed ${missed} of ${a.questions.length} questions · review your answers`:'Strong across assessed concepts'):`${a.questions.length} questions · ${a.type==='mastery'?'Mastery check':'Quiz'}${draft?' · In progress':''}`}</p></div><div class="assessment-score">${att?`<strong>${att.score}%</strong>${statusPill(att.score)}`:`<strong>—</strong><span class="status ${overdue?'danger':'warn'}">${overdue?'Past due':'Not started'}</span>`}</div><div class="row-buttons">${att?`<button class="small-btn" data-action="assessment-results" data-id="${a.id}">View results →</button><button class="text-btn" data-action="retake-assessment" data-id="${a.id}">Retake</button>`:`<button class="small-btn" data-action="start-assessment" data-id="${a.id}">${draft?'Resume':'Start'} →</button>`}</div></article>`;
  }).join('')||emptyState('No assessments here',f==='upcoming'?'You have taken every published assessment.':'Nothing matches this filter yet.')}</div>`;
}
function assessmentById(id){ return state.assessments.find(a=>a.id===id); }
function showAssessmentIntro(id){
  const a=assessmentById(id); if(!a) return toast('That assessment no longer exists.');
  const att=latestAttempt(id);
  showModal(esc(a.title),`<div class="result-grid"><div><span>Questions</span><strong>${a.questions.length}</strong></div><div><span>Due</span><strong>${a.dueDate?fmtShort(a.dueDate):'—'}</strong></div><div><span>Latest score</span><strong>${att?att.score+'%':'Not taken'}</strong></div></div><div class="intervention"><b>${a.type==='mastery'?'Mastery check':'Quiz'} · ${esc(courseName(a.courseId))}</b><p>${esc(a.description||'Answer every question, then submit to see your score.')}</p></div>`,
  `<button class="ghost-btn" data-close>Close</button>${att?`<button class="ghost-btn" data-action="assessment-results" data-id="${id}">View results</button>`:''}<button class="primary-btn" data-action="${att?'retake-assessment':'start-assessment'}" data-id="${id}">${att?'Retake':'Start'} →</button>`,{focus:false});
}
function startAssessment(id,fresh=false){
  const a=assessmentById(id); if(!a) return toast('That assessment no longer exists.');
  if(fresh||!Array.isArray(state.assessmentDrafts[id])||state.assessmentDrafts[id].length!==a.questions.length){ state.assessmentDrafts[id]=a.questions.map(()=>null); saveState(); }
  const draft=state.assessmentDrafts[id], answered=draft.filter(x=>x!=null).length;
  showModal(esc(a.title),`<p class="quiz-meta">${esc(courseName(a.courseId))} · <span id="quiz-count">${answered} of ${a.questions.length} answered</span> · Your answers are saved as you go.</p>${a.questions.map((q,i)=>`<div class="quiz-q" data-q="${i}"><b>${i+1}. ${esc(q.q)}</b><div class="answer-options quiz-options">${q.options.map((o,oi)=>`<button class="${draft[i]===oi?'selected':''}" data-action="answer" data-assessment="${id}" data-q="${i}" data-o="${oi}" aria-pressed="${draft[i]===oi}">${'ABCD'[oi]}. ${esc(o)}</button>`).join('')}</div></div>`).join('')}`,
  `<button class="ghost-btn" data-close>Save & close</button><button class="primary-btn" data-action="submit-assessment" data-id="${id}">Submit answers</button>`,{wide:true,focus:false});
}
function answerQuestion(el){
  const id=el.dataset.assessment, qi=Number(el.dataset.q), oi=Number(el.dataset.o), a=assessmentById(id);
  const draft=state.assessmentDrafts[id]; if(!draft||!a) return;
  draft[qi]=oi; saveState();
  $$(`.quiz-q[data-q="${qi}"] button`).forEach(b=>{ const on=Number(b.dataset.o)===oi; b.classList.toggle('selected',on); b.setAttribute('aria-pressed',on); });
  const count=$('#quiz-count'); if(count) count.textContent=`${draft.filter(x=>x!=null).length} of ${a.questions.length} answered`;
  $('#modal-error')?.remove();
}
function submitAssessment(id){
  const a=assessmentById(id), draft=state.assessmentDrafts[id];
  if(!a||!draft) return toast('Start the assessment first.');
  const missing=draft.map((x,i)=>x==null?i+1:null).filter(Boolean);
  if(missing.length) return fail(`Answer every question before submitting. Unanswered: ${missing.join(', ')}.`);
  const result=gradeAttempt(a,draft);
  state.attempts.push({id:uid('att'),assessmentId:id,studentId:DEMO_STUDENT_ID,answers:[...draft],...result,date:todayISO()});
  delete state.assessmentDrafts[id];
  if(STUDENT_TOPICS.some(t=>t.id===a.courseId)){ const p=loadDemoProgress(); p.topics[a.courseId]=result.score; saveDemoProgress(p); applyDemoMastery(); }
  logActivity(`Scored ${result.score}% in ${a.title}`,'★');
  notify('teacher',`${studentById(DEMO_STUDENT_ID).name} scored ${result.score}% on ${a.title}`,'assessments','Assessment');
  saveState(); refresh(); showAssessmentResults(id,true);
}
function showAssessmentResults(id,justSubmitted=false){
  const a=assessmentById(id), att=latestAttempt(id); if(!a||!att) return toast('No saved attempt for this assessment yet.');
  const history=attemptsFor(id,DEMO_STUDENT_ID);
  showModal(`${justSubmitted?'Submitted · ':''}${esc(a.title)}`,`<div class="result-grid"><div><span>Score</span><strong>${att.score}%</strong></div><div><span>Correct</span><strong>${att.correct} / ${a.questions.length}</strong></div><div><span>Status</span><strong>${getStatus(att.score)}</strong></div></div><div class="intervention"><b>Recommended next step</b><p>${att.score<70?'Review the questions you missed, revisit the course lessons, then retake this check.':att.score<85?'Complete targeted practice on the missed questions before moving on.':'Great work — move to the next topic.'}</p></div><div class="review-list">${a.questions.map((q,i)=>{const ok=att.answers[i]===q.answer;return `<div class="review-item ${ok?'good':'bad'}"><b>${ok?'✓':'✗'} ${i+1}. ${esc(q.q)}</b><span>Your answer: ${esc(q.options[att.answers[i]]??'No answer')}</span>${ok?'':`<span>Correct answer: ${esc(q.options[q.answer])}</span>`}</div>`;}).join('')}</div>${history.length>1?`<p class="field-hint">Attempt history: ${history.map(h=>`${h.score}% (${fmtShort(h.date)})`).join(' · ')}</p>`:''}`,
  `<button class="ghost-btn" data-action="retake-assessment" data-id="${id}">Retake</button><button class="primary-btn" data-close>Done</button>`,{wide:true,focus:false});
}
function retakeAssessment(id){
  const a=assessmentById(id); if(!a) return;
  confirmDialog('Retake assessment?',`Start a new attempt of <strong>${esc(a.title)}</strong>? Your previous scores stay in your history, and the new attempt becomes your latest result.`,'Start new attempt',()=>startAssessment(id,true));
}

function renderTeacherAssessments(c){
  const f=ui.assessFilter==='published'||ui.assessFilter==='draft'?ui.assessFilter:'all';
  const list=state.assessments.filter(a=>f==='all'||(f==='published'?a.status==='Published':a.status==='Draft'));
  c.innerHTML=pageTitle('ASSESSMENTS','Build and review assessments.','Create assessments, inspect results, and identify weak concepts.')+
  `<div class="toolbar"><div>${tabs('assess',[['all','All'],['published','Published'],['draft','Drafts']],f)}</div><button class="primary-btn" data-action="create-assessment">+ Create Assessment</button></div><div class="teacher-assessment-grid">${list.map(a=>{const av=assessmentAverage(a.id), takers=latestAttemptsByStudent(a.id).length;return `<article class="teacher-assessment"><div class="assessment-icon">${a.status==='Draft'?'✎':av!=null&&av>=85?'✓':'◐'}</div><div><span>${esc(courseName(a.courseId))} · ${a.dueDate?`Due ${fmtShort(a.dueDate)}`:'No due date'}</span><h3>${esc(a.title)}${a.status==='Draft'?' <span class="status warn">Draft</span>':''}</h3><p>${av!=null?`Average score: <strong>${av}%</strong> · Completion: ${takers}/${STUDENTS.length}`:`${a.questions.length} question${a.questions.length===1?'':'s'} · No attempts yet`}</p></div><div class="assessment-actions"><button class="small-btn" data-action="teacher-results" data-id="${a.id}">View Results</button><button class="more-btn" data-action="assessment-menu" data-id="${a.id}" aria-label="More actions for ${esc(a.title)}">⋯</button></div></article>`;}).join('')||emptyState('No assessments here','Create an assessment to get started.','<button class="primary-btn" data-action="create-assessment">+ Create Assessment</button>')}</div>`;
}
function showTeacherResults(id){
  const a=assessmentById(id); if(!a) return toast('That assessment no longer exists.');
  const latest=latestAttemptsByStudent(id).sort((x,y)=>y.score-x.score), av=assessmentAverage(id);
  const qStats=a.questions.map((q,i)=>{const all=attemptsFor(id);return all.length?Math.round(all.filter(x=>x.answers[i]===q.answer).length/all.length*100):null;});
  showModal(esc(a.title),`<div class="result-grid"><div><span>Average score</span><strong>${av!=null?av+'%':'—'}</strong></div><div><span>Students attempted</span><strong>${latest.length} / ${STUDENTS.length}</strong></div><div><span>Status</span><strong>${a.status}</strong></div></div>${latest.length?`<h4 class="modal-sub">Latest score per student</h4><div class="submission-list">${latest.map(x=>`<div class="submission-item"><div><strong>${esc(studentById(x.studentId)?.name||'Student')}</strong><small>${fmtShort(x.date)} · ${x.correct}/${a.questions.length} correct</small></div>${statusPill(x.score)}<b>${x.score}%</b></div>`).join('')}</div><h4 class="modal-sub">Question accuracy</h4><div class="review-list">${a.questions.map((q,i)=>`<div class="review-item ${qStats[i]!=null&&qStats[i]<60?'bad':'good'}"><b>${i+1}. ${esc(q.q)}</b><span>${qStats[i]!=null?`${qStats[i]}% answered correctly`:'No answers yet'} · Answer: ${esc(q.options[q.answer])}</span></div>`).join('')}</div>`:'<p class="field-hint">No students have taken this assessment yet.</p>'}`,
  `<button class="ghost-btn" data-action="assessment-menu" data-id="${id}">Manage</button><button class="primary-btn" data-close>Done</button>`,{wide:true,focus:false});
}
function showAssessmentMenu(id){
  const a=assessmentById(id); if(!a) return;
  showModal(esc(a.title),`<p>${esc(courseName(a.courseId))} · ${a.status} · ${a.questions.length} questions</p><div class="menu-list"><button class="setting-row" data-action="edit-assessment" data-id="${id}"><span>Edit assessment</span><b>›</b></button><button class="setting-row" data-action="toggle-publish" data-id="${id}"><span>${a.status==='Published'?'Move back to drafts':'Publish to students'}</span><b>›</b></button><button class="setting-row danger-text" data-action="delete-assessment" data-id="${id}"><span>Delete assessment</span><b>›</b></button></div>`,'',{focus:false});
}
function builderQuestionHTML(q,i){
  return `<div class="builder-q" data-q="${i}"><div class="builder-q-head"><b>Question ${i+1}</b><button type="button" class="text-btn danger-text" data-action="builder-remove" data-index="${i}">Remove</button></div><input class="bq-text" maxlength="240" placeholder="Write a question..." value="${esc(q.q||'')}" aria-label="Question ${i+1} text"><div class="bq-options">${[0,1,2,3].map(o=>`<input class="bq-opt" maxlength="120" placeholder="Option ${'ABCD'[o]}" value="${esc(q.options?.[o]||'')}" aria-label="Question ${i+1} option ${'ABCD'[o]}">`).join('')}</div><div class="two-input"><label>Correct answer<select class="bq-answer">${[0,1,2,3].map(o=>`<option value="${o}" ${(q.answer??0)===o?'selected':''}>Option ${'ABCD'[o]}</option>`).join('')}</select></label><label>Points<input class="bq-points" type="number" min="1" max="20" value="${q.points||1}"></label></div></div>`;
}
function collectBuilderQuestions(){ return $$('#builder-questions .builder-q').map(row=>({q:$('.bq-text',row).value.trim(),options:$$('.bq-opt',row).map(i=>i.value.trim()),answer:Number($('.bq-answer',row).value),points:Number($('.bq-points',row).value)})); }
function renderBuilderQuestions(qs){ $('#builder-questions').innerHTML=qs.map(builderQuestionHTML).join(''); }
function showAssessmentBuilder(id,prefill){
  const a=id?assessmentById(id):null, src=a||prefill||{};
  const qs=src.questions?.length?src.questions:[{q:'',options:['','','',''],answer:0,points:1}];
  showModal(a?'Edit Assessment':'Create Assessment',`<label>Title<input id="new-a-title" maxlength="100" value="${esc(src.title||'')}" placeholder="e.g. General Mathematics Check-in"></label><div class="two-input"><label>Course<select id="new-a-course">${courseOptions(src.courseId||state.courses[0]?.id)}</select></label><label>Type<select id="new-a-type"><option value="quiz" ${src.type!=='mastery'?'selected':''}>Quiz</option><option value="mastery" ${src.type==='mastery'?'selected':''}>Mastery check</option></select></label></div><label>Description<textarea id="new-a-desc" maxlength="300" placeholder="What should students demonstrate?">${esc(src.description||'')}</textarea></label><label>Due Date<input id="new-a-due" type="date" value="${src.dueDate||''}"></label><div class="question-builder"><b>Questions</b><div id="builder-questions">${qs.map(builderQuestionHTML).join('')}</div><button type="button" class="ghost-btn" data-action="builder-add">+ Add question</button></div>${a&&attemptsFor(id).length?'<p class="field-hint">Existing attempts keep the scores they were given.</p>':''}`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="ghost-btn" data-action="save-assessment" data-id="${id||''}" data-status="Draft">Save draft</button><button class="primary-btn" data-action="save-assessment" data-id="${id||''}" data-status="Published">${a?.status==='Published'?'Save & keep published':'Publish'}</button>`,{wide:true});
}
function saveAssessment(id,status){
  const title=val('new-a-title'), raw=collectBuilderQuestions(), dueDate=val('new-a-due'), courseId=val('new-a-course');
  if(title.length<3) return fail('Title must be at least 3 characters.','new-a-title');
  if(!courseId) return fail('Choose a course.','new-a-course');
  const questions=[];
  for(let i=0;i<raw.length;i++){
    const q=raw[i], filled=q.options.map((o,oi)=>({o,oi})).filter(x=>x.o);
    const blank=!q.q&&!filled.length;
    if(blank && status==='Draft') continue;
    if(status==='Published'||!blank){
      if(!q.q) return fail(`Question ${i+1} needs text.`);
      if(filled.length<2) return fail(`Question ${i+1} needs at least two answer options.`);
      if(!q.options[q.answer]) return fail(`The correct answer for question ${i+1} points to an empty option.`);
      if(!Number.isFinite(q.points)||q.points<1||q.points>20) return fail(`Points for question ${i+1} must be between 1 and 20.`);
    }
    questions.push({q:q.q,options:filled.map(x=>x.o),answer:filled.findIndex(x=>x.oi===q.answer),points:q.points});
  }
  if(status==='Published'){
    if(!questions.length) return fail('Add at least one question before publishing.');
    if(!dueDate) return fail('Choose a due date before publishing.','new-a-due');
  }
  const data={title,courseId,type:val('new-a-type'),description:val('new-a-desc'),dueDate,status,questions};
  const wasPublished=id&&assessmentById(id)?.status==='Published';
  if(id){ Object.assign(assessmentById(id),data); delete state.assessmentDrafts[id]; }
  else state.assessments.unshift({id:uid('asm'),createdAt:todayISO(),...data});
  if(status==='Published'&&!wasPublished) notify('student',`New ${data.type==='mastery'?'mastery check':'quiz'}: ${title} · due ${fmtShort(dueDate)}`,'assessments','Assessment','assessments');
  saveState(); closeModal(); refresh(); toast(status==='Published'?'Assessment published to students.':'Assessment saved as a draft.');
}

/* ---------- Assignments ---------- */
function renderAssignments(c){ return isTeacher()?renderTeacherAssignments(c):renderStudentAssignments(c); }
function assignmentById(id){ return state.assignments.find(a=>a.id===id); }
function assignmentFilter(a,f){ const n=daysFromToday(a.due); return f==='all'||(f==='upcoming'&&n>=0)||(f==='past'&&n<0)||(f==='graded'&&submissionFor(a.id)?.status==='Graded')||(f==='grading'&&state.submissions.some(s=>s.assignmentId===a.id&&s.status==='Submitted')); }
function renderStudentAssignments(c){
  const f=['all','upcoming','past','graded'].includes(ui.assignFilter)?ui.assignFilter:'all';
  const list=state.assignments.filter(a=>assignmentFilter(a,f)).sort((a,b)=>a.due.localeCompare(b.due));
  c.innerHTML=pageTitle('ASSIGNMENTS','Your assignments.','Submit your work, keep an eye on due dates, and read feedback from your teachers.')+
  `<div class="filter-tabs-wrap">${tabs('assign',[['all','All'],['upcoming','Upcoming'],['past','Past'],['graded','Graded']],f).replace('filter-tabs','filter-tabs large')}</div><div class="assignment-list">${list.map(a=>{const st=studentAssignmentStatus(a), sub=submissionFor(a.id);return `<article class="assignment-row"><div><span>${esc(courseName(a.courseId))} · Due ${fmtShort(a.due)} (${relDays(a.due)})</span><h3>${esc(a.title)}</h3></div><div><b>${a.points}</b><small>Points</small></div><div><b>${sub?.status==='Graded'?`${sub.score}/${a.points}`:'—'}</b><small>Your score</small></div><span class="status ${st==='Missing'?'danger':st==='Not Started'?'warn':'good'}">${st}</span><button class="small-btn" data-action="view-assignment" data-id="${a.id}">View →</button></article>`;}).join('')||emptyState('No assignments here','Nothing matches this filter.')}</div>`;
}
function showStudentAssignment(id){
  const a=assignmentById(id); if(!a) return toast('That assignment no longer exists.');
  const sub=submissionFor(id), st=studentAssignmentStatus(a), graded=sub?.status==='Graded', late=daysFromToday(a.due)<0;
  showModal(esc(a.title),`<div class="result-grid"><div><span>Due</span><strong>${fmtShort(a.due)}</strong></div><div><span>Points</span><strong>${a.points}</strong></div><div><span>Status</span><strong>${st}</strong></div></div><div class="intervention"><b>Instructions · ${esc(courseName(a.courseId))}</b><p>${esc(a.instructions)}</p></div>${graded?`<div class="intervention"><b>Score: ${sub.score} / ${a.points}</b><p>${esc(sub.feedback||'No written feedback.')}</p></div><h4 class="modal-sub">Your submission · ${fmtShort(sub.submittedAt)}</h4><div class="submission-box">${esc(sub.content)}</div>`:`<label>Your submission<textarea id="sub-content" rows="6" maxlength="4000" placeholder="Type or paste your work here...">${esc(sub?.content||'')}</textarea></label><p class="field-hint">Minimum 20 characters.${sub?` Submitted ${fmtShort(sub.submittedAt)} — you can resubmit until it is graded.`:''}${late?' This assignment is past due; your submission will be marked late.':''}</p>`}`,
  graded?'<button class="primary-btn" data-close>Done</button>':`<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="submit-assignment" data-id="${id}">${sub?'Resubmit':'Submit assignment'}</button>`,{wide:true,focus:false});
}
function submitAssignment(id){
  const a=assignmentById(id), content=val('sub-content');
  if(!a) return;
  if(content.length<20) return fail('Your submission must be at least 20 characters.','sub-content');
  const existing=submissionFor(id), late=daysFromToday(a.due)<0;
  if(existing?.status==='Graded') return fail('This assignment has already been graded.');
  if(existing) Object.assign(existing,{content,submittedAt:todayISO(),late});
  else state.submissions.push({id:uid('sub'),assignmentId:id,studentId:DEMO_STUDENT_ID,content,submittedAt:todayISO(),status:'Submitted',score:null,feedback:'',late});
  logActivity(`Submitted ${a.title}`,'↑');
  notify('teacher',`${studentById(DEMO_STUDENT_ID).name} ${existing?'resubmitted':'submitted'} ${a.title}`,'assignments','Submission');
  saveState(); closeModal(); refresh(); toast(existing?'Submission updated.':'Assignment submitted.');
}
function renderTeacherAssignments(c){
  const f=['all','upcoming','past','grading'].includes(ui.assignFilter)?ui.assignFilter:'all';
  const list=state.assignments.filter(a=>assignmentFilter(a,f)).sort((a,b)=>a.due.localeCompare(b.due));
  c.innerHTML=pageTitle('ASSIGNMENTS','Track the work coming in.','See submissions, averages, and which activities need attention.')+
  `<div class="toolbar"><div>${tabs('assign',[['all','All'],['upcoming','Upcoming'],['past','Past'],['grading','Needs grading']],f)}</div><button class="primary-btn" data-action="create-assignment">+ Create assignment</button></div><div class="assignment-list">${list.map(a=>{const subs=state.submissions.filter(s=>s.assignmentId===a.id), pending=subs.filter(s=>s.status==='Submitted').length, av=assignmentAverage(a);return `<article class="assignment-row"><div><span>${esc(courseName(a.courseId))} · Due ${fmtShort(a.due)}</span><h3>${esc(a.title)}</h3></div><div><b>${subs.length} / ${STUDENTS.length}</b><small>Submissions</small></div><div><b>${av!=null?av+'%':'—'}</b><small>Average score</small></div><span class="status ${pending?'danger':subs.length?'good':'warn'}">${pending?`${pending} to grade`:subs.length?'All graded':'No submissions'}</span><button class="small-btn" data-action="view-submissions" data-id="${a.id}">View →</button></article>`;}).join('')||emptyState('No assignments here','Nothing matches this filter.','<button class="primary-btn" data-action="create-assignment">+ Create assignment</button>')}</div>`;
}
function showSubmissions(id){
  const a=assignmentById(id); if(!a) return toast('That assignment no longer exists.');
  const subs=state.submissions.filter(s=>s.assignmentId===id), av=assignmentAverage(a);
  showModal(esc(a.title),`<p>${esc(courseName(a.courseId))} · Due ${fmtShort(a.due)} · ${a.points} points</p><div class="result-grid"><div><span>Submitted</span><strong>${subs.length} / ${STUDENTS.length}</strong></div><div><span>Graded</span><strong>${subs.filter(s=>s.status==='Graded').length}</strong></div><div><span>Average</span><strong>${av!=null?av+'%':'—'}</strong></div></div><h4 class="modal-sub">Students</h4><div class="submission-list">${students().map(s=>{const sub=subs.find(x=>x.studentId===s.id);return `<div class="submission-item"><div><strong>${esc(s.name)}</strong><small>${sub?`Submitted ${fmtShort(sub.submittedAt)}${sub.late?' · Late':''}`:'Not submitted'}</small></div><span class="status ${!sub?'warn':sub.status==='Graded'?'good':'danger'}">${!sub?(daysFromToday(a.due)<0?'Missing':'Pending'):sub.status==='Graded'?`${sub.score}/${a.points}`:'Needs grading'}</span>${sub?`<button class="small-btn" data-action="grade-submission" data-id="${sub.id}">${sub.status==='Graded'?'Regrade':'Grade'} →</button>`:'<span></span>'}</div>`;}).join('')}</div>`,
  `<button class="ghost-btn danger-text" data-action="delete-assignment" data-id="${id}">Delete</button><button class="ghost-btn" data-action="edit-assignment" data-id="${id}">Edit</button><button class="primary-btn" data-close>Done</button>`,{wide:true,focus:false});
}
function showGradeForm(subId){
  const sub=state.submissions.find(s=>s.id===subId), a=sub&&assignmentById(sub.assignmentId);
  if(!sub||!a) return toast('That submission no longer exists.');
  showModal(`Grade · ${esc(studentById(sub.studentId)?.name||'Student')}`,`<p>${esc(a.title)} · Submitted ${fmtShort(sub.submittedAt)}${sub.late?' · Late':''}</p><div class="submission-box">${esc(sub.content)}</div><label>Score (out of ${a.points})<input id="grade-score" type="number" min="0" max="${a.points}" value="${sub.score??''}"></label><label>Feedback<textarea id="grade-feedback" maxlength="600" placeholder="What went well? What should they work on next?">${esc(sub.feedback||'')}</textarea></label>`,
  `<button class="ghost-btn" data-action="view-submissions" data-id="${a.id}">← Back</button><button class="primary-btn" data-action="save-grade" data-id="${subId}">Save grade</button>`,{wide:true});
}
function saveGrade(subId){
  const sub=state.submissions.find(s=>s.id===subId), a=sub&&assignmentById(sub.assignmentId); if(!a) return;
  const raw=val('grade-score'), score=Number(raw);
  if(raw===''||!Number.isInteger(score)||score<0||score>a.points) return fail(`Enter a whole-number score from 0 to ${a.points}.`,'grade-score');
  Object.assign(sub,{score,feedback:val('grade-feedback'),status:'Graded',gradedAt:todayISO()});
  if(sub.studentId===DEMO_STUDENT_ID) notify('student',`${a.title} was graded: ${score}/${a.points}`,'assignments','Grade','assessments');
  saveState(); refresh(); toast('Grade saved.'); showSubmissions(a.id);
}
function showAssignmentForm(id){
  const a=id?assignmentById(id):null;
  showModal(a?'Edit assignment':'Create assignment',`<label>Title<input id="asg-title" maxlength="100" value="${esc(a?.title||'')}" placeholder="Assignment title"></label><label>Course<select id="asg-course">${courseOptions(a?.courseId||state.courses[0]?.id)}</select></label><div class="two-input"><label>Due date<input id="asg-due" type="date" value="${a?.due||offsetISO(7)}"></label><label>Points<input id="asg-points" type="number" min="1" max="1000" value="${a?.points||100}"></label></div><label>Instructions<textarea id="asg-instructions" maxlength="1500" placeholder="Assignment instructions...">${esc(a?.instructions||'')}</textarea></label>`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-assignment" data-id="${id||''}">${a?'Save changes':'Create'}</button>`);
}
function saveAssignment(id){
  const title=val('asg-title'), courseId=val('asg-course'), due=val('asg-due'), points=Number(val('asg-points')), instructions=val('asg-instructions');
  if(title.length<3) return fail('Title must be at least 3 characters.','asg-title');
  if(!courseId) return fail('Choose a course.','asg-course');
  if(!due) return fail('Choose a due date.','asg-due');
  if(!Number.isInteger(points)||points<1||points>1000) return fail('Points must be a whole number from 1 to 1000.','asg-points');
  if(instructions.length<10) return fail('Instructions must be at least 10 characters.','asg-instructions');
  const graded=id?state.submissions.filter(s=>s.assignmentId===id&&s.status==='Graded'&&s.score>points):[];
  if(graded.length) return fail(`${graded.length} graded submission(s) already score above ${points} points.`,'asg-points');
  if(id){ Object.assign(assignmentById(id),{title,courseId,due,points,instructions}); toast('Assignment updated.'); }
  else{ state.assignments.push({id:uid('asg'),title,courseId,due,points,instructions}); notify('student',`New assignment: ${title} · due ${fmtShort(due)}`,'assignments','Assignment','assessments'); toast('Assignment created. Students can see it now.'); }
  saveState(); closeModal(); refresh();
}

/* ---------- Teacher dashboard ---------- */
function renderTeacherDashboard(c){
  const st=students(), pending=state.submissions.filter(s=>s.status==='Submitted').length;
  const courseStats=state.courses.map(co=>({co,m:classMastery(co.id)})), withData=courseStats.filter(x=>x.m!=null).sort((a,b)=>a.m-b.m);
  const atRisk=withData.filter(x=>x.m<70).length, weakest=withData[0];
  const tags=[...new Set([...st].sort((a,b)=>a.mastery-b.mastery).flatMap(s=>s.weak))].slice(0,3);
  const nextClass=upcomingClasses()[0];
  const recent=[...state.submissions].sort((a,b)=>(a.status==='Submitted'?0:1)-(b.status==='Submitted'?0:1)||b.submittedAt.localeCompare(a.submittedAt)).slice(0,3);
  c.innerHTML=pageTitle('TEACHER DASHBOARD',`${greeting()}, Professor.`,'Here’s what needs your attention today.')+
  `<div class="analytics-top">${stat(String(st.length),'Students','Across active classes','blue')}${stat(String(state.courses.length),'Courses',`${state.courses.filter(x=>x.instructor===user().name).length} taught by you`,'yellow')}${stat(String(pending),'Pending Submissions','Need review','sky')}${stat(String(atRisk),'Topics Need Attention','Below 70% class mastery','navy')}</div><section class="teacher-attention"><div class="attention-copy"><span class="eyebrow">CLASS ATTENTION</span><h2>${weakest?`Students are struggling most with <em>${esc(weakest.co.name)}.</em>`:'No class data yet.'}</h2><p>Average mastery is <strong>${avg(st.map(x=>x.mastery))}%</strong>. Review the topics with the lowest mastery and use targeted practice before the next check-in.</p><div class="tag-row">${tags.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button class="primary-btn" data-go="students">View Students →</button></div><div class="attention-number"><div class="teacher-scene">${svgScene('teacher')}</div><strong>${st.filter(x=>x.mastery<70).length}</strong><span>students below<br>70% mastery</span></div></section>
  <section class="section compact-live-card teacher-live-card"><div class="live-mini-visual"><img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=500&q=80" alt="Teacher and students in a virtual class" onerror="this.style.display='none'"><div class="live-mini-fallback">${svgScene("class")}</div></div><div class="live-mini-copy">${nextClass?`<span class="eyebrow">NEXT LIVE SESSION</span><h3>${esc(nextClass.title)} · ${dayLabel(nextClass.date)} ${fmtTime(nextClass.time)}</h3><p>${esc(nextClass.platform)} · ${nextClass.duration} min · ${nextClass.link?'Meeting link ready':'Meeting link not added yet'}</p><div><button class="primary-btn" data-action="class-details" data-id="${nextClass.id}">Open class →</button><button class="text-btn" data-go="virtual-class">Manage classes</button></div>`:`<span class="eyebrow">NEXT LIVE SESSION</span><h3>No upcoming sessions</h3><p>Schedule a live class for your students.</p><div><button class="primary-btn" data-action="schedule-class">+ Schedule class</button><button class="text-btn" data-go="virtual-class">Manage classes</button></div>`}</div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">CLASS PERFORMANCE</span><h2>How your courses are doing.</h2></div><button class="text-btn" data-go="analytics">Open analytics →</button></div><div class="teacher-course-grid">${courseStats.map(({co,m})=>`<article class="teacher-course clickable" data-action="open-course" data-course="${co.id}" role="button" tabindex="0"><div><span>${m==null?'No students yet':m>=85?'Strong':m<70?'Needs attention':'Good'}</span><b>${m==null?'—':m+'%'}</b></div><h3>${esc(co.name)}</h3>${progressBar(m||0)}<p>Class mastery</p></article>`).join('')}</div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">RECENT SUBMISSIONS</span><h2>Needs your attention.</h2></div><button class="text-btn" data-go="assignments">View all →</button></div><div class="submission-table"><div class="table-head"><span>Student</span><span>Assignment</span><span>Submitted</span><span>Status</span></div>${recent.map(s=>`<div class="table-row clickable" data-action="grade-submission" data-id="${s.id}" role="button" tabindex="0"><strong>${esc(studentById(s.studentId)?.name||'Student')}</strong><span>${esc(assignmentById(s.assignmentId)?.title||'Assignment')}</span><span>${relDays(s.submittedAt)}</span><span class="status ${s.status==='Submitted'?'danger':'good'}">${s.status==='Submitted'?'Needs Review':'Graded'}</span></div>`).join('')||'<div class="table-row"><span>No submissions yet.</span></div>'}</div></section>`;
}

/* ---------- Students ---------- */
function renderStudents(c){
  c.innerHTML=pageTitle('STUDENTS','Who needs support?','Click a student to inspect their learning pattern and suggested intervention.')+
  `<div class="toolbar"><div class="search"><span>⌕</span><input id="student-search" data-input="student-search" placeholder="Search students..." aria-label="Search students" value="${esc(ui.studentQuery)}"><button class="search-clear" data-action="clear-student-search" aria-label="Clear search" ${ui.studentQuery?'':'hidden'}>×</button></div><select id="student-filter" data-change="student-filter" aria-label="Filter students">${[['all','All students'],['Needs Attention','Needs Attention'],['On Track','On Track'],['Mastered','Mastered']].map(([v,l])=>`<option value="${v}" ${ui.studentFilter===v?'selected':''}>${l}</option>`).join('')}</select></div><div id="student-table" class="student-table"></div>`;
  renderStudentRows();
}
function renderStudentRows(){
  const box=$('#student-table'); if(!box) return;
  const q=ui.studentQuery.toLowerCase();
  const list=students().filter(s=>(!q||`${s.name} ${courseName(s.courseId)}`.toLowerCase().includes(q))&&(ui.studentFilter==='all'||s.status===ui.studentFilter));
  box.innerHTML=`<div class="table-head"><span>Student</span><span>Course</span><span>Mastery</span><span>Last activity</span><span>Status</span></div>${list.map(studentRow).join('')||emptyState('No students found','Try another name or status filter.','<button class="ghost-btn" data-action="reset-student-filters">Clear search & filter</button>')}`;
  const clear=$('.search-clear'); if(clear) clear.hidden=!ui.studentQuery;
}
function studentRow(s){return `<button class="table-row student-row" data-action="student-detail" data-id="${s.id}"><strong><span class="avatar sm">${initials(s.name)}</span>${esc(s.name)}</strong><span>${esc(courseName(s.courseId))}</span><span class="mastery-number">${s.mastery}%</span><span>${esc(s.last)}</span><span class="status ${s.mastery<70?'danger':s.mastery<85?'warn':'good'}">${s.status}</span></button>`;}
function showStudentDetail(id){
  const s=studentById(id); if(!s) return;
  const practice=state.tasks.filter(t=>t.studentId===id&&t.assignedBy);
  const subs=state.submissions.filter(x=>x.studentId===id), graded=subs.filter(x=>x.status==='Graded');
  showModal(esc(s.name),`<div class="student-detail"><div class="student-detail-top"><div class="profile-avatar sm">${initials(s.name)}</div><div><span>${esc(courseName(s.courseId))}</span><strong>${s.mastery}% mastery · ${s.status}</strong></div></div><div class="detail-columns"><div><h4>STRONG TOPICS</h4>${s.strong.map(x=>`<span class="topic-chip good">${esc(x)}</span>`).join('')||'<span>None yet</span>'}</div><div><h4>WEAK TOPICS</h4>${s.weak.length?s.weak.map(x=>`<span class="topic-chip danger">${esc(x)}</span>`).join(''):'<span>None</span>'}</div></div><div class="result-grid"><div><span>Submissions</span><strong>${subs.length}</strong></div><div><span>Graded avg.</span><strong>${graded.length?avg(graded.map(x=>x.score/(assignmentById(x.assignmentId)?.points||100)*100))+'%':'—'}</strong></div><div><span>Last active</span><strong>${esc(s.last)}</strong></div></div><div class="intervention"><b>Recommended intervention</b><p>${s.weak.length?`Assign additional practice for ${esc(s.weak[0])} and check mastery after completion.`:'Offer an enrichment activity or move to the next topic.'}</p></div><h4 class="modal-sub">Assigned practice</h4>${practice.length?`<div class="submission-list">${practice.map(t=>`<div class="submission-item"><div><strong>${esc(t.title)}</strong><small>Due ${fmtShort(t.date)} · ${t.duration} min</small></div><span class="status ${t.done?'good':'warn'}">${t.done?'Done':'To do'}</span><span></span></div>`).join('')}</div>`:'<p class="field-hint">No practice assigned yet.</p>'}</div>`,
  `<button class="ghost-btn" data-close>Close</button><button class="primary-btn" data-action="assign-practice" data-id="${id}">Assign Practice →</button>`,{wide:true,focus:false});
}
function showPracticeForm(studentId,courseId){
  const s=studentById(studentId)||students()[0];
  const course=courseId||s.courseId;
  showModal('Assign practice',`<label>Student<select id="prac-student">${students().map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${esc(x.name)} · ${x.mastery}%</option>`).join('')}</select></label><div class="two-input"><label>Course<select id="prac-course">${courseOptions(course)}</select></label><label>Activity<select id="prac-type"><option>Practice set</option><option>Review lesson</option><option>Mastery check</option></select></label></div><label>Practice focus<input id="prac-title" maxlength="80" value="${esc(s.weak[0]?`Practice ${s.weak[0]}`:'Enrichment practice')}"></label><div class="two-input"><label>Due date<input id="prac-date" type="date" value="${offsetISO(1)}"></label><label>Duration (minutes)<input id="prac-duration" type="number" min="5" max="240" step="5" value="20"></label></div><p class="field-hint">The practice is added to the student’s study plan.</p>`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-practice">Assign practice</button>`);
}
function savePractice(){
  const studentId=Number(val('prac-student')), title=val('prac-title'), date=val('prac-date'), duration=Number(val('prac-duration')), type=val('prac-type');
  const s=studentById(studentId);
  if(!s) return fail('Choose a student.','prac-student');
  if(title.length<3) return fail('Describe the practice focus (at least 3 characters).','prac-title');
  if(!date) return fail('Choose a due date.','prac-date');
  if(date<todayISO()) return fail('The due date cannot be in the past.','prac-date');
  if(!Number.isFinite(duration)||duration<5||duration>240) return fail('Duration must be between 5 and 240 minutes.','prac-duration');
  state.tasks.push({id:uid('task'),studentId,title:`${type}: ${title.replace(/^Practice\s+/i,'')}`,courseId:val('prac-course'),date,time:'16:00',duration,priority:s.mastery<70?'High':'Medium',target:type==='Mastery check'?'assessments':'',done:false,assignedBy:user().name});
  if(studentId===DEMO_STUDENT_ID) notify('student',`${user().name} assigned: ${type} · ${title}`,'study-plan','Practice');
  saveState(); toast(`Practice assigned to ${s.name}.`); showStudentDetail(studentId);
}

/* ---------- Analytics ---------- */
function renderAnalytics(c){
  const st=students(), tab=ui.analyticsTab;
  const courseRows=state.courses.map(co=>({id:co.id,name:co.name,value:classMastery(co.id)})).filter(x=>x.value!=null);
  const published=state.assessments.filter(a=>a.status==='Published'), quizAvgs=published.map(a=>assessmentAverage(a.id)).filter(x=>x!=null);
  const rows=tab==='assessments'?published.map(a=>({kind:'assessment',id:a.id,name:a.title,value:assessmentAverage(a.id)}))
    :tab==='assignments'?state.assignments.map(a=>({kind:'assignment',id:a.id,name:a.title,value:assignmentAverage(a)}))
    :courseRows.map(x=>({kind:'course',...x}));
  c.innerHTML=pageTitle('LEARNING ANALYTICS','Class Learning Analytics','Find the topics and students that need intervention—not just the averages.')+
  `<div class="analytics-top">${stat(avg(st.map(x=>x.mastery))+'%','Class Mastery',`Across ${st.length} students`,'blue')}${stat(String(courseRows.filter(x=>x.value<70).length),'Subjects At Risk','Below 70% mastery','yellow')}${stat((quizAvgs.length?avg(quizAvgs):0)+'%','Average Quiz Score','Latest attempt per student','sky')}${stat(String(state.submissions.filter(s=>s.status==='Submitted').length),'Awaiting Grades','Submitted assignments','navy')}</div><section class="section"><div class="section-head"><div><span class="eyebrow">${tab==='mastery'?'TOPIC DIFFICULTY MAP':tab==='assessments'?'ASSESSMENT RESULTS':'ASSIGNMENT RESULTS'}</span><h2>${tab==='mastery'?'Where is the class getting stuck?':tab==='assessments'?'How did students score?':'How is graded work going?'}</h2></div>${tabs('analytics',[['mastery','Mastery'],['assessments','Assessments'],['assignments','Assignments']],tab)}</div><div class="difficulty-map">${rows.map(x=>`<button class="difficulty-row" data-action="analytics-row" data-kind="${x.kind}" data-id="${x.id}"><span class="difficulty-name"><i class="difficulty-dot ${x.value==null?'low':x.value<70?'high':x.value<85?'mid':'low'}"></i>${esc(x.name)}</span><div>${progressBar(x.value||0)}</div><b>${x.value==null?'—':x.value+'%'}</b><em>${x.value==null?'No data yet':x.value<70?'High Difficulty':x.value<85?'Needs Attention':'Easy'}</em>→</button>`).join('')||emptyState('No data yet','Results appear once students submit work.')}</div></section>`;
}
function showCourseInsight(courseId){
  const co=courseById(courseId), m=classMastery(courseId); if(!co) return;
  const list=students().filter(s=>s.courseId===courseId).sort((a,b)=>a.mastery-b.mastery), struggling=list.filter(s=>s.mastery<70);
  showModal(esc(co.name),`<div class="result-grid"><div><span>Average mastery</span><strong>${m}%</strong></div><div><span>Struggling students</span><strong>${struggling.length} of ${list.length}</strong></div><div><span>Difficulty</span><strong>${m<70?'High':m<85?'Medium':'Low'}</strong></div></div><div class="intervention"><b>Recommended intervention</b><p>${m<70?'Assign targeted practice, then run a mastery check.':'Use a short practice set before the next assessment.'}</p></div><h4 class="modal-sub">Students in this course</h4><div class="submission-list">${list.map(s=>`<div class="submission-item"><div><strong>${esc(s.name)}</strong><small>Weak: ${esc(s.weak.join(', ')||'None')}</small></div><span class="status ${s.mastery<70?'danger':s.mastery<85?'warn':'good'}">${s.mastery}%</span><button class="small-btn" data-action="assign-practice" data-id="${s.id}" data-course="${courseId}">Assign →</button></div>`).join('')}</div>`,
  '<button class="primary-btn" data-close>Done</button>',{wide:true,focus:false});
}

/* ---------- Announcements ---------- */
function renderAnnouncements(c){
  const isT=isTeacher(), f=ui.annFilter;
  const anns=[...state.announcements].sort((a,b)=>b.date.localeCompare(a.date)).filter(a=>isT||f==='all'||!state.annRead.includes(a.id));
  const unread=unreadAnnouncements();
  c.innerHTML=pageTitle('ANNOUNCEMENTS',isT?'Keep your classes in the loop.':'Stay in the loop.','Important updates, deadlines, and class information.')+
  `<div class="toolbar">${isT?'<span></span><button class="primary-btn add-ann" data-action="add-ann">+ Create announcement</button>':`${tabs('ann',[['all','All'],['unread',`Unread (${unread})`]],f)}<button class="ghost-btn" data-action="mark-all-ann" ${unread?'':'disabled title="Everything is already read"'}>Mark all as read</button>`}</div><div class="announcement-list">${anns.map(a=>{const read=state.annRead.includes(a.id);return `<article class="announcement ${!isT&&read?'read':''}"><div class="announcement-mark">!</div><div><span>${esc(courseName(a.courseId))} · ${fmtShort(a.date)}</span><h3>${esc(a.title)}</h3><p>${esc(a.body)}</p></div>${isT?`<span class="row-buttons"><button class="text-btn" data-action="edit-ann" data-id="${a.id}">Edit</button><button class="text-btn danger-text" data-action="delete-ann" data-id="${a.id}">Delete</button></span>`:`<button class="text-btn" data-action="toggle-ann-read" data-id="${a.id}">${read?'Mark as unread':'Mark as read'}</button>`}</article>`;}).join('')||emptyState(isT?'No announcements yet':'You are all caught up',isT?'Create an announcement to reach your students.':'There are no unread announcements.')}</div>`;
}
function showAnnouncementModal(id){
  const a=id?state.announcements.find(x=>x.id===id):null;
  showModal(a?'Edit announcement':'Create announcement',`<label>Title<input id="ann-title" maxlength="100" value="${esc(a?.title||'')}" placeholder="Announcement title"></label><label>Course<select id="ann-course">${courseOptions(a?.courseId||'all',{all:true})}</select></label><label>Message<textarea id="ann-body" maxlength="1000" placeholder="Write your announcement...">${esc(a?.body||'')}</textarea></label>`,
  `<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="publish-ann" data-id="${id||''}">${a?'Save changes':'Publish'}</button>`);
}
function publishAnnouncement(id){
  const title=val('ann-title'), body=val('ann-body'), courseId=val('ann-course');
  if(title.length<3) return fail('Title must be at least 3 characters.','ann-title');
  if(body.length<10) return fail('Message must be at least 10 characters.','ann-body');
  if(id){ Object.assign(state.announcements.find(x=>x.id===id),{title,body,courseId}); state.annRead=state.annRead.filter(x=>x!==id); toast('Announcement updated.'); }
  else{ state.announcements.unshift({id:uid('ann'),title,body,courseId,date:todayISO()}); notify('student',`Announcement: ${title}`,'announcements',courseName(courseId),'announcements'); toast('Announcement published.'); }
  saveState(); closeModal(); refresh();
}

/* ---------- Profile & settings ---------- */
function field(k,v){return `<div><span>${k}</span><strong>${esc(v)}</strong></div>`;}
function renderProfile(c){
  const t=isTeacher(), u=user();
  const taught=state.courses.filter(x=>x.instructor===u.name).map(x=>x.name);
  c.innerHTML=pageTitle('PROFILE','Your account','Manage your basic profile information and session.')+`<div class="profile-layout"><section class="profile-card"><div class="profile-cover"><div class="profile-avatar">${initials(u.name)}</div></div><div class="profile-body"><h2>${esc(u.name)}</h2><p>${esc(u.email)}</p><div class="profile-fields">${t?field('Department',u.department)+field('Role','Faculty')+field('Courses',taught.join(' · ')||'None assigned'):field('Program',u.program)+field('Year Level',u.year)+field('Courses',state.courses.map(x=>x.name).join(' · ')||'None')}</div><button class="primary-btn" data-action="edit-profile">Edit Profile</button></div></section><section class="settings-card"><span class="eyebrow">ACCOUNT</span><h2>Settings</h2><button class="setting-row" data-action="notification-settings"><span>Notifications</span><b>›</b></button><button class="setting-row" data-action="change-password"><span>Change password</span><b>›</b></button><button class="setting-row" data-action="privacy"><span>Privacy & data</span><b>›</b></button><button class="setting-row danger-text" data-action="logout"><span>Log out</span><b>›</b></button></section></div>`;
}
function showProfileForm(){
  const u=user(), t=isTeacher();
  showModal('Edit profile',`<label>Display name<input id="profile-name" maxlength="60" value="${esc(u.name)}"></label><label>Email<input id="profile-email" type="email" maxlength="80" value="${esc(u.email)}"></label>${t?`<label>Department<input id="profile-department" maxlength="60" value="${esc(u.department)}"></label>`:`<div class="two-input"><label>Program<input id="profile-program" maxlength="60" value="${esc(u.program)}"></label><label>Year level<input id="profile-year" maxlength="30" value="${esc(u.year)}"></label></div>`}`,
  '<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-profile">Save changes</button>');
}
function saveProfile(){
  const t=isTeacher(), name=val('profile-name'), email=val('profile-email');
  if(name.length<2) return fail('Name must be at least 2 characters.','profile-name');
  if(!validEmail(email)) return fail('Enter a valid email address.','profile-email');
  const data={name,email};
  if(t){ data.department=val('profile-department'); if(data.department.length<2) return fail('Enter your department.','profile-department'); }
  else{ data.program=val('profile-program'); data.year=val('profile-year'); if(data.program.length<2) return fail('Enter your program.','profile-program'); if(!data.year) return fail('Enter your year level.','profile-year'); }
  const oldName=user().name;
  if(t && oldName!==name){ state.courses.forEach(c=>{ if(c.instructor===oldName) c.instructor=name; }); state.classes.forEach(c=>{ if(c.host===oldName) c.host=name; }); state.tasks.forEach(x=>{ if(x.assignedBy===oldName) x.assignedBy=name; }); }
  state.profiles[currentUser.username]={...(state.profiles[currentUser.username]||{}),...data};
  saveState(); closeModal(); renderApp(); toast('Profile saved.');
}
function showNotificationSettings(){
  const s=settingsFor(currentUser.username);
  const rows=isTeacher()?[['assessments','Submission and assessment alerts'],['announcements','Class activity alerts'],['weekly','Weekly class summary']]:[['assessments','Assessment reminders'],['announcements','Course announcements'],['weekly','Weekly progress summary']];
  showModal('Notification settings',`<div class="setting-options">${rows.map(([k,l])=>`<label><input type="checkbox" data-change="setting" data-key="${k}" ${s[k]?'checked':''}> ${l}</label>`).join('')}</div><p class="field-hint">Changes save automatically.${isTeacher()?'':' Turned-off categories stop new notifications of that type.'}</p>`,'<button class="ghost-btn" data-action="reset-settings">Reset to defaults</button><button class="primary-btn" data-close>Done</button>',{focus:false});
}
function showPasswordForm(){
  showModal('Change password',`<div class="prototype-note">Demo only · Passwords are stored in plain text in this browser’s localStorage. This is not secure authentication.</div><label>Current password<input id="pw-current" type="password" autocomplete="current-password"></label><label>New password<input id="pw-new" type="password" autocomplete="new-password"></label><label>Confirm new password<input id="pw-confirm" type="password" autocomplete="new-password"></label>`,
  '<button class="ghost-btn" data-close>Cancel</button><button class="primary-btn" data-action="save-password">Update password</button>');
}
function savePassword(){
  const cur=$('#pw-current').value, nw=$('#pw-new').value, cf=$('#pw-confirm').value;
  if(cur!==passwordFor(currentUser.username)) return fail('Your current password is incorrect.','pw-current');
  if(nw.length<6) return fail('New password must be at least 6 characters.','pw-new');
  if(nw===cur) return fail('Choose a password different from your current one.','pw-new');
  if(nw!==cf) return fail('The new passwords do not match.','pw-confirm');
  state.credentials[currentUser.username]=nw; saveState(); closeModal(); toast('Password updated. Use it the next time you log in.');
}
function showPrivacy(){
  showModal('Privacy & demo data','<p>KnowNext is running as a local frontend prototype. Your session, courses, tasks, submissions, and settings are stored only in this browser using localStorage. Nothing is sent to a server.</p><p>Resetting restores the original demo content for both demo accounts — including passwords — and cannot be undone.</p>','<button class="ghost-btn danger-text" data-action="reset-demo">Reset demo data</button><button class="primary-btn" data-close>Got it</button>',{focus:false});
}

/* ---------- AI tools (simulated locally, clearly labelled) ---------- */
const FLASHCARD_BANK={
  genmath:[['What makes a relation a function?','Each input (x) is paired with exactly one output (y).'],['What does f(x) + k do to a graph?','It shifts the graph k units up (down if k is negative).'],['What is the domain of a function?','The set of all allowed input values.']],
  precalc:[['sin²θ + cos²θ = ?','1 — the Pythagorean identity.'],['Write tan θ using sin and cos.','tan θ = sin θ / cos θ.'],['1 + tan²θ = ?','sec²θ.']],
  earth:[['Name the four Earth subsystems.','Geosphere, hydrosphere, atmosphere, and biosphere.'],['Where is most fresh water stored?','In glaciers and ice caps.'],['What drives plate movement?','Heat from Earth’s interior (mantle convection).']],
  physical:[['What is wavelength?','The distance between two consecutive crests or troughs.'],['What is the wave speed formula?','v = f × λ (frequency × wavelength).'],['Which waves need no medium?','Electromagnetic waves, such as light.']],
  english:[['What is a thesis statement?','A specific, arguable claim that the paper supports.'],['What does paraphrasing require?','Restating the idea in your own words and citing the source.'],['Where does a topic sentence usually go?','At the start of a paragraph.']]
};
function matchTopic(text){ const t=text.toLowerCase(); return STUDENT_TOPICS.find(x=>t.includes(x.name.toLowerCase())||t.includes(x.course.toLowerCase())||x.name.toLowerCase().split(' ').some(w=>w.length>4&&t.includes(w))); }
function renderStudentAI(c){
  const weakest=sortedTopics()[0];
  c.innerHTML=pageTitle('AI STUDY TOOLS','Study with a little help.','These are simulated frontend responses for the prototype. No AI API is connected.')+`<div class="prototype-note">✦ DEMO MODE · Responses are generated locally to demonstrate the experience.</div><div class="ai-grid"><article class="ai-card"><span class="ai-number">01</span><h2>AI Explainer</h2><p>Ask for a simpler explanation when a topic is confusing.</p><textarea id="explain-input" placeholder="Explain a difficult concept in simple terms."></textarea><button class="primary-btn" data-action="ai-explain">Explain it →</button><div id="explain-output" aria-live="polite"></div></article><article class="ai-card yellow"><span class="ai-number">02</span><h2>Flashcard Generator</h2><p>Turn a topic into quick retrieval practice.</p><input id="flash-topic" placeholder="Trigonometric Identities"><button class="primary-btn" data-action="ai-flashcards">Generate Flashcards →</button><div id="flash-output" aria-live="polite"></div></article><article class="ai-card sky"><span class="ai-number">03</span><h2>Practice Questions</h2><p>Generate a few questions at the right difficulty.</p><input id="practice-topic" placeholder="Trigonometric Identities"><select id="practice-diff" aria-label="Difficulty"><option>Easy</option><option selected>Medium</option><option>Hard</option></select><button class="primary-btn" data-action="ai-practice">Generate Questions →</button><div id="practice-output" aria-live="polite"></div></article><article class="ai-card navy"><span class="ai-number">04</span><h2>Personalized Feedback</h2><p>See what your recent performance suggests.</p>${weakest?`<div class="feedback-big">${weakest.score}%<small>${esc(weakest.name.toUpperCase())}</small></div><div class="feedback-text">${weakest.score<70?`This is your lowest subject right now. A short daily review of ${esc(weakest.name.toLowerCase())} will help more than one long session.`:`Your results are developing well. Practice multi-step ${esc(weakest.name.toLowerCase())} problems to push past 85%.`}</div><button class="ghost-btn" data-action="ai-study-action" data-course="${weakest.id}">Build a study action →</button>`:'<div class="feedback-text">Feedback appears once you have course results.</div>'}</div></article></div>`;
}
function aiExplain(){
  const q=val('explain-input'), out=$('#explain-output');
  if(q.length<3){ out.innerHTML='<div class="result bad">Type the concept you want explained first.</div>'; $('#explain-input').focus(); return; }
  const topic=matchTopic(q), excerpt=q.length>80?q.slice(0,80)+'…':q;
  out.innerHTML=`<div class="ai-response"><b>Simple explanation</b><p>Let’s break down “${esc(excerpt)}” into three steps: (1) say what it is in one plain sentence, (2) connect it to an example you already know, and (3) explain why the example works.</p>${topic?`<p>Start here: ${esc(FLASHCARD_BANK[topic.id][0][0])} — ${esc(FLASHCARD_BANK[topic.id][0][1])}</p>`:''}<span>Try it: explain the idea in one sentence, then create your own example.${topic?` Your next lesson in ${esc(topic.course)} is “${esc(currentLesson(topic.id).title)}”.`:''}</span></div>`;
}
function aiFlashcards(){
  const input=$('#flash-topic'), topicText=val('flash-topic')||input.placeholder, topic=matchTopic(topicText);
  const cards=topic?FLASHCARD_BANK[topic.id]:[[`What is the main idea of ${topicText}?`,'Write a one-sentence definition in your own words, then check it against your notes.'],[`Which example best demonstrates ${topicText}?`,'Pick an example from class and explain why it fits.'],[`How could you apply ${topicText} in a real situation?`,'Describe one situation and the steps you would take.']];
  $('#flash-output').innerHTML=`<div class="flashcards">${cards.map(([q,a])=>`<button data-action="flip-card" aria-expanded="false"><b>${esc(q)}</b><span hidden>${esc(a)}</span><small class="flip-hint">Tap to reveal answer</small></button>`).join('')}</div>`;
}
function aiPractice(){
  const topicText=val('practice-topic')||$('#practice-topic').placeholder, diff=val('practice-diff'), topic=matchTopic(topicText);
  const count={Easy:2,Medium:3,Hard:5}[diff]||3;
  const bank=topic?state.assessments.filter(a=>a.courseId===topic.id).flatMap(a=>a.questions):[];
  const questions=bank.length?bank.slice(0,count):[`Define ${topicText} in your own words.`,`Give an example of ${topicText} and explain it.`,`What is a common mistake with ${topicText}?`,`Compare two ideas related to ${topicText}.`,`Solve a multi-step problem that uses ${topicText}.`].slice(0,count).map(q=>({q,options:[],answer:-1}));
  $('#practice-output').innerHTML=questions.map((q,i)=>`<div class="question"><b>${i+1}.</b> ${esc(q.q)}${q.options.length?`<div>${q.options.map((o,oi)=>`${'ABCD'[oi]}. ${esc(o)}`).join(' &nbsp; ')}</div><button class="text-btn" data-action="reveal-answer">Show answer</button><span class="answer-reveal" hidden>Answer: ${'ABCD'[q.answer]}. ${esc(q.options[q.answer])}</span>`:''}</div>`).join('')+`<p class="field-hint">${diff} · ${questions.length} question${questions.length===1?'':'s'}${topic?` from ${esc(topic.course)}`:''}</p>`;
}
function showStudyAction(courseId){
  const t=STUDENT_TOPICS.find(x=>x.id===courseId); if(!t) return;
  showModal('Suggested study action',`<p>Complete a 20-minute review of <strong>${esc(t.name)}</strong> today, then take a mastery check in Assessments.</p><div class="intervention"><b>What gets added</b><p>A high-priority task in your Study Plan for today at the next free hour, linked to ${esc(t.course)}.</p></div>`,
  `<button class="ghost-btn" data-close>Not now</button><button class="primary-btn" data-action="add-study-action" data-course="${courseId}">Add to study plan →</button>`,{focus:false});
}
function addStudyAction(courseId){
  const t=STUDENT_TOPICS.find(x=>x.id===courseId); if(!t) return;
  const h=Math.min(21,new Date().getHours()+1);
  state.tasks.push({id:uid('task'),studentId:DEMO_STUDENT_ID,title:`Review ${t.name}`,courseId,date:todayISO(),time:`${String(h).padStart(2,'0')}:00`,duration:20,priority:'High',target:'',done:false,assignedBy:''});
  saveState(); toast('Study action added to today’s plan.'); navigateTo('study-plan');
}

const AI_TOOLS=[['quiz','Generate quiz questions'],['outline','Generate lesson outline'],['analyze','Analyze assignment content'],['feedback','Suggest feedback'],['missed','Identify commonly missed concepts']];
function renderTeacherAI(c){
  c.innerHTML=pageTitle('AI TEACHING TOOLS','Build better support, faster.','Frontend-only simulated tools for demonstrating how AI could assist teaching workflows.')+`<div class="prototype-note">✦ DEMO MODE · No AI API is connected. Responses are simulated locally.</div><section class="teacher-ai-hero"><div><span class="eyebrow">AI ASSESSMENT ASSISTANT</span><h2>Create a quick question set from a teaching goal.</h2><p>Example: “Create 5 questions about functions and graphs.”</p><div class="ai-input-row"><input id="teacher-ai-input" aria-label="Teaching goal" value="Create 5 questions about functions and graphs."><button class="primary-btn" data-action="ai-generate">Generate →</button></div></div><div class="teacher-ai-symbol">✦</div></section><div id="teacher-ai-output" aria-live="polite"></div><div class="tool-chip-grid">${AI_TOOLS.map(([k,l])=>`<button class="tool-chip" data-action="ai-tool" data-tool="${k}"><span>✦</span>${l}<b>→</b></button>`).join('')}</div>`;
}
function parseAIRequest(text){
  const n=Math.min(10,Math.max(1,parseInt((text.match(/\d+/)||['5'])[0],10)));
  const m=text.match(/about\s+(.+?)[.?!]*$/i);
  return {n,topic:(m?m[1]:'functions and graphs').trim()};
}
function detectTool(text){ return /outline/i.test(text)?'outline':/analy/i.test(text)?'analyze':/feedback/i.test(text)?'feedback':/miss/i.test(text)?'missed':'quiz'; }
const QUIZ_TEMPLATES=['What is the main idea behind {t}?','Give a real-life example of {t}.','What is a common mistake students make with {t}?','How would you explain {t} to a classmate in two sentences?','Which key term is most important when studying {t}, and why?','Compare two related ideas within {t}.','Solve or analyze a short problem involving {t}. Show your steps.','What question would you ask to check someone’s understanding of {t}?','How does {t} connect to the previous lesson?','Summarize {t} in one sentence.'];
let lastAIQuestions=[];
function generateTeacherAI(tool){
  const input=val('teacher-ai-input');
  if(input.length<5){ $('#teacher-ai-output').innerHTML='<div class="result bad">Describe what you want to generate first.</div>'; return; }
  ui.aiTool=tool||detectTool(input);
  const {n,topic}=parseAIRequest(input), v=ui.aiVariant, title=topic.charAt(0).toUpperCase()+topic.slice(1);
  let h='', body='', footer='';
  if(ui.aiTool==='quiz'){
    lastAIQuestions=Array.from({length:n},(_,i)=>QUIZ_TEMPLATES[(i+v)%QUIZ_TEMPLATES.length].replaceAll('{t}',topic));
    h=`${esc(title)} · ${n} Question${n===1?'':'s'}`;
    body=lastAIQuestions.map((q,i)=>`<div class="generated-question"><b>${i+1}</b><p>${esc(q)}</p><span>${['1 pt · Easy','2 pts · Medium','3 pts · Hard'][(i+v)%3]}</span></div>`).join('');
    footer='<button class="primary-btn" data-action="ai-to-assessment">Add to assessment →</button>';
  }else if(ui.aiTool==='outline'){
    const parts=[['Learning objectives',`Students can define and apply ${topic}.`],['Warm-up · 5 min',`Quick recall question on ${topic}.`],['Direct instruction · 15 min','Key terms, one worked example, common mistakes.'],['Guided practice · 10 min','Solve two examples together; students explain each step.'],['Independent practice · 15 min','Short practice set with self-check.'],['Exit ticket · 5 min',`One question that checks understanding of ${topic}.`]];
    h=`Lesson outline · ${esc(title)}`;
    body=parts.map((p,i)=>`<div class="generated-question"><b>${i+1}</b><p><strong>${p[0]}</strong><br>${esc(p[1])}</p><span>Outline</span></div>`).join('');
    footer='<button class="primary-btn" data-action="ai-copy">Copy outline</button>';
  }else if(ui.aiTool==='analyze'){
    h='Assignment analysis · from your current data';
    body=state.assignments.map((a,i)=>{const subs=state.submissions.filter(s=>s.assignmentId===a.id), av=assignmentAverage(a), pending=subs.filter(s=>s.status==='Submitted').length;return `<div class="generated-question"><b>${i+1}</b><p><strong>${esc(a.title)}</strong><br>${subs.length}/${STUDENTS.length} submitted · ${av!=null?`average ${av}%`:'no grades yet'} · ${pending} waiting for grades. ${av!=null&&av<75?'Consider re-teaching the core concept before the next task.':subs.length<STUDENTS.length/2?'Remind students about the due date.':'On track.'}</p><span>${esc(courseName(a.courseId))}</span></div>`;}).join('')||'<p>No assignments yet.</p>';
    footer='<button class="primary-btn" data-go="assignments">Open assignments →</button>';
  }else if(ui.aiTool==='feedback'){
    const pending=state.submissions.filter(s=>s.status==='Submitted').slice(0,4);
    h='Suggested feedback · pending submissions';
    body=pending.map((s,i)=>{const st=studentById(s.studentId), a=assignmentById(s.assignmentId);return `<div class="generated-question"><b>${i+1}</b><p><strong>${esc(st?.name)} · ${esc(a?.title)}</strong><br>“Thanks for submitting on time. Your work shows effort${st?.strong[0]?`, especially in ${esc(st.strong[0].toLowerCase())}`:''}. Next, focus on ${esc((st?.weak[0]||'checking each step').toLowerCase())} — try two more practice items before the next check-in.”</p><button class="small-btn" data-action="grade-submission" data-id="${s.id}">Grade →</button></div>`;}).join('')||'<p>No submissions are waiting for feedback.</p>';
  }else{
    const stats=[];
    state.assessments.forEach(a=>{const all=attemptsFor(a.id); if(!all.length) return; a.questions.forEach((q,i)=>stats.push({a,q,miss:Math.round(all.filter(x=>x.answers[i]!==q.answer).length/all.length*100)}));});
    stats.sort((x,y)=>y.miss-x.miss);
    h='Most-missed questions · from student attempts';
    body=stats.slice(0,5).map((s,i)=>`<div class="generated-question"><b>${i+1}</b><p>${esc(s.q.q)}<br><small>${esc(s.a.title)} · correct answer: ${esc(s.q.options[s.q.answer])}</small></p><span>${s.miss}% missed</span></div>`).join('')||'<p>No attempts yet.</p>';
    footer='<button class="primary-btn" data-go="analytics">Open analytics →</button>';
  }
  $('#teacher-ai-output').innerHTML=`<section class="generated-panel"><div class="generated-head"><span class="eyebrow">SIMULATED RESULT</span><button class="text-btn" data-action="ai-regenerate">Regenerate ↻</button></div><h3>${h}</h3>${body}${footer}</section>`;
}
function aiToAssessment(){
  const {topic}=parseAIRequest(val('teacher-ai-input')), match=matchTopic(topic);
  showAssessmentBuilder(null,{title:`${topic.charAt(0).toUpperCase()+topic.slice(1)} Check`,courseId:match?.id||state.courses[0]?.id,questions:lastAIQuestions.map(q=>({q,options:['','','',''],answer:0,points:1}))});
  fail('Questions added from the AI tool. Add answer options, then save as a draft or publish.');
}

/* ---------- Notifications ---------- */
function showNotifications(){
  const list=myNotifications(), unread=list.filter(n=>!n.read).length;
  showModal('Notifications',`<div class="notification-list">${list.map(n=>`<button class="notif-item ${n.read?'':'unread'}" data-action="open-notification" data-id="${n.id}"><b>${esc(n.title)}</b><span>${esc(n.meta)} · ${dayLabel(n.date)}${n.read?'':' · New'}</span></button>`).join('')||'<p>No notifications yet.</p>'}</div>`,
  `<button class="ghost-btn" data-action="mark-all-notifications" ${unread?'':'disabled'}>Mark all as read</button><button class="primary-btn" data-close>Close</button>`,{focus:false});
}

/* ---------- Action registry ---------- */
const ACTIONS={
  'toggle-pass':()=>{ const i=$('#login-pass'); i.type=i.type==='password'?'text':'password'; $('#toggle-pass').textContent=i.type==='password'?'Show':'Hide'; },
  nav:el=>navigateTo(el.dataset.view),
  logout:()=>logout(),
  'menu-toggle':()=>$('#app').classList.toggle('menu-open'),
  'menu-close':()=>$('#app').classList.remove('menu-open'),
  notifications:()=>showNotifications(),
  'open-notification':el=>{ const n=state.notifications.find(x=>x.id===el.dataset.id); if(!n) return; n.read=true; saveState(); navigateTo(n.view); },
  'mark-all-notifications':()=>{ myNotifications().forEach(n=>n.read=true); saveState(); updateChrome(); showNotifications(); toast('All notifications marked as read.'); },
  'confirm-yes':()=>{ const fn=pendingConfirm; pendingConfirm=null; fn?.(); },
  'set-filter':el=>{
    const g=el.dataset.group, v=el.dataset.value;
    const key={course:'courseFilter',assess:'assessFilter',assign:'assignFilter',class:'classFilter',task:'taskStatus',analytics:'analyticsTab',ann:'annFilter'}[g];
    ui[key]=v; if(g==='course') return renderCourses($('#content')); refresh();
  },
  why:()=>showWhy(),
  'continue-course':el=>continueCourse(el.dataset.course),
  'open-course':el=>openCourse(el.dataset.course),
  'toggle-module':el=>{ const box=$('#lessons-'+el.dataset.module); const open=box.classList.toggle('open'); el.textContent=open?'−':'+'; el.setAttribute('aria-expanded',open); },
  'open-lesson':el=>{ if(!el.dataset.lesson) return; navigateTo('lesson',{courseId:el.dataset.course,lessonId:el.dataset.lesson}); },
  'toggle-lesson':el=>toggleLesson(el.dataset.course,el.dataset.lesson),
  'toggle-bookmark':el=>toggleBookmark(el.dataset.course),
  'back-to-courses':()=>navigateTo('courses'),
  'clear-course-search':()=>{ ui.courseQuery=''; $('#course-search').value=''; renderCourseGrid(); $('#course-search').focus(); },
  'reset-course-filters':()=>{ ui.courseQuery=''; ui.courseFilter='all'; renderCourses($('#content')); },
  'create-course':()=>showCourseForm(),
  'edit-course':el=>showCourseForm(el.dataset.course),
  'save-course':el=>saveCourse(el.dataset.course||null),
  'delete-course':el=>deleteCourse(el.dataset.course),
  'randomize-progress':()=>{ randomizeDemo(); refresh(); toast('Demo mastery and course progress randomized.'); },
  'add-task':el=>showTaskForm(null,el.dataset.date),
  'edit-task':el=>showTaskForm(el.dataset.id),
  'save-task':el=>saveTask(el.dataset.id||null),
  'task-menu':el=>showTaskMenu(el.dataset.id),
  'reschedule-task':el=>showReschedule(el.dataset.id),
  'save-reschedule':el=>{ const t=taskById(el.dataset.id), d=val('resched-date'), tm=val('resched-time'); if(!d) return fail('Choose a date.','resched-date'); if(!tm) return fail('Choose a time.','resched-time'); t.date=d; t.time=tm; saveState(); closeModal(); refresh(); toast(`Rescheduled to ${dayLabel(d)} at ${fmtTime(tm)}.`); },
  'toggle-task':el=>{ const t=taskById(el.dataset.id); if(!t) return; t.done=!t.done; if(t.done) logActivity(`Completed study task: ${t.title}`,'✓'); if(t.done&&t.assignedBy) notify('teacher',`${studentById(t.studentId)?.name} completed ${t.title}`,'students','Practice'); saveState(); closeModal(); refresh(); toast(t.done?'Task completed.':'Task marked as not done.'); },
  'delete-task':el=>{ const t=taskById(el.dataset.id); if(!t) return; confirmDialog('Delete task?',`<strong>${esc(t.title)}</strong> will be removed from your study plan.`,'Delete task',()=>{ state.tasks=state.tasks.filter(x=>x.id!==t.id); saveState(); closeModal(); refresh(); toast('Task deleted.'); }); },
  'start-task':el=>startTask(el.dataset.id),
  'clear-completed':()=>{ const n=myTasks().filter(t=>t.done).length; if(!n) return; confirmDialog('Clear completed tasks?',`${n} completed task${n===1?'':'s'} will be removed from your study plan.`,'Clear completed',()=>{ state.tasks=state.tasks.filter(t=>!(t.studentId===DEMO_STUDENT_ID&&t.done)); saveState(); closeModal(); refresh(); toast('Completed tasks cleared.'); }); },
  'reset-task-filters':()=>{ ui.taskSubject='all'; ui.taskStatus='all'; refresh(); },
  'join-class':el=>joinClass(el.dataset.id),
  'join-next':()=>{ const n=upcomingClasses()[0]; if(!n) return toast('There are no upcoming classes right now.'); joinClass(n.id); },
  'class-details':el=>showClassDetails(el.dataset.id),
  'class-guide':()=>showModal('How Virtual Class works','<div class="explain-list"><p><b>01</b> KnowNext shows the class, time, teacher, and platform.</p><p><b>02</b> The Join button opens the meeting link saved for that class. If no link has been added yet, you will see a message instead.</p><p><b>03</b> Your adaptive path remains the place to decide what to study next.</p></div>','<button class="primary-btn" data-close>Got it</button>',{focus:false}),
  'schedule-class':el=>showClassForm(null,el.dataset.date),
  'edit-class':el=>showClassForm(el.dataset.id),
  'save-class':el=>saveClass(el.dataset.id||null),
  'delete-class':el=>{ const c=classById(el.dataset.id); if(!c) return; confirmDialog('Delete class?',`<strong>${esc(c.title)}</strong> on ${fmtShort(c.date)} will be removed for everyone.`,'Delete class',()=>{ state.classes=state.classes.filter(x=>x.id!==c.id); saveState(); closeModal(); refresh(); toast('Class deleted.'); }); },
  'cal-prev':()=>shiftMonth(-1),
  'cal-next':()=>shiftMonth(1),
  'cal-today':()=>{ ui.calMonth=todayISO().slice(0,7); ui.calSelected=todayISO(); refresh(); },
  'cal-select':el=>{ ui.calSelected=el.dataset.date; refresh(); $('.day-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'}); },
  'open-event':el=>openEvent(el.dataset.kind,el.dataset.id),
  'start-assessment':el=>startAssessment(el.dataset.id),
  answer:el=>answerQuestion(el),
  'submit-assessment':el=>submitAssessment(el.dataset.id),
  'assessment-results':el=>showAssessmentResults(el.dataset.id),
  'retake-assessment':el=>retakeAssessment(el.dataset.id),
  'create-assessment':()=>showAssessmentBuilder(),
  'edit-assessment':el=>showAssessmentBuilder(el.dataset.id),
  'teacher-results':el=>showTeacherResults(el.dataset.id),
  'assessment-menu':el=>showAssessmentMenu(el.dataset.id),
  'builder-add':()=>{ const qs=collectBuilderQuestions(); if(qs.length>=20) return fail('An assessment can have up to 20 questions.'); qs.push({q:'',options:['','','',''],answer:0,points:1}); renderBuilderQuestions(qs); $$('#builder-questions .bq-text').pop().focus(); },
  'builder-remove':el=>{ const qs=collectBuilderQuestions(); if(qs.length<=1) return fail('An assessment needs at least one question.'); qs.splice(Number(el.dataset.index),1); renderBuilderQuestions(qs); },
  'save-assessment':el=>saveAssessment(el.dataset.id||null,el.dataset.status),
  'toggle-publish':el=>{ const a=assessmentById(el.dataset.id); if(!a) return; if(a.status==='Draft'){ closeModal(); showAssessmentBuilder(a.id); return fail('Review the assessment, then choose Publish.'); } a.status='Draft'; saveState(); closeModal(); refresh(); toast('Assessment moved back to drafts. Students can no longer see it.'); },
  'delete-assessment':el=>{ const a=assessmentById(el.dataset.id); if(!a) return; const n=attemptsFor(a.id).length; confirmDialog('Delete assessment?',`<strong>${esc(a.title)}</strong>${n?` and ${n} student attempt${n===1?'':'s'}`:''} will be permanently removed.`,'Delete assessment',()=>{ state.assessments=state.assessments.filter(x=>x.id!==a.id); state.attempts=state.attempts.filter(x=>x.assessmentId!==a.id); delete state.assessmentDrafts[a.id]; saveState(); closeModal(); refresh(); toast('Assessment deleted.'); }); },
  'view-assignment':el=>showStudentAssignment(el.dataset.id),
  'submit-assignment':el=>submitAssignment(el.dataset.id),
  'create-assignment':()=>showAssignmentForm(),
  'edit-assignment':el=>showAssignmentForm(el.dataset.id),
  'save-assignment':el=>saveAssignment(el.dataset.id||null),
  'delete-assignment':el=>{ const a=assignmentById(el.dataset.id); if(!a) return; const n=state.submissions.filter(s=>s.assignmentId===a.id).length; confirmDialog('Delete assignment?',`<strong>${esc(a.title)}</strong>${n?` and ${n} submission${n===1?'':'s'}`:''} will be permanently removed.`,'Delete assignment',()=>{ state.assignments=state.assignments.filter(x=>x.id!==a.id); state.submissions=state.submissions.filter(s=>s.assignmentId!==a.id); saveState(); closeModal(); refresh(); toast('Assignment deleted.'); }); },
  'view-submissions':el=>showSubmissions(el.dataset.id),
  'grade-submission':el=>showGradeForm(el.dataset.id),
  'save-grade':el=>saveGrade(el.dataset.id),
  'student-detail':el=>showStudentDetail(Number(el.dataset.id)),
  'assign-practice':el=>showPracticeForm(Number(el.dataset.id),el.dataset.course),
  'save-practice':()=>savePractice(),
  'clear-student-search':()=>{ ui.studentQuery=''; $('#student-search').value=''; renderStudentRows(); $('#student-search').focus(); },
  'reset-student-filters':()=>{ ui.studentQuery=''; ui.studentFilter='all'; renderStudents($('#content')); },
  'analytics-row':el=>el.dataset.kind==='course'?showCourseInsight(el.dataset.id):el.dataset.kind==='assessment'?showTeacherResults(el.dataset.id):showSubmissions(el.dataset.id),
  'add-ann':()=>showAnnouncementModal(),
  'edit-ann':el=>showAnnouncementModal(el.dataset.id),
  'publish-ann':el=>publishAnnouncement(el.dataset.id||null),
  'delete-ann':el=>{ const a=state.announcements.find(x=>x.id===el.dataset.id); if(!a) return; confirmDialog('Delete announcement?',`<strong>${esc(a.title)}</strong> will be removed for all students.`,'Delete',()=>{ state.announcements=state.announcements.filter(x=>x.id!==a.id); state.annRead=state.annRead.filter(x=>x!==a.id); saveState(); closeModal(); refresh(); toast('Announcement deleted.'); }); },
  'toggle-ann-read':el=>{ const id=el.dataset.id; state.annRead=state.annRead.includes(id)?state.annRead.filter(x=>x!==id):[...state.annRead,id]; saveState(); refresh(); },
  'mark-all-ann':()=>{ state.annRead=[...new Set([...state.annRead,...state.announcements.map(a=>a.id)])]; saveState(); refresh(); toast('All announcements marked as read.'); },
  'edit-profile':()=>showProfileForm(),
  'save-profile':()=>saveProfile(),
  'notification-settings':()=>showNotificationSettings(),
  'reset-settings':()=>confirmDialog('Reset notification settings?','Your notification preferences will return to the defaults.','Reset settings',()=>{ delete state.settings[currentUser.username]; saveState(); toast('Notification settings reset.'); showNotificationSettings(); }),
  'change-password':()=>showPasswordForm(),
  'save-password':()=>savePassword(),
  privacy:()=>showPrivacy(),
  'reset-demo':()=>confirmDialog('Reset all demo data?','Every change made with both demo accounts — courses, tasks, submissions, grades, classes, settings, and passwords — will be replaced with the original demo content.','Reset demo data',()=>{ resetDemoData(); applyDemoMastery(); navigateTo('dashboard'); toast('Demo data reset.'); }),
  'ai-explain':()=>aiExplain(),
  'ai-flashcards':()=>aiFlashcards(),
  'ai-practice':()=>aiPractice(),
  'flip-card':el=>{ const span=$('span',el), hint=$('.flip-hint',el); span.hidden=!span.hidden; if(hint) hint.hidden=!span.hidden; el.setAttribute('aria-expanded',!span.hidden); },
  'reveal-answer':el=>{ const span=el.nextElementSibling; span.hidden=!span.hidden; el.textContent=span.hidden?'Show answer':'Hide answer'; },
  'ai-study-action':el=>showStudyAction(el.dataset.course),
  'add-study-action':el=>addStudyAction(el.dataset.course),
  'ai-generate':()=>{ ui.aiVariant=0; generateTeacherAI(); },
  'ai-tool':el=>{ const {topic}=parseAIRequest(val('teacher-ai-input')); const label=AI_TOOLS.find(t=>t[0]===el.dataset.tool)[1]; $('#teacher-ai-input').value=`${label} about ${topic}.`; ui.aiVariant=0; generateTeacherAI(el.dataset.tool); $('#teacher-ai-output').scrollIntoView({behavior:'smooth',block:'nearest'}); },
  'ai-regenerate':()=>{ ui.aiVariant++; generateTeacherAI(ui.aiTool); toast('Generated a new variation.'); },
  'ai-to-assessment':()=>aiToAssessment(),
  'ai-copy':()=>{ const text=$$('#teacher-ai-output .generated-question p').map((p,i)=>`${i+1}. ${p.innerText.replace(/\n/g,' — ')}`).join('\n'); navigator.clipboard?.writeText(text).then(()=>toast('Outline copied to clipboard.'),()=>toast('Copy failed — select the text and copy it manually.')) ?? toast('Clipboard is not available in this browser.'); }
};

/* ---------- Delegated listeners (registered once) ---------- */
document.addEventListener('click',e=>{
  const closer=e.target.closest('[data-close]');
  if(closer && (closer===e.target || !closer.classList.contains('modal-backdrop'))){ closeModal(); return; }
  const el=e.target.closest('[data-action],[data-go]');
  if(!el || el.disabled) return;
  if(el.dataset.action){ const fn=ACTIONS[el.dataset.action]; if(fn){ e.preventDefault(); fn(el,e); } }
  else navigateTo(el.dataset.go);
});
document.addEventListener('submit',e=>{ if(e.target.dataset.form==='login'){ e.preventDefault(); handleLogin(); } });
document.addEventListener('input',e=>{
  const k=e.target.dataset.input;
  if(k==='course-search'){ ui.courseQuery=e.target.value; renderCourseGrid(); }
  if(k==='student-search'){ ui.studentQuery=e.target.value; renderStudentRows(); }
  if(e.target.classList.contains('invalid')) e.target.classList.remove('invalid');
});
document.addEventListener('change',e=>{
  const k=e.target.dataset.change;
  if(k==='student-filter'){ ui.studentFilter=e.target.value; renderStudentRows(); }
  if(k==='task-subject'){ ui.taskSubject=e.target.value; refresh(); }
  if(k==='task-sort'){ ui.taskSort=e.target.value; refresh(); }
  if(k==='setting'){ const u=currentUser.username; state.settings[u]={...settingsFor(u),[e.target.dataset.key]:e.target.checked}; saveState(); toast('Notification setting saved.'); }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && $('#modal-root').innerHTML){ closeModal(); return; }
  const el=e.target;
  if((e.key==='Enter'||e.key===' ') && el.getAttribute?.('role')==='button' && el.tagName!=='BUTTON'){ e.preventDefault(); el.click(); }
});
window.addEventListener('storage',e=>{ if(e.key===STORE_KEY && currentUser){ state=loadState(); refresh(); } if(e.key===SESSION_KEY){ currentUser=getSession(); currentUser?renderApp():renderLogin(); } });

/* ---------- Boot ---------- */
if(currentUser){
  try{ const saved=JSON.parse(sessionStorage.getItem(VIEW_KEY)); if(saved?.view){ currentView=saved.view; viewParams=saved.params||{}; } }catch(e){}
  renderApp();
} else renderLogin();
