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
  User, Home, BookOpen, Settings, Zap, Star, TrendingUp, Edit3, Target
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

    // History (Full history for dashboard)
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

  // Derived Values
  const activeSet = useMemo(() => {
    return sets.find(s => s.id === activeSetId) || null;
  }, [sets, activeSetId]);

  const filteredSets = useMemo(() => {
    const list = sets.filter(s => s.type === activeTab);
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

  // Actions
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

  const moveSet = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= filteredSets.length) return;

    setSyncing(true);
    const itemA = filteredSets[index];
    const itemB = filteredSets[targetIndex];

    const batch = writeBatch(db);
    const refA = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', itemA.id);
    const refB = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', itemB.id);

    batch.update(refA, { orderIndex: targetIndex });
    batch.update(refB, { orderIndex: index });

    await batch.commit();
    setSyncing(false);
  };

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

    // Save to History & Update Set with Latest Score
    if (!isRetakingMissed) {
      const historyPath = collection(db, 'artifacts', appId, 'users', user.uid, 'quizHistory');
      await addDoc(historyPath, { 
        setId: activeSetId,
        setTitle: activeSet.title, 
        score, 
        total: quizQuestions.length, 
        timestamp: Date.now() 
      });

      // Update the actual set with the most recent percentage for quick access
      const setRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studySets', activeSetId);
      await updateDoc(setRef, { 
        lastScore: Math.round((score / quizQuestions.length) * 100),
        lastTakenAt: Date.now()
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center bg-white"><RefreshCw className="animate-spin text-indigo-600" size={32} /></div>;

  // LOGIN / AUTH
  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 pb-20">
      <div className="w-full max-w-md bg-white p-10 rounded-[4rem] border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-8">
           <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-100"><BrainCircuit size={40} /></div>
        </div>
        <h1 className="text-3xl font-black text-center mb-2 tracking-tight">{authMode === 'login' ? 'Welcome Back' : 'Get Started'}</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full Name" required className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input ref={emailInputRef} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all font-bold" />
          </div>
          {authError && <div className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-3 rounded-xl border border-rose-100">{authError}</div>}
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }} className="w-full mt-8 text-slate-400 font-black text-[10px] uppercase tracking-widest text-center">
          {authMode === 'login' ? 'New user? Create Account' : 'Member? Log In'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><BrainCircuit size={22} /></div>
          <span className="font-black text-2xl tracking-tighter">LEARNLY</span>
        </div>
        <div className="flex items-center gap-2">
           {syncing && <RefreshCw size={16} className="animate-spin text-indigo-500 mr-2" />}
           <div onClick={() => setView('profile')} className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 cursor-pointer">
             <User size={20} />
           </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* DASHBOARD */}
        {view === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
               <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hello, {profile.displayName.split(' ')[0]}!</h1>
               <p className="text-slate-400 font-medium text-sm">Ready for another session?</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
               <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-xl font-black">{stats.flashcardCount + stats.examCount}</div>
                  <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Sets</div>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-xl font-black">{stats.totalQuestions}</div>
                  <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Cards</div>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-xl font-black">{stats.avgScore}%</div>
                  <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Avg</div>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-xl font-black">{history.length}</div>
                  <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest">History</div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div onClick={() => { setActiveTab('flashcards'); setView('library'); }} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                  <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all"><BookOpen size={28}/></div>
                  <h4 className="text-xl font-black">Flashcards</h4>
                  <p className="text-slate-400 text-xs font-medium">Concept drills.</p>
               </div>
               <div onClick={() => { setActiveTab('quizzes'); setView('library'); }} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                  <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all"><GraduationCap size={28}/></div>
                  <h4 className="text-xl font-black">Practice Exams</h4>
                  <p className="text-slate-400 text-xs font-medium">Test simulation.</p>
               </div>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {view === 'profile' && (
          <div className="max-w-md mx-auto animate-in zoom-in-95 duration-300">
             <button onClick={() => setView('dashboard')} className="mb-6 text-slate-400 font-black text-[10px] uppercase flex items-center gap-2"><ChevronLeft size={16}/> Back</button>
             <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-indigo-600 mx-auto mb-4 flex items-center justify-center text-white shadow-xl"><User size={40} /></div>
                <h2 className="text-2xl font-black mb-1">{profile.displayName}</h2>
                <p className="text-slate-400 font-medium text-xs mb-8">{user.email}</p>
                <div className="space-y-4 text-left">
                   <input type="text" value={editName} onChange={e => { setEditName(e.target.value); setSaveSuccess(false); }} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-bold outline-none text-sm" placeholder="Display Name"/>
                   <button onClick={handleUpdateProfile} disabled={syncing} className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2 ${saveSuccess ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                     {syncing ? <RefreshCw className="animate-spin" size={14}/> : saveSuccess ? <><Check size={14}/> Saved</> : 'Update Profile'}
                   </button>
                </div>
             </div>
             <button onClick={handleLogout} className="w-full bg-rose-50 text-rose-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-rose-100">Log Out</button>
          </div>
        )}

        {/* LIBRARY (COMPACT) */}
        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <header className="flex justify-between items-center mb-6">
               <button onClick={() => setView('dashboard')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2"><ChevronLeft size={16}/> Back</button>
               <button onClick={() => createSet(activeTab)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">+ Add Set</button>
            </header>

            <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">{activeTab === 'flashcards' ? 'My Decks' : 'My Practice Exams'}</h2>

            <div className="space-y-3">
              {filteredSets.length === 0 ? (
                <div className="py-12 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-center flex flex-col items-center"><p className="text-slate-300 font-black uppercase text-[10px]">Empty</p></div>
              ) : (
                filteredSets.map((set, idx) => (
                  <div 
                    key={set.id} 
                    className="bg-white p-3.5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4 cursor-pointer group relative overflow-hidden"
                    onClick={() => { setActiveSetId(set.id); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); setCurrentCardIndex(0); setIsFlipped(false); }}
                  >
                    {/* Progress Bar background if score exists */}
                    {set.lastScore !== undefined && (
                      <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/20" style={{ width: `${set.lastScore}%` }}></div>
                    )}

                    <div className="flex flex-col bg-slate-50 p-1 rounded-xl gap-0.5 border border-slate-100" onClick={e => e.stopPropagation()}>
                       <button onClick={() => moveSet(idx, -1)} disabled={idx === 0} className={`p-1 rounded-lg ${idx === 0 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-sm active:scale-90'}`}><ChevronUp size={16} strokeWidth={3}/></button>
                       <button onClick={() => moveSet(idx, 1)} disabled={idx === filteredSets.length - 1} className={`p-1 rounded-lg ${idx === filteredSets.length - 1 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-sm active:scale-90'}`}><ChevronDown size={16} strokeWidth={3}/></button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black group-hover:text-indigo-600 leading-tight transition-colors truncate">{set.title}</h3>
                      <div className="flex items-center gap-3">
                         <div className="text-[9px] font-black uppercase text-slate-300 tracking-widest">{set.items?.length || 0} ITEMS</div>

                         {/* THE LATEST SCORE BADGE */}
                         {set.lastScore !== undefined && (
                            <div className={`flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${set.lastScore >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                               <Target size={10} /> Latest: {set.lastScore}%
                            </div>
                         )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                       <button onClick={() => { setActiveSetId(set.id); setView('edit'); }} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Edit3 size={14}/></button>
                       <button onClick={() => deleteSet(set.id)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* EDITOR */}
        {view === 'edit' && activeSet && (
          <div className="animate-in fade-in duration-300 pb-20">
            <div className="flex justify-between items-center mb-6 sticky top-16 bg-slate-50/90 py-3 z-40 border-b border-slate-200">
              <button onClick={() => setView('library')} className="text-slate-400 p-2"><ChevronLeft size={20}/></button>
              <div className="flex gap-2"><button onClick={() => setIsImporting(true)} className="bg-white border border-slate-200 px-5 rounded-xl text-[10px] font-black uppercase">Bulk</button><button onClick={() => setView('library')} className="bg-indigo-600 text-white px-7 rounded-xl text-[10px] font-black uppercase shadow-md">Done</button></div>
            </div>
            <input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-3xl font-black outline-none border-b-2 border-slate-200 focus:border-indigo-500 transition-all pb-2 mb-8" placeholder="Title..."/>
            <div className="space-y-4">
              {(activeSet.items || []).map((item, i) => (
                <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative group">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                       <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[9px] font-black uppercase"># {i+1}</span>
                       <div className="flex bg-slate-50 p-1 rounded-xl gap-1 border border-slate-100">
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0} className={`p-2 rounded-lg transition-all ${i === 0 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-sm'}`}><ChevronUp size={18} strokeWidth={3}/></button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === activeSet.items.length - 1} className={`p-2 rounded-lg transition-all ${i === activeSet.items.length - 1 ? 'text-slate-200' : 'bg-white text-indigo-600 shadow-sm'}`}><ChevronDown size={18} strokeWidth={3}/></button>
                       </div>
                    </div>
                    <button onClick={() => updateSet(activeSetId, { items: activeSet.items.filter(it => it.id !== item.id) })} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                  </div>
                  {activeTab === 'flashcards' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <input value={item.term} onChange={e => { const ni = [...activeSet.items]; ni[i].term = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-black text-lg border-b outline-none focus:border-indigo-500" placeholder="Term" />
                      <textarea value={item.definition} onChange={e => { const ni = [...activeSet.items]; ni[i].definition = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-medium border-b outline-none focus:border-indigo-500 h-10 resize-none" placeholder="Definition" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                       <textarea value={item.question} onChange={e => { const ni = [...activeSet.items]; ni[i].question = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full text-lg font-black border-b outline-none focus:border-indigo-500 resize-none h-16" placeholder="Question Text" />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {['a', 'b', 'c', 'd'].map(key => (
                            <div key={key} className="flex items-center gap-2">
                               <button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = key; updateSet(activeSetId, {items:ni}); }} className={`w-8 h-8 rounded-lg font-black uppercase text-xs ${item.correctAnswer === key ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-300'}`}>{key}</button>
                               <input value={item.options[key]} onChange={e => { const ni = [...activeSet.items]; ni[i].options[key] = e.target.value; updateSet(activeSetId, { items: ni }); }} className="flex-1 font-bold outline-none border-b border-slate-100 text-sm" placeholder={`Option ${key.toUpperCase()}`} />
                            </div>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items || []), activeTab === 'flashcards' ? { id: Math.random().toString(), term: '', definition: '' } : { id: Math.random().toString(), type: 'mc', question: '', options: {a:'',b:'',c:'',d:''}, correctAnswer: 'a' }] })} className="w-full py-12 border-4 border-dashed border-slate-200 rounded-[3rem] text-slate-200 font-black hover:border-indigo-200 hover:text-indigo-500 transition-all flex items-center justify-center gap-3 tracking-widest text-sm text-center">+ ADD ITEM</button>
            </div>
          </div>
        )}

        {/* STUDY ENGINE */}
        {view === 'study' && activeSet && (
          <div className="max-w-xl mx-auto text-center animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6"><button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2"><ChevronLeft size={16}/> Back</button><button onClick={() => setView('edit')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md">Edit</button></div>
            <h1 className="text-xl font-black text-slate-800 mb-2">{activeSet.title}</h1>
            <div className="bg-indigo-50 text-indigo-600 inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-8">{currentCardIndex + 1} / {activeSet.items?.length || 0}</div>
            <div className="aspect-[14/10] relative perspective-1000 cursor-pointer mb-8 select-none" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-b-[8px] border-slate-200 shadow-xl flex items-center justify-center p-8 text-2xl font-black text-slate-800">{activeSet.items[currentCardIndex]?.term}</div>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-b-[8px] border-slate-200 shadow-xl flex items-center justify-center p-8 text-xl font-medium rotate-y-180 text-indigo-700 overflow-y-auto">{activeSet.items[currentCardIndex]?.definition}</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-10"><button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p - 1 + activeSet.items.length) % activeSet.items.length); }} className="p-5 bg-white rounded-full border border-slate-200 shadow-lg hover:text-indigo-600 active:scale-90 transition-all"><ChevronLeft size={32}/></button><button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p + 1) % activeSet.items.length); }} className="p-5 bg-white rounded-full border border-slate-200 shadow-lg hover:text-indigo-600 active:scale-90 transition-all"><ChevronRight size={32}/></button></div>
          </div>
        )}

        {/* QUIZ READY */}
        {view === 'quiz-ready' && activeSet && (
          <div className="max-w-md mx-auto text-center animate-in zoom-in-95 duration-300">
             <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl mb-8">
                <GraduationCap className="mx-auto text-indigo-600 mb-6" size={64} />
                <h2 className="text-3xl font-black mb-1 text-slate-800 tracking-tight">{activeSet.title}</h2>
                <p className="text-slate-400 mb-10 font-medium text-sm">{activeSet.items?.length || 0} Questions</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => startQuiz(false)} className="bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Start Exam</button>
                  <button onClick={() => setView('edit')} className="bg-slate-50 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Edit Bank</button>
                </div>
             </div>
             <button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2 mx-auto"><ChevronLeft size={16}/> Back</button>
          </div>
        )}

        {/* QUIZ ENGINE */}
        {view === 'quiz' && activeSet && (
          <div className="animate-in fade-in duration-300 space-y-6 pb-20">
            {!quizResults ? (
              <>
                <div className="flex justify-between items-center mb-6"><button onClick={() => setView('quiz-ready')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><ChevronLeft size={16}/> Quit</button>{isRetakingMissed && <div className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-100">Retake Mode</div>}</div>
                {quizQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                    <div className="text-[9px] font-black text-slate-300 uppercase mb-4 border-b border-slate-50 pb-2">Question {i+1}</div>
                    <p className="text-xl font-black text-slate-800 mb-8 leading-tight">{q.question}</p>
                    {q.type === 'mc' ? (
                      <div className="grid grid-cols-1 gap-3">{['a', 'b', 'c', 'd'].map(key => (<button key={key} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: key})} className={`p-5 rounded-2xl text-left border-2 flex items-start gap-4 transition-all ${quizAnswers[q.id] === key ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-inner' : 'border-slate-50 bg-white text-slate-500 hover:border-slate-200'}`}><span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-colors ${quizAnswers[q.id] === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 uppercase'}`}>{key}</span><span className="font-bold text-sm leading-snug">{q.options[key]}</span></button>))}</div>
                    ) : (
                      <div className="flex gap-3">{['true', 'false'].map(opt => (<button key={opt} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: opt})} className={`flex-1 p-8 rounded-2xl font-black text-xl border-2 transition-all capitalize ${quizAnswers[q.id] === opt ? (opt === 'true' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-rose-50 border-rose-500 text-rose-700') : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}>{opt}</button>))}</div>
                    )}
                  </div>
                ))}
                <button onClick={finishQuiz} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-lg shadow-xl active:scale-95 transition-all">Submit Answers</button>
              </>
            ) : (
              <div className="animate-in zoom-in-95 text-center">
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-2xl mb-8">
                  <div className="w-40 h-40 rounded-full bg-slate-50 flex flex-col items-center justify-center mx-auto mb-6 border-[10px] border-indigo-50 shadow-inner"><span className="text-4xl font-black text-indigo-600">{Math.round((quizResults.score/quizResults.total)*100)}%</span></div>
                  <h3 className="text-2xl font-black text-slate-800 mb-8">{quizResults.score} / {quizResults.total} Correct</h3>
                  <div className="flex flex-col gap-3">{quizResults.missed.length > 0 && (<button onClick={() => startQuiz(true)} className="bg-rose-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg"><RotateCcw size={16} className="inline mr-2"/> Fix Mistakes</button>)}<button onClick={() => startQuiz(false)} className="bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase">New Attempt</button><button onClick={() => setView('dashboard')} className="bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-[10px] uppercase">Done</button></div>
                </div>
                {quizResults.missed.map((m, i) => (<div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 border-l-[12px] border-l-rose-500 shadow-sm text-left mb-4"><p className="font-black text-slate-800 text-lg mb-6 leading-tight">{m.q}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-rose-50/50 p-4 rounded-2xl"> <span className="font-black uppercase block text-rose-300 text-[9px] mb-2">Picked</span><span className="text-rose-700 font-bold text-xs">{m.user === 'a' || m.user === 'b' || m.user === 'c' || m.user === 'd' ? `${m.user.toUpperCase()}: ${m.options?.[m.user]}` : m.user}</span></div><div className="bg-emerald-50/50 p-4 rounded-2xl"><span className="font-black uppercase block text-emerald-300 text-[9px] mb-2">Correct</span><span className="text-emerald-700 font-bold text-xs">{m.correct === 'a' || m.correct === 'b' || m.correct === 'c' || m.correct === 'd' ? `${m.correct.toUpperCase()}: ${m.options?.[m.correct]}` : m.correct}</span></div></div></div>))}
              </div>
            )}
          </div>
        )}

        {/* IMPORT */}
        {isImporting && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4"><div className="bg-white w-full max-w-xl rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-slate-800">Bulk Import</h3><button onClick={() => setIsImporting(false)} className="text-slate-300 hover:text-slate-900"><X size={28}/></button></div>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste content here..." className="w-full h-72 border border-slate-100 rounded-[2rem] p-6 outline-none font-mono text-xs mb-8 bg-slate-50/50 resize-none shadow-inner" />
              <div className="flex justify-end gap-4"><button onClick={() => setIsImporting(false)} className="text-slate-400 font-black text-[10px] uppercase">Cancel</button><button onClick={handleImport} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Confirm</button></div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Bottom Bar */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-8 py-4 flex justify-around items-center z-50 shadow-lg">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <Home size={22} />
            <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
          </button>
          <button onClick={() => { setActiveTab('flashcards'); setView('library'); }} className={`flex flex-col items-center gap-1 ${view === 'library' && activeTab === 'flashcards' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <LayoutGrid size={22} />
            <span className="text-[9px] font-black uppercase tracking-widest">Decks</span>
          </button>
          <button onClick={() => { setActiveTab('quizzes'); setView('library'); }} className={`flex flex-col items-center gap-1 ${view === 'library' && activeTab === 'quizzes' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <GraduationCap size={22} />
            <span className="text-[9px] font-black uppercase tracking-widest">Exams</span>
          </button>
          <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 ${view === 'profile' ? 'text-indigo-600' : 'text-slate-300'}`}>
            <User size={22} />
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

