import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Trash2, ChevronLeft, ChevronRight, BrainCircuit, GraduationCap, 
  Play, Search, Cloud, RefreshCw, X, Plus, Upload, 
  LayoutGrid, CheckCircle2, RotateCcw, Shuffle, History,
  Award, Clock, Info, Check, ArrowUp, ArrowDown, AlertTriangle, 
  ChevronUp, ChevronDown, LogOut, Mail, Lock, UserPlus, Fingerprint
} from 'lucide-react';

// ==========================================
// FIREBASE CONFIG
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDXSozkHRE0Agg9-uNmrxGAWiU9MtsaS-c",
  authDomain: "learnly-bb0da.firebaseapp.com",
  projectId: "learnly-bb0da",
  storageBucket: "learnly-bb0da.firebasestorage.app",
  messagingSenderId: "77667151804",
  appId: "1:77667151804:web:374ab4a0961d1af18f85b9",
  measurementId: "G-QGZDW8VJ6J"
};

const appId = "learnly-v1"; 
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState('');

  const [sets, setSets] = useState([]);
  const [oldSets, setOldSets] = useState([]); 
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [syncing, setSyncing] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const [activeTab, setActiveTab] = useState('flashcards'); 
  const [view, setView] = useState('library'); 
  const [activeSetId, setActiveSetId] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);
  const [isRetakingMissed, setIsRetakingMissed] = useState(false);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStatus('ready');
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user) return;

    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    const unsubscribeSets = onSnapshot(setsPath, (snapshot) => {
      setSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const oldPath = collection(db, 'studySets');
    const unsubscribeOld = onSnapshot(oldPath, (snapshot) => {
      setOldSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const historyPath = collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory');
    const unsubscribeHistory = onSnapshot(historyPath, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => { unsubscribeSets(); unsubscribeOld(); unsubscribeHistory(); };
  }, [user]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId), [sets, activeSetId]);
  const filteredSets = sets.filter(s => s.type === activeTab && s.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  // 3. Auth Actions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      // Set persistence based on "Remember Me"
      // Note: default is LOCAL (persists after browser close)
      await setPersistence(auth, browserLocalPersistence);

      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleLogout = () => signOut(auth);

  // 4. Database Actions
  const handleSave = async (op) => {
    setSyncing(true);
    try { await op(); } catch (e) { console.error(e); }
    finally { setTimeout(() => setSyncing(false), 800); }
  };

  const createSet = () => handleSave(async () => {
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    const docRef = await addDoc(setsPath, {
      title: activeTab === 'flashcards' ? 'New Deck' : 'New Exam',
      type: activeTab,
      items: [],
      updatedAt: Date.now()
    });
    setActiveSetId(docRef.id);
    setView('edit');
  });

  const migrateSet = (oldSet) => handleSave(async () => {
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    await addDoc(setsPath, {
      title: oldSet.title + " (Recovered)",
      type: oldSet.type || 'flashcards',
      items: oldSet.items || [],
      updatedAt: Date.now()
    });
  });

  const updateSet = (id, data) => handleSave(async () => {
    const setRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id);
    await updateDoc(setRef, { ...data, updatedAt: Date.now() });
  });

  const deleteSet = (id) => handleSave(async () => {
    const setRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id);
    await deleteDoc(setRef);
  });

  const moveItem = (index, direction) => {
    if (!activeSet?.items) return;
    const newItems = [...activeSet.items];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const [movedItem] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, movedItem);
    updateSet(activeSetId, { items: newItems });
  };

  const handleImport = () => {
    const newItems = [];
    if (activeTab === 'flashcards') {
      const regex = /Front:\s*(.*?)\s*Back:\s*(.*)/gi;
      let m; while ((m = regex.exec(importText)) !== null) {
        newItems.push({ id: Math.random().toString(36).substr(2,9), term: m[1].trim(), definition: m[2].trim() });
      }
    } else {
      const blocks = importText.split(/\n\s*\n/);
      blocks.forEach(block => {
        const qM = block.match(/Q:\s*(.*)/i);
        if (qM) {
          const a = block.match(/A:\s*(.*)/i), b = block.match(/B:\s*(.*)/i), c = block.match(/C:\s*(.*)/i), d = block.match(/D:\s*(.*)/i), ans = block.match(/Ans:\s*([A-D]|True|False)/i);
          if (a && b && c && d) {
            newItems.push({ id: Math.random().toString(36).substr(2,9), type: 'mc', question: qM[1].trim(), options: { a: a[1].trim(), b: b[1].trim(), c: c[1].trim(), d: d[1].trim() }, correctAnswer: ans ? ans[1].toLowerCase() : 'a' });
          } else if (ans) {
            newItems.push({ id: Math.random().toString(36).substr(2,9), type: 'tf', question: qM[1].trim(), correctAnswer: ans[1].toLowerCase() });
          }
        }
      });
    }
    if (newItems.length) {
      updateSet(activeSetId, { items: [...(activeSet.items || []), ...newItems] });
      setIsImporting(false); setImportText('');
    }
  };

  const startQuiz = (onlyMissed = false) => {
    if (!activeSet?.items || activeSet.items.length === 0) return;
    let items = onlyMissed ? activeSet.items.filter(it => quizResults.missedIds.includes(it.id)) : activeSet.items;
    setQuizQuestions([...items].sort(() => 0.5 - Math.random()));
    setQuizAnswers({});
    setQuizResults(null);
    setIsRetakingMissed(onlyMissed);
    setView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finishQuiz = async () => {
    let score = 0;
    const missed = [];
    const missedIds = [];
    quizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correctAnswer) score++;
      else { missedIds.push(q.id); missed.push({ q: q.question, user: quizAnswers[q.id] || 'None', correct: q.correctAnswer, options: q.options }); }
    });
    setQuizResults({ score, total: quizQuestions.length, missed, missedIds });
    if (!isRetakingMissed) {
      const historyPath = collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory');
      await addDoc(historyPath, { setTitle: activeSet.title, score, total: quizQuestions.length, timestamp: Date.now() });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center bg-white"><RefreshCw className="animate-spin text-indigo-600" size={32} /></div>;

  // LOGIN SCREEN
  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-10 rounded-[4rem] border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-8">
           <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-100"><BrainCircuit size={40} /></div>
        </div>
        <h1 className="text-3xl font-black text-center mb-2 tracking-tight">
          {authMode === 'login' ? 'Welcome Back' : 'Join Learnly'}
        </h1>
        <p className="text-slate-400 text-center mb-10 font-medium">
          {authMode === 'login' ? 'Your private library is waiting.' : 'Create your private account to start.'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="email" 
              autoComplete="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Email Address" 
              required 
              className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" 
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="password" 
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password" 
              required 
              className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" 
            />
          </div>

          <div className="flex items-center justify-between px-2 pb-4">
             <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`} onClick={() => setRememberMe(!rememberMe)}>
                   {rememberMe && <Check size={14} className="text-white" />}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remember Me</span>
             </label>
             <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                <Fingerprint size={12}/> Face ID Ready
             </div>
          </div>

          {authError && <div className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-3 rounded-xl border border-rose-100 animate-in shake-in">{authError}</div>}

          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">
            {authMode === 'login' ? 'Login to Library' : 'Initialize Account'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-50 text-center">
           <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-all flex items-center justify-center gap-2 mx-auto">
             {authMode === 'login' ? <><UserPlus size={14}/> Need an account? Sign up</> : <><Mail size={14}/> Already have an account? Log in</>}
           </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('library')}>
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-lg"><BrainCircuit size={20} /></div>
          <span className="font-black text-xl tracking-tighter">LEARNLY</span>
        </div>
        <div className="flex items-center gap-4">
          {syncing ? <RefreshCw size={14} className="animate-spin text-indigo-500" /> : <Cloud size={14} className="text-emerald-500" />}
          <button onClick={handleLogout} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><LogOut size={20}/></button>
          <button onClick={createSet} className="bg-indigo-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">+ {activeTab === 'flashcards' ? 'Deck' : 'Exam'}</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            {/* Recovery Alert */}
            {oldSets.length > 0 && !showRecovery && (
              <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] mb-8 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><AlertTriangle size={24}/></div>
                    <div>
                       <h4 className="font-black text-amber-900 text-sm">Found Legacy Content</h4>
                       <p className="text-amber-700 text-[11px] font-medium leading-tight">Migrate your old sets to this account?</p>
                    </div>
                 </div>
                 <button onClick={() => setShowRecovery(true)} className="bg-amber-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex-shrink-0">Migrate</button>
              </div>
            )}

            {showRecovery && (
              <div className="bg-slate-900 text-white p-8 rounded-[3rem] mb-10 animate-in zoom-in-95">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black">Data Migration</h3>
                    <button onClick={() => setShowRecovery(false)} className="text-slate-500 hover:text-white"><X size={24}/></button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {oldSets.map(os => (
                       <div key={os.id} className="bg-slate-800 p-5 rounded-2xl flex justify-between items-center border border-slate-700">
                          <div><div className="font-bold text-sm">{os.title}</div><div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{os.items?.length || 0} items</div></div>
                          <button onClick={() => migrateSet(os)} className="bg-indigo-600 text-white p-3 rounded-xl"><Check size={20}/></button>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            <div className="flex bg-slate-200/50 p-1 rounded-2xl mb-8 max-w-sm mx-auto shadow-inner">
              <button onClick={() => setActiveTab('flashcards')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Flashcards</button>
              <button onClick={() => setActiveTab('quizzes')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'quizzes' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Exams</button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">My Library</h2>
              <div className="relative w-full md:w-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Filter..." className="bg-white border border-slate-200 pl-10 pr-4 py-3 rounded-2xl text-sm outline-none w-full md:w-64 focus:ring-4 focus:ring-indigo-500/5 transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSets.length === 0 ? (
                <div className="col-span-full py-20 bg-white rounded-[3.5rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
                   <LayoutGrid size={48} className="text-slate-200 mb-4"/>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nothing found here</p>
                </div>
              ) : (
                filteredSets.map(set => (
                  <div key={set.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group" onClick={() => { setActiveSetId(set.id); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); setCurrentCardIndex(0); }}>
                    <div className="flex justify-between items-start mb-2"><h3 className="text-xl font-black group-hover:text-indigo-600 leading-tight">{set.title}</h3><button onClick={(e) => { e.stopPropagation(); deleteSet(set.id); }} className="text-slate-100 hover:text-red-500 transition-colors"><Trash2 size={18}/></button></div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1"><Play size={10} fill="currentColor"/> {set.items?.length || 0} ITEMS</div>
                    <div className="mt-8 flex gap-3"><button className="flex-1 bg-indigo-50 text-indigo-600 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Launch</button></div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* EDIT VIEW (With Reorder Handles) */}
        {view === 'edit' && activeSet && (
          <div className="animate-in fade-in duration-300 pb-20">
            <div className="flex justify-between items-center mb-8 sticky top-16 bg-slate-50/90 backdrop-blur-sm py-4 z-40 border-b border-slate-200">
              <button onClick={() => setView('library')} className="text-slate-400 p-2"><ChevronLeft size={24}/></button>
              <div className="flex gap-2"><button onClick={() => setIsImporting(true)} className="bg-white border border-slate-200 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 shadow-sm"><Upload size={14}/> Bulk</button><button onClick={() => setView('library')} className="bg-indigo-600 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">Save Changes</button></div>
            </div>
            <div className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm mb-10"><label className="text-[10px] font-black text-slate-300 uppercase block mb-3 tracking-widest">Collection Title</label><input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-4xl font-black outline-none border-b-4 border-slate-50 focus:border-indigo-500 transition-all pb-3" placeholder="Title..."/></div>
            <div className="space-y-8">
              {(activeSet.items || []).map((item, i) => (
                <div key={item.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm relative group">
                  <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-3">
                       <span className="bg-slate-100 text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">{activeTab === 'flashcards' ? 'Card' : 'Question'} {i+1}</span>
                       <div className="flex bg-slate-50 p-1 rounded-xl gap-1 ml-4 border border-slate-100">
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0} className={`p-2 rounded-lg transition-all ${i === 0 ? 'text-slate-200' : 'text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm'}`}><ChevronUp size={20} strokeWidth={3}/></button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === activeSet.items.length - 1} className={`p-2 rounded-lg transition-all ${i === activeSet.items.length - 1 ? 'text-slate-200' : 'text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm'}`}><ChevronDown size={20} strokeWidth={3}/></button>
                       </div>
                    </div>
                    <button onClick={() => updateSet(activeSetId, { items: activeSet.items.filter(it => it.id !== item.id) })} className="text-slate-100 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button>
                  </div>
                  {activeTab === 'flashcards' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div><label className="text-[10px] font-black text-slate-300 uppercase mb-3 block tracking-widest">Term</label><input value={item.term} onChange={e => { const ni = [...activeSet.items]; ni[i].term = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-black text-xl border-b-2 outline-none border-slate-50 focus:border-indigo-500 pb-2" /></div>
                      <div><label className="text-[10px] font-black text-slate-300 uppercase mb-3 block tracking-widest">Explanation</label><textarea value={item.definition} onChange={e => { const ni = [...activeSet.items]; ni[i].definition = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-medium border-b-2 outline-none border-slate-50 focus:border-indigo-500 resize-none h-12" /></div>
                    </div>
                  ) : (
                    <div className="space-y-10">
                       <div><div className="flex justify-between items-center mb-6"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Question Text</label><div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner"><button onClick={() => { const ni = [...activeSet.items]; ni[i].type = 'mc'; ni[i].options = {a:'',b:'',c:'',d:''}; updateSet(activeSetId, {items:ni}); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${item.type==='mc' ? 'bg-white shadow-md text-indigo-600':'text-slate-400'}`}>A/B/C/D</button><button onClick={() => { const ni = [...activeSet.items]; ni[i].type = 'tf'; ni[i].correctAnswer = 'true'; updateSet(activeSetId, {items:ni}); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${item.type==='tf' ? 'bg-white shadow-md text-indigo-600':'text-slate-400'}`}>T/F</button></div></div><textarea value={item.question} onChange={e => { const ni = [...activeSet.items]; ni[i].question = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full text-2xl font-black border-b-2 border-slate-50 outline-none focus:border-indigo-500 resize-none h-24 p-2" /></div>
                       {item.type === 'mc' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {['a', 'b', 'c', 'd'].map(key => (
                              <div key={key} className="relative group pl-6">
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-full ${item.correctAnswer === key ? 'bg-indigo-600':'bg-slate-100'}`} />
                                <label className="text-[10px] font-black text-slate-300 uppercase mb-2 block flex justify-between items-center">Option {key.toUpperCase()}<button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = key; updateSet(activeSetId, {items:ni}); }} className={`text-[9px] font-black py-1 px-3 rounded-lg transition-all ${item.correctAnswer === key ? 'bg-indigo-600 text-white shadow-md':'bg-slate-50 text-slate-300 hover:text-indigo-400'}`}>{item.correctAnswer === key ? '✓ ANSWER' : 'SET AS KEY'}</button></label>
                                <input value={item.options[key]} onChange={e => { const ni = [...activeSet.items]; ni[i].options[key] = e.target.value; updateSet(activeSetId, { items: ni }); }} className={`w-full font-bold outline-none border-b-2 py-1 ${item.correctAnswer === key ? 'border-indigo-100 text-indigo-800':'border-slate-50 text-slate-500'}`} />
                              </div>
                            ))}
                          </div>
                       ) : (
                          <div className="flex gap-4">
                            <button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = 'true'; updateSet(activeSetId, {items:ni}); }} className={`flex-1 py-6 rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 transition-all ${item.correctAnswer === 'true' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-inner' : 'border-slate-100 text-slate-300 hover:border-slate-200'}`}>Correct: TRUE</button>
                            <button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = 'false'; updateSet(activeSetId, {items:ni}); }} className={`flex-1 py-6 rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 transition-all ${item.correctAnswer === 'false' ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-inner' : 'border-slate-100 text-slate-300 hover:border-slate-200'}`}>Correct: FALSE</button>
                          </div>
                       )}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items || []), activeTab === 'flashcards' ? { id: Math.random().toString(), term: '', definition: '' } : { id: Math.random().toString(), type: 'mc', question: '', options: {a:'',b:'',c:'',d:''}, correctAnswer: 'a' }] })} className="w-full py-16 border-4 border-dashed border-slate-200 rounded-[4rem] text-slate-200 font-black hover:border-indigo-200 hover:text-indigo-500 transition-all text-2xl flex items-center justify-center gap-4 active:scale-98"><Plus size={32}/> ADD NEW ITEM</button>
            </div>
          </div>
        )}

        {/* Views for STUDY, QUIZ, and IMPORT remain identical to the reorder edition... */}
        {view === 'quiz-ready' && activeSet && (
          <div className="max-w-xl mx-auto text-center animate-in zoom-in-95 duration-300">
             <div className="bg-white p-16 rounded-[4.5rem] border border-slate-200 shadow-2xl mb-10">
                <GraduationCap className="mx-auto text-indigo-600 mb-6" size={72} />
                <h2 className="text-4xl font-black mb-2 text-slate-800 tracking-tight">{activeSet.title}</h2>
                <p className="text-slate-400 mb-12 font-medium">{activeSet.items?.length || 0} Questions</p>
                <div className="flex flex-col gap-4">
                  <button onClick={() => startQuiz(false)} className="bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Begin Examination</button>
                  <button onClick={() => setView('edit')} className="bg-slate-50 text-slate-500 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all">Modify Bank</button>
                </div>
             </div>
             <button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto"><ChevronLeft size={16}/> Back</button>
          </div>
        )}

        {view === 'study' && activeSet && (
          <div className="max-w-2xl mx-auto text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8"><button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2 hover:text-indigo-600"><ChevronLeft size={16}/> Library</button><button onClick={() => setView('edit')} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Edit Deck</button></div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">{activeSet.title}</h1>
            <div className="bg-indigo-50 text-indigo-600 inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-10">{currentCardIndex + 1} / {activeSet.items?.length || 0}</div>
            <div className="aspect-[16/10] relative perspective-1000 cursor-pointer mb-12 select-none group" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3.5rem] border-b-[10px] border-slate-200 shadow-2xl flex items-center justify-center p-12 text-3xl font-black text-slate-800">{activeSet.items[currentCardIndex]?.term}</div>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3.5rem] border-b-[10px] border-slate-200 shadow-2xl flex items-center justify-center p-12 text-2xl font-medium rotate-y-180 text-indigo-700 leading-relaxed overflow-y-auto">{activeSet.items[currentCardIndex]?.definition}</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-14"><button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p - 1 + activeSet.items.length) % activeSet.items.length); }} className="p-6 bg-white rounded-full border border-slate-200 shadow-xl hover:text-indigo-600 hover:scale-110 active:scale-90 transition-all"><ChevronLeft size={40}/></button><button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p + 1) % activeSet.items.length); }} className="p-6 bg-white rounded-full border border-slate-200 shadow-xl hover:text-indigo-600 hover:scale-110 active:scale-90 transition-all"><ChevronRight size={40}/></button></div>
          </div>
        )}

        {view === 'quiz' && activeSet && (
          <div className="animate-in fade-in duration-300 space-y-10 pb-20">
            {!quizResults ? (
              <>
                <div className="flex justify-between items-center mb-10"><button onClick={() => setView('quiz-ready')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><ChevronLeft size={16}/> Quit</button>{isRetakingMissed && <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-sm border border-rose-100"><RotateCcw size={14}/> Recovery Mode</div>}</div>
                {quizQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm"><div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Question {i+1}</div><p className="text-2xl font-black text-slate-800 mb-12 leading-tight">{q.question}</p>
                    {q.type === 'mc' ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{['a', 'b', 'c', 'd'].map(key => (<button key={key} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: key})} className={`p-6 rounded-3xl text-left border-2 flex items-start gap-4 transition-all ${quizAnswers[q.id] === key ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-inner' : 'border-slate-50 bg-white text-slate-500 hover:border-slate-200'}`}><span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-colors ${quizAnswers[q.id] === key ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 uppercase'}`}>{key}</span><span className="font-bold pt-0.5 leading-snug">{q.options[key]}</span></button>))}</div>) : (<div className="flex gap-4">{['true', 'false'].map(opt => (<button key={opt} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: opt})} className={`flex-1 p-8 rounded-3xl font-black text-2xl border-2 transition-all capitalize ${quizAnswers[q.id] === opt ? (opt === 'true' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-inner' : 'bg-rose-50 border-rose-500 text-rose-700 shadow-inner') : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}>{opt}</button>))}</div>)}
                  </div>
                ))}
                <button onClick={finishQuiz} className="w-full bg-indigo-600 text-white py-7 rounded-[3rem] font-black text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"><CheckCircle2 size={24}/> Finalize Submission</button>
              </>
            ) : (
              <div className="animate-in fade-in zoom-in-95 text-center">
                <div className="bg-white p-14 rounded-[4.5rem] border border-slate-200 shadow-2xl mb-10 relative overflow-hidden"><div className="w-56 h-56 rounded-full bg-slate-50 flex flex-col items-center justify-center mx-auto mb-8 border-[12px] border-indigo-50 shadow-inner"><span className="text-6xl font-black text-indigo-600 tracking-tighter">{Math.round((quizResults.score/quizResults.total)*100)}%</span></div><h3 className="text-4xl font-black text-slate-800 mb-2">{quizResults.score} / {quizResults.total} Correct</h3><div className="flex flex-wrap gap-4 justify-center mt-12">{quizResults.missed.length > 0 && (<button onClick={() => startQuiz(true)} className="bg-rose-500 text-white px-8 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-rose-600 transition-all"><RotateCcw size={18}/> Perfect Mistakes</button>)}<button onClick={() => startQuiz(false)} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-[11px] uppercase shadow-lg transition-all">New Attempt</button><button onClick={() => setView('library')} className="bg-slate-100 text-slate-600 px-10 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200">Done</button></div></div>
                {quizResults.missed.map((m, i) => (<div key={i} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 border-l-[16px] border-l-rose-500 shadow-sm text-left mb-6"><p className="font-black text-slate-800 text-2xl mb-8 leading-tight">{m.q}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-10"><div className="bg-rose-50/50 p-6 rounded-3xl"> <span className="font-black uppercase block text-rose-300 text-[10px] mb-3">You Picked</span><span className="text-rose-700 font-bold uppercase">{m.user === 'a' || m.user === 'b' || m.user === 'c' || m.user === 'd' ? `${m.user}: ${m.options?.[m.user]}` : m.user}</span></div><div className="bg-emerald-50/50 p-6 rounded-3xl"><span className="font-black uppercase block text-emerald-300 text-[10px] mb-3">Correct Solution</span><span className="text-emerald-700 font-bold uppercase">{m.correct === 'a' || m.correct === 'b' || m.correct === 'c' || m.correct === 'd' ? `${m.correct}: ${m.options?.[m.correct]}` : m.correct}</span></div></div></div>))}
              </div>
            )}
          </div>
        )}

        {isImporting && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6"><div className="bg-white w-full max-w-3xl rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden relative"><div className="flex justify-between items-center mb-8"><div className="flex items-center gap-4"><div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600"><Upload size={28}/></div><h3 className="text-4xl font-black text-slate-800 tracking-tight">Bulk Upload</h3></div><button onClick={() => setIsImporting(false)} className="text-slate-300 hover:text-slate-900 transition-all"><X size={36}/></button></div>
              <div className="bg-indigo-50/50 p-6 rounded-3xl text-indigo-700 text-[11px] font-bold uppercase tracking-widest mb-10 leading-relaxed border border-indigo-100 flex gap-4 items-center"><Info size={24} className="flex-shrink-0" /><div>{activeTab === 'flashcards' ? "Format: 'Front: Text Back: Text' on each line." : "Format: 'Q: ... A: ... B: ... C: ... D: ... Ans: A' or 'Q: ... Ans: True'."}</div></div>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={activeTab === 'flashcards' ? "Front: Real Estate Back: Land plus improvements..." : "Q: Question?\nA: Option\nB: Option\nC: Option\nD: Option\nAns: B"} className="w-full h-96 border-2 border-slate-100 rounded-[2.5rem] p-10 outline-none font-mono text-sm mb-12 focus:border-indigo-500 transition-all resize-none shadow-inner bg-slate-50/50" />
              <div className="flex justify-end gap-6 items-center"><button onClick={() => setIsImporting(false)} className="text-slate-400 font-black text-xs uppercase tracking-widest">Discard</button><button onClick={handleImport} className="bg-indigo-600 text-white px-16 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 active:scale-95 transition-all">Confirm Batch Import</button></div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .active:scale-98 { transform: scale(0.98); }
        .select-none { user-select: none; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shake-in { animation: shake 0.2s ease-in-out 0s 2; }
      `}} />
    </div>
  );
}

