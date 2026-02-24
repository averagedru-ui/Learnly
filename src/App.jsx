import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  onSnapshot,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  Trash2, ChevronLeft, ChevronRight, BrainCircuit, GraduationCap, 
  Play, Search, Cloud, RefreshCw, X, Plus, Upload, 
  LayoutGrid, CheckCircle2, RotateCcw, Shuffle, History,
  Award, Clock, Info, Check, ArrowUp, ArrowDown, AlertTriangle, 
  ChevronUp, ChevronDown, LogOut, Mail, Lock, UserPlus, Fingerprint,
  User, Home, BookOpen, Settings, Zap, Star, TrendingUp
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
  const [profile, setProfile] = useState({ displayName: 'Student' });
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editName, setEditName] = useState('');
  const [authError, setAuthError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [sets, setSets] = useState([]);
  const [oldSets, setOldSets] = useState([]); 
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [syncing, setSyncing] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  // Navigation
  const [view, setView] = useState('dashboard'); 
  const [activeTab, setActiveTab] = useState('flashcards'); 
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

  const emailInputRef = useRef(null);

  // 1. Auth Listener
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setStatus('ready');
        setView('dashboard');
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user) return;

    // Profile
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setEditName(prev => (prev === '' ? data.displayName : prev));
      }
      setStatus('ready');
    });

    // Sets
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    const unsubscribeSets = onSnapshot(setsPath, (snapshot) => {
      setSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Recovery (Old Public Data)
    const oldPath = collection(db, 'studySets');
    const unsubscribeOld = onSnapshot(oldPath, (snapshot) => {
      setOldSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // History
    const historyPath = collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory');
    const unsubscribeHistory = onSnapshot(historyPath, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => { 
      unsubscribeProfile();
      unsubscribeSets(); 
      unsubscribeOld(); 
      unsubscribeHistory(); 
    };
  }, [user]);

  // Derived Active Set
  const activeSet = useMemo(() => {
    return sets.find(s => s.id === activeSetId) || null;
  }, [sets, activeSetId]);

  // Global Reordering logic for the Library
  const filteredSets = useMemo(() => {
    const list = sets.filter(s => s.type === activeTab);
    // Sort by orderIndex first, then by updatedAt
    return list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
               .filter(s => (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [sets, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const flashcardCount = sets.filter(s => s.type === 'flashcards').length;
    const examCount = sets.filter(s => s.type === 'quizzes').length;
    const totalQuestions = sets.reduce((acc, set) => acc + (set.items?.length || 0), 0);
    const avgScore = history.length > 0 
      ? Math.round((history.reduce((acc, h) => acc + (h.score / h.total), 0) / history.length) * 100) 
      : 0;
    return { flashcardCount, examCount, totalQuestions, avgScore };
  }, [sets, history]);

  // Auth Actions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const profileRef = doc(db, 'artifacts', appId, 'users', userCred.user.uid, 'profile', 'info');
        await setDoc(profileRef, {
          displayName: editName || 'Student',
          email: email,
          createdAt: Date.now()
        }, { merge: true });
      }
      setView('dashboard');
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !editName) return;
    setSyncing(true);
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await setDoc(profileRef, { displayName: editName }, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setEditName('');
    setView('dashboard');
  };

  const handleSave = async (op) => {
    setSyncing(true);
    try { await op(); } catch (e) { console.error(e); }
    finally { setTimeout(() => setSyncing(false), 800); }
  };

  // REORDER LOGIC FOR LIBRARY SETS
  const moveSet = async (index, direction) => {
    const newFilteredList = [...filteredSets];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newFilteredList.length) return;

    setSyncing(true);
    const itemA = newFilteredList[index];
    const itemB = newFilteredList[targetIndex];

    // Swap orderIndex values
    const batch = writeBatch(db);
    const refA = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', itemA.id);
    const refB = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', itemB.id);

    // If they don't have orderIndex yet, initialize them
    const newOrderA = targetIndex;
    const newOrderB = index;

    batch.update(refA, { orderIndex: newOrderA });
    batch.update(refB, { orderIndex: newOrderB });

    await batch.commit();
    setSyncing(false);
  };

  // REORDER LOGIC FOR QUESTIONS WITHIN A SET
  const moveItem = (index, direction) => {
    if (!activeSet?.items) return;
    const newItems = [...activeSet.items];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const [movedItem] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, movedItem);
    updateSet(activeSetId, { items: newItems });
  };

  const createSet = (type) => handleSave(async () => {
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    const docRef = await addDoc(setsPath, {
      title: type === 'flashcards' ? 'New Deck' : 'New Exam',
      type: type,
      items: [],
      orderIndex: sets.filter(s => s.type === type).length,
      updatedAt: Date.now()
    });
    setActiveSetId(docRef.id);
    setActiveTab(type);
    setView('edit');
  });

  const updateSet = (id, data) => handleSave(async () => {
    const setRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id);
    await updateDoc(setRef, { ...data, updatedAt: Date.now() });
  });

  const migrateSet = (oldSet) => handleSave(async () => {
    const setsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'studySets');
    await addDoc(setsPath, {
      title: oldSet.title + " (Recovered)",
      type: oldSet.type || 'flashcards',
      items: oldSet.items || [],
      orderIndex: sets.length,
      updatedAt: Date.now()
    });
  });

  const deleteSet = (id) => handleSave(async () => {
    const setRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', id);
    await deleteDoc(setRef);
  });

  const handleImport = () => {
    if (!activeSet) return;
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
    if (!activeSet) return;
    let score = 0; const missed = [], missedIds = [];
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 pb-20">
      <div className="w-full max-w-md bg-white p-10 rounded-[4rem] border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-8">
           <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-100"><BrainCircuit size={40} /></div>
        </div>
        <h1 className="text-3xl font-black text-center mb-2 tracking-tight">{authMode === 'login' ? 'Welcome Back' : 'Get Started'}</h1>
        <p className="text-slate-400 text-center mb-10 font-medium">{authMode === 'login' ? 'Login to access your menu.' : 'Create an account to save progress.'}</p>

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full Name" required className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input ref={emailInputRef} type="email" autoComplete="username email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" />
          </div>
          {authError && <div className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-3 rounded-xl border border-rose-100">{authError}</div>}
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="w-full mt-8 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-all text-center">
          {authMode === 'login' ? 'New user? Create Account' : 'Member? Log In'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Universal Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><BrainCircuit size={22} /></div>
          <span className="font-black text-2xl tracking-tighter">LEARNLY</span>
        </div>
        <div className="flex items-center gap-2">
           {syncing && <RefreshCw size={16} className="animate-spin text-indigo-500 mr-2" />}
           <div 
             onClick={() => setView('profile')}
             className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 cursor-pointer hover:bg-indigo-600 hover:text-white transition-all overflow-hidden"
           >
             <User size={20} />
           </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* DASHBOARD (Main Menu) */}
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-12">
               <h1 className="text-4xl font-black text-slate-800 tracking-tight">Hello, {profile.displayName.split(' ')[0]}!</h1>
               <p className="text-slate-400 font-medium mt-1">What are we mastering today?</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl font-black">{stats.flashcardCount + stats.examCount}</div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sets</div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl font-black">{stats.totalQuestions}</div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cards</div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl font-black">{stats.avgScore}%</div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Avg</div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl font-black">{history.length}</div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tests</div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div onClick={() => { setActiveTab('flashcards'); setView('library'); }} className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                  <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all"><BookOpen size={32}/></div>
                  <h4 className="text-2xl font-black mb-1">Flashcards</h4>
                  <p className="text-slate-400 text-sm font-medium">Flash drill concepts.</p>
               </div>
               <div onClick={() => { setActiveTab('quizzes'); setView('library'); }} className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                  <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all"><GraduationCap size={32}/></div>
                  <h4 className="text-2xl font-black mb-1">Exam Center</h4>
                  <p className="text-slate-400 text-sm font-medium">Practice examinations.</p>
               </div>
            </div>
          </div>
        )}

        {/* PROFILE PAGE */}
        {view === 'profile' && (
          <div className="max-w-xl mx-auto animate-in zoom-in-95 duration-300">
             <button onClick={() => setView('dashboard')} className="mb-8 text-slate-400 font-black text-[10px] uppercase flex items-center gap-2"><ChevronLeft size={16}/> Back</button>

             <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-2xl text-center mb-6">
                <div className="w-24 h-24 rounded-full bg-indigo-600 mx-auto mb-6 flex items-center justify-center text-white shadow-xl"><User size={48} /></div>
                <h2 className="text-3xl font-black mb-1">{profile.displayName}</h2>
                <p className="text-slate-400 font-medium mb-10">{user.email}</p>

                <div className="space-y-4 text-left">
                   <label className="text-[10px] font-black uppercase text-slate-300 tracking-widest ml-4 mb-2 block">Display Name</label>
                   <input 
                     type="text" 
                     value={editName} 
                     onChange={e => {
                       setEditName(e.target.value);
                       if (saveSuccess) setSaveSuccess(false);
                     }}
                     className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all mb-4"
                     placeholder="Your Name"
                   />
                   <button 
                     onClick={handleUpdateProfile} 
                     disabled={syncing}
                     className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
                   >
                     {syncing ? <RefreshCw className="animate-spin" size={14}/> : saveSuccess ? <><Check size={14}/> Saved</> : 'Update Profile'}
                   </button>
                </div>
             </div>
             <button onClick={handleLogout} className="w-full bg-rose-50 text-rose-500 py-6 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all"><LogOut size={18}/> Log Out</button>
          </div>
        )}

        {/* LIBRARY (With Global Set Reordering) */}
        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <header className="flex justify-between items-center mb-8">
               <button onClick={() => setView('dashboard')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2"><ChevronLeft size={16}/> Home</button>
               <button onClick={() => createSet(activeTab)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">+ Add {activeTab === 'flashcards' ? 'Deck' : 'Exam'}</button>
            </header>

            {oldSets.length > 0 && !showRecovery && (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] mb-8 flex items-center justify-between shadow-sm">
                 <div className="flex items-center gap-4"><div className="text-amber-500"><AlertTriangle size={24}/></div><p className="text-amber-800 text-[11px] font-black uppercase tracking-widest">Found legacy content. Migrate?</p></div>
                 <button onClick={() => setShowRecovery(true)} className="bg-amber-500 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase">View</button>
              </div>
            )}

            {showRecovery && (
               <div className="bg-slate-900 text-white p-8 rounded-[3rem] mb-10 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-black">Migration</h3><button onClick={() => setShowRecovery(false)}><X/></button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {oldSets.map(os => (
                        <div key={os.id} className="bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
                           <div><div className="font-bold text-sm">{os.title}</div><div className="text-[9px] text-slate-500 uppercase">{os.items?.length || 0} items</div></div>
                           <button onClick={() => migrateSet(os)} className="bg-indigo-600 p-2 rounded-xl"><Check size={16}/></button>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">{activeTab === 'flashcards' ? 'My Decks' : 'My Practice Exams'}</h2>

            <div className="grid grid-cols-1 gap-6">
              {filteredSets.length === 0 ? (
                <div className="py-20 bg-white rounded-[3.5rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
                   <div className="bg-slate-50 p-6 rounded-full mb-4 text-slate-200"><Plus size={48}/></div>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No sets found</p>
                </div>
              ) : (
                filteredSets.map((set, idx) => (
                  <div 
                    key={set.id} 
                    className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-6 cursor-pointer group"
                    onClick={() => { setActiveSetId(set.id); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); setCurrentCardIndex(0); setIsFlipped(false); }}
                  >
                    {/* GLOBAL REORDER ARROWS (On Left for Desktop, Right for Mobile if you prefer) */}
                    <div className="flex flex-col bg-slate-50 p-1.5 rounded-2xl gap-1 border border-slate-100" onClick={e => e.stopPropagation()}>
                       <button onClick={() => moveSet(idx, -1)} disabled={idx === 0} className={`p-1.5 rounded-lg ${idx === 0 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-sm hover:scale-110 active:scale-90'}`}><ChevronUp size={20} strokeWidth={3}/></button>
                       <button onClick={() => moveSet(idx, 1)} disabled={idx === filteredSets.length - 1} className={`p-1.5 rounded-lg ${idx === filteredSets.length - 1 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-sm hover:scale-110 active:scale-90'}`}><ChevronDown size={20} strokeWidth={3}/></button>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-black group-hover:text-indigo-600 leading-tight transition-colors">{set.title}</h3>
                      <div className="flex items-center gap-4 mt-1">
                         <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{set.items?.length || 0} ITEMS</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                       <button onClick={() => { setActiveSetId(set.id); setView('edit'); }} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Settings size={18}/></button>
                       <button onClick={() => deleteSet(set.id)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"><Trash2 size={18}/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* EDITOR (Question Reordering) */}
        {view === 'edit' && activeSet && (
          <div className="animate-in fade-in duration-300 pb-20">
            <div className="flex justify-between items-center mb-8 sticky top-16 bg-slate-50/90 py-4 z-40 border-b border-slate-200">
              <button onClick={() => setView('library')} className="text-slate-400 p-2"><ChevronLeft size={24}/></button>
              <div className="flex gap-2"><button onClick={() => setIsImporting(true)} className="bg-white border border-slate-200 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest">Bulk Import</button><button onClick={() => setView('library')} className="bg-indigo-600 text-white px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Save & Exit</button></div>
            </div>
            <input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-4xl font-black outline-none border-b-4 border-slate-50 focus:border-indigo-500 transition-all pb-3 mb-10" placeholder="Set Title..."/>
            <div className="space-y-8">
              {(activeSet.items || []).map((item, i) => (
                <div key={item.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm relative group">
                  <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                       <span className="bg-slate-100 text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Question {i+1}</span>
                       <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0} className={`p-2.5 rounded-xl transition-all ${i === 0 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-md hover:scale-110 active:scale-90'}`}><ChevronUp size={24} strokeWidth={3}/></button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === activeSet.items.length - 1} className={`p-2.5 rounded-xl transition-all ${i === activeSet.items.length - 1 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-md hover:scale-110 active:scale-90'}`}><ChevronDown size={24} strokeWidth={3}/></button>
                       </div>
                    </div>
                    <button onClick={() => updateSet(activeSetId, { items: activeSet.items.filter(it => it.id !== item.id) })} className="text-slate-100 hover:text-red-500 transition-colors p-2"><Trash2 size={24}/></button>
                  </div>
                  {activeTab === 'flashcards' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <input value={item.term} onChange={e => { const ni = [...activeSet.items]; ni[i].term = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-black text-xl border-b-2 outline-none border-slate-50 focus:border-indigo-500 pb-2" placeholder="Term" />
                      <textarea value={item.definition} onChange={e => { const ni = [...activeSet.items]; ni[i].definition = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-medium border-b-2 outline-none border-slate-50 focus:border-indigo-500 resize-none h-12" placeholder="Definition" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                       <textarea value={item.question} onChange={e => { const ni = [...activeSet.items]; ni[i].question = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full text-xl font-black border-b-2 border-slate-50 outline-none focus:border-indigo-500 resize-none h-20 p-2" placeholder="Enter Question" />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {['a', 'b', 'c', 'd'].map(key => (
                            <div key={key} className="flex items-center gap-2">
                               <button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = key; updateSet(activeSetId, {items:ni}); }} className={`w-10 h-10 rounded-xl font-black uppercase ${item.correctAnswer === key ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>{key}</button>
                               <input value={item.options[key]} onChange={e => { const ni = [...activeSet.items]; ni[i].options[key] = e.target.value; updateSet(activeSetId, { items: ni }); }} className="flex-1 font-bold outline-none border-b-2 border-slate-50 focus:border-indigo-500" placeholder={`Option ${key}`} />
                            </div>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items || []), activeTab === 'flashcards' ? { id: Math.random().toString(), term: '', definition: '' } : { id: Math.random().toString(), type: 'mc', question: '', options: {a:'',b:'',c:'',d:''}, correctAnswer: 'a' }] })} className="w-full py-16 border-4 border-dashed border-slate-200 rounded-[4rem] text-slate-200 font-black hover:border-indigo-200 hover:text-indigo-500 transition-all text-2xl flex items-center justify-center gap-4">+ NEW ITEM</button>
            </div>
          </div>
        )}

        {/* STUDY ENGINE */}
        {view === 'study' && activeSet && (
          <div className="max-w-2xl mx-auto text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8"><button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2 hover:text-indigo-600"><ChevronLeft size={16}/> Back</button><button onClick={() => setView('edit')} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Edit Deck</button></div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">{activeSet.title}</h1>
            <div className="bg-indigo-50 text-indigo-600 inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-10">{currentCardIndex + 1} / {activeSet.items?.length || 0}</div>
            <div className="aspect-[16/10] relative perspective-1000 cursor-pointer mb-12 select-none group" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3.5rem] border-b-[10px] border-slate-200 shadow-2xl flex items-center justify-center p-12 text-3xl font-black text-slate-800 leading-tight">{activeSet.items[currentCardIndex]?.term}</div>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3.5rem] border-b-[10px] border-slate-200 shadow-2xl flex items-center justify-center p-12 text-2xl font-medium rotate-y-180 text-indigo-700 leading-relaxed overflow-y-auto">{activeSet.items[currentCardIndex]?.definition}</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-14"><button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p - 1 + activeSet.items.length) % activeSet.items.length); }} className="p-6 bg-white rounded-full border border-slate-200 shadow-xl hover:text-indigo-600 hover:scale-110 active:scale-90 transition-all"><ChevronLeft size={40}/></button><button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p + 1) % activeSet.items.length); }} className="p-6 bg-white rounded-full border border-slate-200 shadow-xl hover:text-indigo-600 hover:scale-110 active:scale-90 transition-all"><ChevronRight size={40}/></button></div>
          </div>
        )}

        {/* QUIZ READY SCREEN */}
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
             <button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto"><ChevronLeft size={16}/> Back to Library</button>
          </div>
        )}

        {/* QUIZ ENGINE */}
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
                <div className="bg-white p-14 rounded-[4.5rem] border border-slate-200 shadow-2xl mb-10 relative overflow-hidden"><div className="w-56 h-56 rounded-full bg-slate-50 flex flex-col items-center justify-center mx-auto mb-8 border-[12px] border-indigo-50 shadow-inner"><span className="text-6xl font-black text-indigo-600 tracking-tighter">{Math.round((quizResults.score/quizResults.total)*100)}%</span></div><h3 className="text-4xl font-black text-slate-800 mb-2">{quizResults.score} / {quizResults.total} Correct</h3><div className="flex flex-wrap gap-4 justify-center mt-12">{quizResults.missed.length > 0 && (<button onClick={() => startQuiz(true)} className="bg-rose-500 text-white px-8 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-rose-600 transition-all"><RotateCcw size={18}/> Perfect Mistakes</button>)}<button onClick={() => startQuiz(false)} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-[11px] uppercase shadow-lg transition-all">New Attempt</button><button onClick={() => setView('dashboard')} className="bg-slate-100 text-slate-600 px-10 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200">Done</button></div></div>
                {quizResults.missed.map((m, i) => (<div key={i} className="bg-white p-10 rounded-[3.5rem] border border-slate-200 border-l-[16px] border-l-rose-500 shadow-sm text-left mb-6"><p className="font-black text-slate-800 text-2xl mb-8 leading-tight">{m.q}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-10"><div className="bg-rose-50/50 p-6 rounded-3xl"> <span className="font-black uppercase block text-rose-300 text-[10px] mb-3">You Picked</span><span className="text-rose-700 font-bold uppercase">{m.user === 'a' || m.user === 'b' || m.user === 'c' || m.user === 'd' ? `${m.user}: ${m.options?.[m.user]}` : m.user}</span></div><div className="bg-emerald-50/50 p-6 rounded-3xl"><span className="font-black uppercase block text-emerald-300 text-[10px] mb-3">Correct Answer</span><span className="text-emerald-700 font-bold uppercase">{m.correct === 'a' || m.correct === 'b' || m.correct === 'c' || m.correct === 'd' ? `${m.correct}: ${m.options?.[m.correct]}` : m.correct}</span></div></div></div>))}
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

      {/* Persistent Bottom Bar */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-8 py-4 flex justify-around items-center z-50 shadow-lg">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <Home size={24} />
            <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button onClick={() => { setActiveTab('flashcards'); setView('library'); }} className={`flex flex-col items-center gap-1 ${view === 'library' && activeTab === 'flashcards' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <LayoutGrid size={24} />
            <span className="text-[9px] font-black uppercase tracking-widest">Decks</span>
          </button>
          <button onClick={() => { setActiveTab('quizzes'); setView('library'); }} className={`flex flex-col items-center gap-1 ${view === 'library' && activeTab === 'quizzes' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <GraduationCap size={24} />
            <span className="text-[9px] font-black uppercase tracking-widest">Exams</span>
          </button>
          <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 ${view === 'profile' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <User size={24} />
            <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .active:scale-98 { transform: scale(0.98); }
        .select-none { user-select: none; }
      `}} />
    </div>
  );
}

