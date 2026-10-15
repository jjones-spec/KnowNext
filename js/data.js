/* KnowNext seed data. Frontend-only prototype.
   These constants are only used to build the first copy of the demo data (see js/store.js).
   After that, everything is read from and written to localStorage. Date fields ending in
   "Offset" are days relative to the day the demo data is first created. */
const DEMO_USERS = {
  student123: { username:'student123', password:'student123', role:'student', name:'Alex Cruz', email:'alex.cruz@knownext.demo', program:'Senior High School', year:'Grade 12', studentId:1 },
  teacher123: { username:'teacher123', password:'teacher123', role:'teacher', name:'Prof. Maria Santos', email:'maria.santos@knownext.demo', department:'Senior High School' }
};

/* Mastery topics, one per seed course (same id as the course). Scores are randomized once and can be reshuffled. */
const STUDENT_TOPICS = [
  {id:'genmath', name:'Functions and Graphs', score:76, course:'General Mathematics'},
  {id:'precalc', name:'Trigonometric Identities', score:64, course:'Pre-Calculus'},
  {id:'earth', name:'Earth Systems', score:88, course:'Earth and Life Science'},
  {id:'physical', name:'Waves and Energy', score:59, course:'Physical Science'},
  {id:'english', name:'Academic Writing', score:92, course:'English for Academic and Professional Purposes'}
];

const COURSES = [
  {id:'genmath', name:'General Mathematics', instructor:'Prof. Maria Santos', progress:72, accent:'blue', desc:'Build confidence with functions, rational expressions, logic, and practical mathematical reasoning.'},
  {id:'precalc', name:'Pre-Calculus', instructor:'Prof. Daniel Reyes', progress:58, accent:'yellow', desc:'Explore polynomial and trigonometric functions, identities, and mathematical models.'},
  {id:'earth', name:'Earth and Life Science', instructor:'Prof. Ana Garcia', progress:84, accent:'sky', desc:'Understand Earth systems, biodiversity, ecosystems, and the processes that support life.'},
  {id:'physical', name:'Physical Science', instructor:'Prof. Carlo Mendoza', progress:46, accent:'navy', desc:'Explore matter, motion, energy, waves, and how physical principles explain everyday phenomena.'},
  {id:'english', name:'English for Academic and Professional Purposes', instructor:'Prof. Maria Santos', progress:91, accent:'blue', desc:'Strengthen academic reading, research, formal writing, and professional communication.'}
];

/* Module/lesson template shared by every course. Lesson ids are "<moduleId>-<index>". */
const MODULES = [
  {id:'m1', title:'Core Concepts', lessons:['Key terms and concepts','Guided examples','Quick knowledge check']},
  {id:'m2', title:'Building Understanding', lessons:['Worked examples','Common mistakes','Practice activity']},
  {id:'m3', title:'Apply What You Know', lessons:['Real-world application','Independent practice','Reflection']},
  {id:'m4', title:'Challenge Activity', lessons:['Advanced examples','Problem solving','Challenge quiz']},
  {id:'m5', title:'Mastery Check', lessons:['Mixed practice','Review feedback','Mastery assessment']}
];

const ANNOUNCEMENTS = [
  {id:'ann-1', title:'Welcome to General Mathematics', body:'Your course is ready. Review the learning materials, assessments, and your personalized learning path.', courseId:'genmath', dateOffset:-7},
  {id:'ann-2', title:'Pre-Calculus practice materials added', body:'A new practice set is available. Try the guided examples before attempting the mastery check.', courseId:'precalc', dateOffset:-8},
  {id:'ann-3', title:'Physical Science review session', body:'Join the optional review session to revisit waves, energy, and common quiz mistakes.', courseId:'physical', dateOffset:-9}
];

/* Class roster. Student 1 is the logged-in demo student (student123); their mastery is computed live. */
const STUDENTS = [
  {id:1,name:'Alex Cruz',username:'student123',courseId:'genmath',mastery:76,last:'Today',strong:['Academic Writing','Earth Systems'],weak:['Waves and Energy','Trigonometric Identities']},
  {id:2,name:'Jamie Santos',courseId:'physical',mastery:61,last:'2 days ago',strong:['Earth Systems'],weak:['Waves and Energy','Energy Transfer']},
  {id:3,name:'Miguel Reyes',courseId:'english',mastery:84,last:'Today',strong:['Academic Writing','Research Skills'],weak:['Source Integration']},
  {id:4,name:'Sofia Garcia',courseId:'precalc',mastery:64,last:'Yesterday',strong:['Functions'],weak:['Trigonometric Identities','Graph Transformations']},
  {id:5,name:'Noah Mendoza',courseId:'earth',mastery:91,last:'Today',strong:['Earth Systems','Biodiversity'],weak:[]},
  {id:6,name:'Bea Torres',courseId:'genmath',mastery:69,last:'3 days ago',strong:['Logic'],weak:['Functions','Rational Expressions']}
];

const SEED_ASSIGNMENTS = [
  {id:'asg-1',title:'Functions Practice Set',courseId:'genmath',dueOffset:3,points:100,instructions:'Solve the 10 function problems in the practice set. Show your solution for each item and explain how you identified the domain and range.'},
  {id:'asg-2',title:'Academic Writing Draft',courseId:'english',dueOffset:6,points:100,instructions:'Write a 300–400 word draft of your position paper introduction. Include a clear thesis statement and at least two cited sources.'},
  {id:'asg-3',title:'Waves and Energy Activity',courseId:'physical',dueOffset:-2,points:50,instructions:'Describe three everyday examples of waves. For each, identify the type of wave, the medium (if any), and how energy is transferred.'}
];

/* [assignmentId, studentId, daysAgo, score|null, feedback] — null score means "Submitted, not graded". */
const SEED_SUBMISSIONS = [
  ['asg-1',2,1,72,'Good start. Review how to find the domain of rational functions.'],
  ['asg-1',3,1,88,'Clear solutions and explanations.'],
  ['asg-1',6,0,null,''],
  ['asg-1',4,0,null,''],
  ['asg-2',3,2,90,'Strong thesis. Tighten the second paragraph.'],
  ['asg-2',5,2,85,'Well organized. Add one more scholarly source.'],
  ['asg-2',2,1,null,''],
  ['asg-3',2,3,null,''],
  ['asg-3',5,3,40,'Great examples; the medium for light waves needs correction.']
];
const SEED_SUBMISSION_TEXT = 'I completed the activity and attached my answers below. Each item includes my solution steps and a short explanation of my reasoning.';

const SEED_ASSESSMENTS = [
  {id:'asm-1',title:'General Mathematics Check-in',courseId:'genmath',type:'mastery',dueOffset:-7,description:'Check your understanding of functions and their graphs.',questions:[
    {q:'If f(x) = x², which function shifts the graph 3 units up?',options:['(x + 3)²','x² + 3','3x²','x² − 3'],answer:1,points:1},
    {q:'What is f(2) if f(x) = 3x − 1?',options:['5','6','7','4'],answer:0,points:1},
    {q:'Which relation is a function?',options:['{(1,2),(1,3),(2,4)}','{(2,1),(2,5),(3,1)}','{(1,2),(2,3),(3,4)}','{(0,0),(0,1),(1,1)}'],answer:2,points:1},
    {q:'The domain of f(x) = 1/(x − 2) excludes:',options:['x = 0','x = −2','x = 1','x = 2'],answer:3,points:1},
    {q:'Moving a graph 4 units to the right replaces x with:',options:['x − 4','x + 4','4x','x / 4'],answer:0,points:1}
  ]},
  {id:'asm-2',title:'Pre-Calculus Practice Quiz',courseId:'precalc',type:'quiz',dueOffset:-9,description:'Practice the fundamental trigonometric identities.',questions:[
    {q:'sin²θ + cos²θ equals:',options:['0','1','tan θ','2'],answer:1,points:1},
    {q:'tan θ is equal to:',options:['cos θ / sin θ','sin θ / cos θ','1 / sin θ','sin θ · cos θ'],answer:1,points:1},
    {q:'sec θ is the reciprocal of:',options:['sin θ','tan θ','cos θ','cot θ'],answer:2,points:1},
    {q:'1 + tan²θ equals:',options:['sec²θ','csc²θ','cot²θ','sin²θ'],answer:0,points:1},
    {q:'sin(90° − θ) equals:',options:['sin θ','−cos θ','tan θ','cos θ'],answer:3,points:1}
  ]},
  {id:'asm-3',title:'Academic Writing Check',courseId:'english',type:'mastery',dueOffset:-11,description:'Confirm the basics of academic tone and structure.',questions:[
    {q:'A thesis statement should be:',options:['A question to the reader','A specific, arguable claim','A list of sources','A personal anecdote'],answer:1,points:1},
    {q:'Which sentence uses a formal academic tone?',options:['The results kinda show a trend.','The results indicate a clear trend.','Results? Pretty clear trend!','U can see a trend here.'],answer:1,points:1},
    {q:'Paraphrasing a source requires:',options:['Copying the exact words','Changing only one word','Restating the idea in your own words and citing it','Skipping the citation'],answer:2,points:1},
    {q:'A topic sentence usually appears:',options:['At the start of a paragraph','Only in the conclusion','In the references','In the title'],answer:0,points:1},
    {q:'Which section lists the sources you used?',options:['Abstract','Introduction','References','Acknowledgements'],answer:2,points:1}
  ]},
  {id:'asm-4',title:'Physical Science Quiz',courseId:'physical',type:'quiz',dueOffset:1,description:'Waves, wave properties, and forms of energy.',questions:[
    {q:'The distance between two consecutive crests of a wave is its:',options:['Amplitude','Frequency','Wavelength','Period'],answer:2,points:1},
    {q:'Which wave does NOT need a medium to travel?',options:['Sound wave','Electromagnetic wave','Water wave','Seismic wave'],answer:1,points:1},
    {q:'Wave speed equals:',options:['frequency × wavelength','amplitude × period','frequency ÷ wavelength','wavelength ÷ amplitude'],answer:0,points:1},
    {q:'The energy of a moving object is called:',options:['Potential energy','Thermal energy','Kinetic energy','Chemical energy'],answer:2,points:1},
    {q:'The SI unit of energy is the:',options:['Watt','Newton','Pascal','Joule'],answer:3,points:1}
  ]},
  {id:'asm-5',title:'Earth and Life Science Mastery Check',courseId:'earth',type:'mastery',dueOffset:5,description:'Earth subsystems and biodiversity.',questions:[
    {q:'Which Earth subsystem includes all living things?',options:['Geosphere','Hydrosphere','Atmosphere','Biosphere'],answer:3,points:1},
    {q:'The layer of gases surrounding Earth is the:',options:['Atmosphere','Lithosphere','Mantle','Hydrosphere'],answer:0,points:1},
    {q:'Most of Earth\'s fresh water is stored in:',options:['Rivers','Glaciers and ice caps','Lakes','The atmosphere'],answer:1,points:1},
    {q:'Biodiversity refers to:',options:['The variety of life in an area','The number of rocks in a region','Long-term weather patterns','The depth of the ocean'],answer:0,points:1},
    {q:'Plate movement is driven mainly by heat from Earth\'s:',options:['Crust','Oceans','Interior (mantle)','Atmosphere'],answer:2,points:1}
  ]}
];

/* [assessmentId, studentId, correctAnswers, daysAgo] */
const SEED_ATTEMPTS = [
  ['asm-1',1,4,7],['asm-1',6,3,7],['asm-1',2,3,7],['asm-1',3,4,6],
  ['asm-2',1,3,9],['asm-2',4,3,9],['asm-2',2,2,8],
  ['asm-3',1,5,11],['asm-3',3,5,11],['asm-3',5,4,10]
];

/* Live sessions. Seeds have no meeting link: a teacher adds a real one with Edit. */
const SEED_CLASSES = [
  {id:'cls-1',title:'General Mathematics Live Review',courseId:'genmath',dateOffset:0,time:'19:00',duration:60,host:'Prof. Maria Santos',platform:'Google Meet',link:''},
  {id:'cls-2',title:'Physical Science Clinic',courseId:'physical',dateOffset:2,time:'16:00',duration:45,host:'Prof. Carlo Mendoza',platform:'Zoom',link:''},
  {id:'cls-3',title:'Academic Writing Consultation',courseId:'english',dateOffset:5,time:'18:00',duration:30,host:'Prof. Daniel Reyes',platform:'Google Meet',link:''},
  {id:'cls-4',title:'Earth Systems Q&A',courseId:'earth',dateOffset:-3,time:'15:00',duration:45,host:'Prof. Ana Garcia',platform:'Zoom',link:''}
];

/* Study plan for the demo student (studentId 1). */
const SEED_TASKS = [
  {title:'Review Trigonometric Identities',courseId:'precalc',dateOffset:0,time:'09:00',duration:20,priority:'High'},
  {title:'Practice Function Transformations',courseId:'genmath',dateOffset:0,time:'10:00',duration:15,priority:'Medium'},
  {title:'Take Mastery Check',courseId:'genmath',dateOffset:0,time:'14:00',duration:10,priority:'Medium',target:'assessments'},
  {title:'Review mistakes',courseId:'physical',dateOffset:0,time:'18:00',duration:15,priority:'Low'}
];

const SEED_NOTIFICATIONS = [
  {role:'student',title:'Waves and Energy needs attention',meta:'Adaptive engine',view:'learning-path',dateOffset:0},
  {role:'student',title:'General Mathematics Check-in results are ready',meta:'Assessment',view:'assessments',dateOffset:-1},
  {role:'student',title:'New assignment: Functions Practice Set',meta:'Assignment',view:'assignments',dateOffset:-2},
  {role:'teacher',title:'Bea Torres submitted Functions Practice Set',meta:'Submission',view:'assignments',dateOffset:0},
  {role:'teacher',title:'Jamie Santos needs attention in Physical Science',meta:'Student insight',view:'students',dateOffset:-1}
];

const SEED_ACTIVITY = [
  {text:'Reviewed Function Concepts',icon:'↻',dateOffset:-1},
  {text:'Scored 80% in General Mathematics Check-in',icon:'★',dateOffset:-7},
  {text:'Scored 60% in Pre-Calculus Practice Quiz',icon:'★',dateOffset:-9},
  {text:'Scored 100% in Academic Writing Check',icon:'★',dateOffset:-11}
];
