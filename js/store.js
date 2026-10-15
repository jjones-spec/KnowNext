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
    annRead: [],
    notifications: SEED_NOTIFICATIONS.map((n,i)=>({id:`ntf-seed-${i}`,role:n.role,title:n.title,meta:n.meta,view:n.view,date:offsetISO(n.dateOffset),read:false})),
    activity: SEED_ACTIVITY.map(a=>({text:a.text,icon:a.icon,date:offsetISO(a.dateOffset)})),
    profiles: {},
    credentials: {},
    settings: {},
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
