/* KnowNext demo data. Frontend-only prototype; progress is randomized once and can be reshuffled. */
const DEMO_USERS = {
  student123: { username:'student123', password:'student123', role:'student', name:'Alex Cruz', email:'alex.cruz@knownext.demo', program:'Senior High School', year:'Grade 12' },
  teacher123: { username:'teacher123', password:'teacher123', role:'teacher', name:'Prof. Maria Santos', email:'maria.santos@knownext.demo', department:'Senior High School' }
};

const STUDENT_TOPICS = [
  {id:'genmath', name:'Functions and Graphs', score:76, last:'Today', course:'General Mathematics', recommendation:'Practice function transformations'},
  {id:'precalc', name:'Trigonometric Identities', score:64, last:'2 days ago', course:'Pre-Calculus', recommendation:'Review trigonometric identities'},
  {id:'earth', name:'Earth Systems', score:88, last:'Yesterday', course:'Earth and Life Science', recommendation:'Move to the next lesson'},
  {id:'physical', name:'Waves and Energy', score:59, last:'3 days ago', course:'Physical Science', recommendation:'Review waves and energy concepts'},
  {id:'english', name:'Academic Writing', score:92, last:'Today', course:'English for Academic and Professional Purposes', recommendation:'Move to the next lesson'}
];

const COURSES = [
  {id:'genmath', name:'General Mathematics', instructor:'Prof. Maria Santos', progress:72, modules:7, next:'Functions and Graphs', accent:'blue', desc:'Build confidence with functions, rational expressions, logic, and practical mathematical reasoning.'},
  {id:'precalc', name:'Pre-Calculus', instructor:'Prof. Daniel Reyes', progress:58, modules:8, next:'Trigonometric Identities', accent:'yellow', desc:'Explore polynomial and trigonometric functions, identities, and mathematical models.'},
  {id:'earth', name:'Earth and Life Science', instructor:'Prof. Ana Garcia', progress:84, modules:6, next:'Earth Systems', accent:'sky', desc:'Understand Earth systems, biodiversity, ecosystems, and the processes that support life.'},
  {id:'physical', name:'Physical Science', instructor:'Prof. Carlo Mendoza', progress:46, modules:7, next:'Waves and Energy', accent:'navy', desc:'Explore matter, motion, energy, waves, and how physical principles explain everyday phenomena.'},
  {id:'english', name:'English for Academic and Professional Purposes', instructor:'Prof. Maria Santos', progress:91, modules:6, next:'Academic Writing', accent:'blue', desc:'Strengthen academic reading, research, formal writing, and professional communication.'}
];

const MODULES = [
  {id:'m1', title:'Core Concepts', status:'completed', lessons:['Key terms and concepts','Guided examples','Quick knowledge check']},
  {id:'m2', title:'Building Understanding', status:'completed', lessons:['Worked examples','Common mistakes','Practice activity']},
  {id:'m3', title:'Apply What You Know', status:'review', lessons:['Real-world application','Independent practice','Reflection']},
  {id:'m4', title:'Challenge Activity', status:'locked', lessons:['Advanced examples','Problem solving','Challenge quiz']},
  {id:'m5', title:'Mastery Check', status:'locked', lessons:['Mixed practice','Review feedback','Mastery assessment']}
];

const EVENTS = [
  {date:'2026-10-12', title:'General Mathematics Check-in', type:'quiz'},
  {date:'2026-10-14', title:'Pre-Calculus Practice Set', type:'assignment'},
  {date:'2026-10-16', title:'Physical Science Quiz', type:'quiz'},
  {date:'2026-10-20', title:'Earth and Life Science Reflection', type:'assignment'},
  {date:'2026-10-22', title:'Academic Writing Draft', type:'assignment'}
];

const ANNOUNCEMENTS = [
  {id:1, title:'Welcome to General Mathematics', body:'Your course is ready. Review the learning materials, assessments, and your personalized learning path.', course:'General Mathematics', date:'Oct 8'},
  {id:2, title:'Pre-Calculus practice materials added', body:'A new practice set is available. Try the guided examples before attempting the mastery check.', course:'Pre-Calculus', date:'Oct 7'},
  {id:3, title:'Physical Science review session', body:'Join the optional review session to revisit waves, energy, and common quiz mistakes.', course:'Physical Science', date:'Oct 6'}
];

const STUDENTS = [
  {id:1,name:'Alex Cruz',course:'General Mathematics',mastery:76,last:'Today',status:'On Track',strong:['Academic Writing','Earth Systems'],weak:['Waves and Energy','Trigonometric Identities']},
  {id:2,name:'Jamie Santos',course:'Physical Science',mastery:61,last:'2 days ago',status:'Needs Attention',strong:['Earth Systems'],weak:['Waves and Energy','Energy Transfer']},
  {id:3,name:'Miguel Reyes',course:'English for Academic and Professional Purposes',mastery:84,last:'Today',status:'On Track',strong:['Academic Writing','Research Skills'],weak:['Source Integration']},
  {id:4,name:'Sofia Garcia',course:'Pre-Calculus',mastery:64,last:'Yesterday',status:'Needs Attention',strong:['Functions'],weak:['Trigonometric Identities','Graph Transformations']},
  {id:5,name:'Noah Mendoza',course:'Earth and Life Science',mastery:91,last:'Today',status:'Mastered',strong:['Earth Systems','Biodiversity'],weak:[]},
  {id:6,name:'Bea Torres',course:'General Mathematics',mastery:69,last:'3 days ago',status:'Needs Attention',strong:['Logic'],weak:['Functions','Rational Expressions']}
];

const ASSIGNMENTS = [
  {id:1,title:'Functions Practice Set',course:'General Mathematics',due:'Oct 12',submissions:'32 / 40',avg:78,status:'Active'},
  {id:2,title:'Academic Writing Draft',course:'English for Academic and Professional Purposes',due:'Oct 14',submissions:'37 / 40',avg:86,status:'Active'},
  {id:3,title:'Waves and Energy Activity',course:'Physical Science',due:'Oct 16',submissions:'24 / 40',avg:71,status:'Needs Attention'}
];

const ASSESSMENTS = [
  {id:1,title:'General Mathematics Check-in',course:'General Mathematics',score:76,status:'Completed',date:'Oct 8',weak:'Function transformations'},
  {id:2,title:'Pre-Calculus Practice Quiz',course:'Pre-Calculus',score:64,status:'Needs Review',date:'Oct 6',weak:'Trigonometric identities'},
  {id:3,title:'Academic Writing Check',course:'English for Academic and Professional Purposes',score:92,status:'Mastered',date:'Oct 4',weak:'None'}
];

function defaultState(){ return { student:{tasks:{},progress:64,streak:6,annRead:[]}, teacher:{announcements:[...ANNOUNCEMENTS],assessments:[...ASSESSMENTS]}, courseOpen:null }; }
