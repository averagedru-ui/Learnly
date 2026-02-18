import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { 
  Trash2, ChevronLeft, ChevronRight, BrainCircuit, GraduationCap, 
  Play, Search, Cloud, RefreshCw, X, Plus, Upload, 
  LayoutGrid, CheckCircle2, RotateCcw
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyDXSozkHRE0Agg9-uNmrxGAWiU9MtsaS-c",
  authDomain: "learnly-bb0da.firebaseapp.com",
  projectId: "learnly-bb0da",
  storageBucket: "learnly-bb0da.firebasestorage.app",
  messagingSenderId: "77667151804",
  appId: "1:77667151804:web:374ab4a0961d1af18f85b9",
  measurementId: "G-QGZDW8VJ6J"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [sets, setSets] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [syncing, setSyncing] = useState(false);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setStatus('ready'); } 
      else { signInAnonymously(auth).catch(() => setStatus('error')); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'studySets'), (snapshot) => {
      setSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId), [sets, activeSetId]);
  const filteredSets = sets.filter(s => s.type === activeTab && s.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSave = async (op) => {
    setSyncing(true);
    try { await op(); } finally { setTimeout(() => setSyncing(false), 800); }
  };

  const createSet = () => handleSave(async () => {
    const docRef = await addDoc(collection(db, 'studySets'), {
      title: activeTab === 'flashcards' ? 'New Deck' : 'New Quiz',
      type: activeTab,
      items: [],
      updatedAt: Date.now(),
      owner: user.uid
    });
    setActiveSetId(docRef.id);
    setView('edit');
  });

  const updateSet = (id, data) => handleSave(async () => {
    await updateDoc(doc(db, 'studySets', id), { ...data, updatedAt: Date.now() });
  });

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
    if (!activeSet?.items) return;
    let items = onlyMissed ? activeSet.items.filter(it => quizResults.missedIds.includes(it.id)) : activeSet.items;
    setQuizQuestions([...items].sort(() => 0.5 - Math.random()));
    setQuizAnswers({});
    setQuizResults(null);
    setIsRetakingMissed(onlyMissed);
    setView('quiz');
  };

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center bg-white font-bold text-slate-400">Syncing...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('library')}>
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-lg"><BrainCircuit size={20} /></div>
          <span className="font-black text-xl tracking-tighter">LEARNLY</span>
        </div>
        <div className="flex items-center gap-4">
          {syncing ? <RefreshCw size={14} className="animate-spin text-indigo-500" /> : <Cloud size={14} className="text-emerald-500" />}
          <button onClick={createSet} className="bg-indigo-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">+ {activeTab === 'flashcards' ? 'Deck' : 'Quiz'}</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'library' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex bg-slate-200/50 p-1 rounded-2xl mb-8 max-w-sm mx-auto">
              <button onClick={() => setActiveTab('flashcards')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Flashcards</button>
              <button onClick={() => setActiveTab('quizzes')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'quizzes' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Exams</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSets.map(set => (
                <div key={set.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer" onClick={() => { setActiveSetId(set.id); setView(activeTab === 'flashcards' ? 'study' : 'quiz-ready'); setCurrentCardIndex(0); if(activeTab === 'quizzes') startQuiz(false); }}>
                  <div className="flex justify-between items-start mb-2"><h3 className="text-lg font-black">{set.title}</h3><button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'studySets', set.id)); }} className="text-slate-100 hover:text-red-500"><Trash2 size={18}/></button></div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{set.items?.length || 0} items</span>
                  <div className="mt-8 flex gap-3"><button className="flex-1 bg-indigo-50 text-indigo-600 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">Open</button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'study' && activeSet && (
          <div className="max-w-xl mx-auto text-center animate-in zoom-in-95">
            <div className="flex justify-between mb-8"><button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase flex items-center gap-2"><ChevronLeft size={16}/> Back</button><button onClick={() => setView('edit')} className="text-indigo-600 font-black text-[10px] uppercase">Edit</button></div>
            <div className="aspect-[16/10] relative perspective-1000 cursor-pointer mb-10" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`w-full h-full relative transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-b-8 border-slate-200 shadow-2xl flex items-center justify-center p-12 text-3xl font-black">{activeSet.items[currentCardIndex]?.term}</div>
                <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] border-b-8 border-slate-200 shadow-2xl flex items-center justify-center p-12 text-xl font-medium rotate-y-180 text-indigo-700 leading-relaxed">{activeSet.items[currentCardIndex]?.definition}</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-10">
              <button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p - 1 + activeSet.items.length) % activeSet.items.length); }} className="p-5 bg-white rounded-full shadow-lg"><ChevronLeft size={32}/></button>
              <button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p + 1) % activeSet.items.length); }} className="p-5 bg-white rounded-full shadow-lg"><ChevronRight size={32}/></button>
            </div>
          </div>
        )}

        {view === 'quiz' && activeSet && (
          <div className="space-y-6">
            {!quizResults ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <button onClick={() => setView('library')} className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Quit</button>
                  {isRetakingMissed && <span className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Retaking Missed</span>}
                </div>
                {quizQuestions.map((q, i) => (
                  <div key={q.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm mb-6">
                    <p className="text-2xl font-black text-slate-800 mb-8">{q.question}</p>
                    {q.type === 'mc' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {['a', 'b', 'c', 'd'].map(key => (
                          <button key={key} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: key})} className={`p-6 rounded-2xl text-left border-2 flex items-start gap-4 transition-all ${quizAnswers[q.id] === key ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-50 bg-white text-slate-500'}`}><span className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black bg-slate-100 uppercase">{key}</span><span className="font-bold">{q.options[key]}</span></button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        {['true', 'false'].map(opt => (
                          <button key={opt} onClick={() => setQuizAnswers({...quizAnswers, [q.id]: opt})} className={`flex-1 p-6 rounded-2xl font-black text-2xl border-2 capitalize ${quizAnswers[q.id] === opt ? 'bg-indigo-50 border-indigo-600' : 'bg-white'}`}>{opt}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => {
                  let score = 0; const missed = [], missedIds = [];
                  quizQuestions.forEach(q => {
                    if (quizAnswers[q.id] === q.correctAnswer) score++;
                    else { missedIds.push(q.id); missed.push({ q: q.question, user: quizAnswers[q.id] || 'None', correct: q.correctAnswer, options: q.options }); }
                  });
                  setQuizResults({ score, total: quizQuestions.length, missed, missedIds });
                }} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-xl">Finish Exam</button>
              </>
            ) : (
              <div className="text-center animate-in zoom-in-95">
                <div className="bg-white p-14 rounded-[4rem] border border-slate-200 shadow-2xl mb-10">
                  <div className="w-48 h-48 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-8 text-5xl font-black text-indigo-600">{Math.round((quizResults.score/quizResults.total)*100)}%</div>
                  <h3 className="text-3xl font-black text-slate-800 mb-8">{quizResults.score} / {quizResults.total} Correct</h3>
                  <div className="flex gap-4 justify-center">
                    {quizResults.missed.length > 0 && <button onClick={() => startQuiz(true)} className="bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2"><RotateCcw size={16}/> Retake Missed</button>}
                    <button onClick={() => setView('library')} className="bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-black text-[10px] uppercase">Done</button>
                  </div>
                </div>
                {quizResults.missed.map((m, i) => (
                  <div key={i} className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-red-500 shadow-sm text-left mb-4">
                    <p className="font-black text-slate-800 text-xl mb-4">{m.q}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase tracking-widest"><div className="text-red-500">You: {m.user}</div><div className="text-green-600">Correct: {m.correct}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'edit' && activeSet && (
          <div className="pb-20 animate-in fade-in">
            <div className="flex justify-between items-center mb-8 sticky top-20 bg-slate-50 py-4 z-40 border-b border-slate-200">
              <button onClick={() => setView('library')} className="text-slate-400"><ChevronLeft size={24}/></button>
              <div className="flex gap-2"><button onClick={() => setIsImporting(true)} className="bg-white border border-slate-200 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Upload size={14}/> Import</button><button onClick={() => setView('library')} className="bg-indigo-600 text-white px-8 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Done</button></div>
            </div>
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm mb-6"><label className="text-[10px] font-black text-slate-300 uppercase block mb-2">Title</label><input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-3xl font-black outline-none border-b-4 border-slate-50 focus:border-indigo-500 transition-all pb-2"/></div>
            <div className="space-y-6">
              {(activeSet.items || []).map((item, i) => (
                <div key={item.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
                  <div className="flex justify-between mb-8"><span className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Item {i+1}</span><button onClick={() => updateSet(activeSetId, { items: activeSet.items.filter(it => it.id !== item.id) })} className="text-slate-100 hover:text-red-500 transition-colors"><Trash2 size={20}/></button></div>
                  {activeTab === 'flashcards' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div><label className="text-[10px] font-black text-slate-300 uppercase block mb-2 tracking-widest">Term</label><input value={item.term} onChange={e => { const ni = [...activeSet.items]; ni[i].term = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-bold text-lg border-b-2 outline-none border-slate-50 focus:border-indigo-500 pb-2" /></div>
                      <div><label className="text-[10px] font-black text-slate-300 uppercase block mb-2 tracking-widest">Explanation</label><textarea value={item.definition} onChange={e => { const ni = [...activeSet.items]; ni[i].definition = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full font-medium border-b-2 outline-none border-slate-50 focus:border-indigo-500 resize-none h-12" /></div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                       <div><div className="flex justify-between items-center mb-4"><label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Question</label><div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner"><button onClick={() => { const ni = [...activeSet.items]; ni[i].type = 'mc'; ni[i].options = {a:'',b:'',c:'',d:''}; updateSet(activeSetId, {items:ni}); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${item.type==='mc' ? 'bg-white shadow-md text-indigo-600':'text-slate-400'}`}>MC</button><button onClick={() => { const ni = [...activeSet.items]; ni[i].type = 'tf'; ni[i].correctAnswer = 'true'; updateSet(activeSetId, {items:ni}); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${item.type==='tf' ? 'bg-white shadow-md text-indigo-600':'text-slate-400'}`}>T/F</button></div></div><textarea value={item.question} onChange={e => { const ni = [...activeSet.items]; ni[i].question = e.target.value; updateSet(activeSetId, { items: ni }); }} className="w-full text-2xl font-black border-b-2 border-slate-50 outline-none focus:border-indigo-500 resize-none h-24 p-2" /></div>
                       {item.type === 'mc' ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{['a', 'b', 'c', 'd'].map(key => (
                              <div key={key} className="relative pl-6"><div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-full ${item.correctAnswer === key ? 'bg-indigo-600 shadow-lg shadow-indigo-100':'bg-slate-100'}`} /><label className="text-[10px] font-black text-slate-300 uppercase mb-2 block flex justify-between items-center">Option {key.toUpperCase()}<button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = key; updateSet(activeSetId, {items:ni}); }} className={`text-[9px] font-black py-1 px-3 rounded-lg transition-all ${item.correctAnswer === key ? 'bg-indigo-600 text-white shadow-md':'bg-slate-50 text-slate-300'}`}>{item.correctAnswer === key ? 'CORRECT' : 'SET AS KEY'}</button></label><input value={item.options[key]} onChange={e => { const ni = [...activeSet.items]; ni[i].options[key] = e.target.value; updateSet(activeSetId, { items: ni }); }} className={`w-full font-bold outline-none border-b-2 transition-all py-1 ${item.correctAnswer === key ? 'border-indigo-100 text-indigo-800':'border-slate-50 text-slate-500'}`} /></div>
                            ))}</div>
                       ) : (
                         <div className="flex gap-4"><button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = 'true'; updateSet(activeSetId, {items:ni}); }} className={`flex-1 py-6 rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 transition-all ${item.correctAnswer === 'true' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-inner' : 'border-slate-100 text-slate-300 hover:border-slate-200'}`}>Correct: TRUE</button><button onClick={() => { const ni = [...activeSet.items]; ni[i].correctAnswer = 'false'; updateSet(activeSetId, {items:ni}); }} className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 transition-all ${item.correctAnswer === 'false' ? 'border-red-500 bg-red-50 text-red-700 shadow-inner' : 'border-slate-100 text-slate-300'}`}>Correct: FALSE</button></div>
                       )}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => updateSet(activeSetId, { items: [...(activeSet.items || []), activeTab === 'flashcards' ? { id: Math.random().toString(), term: '', definition: '' } : { id: Math.random().toString(), type: 'mc', question: '', options: {a:'',b:'',c:'',d:''}, correctAnswer: 'a' }] })} className="w-full py-16 border-4 border-dashed border-slate-200 rounded-[4rem] text-slate-200 font-black hover:border-indigo-200 hover:text-indigo-500 transition-all text-2xl flex items-center justify-center gap-4 active:scale-95"><Plus size={32}/> NEW ITEM</button>
            </div>
          </div>
        )}

        {isImporting && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[3.5rem] p-10 shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8"><h3 className="text-3xl font-black text-slate-800">Smart Import</h3><button onClick={() => setIsImporting(false)} className="text-slate-300"><X size={32}/></button></div>
              <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder={activeTab === 'flashcards' ? "Front: Term Back: Def" : "Q: 1+1?\nA: 1\nB: 2\nC: 3\nD: 4\nAns: B"} className="w-full h-80 border-2 border-slate-100 rounded-[2rem] p-8 outline-none font-mono text-xs mb-10 focus:border-indigo-500 transition-all resize-none shadow-inner" />
              <div className="flex justify-end gap-6 items-center"><button onClick={() => setIsImporting(false)} className="text-slate-400 font-black text-[10px] uppercase">Cancel</button><button onClick={handleImport} className="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">Import</button></div>
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
}

