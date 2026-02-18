import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
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
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Upload,
  X,
  BrainCircuit,
  GraduationCap,
  Play,
  Settings,
  Search,
  Check,
  Cloud,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Shuffle,
  AlertCircle
} from 'lucide-react';

// ==========================================
// 1. YOUR FIREBASE CONFIG (ALREADY UPDATED)
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

// 2. Safe Initialization
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const App = () => {
  const [user, setUser] = useState(null);
  const [sets, setSets] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading', 'ready', 'error'
  const [syncing, setSyncing] = useState(false);

  const [activeSetId, setActiveSetId] = useState(null);
  const [view, setView] = useState('library'); 

  // App States
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [frontFirst, setFrontFirst] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);

  // 1. Authentication Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setStatus('ready');
      } else {
        signInAnonymously(auth).catch(() => setStatus('error'));
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Data Sync
  useEffect(() => {
    if (!user) return;
    // For standalone hosting, we use a simple top-level collection
    const setsCollection = collection(db, 'studySets');
    const unsubscribe = onSnapshot(setsCollection, 
      (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSets(fetched);
      },
      (err) => {
        console.error("Firestore Error:", err);
        // If you see an error here, check your Firestore Rules in the console
      }
    );
    return () => unsubscribe();
  }, [user]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId), [sets, activeSetId]);

  // Saving Helper
  const handleSave = async (op) => {
    if (!user) return;
    setSyncing(true);
    try { await op(); } catch (e) { console.error(e); }
    finally { setTimeout(() => setSyncing(false), 800); }
  };

  // Actions
  const createSet = () => handleSave(async () => {
    const docRef = await addDoc(collection(db, 'studySets'), {
      title: 'New Real Estate Set',
      cards: [],
      updatedAt: Date.now(),
      owner: user.uid
    });
    setActiveSetId(docRef.id);
    setView('edit');
  });

  const updateSet = (id, data) => handleSave(async () => {
    await updateDoc(doc(db, 'studySets', id), { ...data, updatedAt: Date.now() });
  });

  const deleteSet = (id) => handleSave(async () => {
    await deleteDoc(doc(db, 'studySets', id));
  });

  const handleImport = () => {
    const lines = importText.split('\n');
    const newCards = lines.map(line => {
      const f = line.match(/Front:\s*(.*?)\s*Back:/i);
      const b = line.match(/Back:\s*(.*)$/i);
      if (f && b) return { id: Math.random().toString(36), term: f[1].trim(), definition: b[1].trim() };
      return null;
    }).filter(Boolean);
    if (newCards.length) {
      updateSet(activeSetId, { cards: [...(activeSet.cards || []), ...newCards] });
    }
    setIsImporting(false);
    setImportText('');
  };

  const startQuiz = () => {
    if (!activeSet?.cards?.length) return;
    const questions = activeSet.cards.map(card => {
      const isMC = Math.random() > 0.5 && activeSet.cards.length >= 4;
      if (isMC) {
        const others = activeSet.cards.filter(c => c.id !== card.id).map(c => c.definition);
        const options = [...others.sort(() => Math.random() - 0.5).slice(0, 3), card.definition].sort(() => Math.random() - 0.5);
        return { id: card.id, type: 'mc', question: card.term, correctAnswer: card.definition, options };
      }
      const isCorrect = Math.random() > 0.5;
      const otherCard = activeSet.cards.find(c => c.id !== card.id) || card;
      const displayDef = isCorrect ? card.definition : otherCard.definition;
      return { id: card.id, type: 'tf', question: card.term, displayDef, correctAnswer: isCorrect ? 'True' : 'False' };
    });
    setQuizQuestions(questions.sort(() => Math.random() - 0.5));
    setQuizAnswers({});
    setQuizResults(null);
    setView('quiz');
  };

  if (status === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-white font-sans">
      <div className="text-center">
        <RefreshCw size={32} className="animate-spin text-blue-600 mb-4 mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing with Firebase</p>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center bg-red-50">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h2 className="text-xl font-black mb-2">Setup Error</h2>
      <p className="text-sm text-red-700">Please ensure "Anonymous Authentication" is enabled in your Firebase Console.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg" onClick={() => setView('library')}>
              <BrainCircuit size={20} />
            </div>
            {syncing ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <Cloud size={14} className="text-emerald-500" />}
          </div>
          <button onClick={createSet} className="bg-blue-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">New Set</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Library</h2>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Search sets..." className="bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-2xl text-sm outline-none w-full md:w-64 focus:ring-2 focus:ring-blue-500/20 transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            {sets.length === 0 ? (
              <div className="bg-white p-16 rounded-[3rem] border border-slate-200 text-center shadow-sm">
                <Layers className="mx-auto text-slate-100 mb-6" size={64} />
                <h3 className="text-xl font-black text-slate-700 mb-2">Your library is empty</h3>
                <p className="text-slate-400 mb-8 max-w-xs mx-auto">Create a new set or import your existing flashcards to get started.</p>
                <button onClick={createSet} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest">Create First Set</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sets.filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase())).map(set => (
                  <div key={set.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group" onClick={() => { setActiveSetId(set.id); setView('study'); }}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{set.title}</h3>
                      <button onClick={(e) => { e.stopPropagation(); deleteSet(set.id); }} className="text-slate-100 group-hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{set.cards?.length || 0} cards</span>
                    <div className="mt-8 flex gap-3">
                      <div className="flex-1 bg-blue-50 text-blue-600 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white transition-all"><Play size={12} fill="currentColor"/> Study</div>
                      <div onClick={(e) => { e.stopPropagation(); setActiveSetId(set.id); setTimeout(() => startQuiz(), 0); }} className="flex-1 bg-slate-50 text-slate-400 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"><GraduationCap size={14}/> Quiz</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'study' && activeSet && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-blue-600"><ChevronLeft size={16}/> Library</button>
              <div className="flex gap-2">
                <button onClick={() => setView('edit')} className="bg-white border border-slate-200 px-5 py-2 rounded-xl text-slate-700 font-black text-[10px] uppercase tracking-widest">Edit</button>
                <button onClick={startQuiz} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100">Practice Quiz</button>
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400"><Settings size={20}/></button>
              </div>
              {showSettings && (
                  <div className="absolute right-4 top-24 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 z-50 w-64 animate-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setFrontFirst(!frontFirst)}>
                      <span className="text-sm font-bold text-slate-600">Front Side First</span>
                      <div className={`w-11 h-6 rounded-full relative transition-all ${frontFirst ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${frontFirst ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                  </div>
              )}
            </div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-black text-slate-800">{activeSet.title}</h1>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mt-3">Card {currentCardIndex + 1} of {activeSet.cards.length}</div>
            </div>
            <div className="w-full max-w-2xl mx-auto aspect-[16/10] relative perspective-1000 cursor-pointer mb-12" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-b-[10px] border-slate-200 shadow-2xl flex items-center justify-center p-12 text-center text-3xl font-black text-slate-800 overflow-hidden">
                  <div className="max-h-full overflow-y-auto w-full">
                    {frontFirst ? activeSet.cards[currentCardIndex]?.term : activeSet.cards[currentCardIndex]?.definition}
                  </div>
                </div>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-b-[10px] border-slate-200 shadow-2xl flex items-center justify-center p-12 text-center text-2xl font-medium rotate-y-180 text-blue-700 leading-relaxed overflow-hidden">
                  <div className="max-h-full overflow-y-auto w-full">
                    {frontFirst ? activeSet.cards[currentCardIndex]?.definition : activeSet.cards[currentCardIndex]?.term}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-12">
              <button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p - 1 + activeSet.cards.length) % activeSet.cards.length); }} className="p-5 bg-white rounded-full border border-slate-200 shadow-xl hover:text-blue-600 hover:scale-110 transition-all"><ChevronLeft size={36}/></button>
              <button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p + 1) % activeSet.cards.length); }} className="p-5 bg-white rounded-full border border-slate-200 shadow-xl hover:text-blue-600 hover:scale-110 transition-all"><ChevronRight size={36}/></button>
            </div>
          </div>
        )}

        {view === 'edit' && activeSet && (
          <div className="pb-24 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-8 sticky top-16 bg-slate-50 pt-4 pb-4 border-b border-slate-200 z-30">
              <h2 className="text-2xl font-black text-slate-800">Edit Deck</h2>
              <div className="flex gap-2 relative">
                <button onClick={() => setShowSortOptions(!showSortOptions)} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-400 hover:text-blue-600"><ArrowUpDown size={20}/></button>
                <button onClick={() => setIsImporting(true)} className="bg-white border border-slate-200 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Import</button>
                <button onClick={() => setView('study')} className="bg-blue-600 text-white px-6 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Save</button>
                {showSortOptions && (
                  <div className="absolute right-0 top-14 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 w-48">
                    <button onClick={() => { const s = [...activeSet.cards].sort((a,b)=>a.term.localeCompare(b.term)); updateSet(activeSetId, {cards:s}); setShowSortOptions(false); }} className="w-full text-left p-4 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl flex items-center gap-3"><ArrowUpDown size={14} className="text-blue-500"/> Sort A-Z</button>
                    <button onClick={() => { const s = [...activeSet.cards].sort(()=>Math.random()-0.5); updateSet(activeSetId, {cards:s}); setShowSortOptions(false); }} className="w-full text-left p-4 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl flex items-center gap-3"><Shuffle size={14} className="text-indigo-500"/> Shuffle</button>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm mb-6">
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">Deck Title</label>
              <input type="text" value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-3xl font-black outline-none border-b-4 border-slate-50 focus:border-blue-500 transition-all pb-2"/>
            </div>
            <div className="space-y-6">
              {activeSet.cards.map((card, i) => (
                <div key={card.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group transition-all">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-200 tracking-widest">CARD {i+1}</span>
                      <button onClick={() => { const nc = [...activeSet.cards]; [nc[i], nc[i-1]] = [nc[i-1], nc[i]]; updateSet(activeSetId, {cards:nc}); }} disabled={i===0} className="text-slate-200 hover:text-blue-500 disabled:opacity-0"><ArrowUp size={16}/></button>
                      <button onClick={() => { const nc = [...activeSet.cards]; [nc[i], nc[i+1]] = [nc[i+1], nc[i]]; updateSet(activeSetId, {cards:nc}); }} disabled={i===activeSet.cards.length-1} className="text-slate-200 hover:text-blue-500 disabled:opacity-0"><ArrowDown size={16}/></button>
                    </div>
                    <button onClick={() => updateSet(activeSetId, { cards: activeSet.cards.filter(c => c.id !== card.id) })} className="text-slate-100 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">Term</label>
                      <input value={card.term} onChange={e => { const nc = [...activeSet.cards]; nc[i].term = e.target.value; updateSet(activeSetId, { cards: nc }); }} className="w-full font-bold text-lg border-b-2 outline-none border-slate-50 focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">Definition</label>
                      <textarea value={card.definition} onChange={e => { const nc = [...activeSet.cards]; nc[i].definition = e.target.value; updateSet(activeSetId, { cards: nc }); }} className="w-full font-medium border-b-2 outline-none border-slate-50 focus:border-blue-500 transition-all resize-none h-10" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => updateSet(activeSetId, { cards: [...activeSet.cards, { id: Math.random().toString(), term: '', definition: '' }] })} className="w-full py-12 border-4 border-dashed border-slate-200 rounded-[3rem] text-slate-300 font-black hover:border-blue-200 hover:text-blue-500 transition-all text-xl flex items-center justify-center gap-4">+ ADD NEW CARD</button>
            </div>
          </div>
        )}

        {view === 'quiz' && (
          <div className="space-y-8 pb-20 animate-in fade-in duration-300">
            {!quizResults ? (
              <>
                <div className="flex justify-between items-center mb-8">
                  <button onClick={() => setView('study')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><ChevronLeft size={16}/> Exit Quiz</button>
                  <span className="text-sm font-black text-indigo-600 flex items-center gap-2"><GraduationCap size={22}/> Assessment</span>
                </div>
                {quizQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">Question {i+1}</div>
                    <p className="text-2xl font-black text-slate-800 mb-10 leading-tight">{q.question}</p>
                    {q.type === 'mc' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, oIdx) => (
                          <button key={opt} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: opt})} className={`p-6 rounded-2xl text-left border-2 flex items-start gap-4 transition-all ${quizAnswers[q.id] === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-50 bg-white text-slate-500 hover:border-slate-200'}`}>
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${quizAnswers[q.id] === opt ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+oIdx)}</span>
                            <span className="font-bold pt-0.5">{opt}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-8 bg-slate-50 rounded-2xl italic text-slate-600 text-xl border-2 border-dashed border-slate-100">"...{q.displayDef}"</div>
                        <div className="flex gap-4">
                          {['True', 'False'].map(opt => (
                            <button key={opt} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: opt})} className={`flex-1 p-6 rounded-2xl font-black text-2xl border-2 transition-all ${quizAnswers[q.id] === opt ? (opt === 'True' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700') : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => {
                  let s = 0; const m = [];
                  quizQuestions.forEach(q => {
                    const ans = quizAnswers[q.id];
                    if (ans === q.correctAnswer) s++;
                    else m.push({ q: q.question, user: ans || 'Skipped', correct: q.correctAnswer });
                  });
                  setQuizResults({ score: s, total: quizQuestions.length, missed: m });
                }} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Submit Assessment</button>
              </>
            ) : (
              <div className="animate-in fade-in zoom-in-95 duration-500 text-center">
                <div className="bg-white p-14 rounded-[4rem] border border-slate-200 shadow-2xl mb-10">
                  <div className="w-48 h-48 rounded-full bg-slate-50 flex flex-col items-center justify-center mx-auto mb-8 border-[10px] border-indigo-50">
                    <span className="text-5xl font-black text-indigo-600">{Math.round((quizResults.score/quizResults.total)*100)}%</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mb-2">{quizResults.score} / {quizResults.total} Correct</h3>
                  <div className="flex gap-4 justify-center mt-12">
                    <button onClick={startQuiz} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 transition-all">Retake Quiz</button>
                    <button onClick={() => setView('study')} className="bg-slate-100 text-slate-600 px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Finish Session</button>
                  </div>
                </div>
                {quizResults.missed.length > 0 && (
                  <div className="space-y-4 text-left">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6 mb-2">Review Knowledge Gaps</h4>
                    {quizResults.missed.map((m, i) => (
                      <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 border-l-[12px] border-l-red-500 shadow-sm">
                        <p className="font-black text-slate-800 text-xl mb-6 leading-tight">{m.q}</p>
                        <div className="grid grid-cols-2 gap-8">
                          <div><span className="font-black uppercase block text-red-400 text-[9px] mb-2 tracking-widest">Your Answer</span><span className="text-red-700 font-bold text-lg">{m.user}</span></div>
                          <div><span className="font-black uppercase block text-green-400 text-[9px] mb-2 tracking-widest">Correct Answer</span><span className="text-green-700 font-bold text-lg">{m.correct}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isImporting && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[3.5rem] p-12 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black text-slate-800">Smart Import</h3>
                <button onClick={() => setIsImporting(false)} className="text-slate-400 hover:text-slate-900"><X size={32}/></button>
              </div>
              <div className="bg-blue-50 p-6 rounded-2xl text-blue-700 text-[11px] font-black uppercase tracking-widest mb-8 leading-relaxed">
                Copy from your notes and paste below.<br/>Expected format: Front: Term Back: Definition
              </div>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Front: Associate licensee Back: A real estate salesperson..." className="w-full h-80 border-2 border-slate-100 rounded-[2rem] p-8 outline-none font-mono text-sm mb-10 focus:border-blue-500 transition-all resize-none shadow-inner" />
              <div className="flex justify-end gap-6 items-center">
                <button onClick={() => setIsImporting(false)} className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleImport} className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all">Import Cards</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </div>
  );
};

export default App;

