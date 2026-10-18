/* KnowNext persistence layer — every piece of demo data lives in localStorage.
   knownext_state          : all shared records (courses, tasks, classes, assignments, ...)
   knownext_session        : the logged-in demo account
   knownext_demo_progress  : randomized mastery scores per topic */
const STORE_KEY = 'knownext_state';
const SESSION_KEY = 'knownext_session';
const PROGRESS_KEY = 'knownext_demo_progress';
const VIEW_KEY = 'knownext_view';
const STORE_VERSION = 2;
const DEMO_STUDENT_ID = 1;
const DEFAULT_PLATFORM_SETTINGS = {
  platformName:'KnowNext',
  platformTagline:'Study Smarter. Know What’s Next.',
  defaultPreferences:{ language:'English', timezone:'UTC+8', academicYear:'2025-2026' },
  notificationSettings:{ email:true, inApp:true, announcements:true },
  availableFeatures:{ institutionManagement:true, adminManagement:true, analytics:true, globalAnnouncements:true },
  defaultPermissions:{ student:true, teacher:true, admin:{ createStudents:true, manageCourses:true, syncSections:true }, superadmin:{ manageInstitutions:true, manageAdmins:true, manageSettings:true } }
};
const DEFAULT_INSTITUTIONS = [
  {id:'inst-northfield', name:'Northfield Academy', code:'NFA', type:'Private School', address:'128 Park Avenue, Cebu City', email:'admin@northfield.edu', contact:'(032) 555-0101', assignedAdmin:'admin123', status:'active', createdAt:offsetISO(-180)},
  {id:'inst-southview', name:'Southview Learning Center', code:'SVL', type:'STEM School', address:'22 Eastwood Road, Davao City', email:'info@southview.edu', contact:'(082) 555-0122', assignedAdmin:'', status:'active', createdAt:offsetISO(-100)},
  {id:'inst-lakeside', name:'Lakeside International School', code:'LIS', type:'International School', address:'9 Lakeview Drive, Manila', email:'hello@lakeside.edu', contact:'(02) 555-0144', assignedAdmin:'', status:'inactive', createdAt:offsetISO(-60)}
];
const DEFAULT_ADMIN_ACCOUNTS = [
  {id:'admin-001', username:'admin123', name:'Elena Ramos', email:'elena.ramos@knownext.demo', institutionId:'inst-northfield', status:'active', role:'admin', createdAt:offsetISO(-150)}
];
const DEFAULT_AUDIT_LOGS = [
  {id:'audit-001', date:offsetISO(-1), actor:'superadmin123', action:'Institution Created', record:'Northfield Academy', description:'Initial institution record created for the default admin account.'},
  {id:'audit-002', date:offsetISO(-2), actor:'admin123', action:'Course Updated', record:'General Mathematics', description:'Course details and materials refreshed for the academic term.'}
];
const DEFAULT_PLATFORM_ANNOUNCEMENTS = [
  {id:'plat-ann-1', title:'Platform maintenance window', body:'Scheduled maintenance will occur on Saturday from 2:00 AM to 4:00 AM.', target:'all', institutionId:'', createdAt:offsetISO(-3), published:true, status:'Published'},
  {id:'plat-ann-2', title:'Academic year kickoff', body:'A new academic year has started across all institutions. Please review the institutional updates.', target:'all', institutionId:'', createdAt:offsetISO(-8), published:true, status:'Published'}
];

/* ---------- Dates & ids ---------- */
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayISO(){ return isoDate(new Date()); }
function offsetISO(days){ const d=new Date(); d.setDate(d.getDate()+days); return isoDate(d); }
function parseISO(iso){ return new Date(iso+'T00:00:00'); }
function uid(prefix){ return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`; }
function clone(v){ return JSON.parse(JSON.stringify(v)); }

/* ---------- Lessons (same module template for every course) ---------- */
function courseLessons(){ return MODULES.flatMap(m=>m.lessons.map((title,i)=>({id:`${m.id}-${i}`, moduleId:m.id, title}))); }

/* ---------- Assessments ---------- */
function answersFor(assessment, correctCount){ return assessment.questions.map((q,i)=>i<correctCount?q.answer:(q.answer+1)%q.options.length); }
function gradeAttempt(assessment, answers){
  let earned=0,total=0,correct=0;
  assessment.questions.forEach((q,i)=>{ const pts=Number(q.points)||1; total+=pts; if(answers[i]===q.answer){ earned+=pts; correct++; } });
  return { score: total?Math.round(earned/total*100):0, correct, total:assessment.questions.length };
}

/* ---------- Demo mastery (randomized once, reshuffled on request) ---------- */
function loadDemoProgress(force=false){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(PROGRESS_KEY)); }catch(e){}
  if(!saved || typeof saved!=='object' || !saved.topics || force){
    const random=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;
    saved={topics:{},courses:{}};
    STUDENT_TOPICS.forEach(t=>saved.topics[t.id]=random(54,96));
    COURSES.forEach(c=>saved.courses[c.id]=random(42,96));
    localStorage.setItem(PROGRESS_KEY,JSON.stringify(saved));
  }
  return saved;
}
function saveDemoProgress(p){ localStorage.setItem(PROGRESS_KEY,JSON.stringify(p)); }

/* Builds lesson completion matching a percentage, completing lessons in order. */
function lessonProgressFor(percent){
  const lessons=courseLessons(), count=Math.round(lessons.length*percent/100);
  const completed=lessons.slice(0,count).map(l=>l.id);
  return { completed, last: (lessons[count]||lessons[lessons.length-1]).id };
}

/* ---------- Seed ---------- */
function seedState(){
  const demo=loadDemoProgress();
  const lessonProgress={};
  COURSES.forEach(c=>lessonProgress[c.id]=lessonProgressFor(demo.courses?.[c.id] ?? c.progress));

  const assessments=SEED_ASSESSMENTS.map(a=>({id:a.id,title:a.title,courseId:a.courseId,type:a.type,description:a.description,dueDate:offsetISO(a.dueOffset),status:'Published',questions:clone(a.questions),createdAt:offsetISO(a.dueOffset-7)}));
  const attempts=SEED_ATTEMPTS.map(([assessmentId,studentId,correct,daysAgo],i)=>{
    const a=assessments.find(x=>x.id===assessmentId), answers=answersFor(a,correct);
    return {id:`att-seed-${i}`,assessmentId,studentId,answers,...gradeAttempt(a,answers),date:offsetISO(-daysAgo)};
  });

  return {
    version: STORE_VERSION,
    courses: COURSES.map(c=>({id:c.id,name:c.name,instructor:c.instructor,accent:c.accent,desc:c.desc})),
    lessonProgress,
    bookmarks: [],
    tasks: SEED_TASKS.map((t,i)=>({id:`task-seed-${i}`,studentId:DEMO_STUDENT_ID,title:t.title,courseId:t.courseId,date:offsetISO(t.dateOffset),time:t.time,duration:t.duration,priority:t.priority,target:t.target||'',done:false,assignedBy:''})),
    classes: SEED_CLASSES.map(c=>({id:c.id,title:c.title,courseId:c.courseId,date:offsetISO(c.dateOffset),time:c.time,duration:c.duration,host:c.host,platform:c.platform,link:c.link,owner:'teacher123'})),
    assignments: SEED_ASSIGNMENTS.map(a=>({id:a.id,title:a.title,courseId:a.courseId,due:offsetISO(a.dueOffset),points:a.points,instructions:a.instructions})),
    submissions: SEED_SUBMISSIONS.map(([assignmentId,studentId,daysAgo,score,feedback],i)=>({id:`sub-seed-${i}`,assignmentId,studentId,content:SEED_SUBMISSION_TEXT,submittedAt:offsetISO(-daysAgo),status:score==null?'Submitted':'Graded',score,feedback,late:false})),
    assessments,
    attempts,
    assessmentDrafts: {},
    announcements: ANNOUNCEMENTS.map(a=>({id:a.id,title:a.title,body:a.body,courseId:a.courseId,date:offsetISO(a.dateOffset)})),
    platformAnnouncements: DEFAULT_PLATFORM_ANNOUNCEMENTS.map(a=>({...a, createdAt:a.createdAt||todayISO()})),
    institutions: DEFAULT_INSTITUTIONS.map(i=>({...i, status:i.status||'active'})),
    adminAccounts: DEFAULT_ADMIN_ACCOUNTS.map(a=>({...a, status:a.status||'active'})),
    auditLogs: DEFAULT_AUDIT_LOGS,
    platformSettings: DEFAULT_PLATFORM_SETTINGS,
    institutionSettings: {},
    annRead: [],
    notifications: SEED_NOTIFICATIONS.map((n,i)=>({id:`ntf-seed-${i}`,role:n.role,title:n.title,meta:n.meta,view:n.view,date:offsetISO(n.dateOffset),read:false})),
    activity: SEED_ACTIVITY.map(a=>({text:a.text,icon:a.icon,date:offsetISO(a.dateOffset)})),
    profiles: {},
    credentials: {},
    settings: {},
    communityResources: [],
    communityBookmarks: [],
    streak: 6
  };
}

/* Loads saved data, falling back to seeds for anything missing or malformed without discarding valid user changes. */
function loadState(){
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem(STORE_KEY)); }catch(e){ saved=null; }
  const seed=seedState();
  if(!saved || typeof saved!=='object' || saved.version!==STORE_VERSION){
    // Carry over what the previous prototype version stored (read announcements, teacher announcements).
    if(saved && typeof saved==='object'){
      if(Array.isArray(saved.student?.annRead)) seed.annRead=saved.student.annRead.map(id=>typeof id==='number'?`ann-${id}`:id);
    }
    localStorage.setItem(STORE_KEY,JSON.stringify(seed));
    return seed;
  }
  Object.keys(seed).forEach(key=>{
    const expectArray=Array.isArray(seed[key]);
    if(saved[key]===undefined || saved[key]===null || Array.isArray(saved[key])!==expectArray || typeof saved[key]!==typeof seed[key]) saved[key]=seed[key];
  });
  return saved;
}
function saveState(){
  try{ localStorage.setItem(STORE_KEY,JSON.stringify(state)); }
  catch(e){ toast('Could not save — browser storage is full or disabled.'); }
}
function resetDemoData(){
  localStorage.removeItem(STORE_KEY);
  loadDemoProgress(true);
  state=loadState();
}

/* ---------- Session ---------- */
function getSession(){
  try{ const s=JSON.parse(localStorage.getItem(SESSION_KEY)); return s && DEMO_USERS[s.username] ? s : null; }
  catch(e){ return null; }
}
function setSession(u){ const s={username:u.username,role:u.role}; localStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s; }
function clearSession(){ localStorage.removeItem(SESSION_KEY); try{ sessionStorage.removeItem(VIEW_KEY); }catch(e){} }
