import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Trash2, ChevronLeft, ChevronRight, BrainCircuit, GraduationCap, Play, Search, Cloud, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';

// Your Specific Firebase Config
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
  const [activeSetId, setActiveSetId] = useState(null);
  const [view, setView] = useState('library'); 
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [frontFirst, setFrontFirst] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);

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

  const handleSave = async (op) => {
    setSyncing(true);
    try { await op(); } finally { setTimeout(() => setSyncing(false), 800); }
  };

  const createSet = () => handleSave(async () => {
    const docRef = await addDoc(collection(db, 'studySets'), {
      title: 'New Set', cards: [], updatedAt: Date.now(), owner: user.uid
    });
    setActiveSetId(docRef.id);
    setView('edit');
  });

  const updateSet = (id, data) => handleSave(async () => {
    await updateDoc(doc(db, 'studySets', id), { ...data, updatedAt: Date.now() });
  });

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white" onClick={() => setView('library')}><BrainCircuit size={20} /></div>
          {syncing ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <Cloud size={14} className="text-emerald-500" />}
        </div>
        <button onClick={createSet} className="bg-blue-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase">New Set</button>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {view === 'library' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Library</h2>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Search..." className="bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm w-40 md:w-64" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sets.filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase())).map(set => (
                <div key={set.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm" onClick={() => { setActiveSetId(set.id); setView('study'); }}>
                  <div className="flex justify-between mb-4"><h3 className="font-black text-lg">{set.title}</h3><button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'studySets', set.id)); }} className="text-slate-100 hover:text-red-500"><Trash2 size={18}/></button></div>
                  <div className="flex gap-2"><button className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl text-[10px] font-black uppercase">Study</button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'study' && activeSet && (
          <div className="max-w-xl mx-auto">
             <button onClick={() => setView('library')} className="mb-6 text-slate-400 font-black text-xs uppercase flex items-center gap-1"><ChevronLeft size={16}/> Library</button>
             <div className="w-full aspect-[16/10] relative cursor-pointer mb-10" onClick={() => setIsFlipped(!isFlipped)}>
                <div className="w-full h-full bg-white rounded-[2.5rem] border-b-8 border-slate-200 shadow-xl flex items-center justify-center p-8 text-center overflow-y-auto">
                  <p className="text-2xl font-black">{isFlipped ? activeSet.cards[currentCardIndex]?.definition : activeSet.cards[currentCardIndex]?.term}</p>
                </div>
             </div>
             <div className="flex items-center justify-center gap-10">
                <button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p - 1 + (activeSet.cards?.length || 1)) % (activeSet.cards?.length || 1)); }} className="p-4 bg-white rounded-full shadow"><ChevronLeft size={32}/></button>
                <button onClick={() => { setIsFlipped(false); setCurrentCardIndex(p => (p + 1) % (activeSet.cards?.length || 1)); }} className="p-4 bg-white rounded-full shadow"><ChevronRight size={32}/></button>
             </div>
          </div>
        )}

        {view === 'edit' && activeSet && (
          <div className="space-y-4">
            <button onClick={() => setView('study')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black uppercase text-xs">Save Deck</button>
            <input value={activeSet.title} onChange={e => updateSet(activeSetId, { title: e.target.value })} className="w-full text-3xl font-black bg-transparent border-b-4 border-slate-100 outline-none pb-2 mb-6" />
            {activeSet.cards?.map((card, i) => (
              <div key={card.id} className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
                <input value={card.term} onChange={e => { const nc = [...activeSet.cards]; nc[i].term = e.target.value; updateSet(activeSetId, { cards: nc }); }} className="w-full font-bold border-b outline-none" placeholder="Term" />
                <textarea value={card.definition} onChange={e => { const nc = [...activeSet.cards]; nc[i].definition = e.target.value; updateSet(activeSetId, { cards: nc }); }} className="w-full outline-none resize-none h-20" placeholder="Definition" />
              </div>
            ))}
            <button onClick={() => updateSet(activeSetId, { cards: [...(activeSet.cards || []), { id: Math.random().toString(), term: '', definition: '' }] })} className="w-full py-10 border-4 border-dashed border-slate-200 rounded-3xl text-slate-300 font-black">+ ADD CARD</button>
          </div>
        )}
      </main>
    </div>
  );
}

