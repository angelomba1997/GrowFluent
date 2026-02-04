
import React, { useState, useEffect, useMemo } from 'react';
import { Language, Flashcard, ExamReport, PracticeResult } from './types.ts';
import { translatePhrase } from './services/geminiService.ts';
import { firebaseService } from './services/firebaseService.ts';
import { uiTranslations } from './translations.ts';
import Layout from './components/Layout.tsx';
import PhraseInput from './components/PhraseInput.tsx';
import FlashcardItem from './components/FlashcardItem.tsx';
import PracticeMode from './components/PracticeMode.tsx';
import ExamMode from './components/ExamMode.tsx';
import ExamReportView from './components/ExamReport.tsx';
import MasteryLab from './components/MasteryLab.tsx';
import StatisticsView from './components/StatisticsView.tsx';
import LiveTutor from './components/LiveTutor.tsx';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Language>(Language.ENGLISH);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [examHistory, setExamHistory] = useState<ExamReport[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isLoadingAdd, setIsLoadingAdd] = useState(false);
  
  // Navigation & Session States
  const [isPracticing, setIsPracticing] = useState(false);
  const [isFreePracticing, setIsFreePracticing] = useState(false);
  const [isExamining, setIsExamining] = useState(false);
  const [isViewingStats, setIsViewingStats] = useState(false);
  const [isLiveTutorOpen, setIsLiveTutorOpen] = useState(false);
  const [masteryCard, setMasteryCard] = useState<Flashcard | null>(null);
  const [examReport, setExamReport] = useState<ExamReport | null>(null);
  const [showMasterySelector, setShowMasterySelector] = useState(false);
  
  // Search & Sort States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'date' | 'alphabetical'>('date');
  
  // Stable session cards
  const [currentSessionCards, setCurrentSessionCards] = useState<Flashcard[]>([]);

  const t = uiTranslations[activeTab];

  useEffect(() => {
    const initData = async () => {
      setIsLoadingCards(true);
      try {
        const [firebaseCards, firebaseHistory] = await Promise.all([
          firebaseService.getCards(),
          firebaseService.getExamHistory()
        ]);
        setCards(firebaseCards || []);
        setExamHistory(firebaseHistory || []);
      } catch (e) {
        console.error("Error cargando datos:", e);
      } finally {
        setIsLoadingCards(false);
      }
    };
    initData();
  }, []);

  const calculateNextSRS = (card: Flashcard, isCorrect: boolean): Flashcard => {
    let { repetitionCount, easinessFactor, lastInterval } = card;
    let newInterval = 1;
    
    if (isCorrect) {
      if (repetitionCount === 0) newInterval = 1;
      else if (repetitionCount === 1) newInterval = 6;
      else newInterval = Math.round(lastInterval * easinessFactor * 1.5);
      repetitionCount += 1;
      easinessFactor = Math.min(3.5, easinessFactor + 0.1);
    } else {
      repetitionCount = 0;
      newInterval = 1;
      easinessFactor = Math.max(1.3, easinessFactor - 0.2);
    }

    const dayInMs = 24 * 60 * 60 * 1000;
    const updatedCard: Flashcard = {
      ...card,
      status: (newInterval > 21 ? 'mastered' : 'learning') as any,
      timesReviewed: card.timesReviewed + 1,
      successCount: card.successCount + (isCorrect ? 1 : 0),
      failureCount: card.failureCount + (isCorrect ? 0 : 1),
      repetitionCount,
      easinessFactor,
      lastInterval: newInterval,
      nextReviewAt: Date.now() + (newInterval * dayInMs)
    };
    
    firebaseService.saveCard(updatedCard).catch(console.error);
    return updatedCard;
  };

  const handleAddPhrase = async (phrase: string) => {
    setIsLoadingAdd(true);
    try {
      const data = await translatePhrase(phrase, activeTab);
      
      const newCard: Flashcard = {
        id: crypto.randomUUID(),
        phrase,
        ...data,
        language: activeTab,
        createdAt: Date.now(),
        nextReviewAt: Date.now(),
        lastInterval: 0,
        repetitionCount: 0,
        easinessFactor: 2.5,
        status: 'new',
        timesReviewed: 0,
        successCount: 0,
        failureCount: 0,
        pronunciationHistory: [],
        sentenceHistory: []
      };
      
      await firebaseService.saveCard(newCard);
      setCards(prev => [newCard, ...prev]);
    } catch (error: any) {
      console.error("Error al añadir frase:", error);
      alert("Hubo un error al procesar la palabra. Por favor intenta de nuevo.");
    } finally {
      setIsLoadingAdd(false);
    }
  };

  const handleExamFinish = async (report: ExamReport) => {
    await firebaseService.addExamReport(report);
    setExamHistory(prev => [report, ...prev]);
    setExamReport(report);
    setIsExamining(false);
    
    setCards(prev => prev.map(card => {
      const result = report.results.find(r => r.cardId === card.id);
      if (result) return calculateNextSRS(card, result.isCorrect);
      return card;
    }));
  };

  const handlePracticeFinish = (result: PracticeResult) => {
    setCards(prev => prev.map(card => 
      card.id === result.cardId ? calculateNextSRS(card, result.isCorrect) : card
    ));
  };

  const handleDeleteCard = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta palabra de tu diccionario?")) {
      try {
        await firebaseService.removeCard(id);
        setCards(prev => prev.filter(c => c.id !== id));
      } catch (e) {
        console.error("Error eliminando tarjeta:", e);
      }
    }
  };

  const currentTabCards = useMemo(() => cards.filter(c => c.language === activeTab), [cards, activeTab]);

  const filteredDictionaryCards = useMemo(() => {
    let filtered = [...currentTabCards];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.phrase.toLowerCase().includes(term) || 
        c.translation.toLowerCase().includes(term)
      );
    }
    return filtered.sort((a, b) => {
      if (sortOrder === 'alphabetical') return a.phrase.localeCompare(b.phrase);
      return b.createdAt - a.createdAt;
    });
  }, [currentTabCards, searchTerm, sortOrder]);
  
  const overdueCardsForToday = useMemo(() => {
    const now = Date.now();
    const overdue = currentTabCards
      .filter(c => now >= c.nextReviewAt)
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt);

    const brandNew = currentTabCards
      .filter(c => c.repetitionCount === 0 && !overdue.find(o => o.id === c.id))
      .sort((a, b) => b.createdAt - a.createdAt);

    return [...overdue, ...brandNew].slice(0, 15);
  }, [currentTabCards]);

  const startDailySession = () => {
    if (overdueCardsForToday.length > 0) {
      setCurrentSessionCards([...overdueCardsForToday]);
      setIsPracticing(true);
    }
  };

  const startFreePractice = () => {
    if (currentTabCards.length > 0) {
      setCurrentSessionCards([...currentTabCards].sort(() => 0.5 - Math.random()).slice(0, 10));
      setIsFreePracticing(true);
    }
  };

  const startExam = () => {
    const sorted = [...currentTabCards];
    const newOnes = sorted.filter(c => c.status === 'new').sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
    const weakOnes = sorted.filter(c => c.easinessFactor < 2.2).sort((a,b) => a.easinessFactor - b.easinessFactor).slice(0, 5);
    const masteryReview = sorted.filter(c => c.status === 'mastered').sort(() => 0.5 - Math.random()).slice(0, 5);
    const combined = [...new Set([...newOnes, ...weakOnes, ...masteryReview])];
    if (combined.length < 10 && sorted.length > combined.length) {
      const extras = sorted.filter(c => !combined.find(x => x.id === c.id)).sort(() => 0.5 - Math.random()).slice(0, 10 - combined.length);
      combined.push(...extras);
    }
    setCurrentSessionCards(combined.slice(0, 15));
    setIsExamining(true);
  };

  const masteredCards = useMemo(() => currentTabCards.filter(c => c.status === 'mastered'), [currentTabCards]);

  const resetViews = () => {
    setIsViewingStats(false);
    setIsPracticing(false);
    setIsExamining(false);
    setIsFreePracticing(false);
    setIsLiveTutorOpen(false);
    setMasteryCard(null);
    setShowMasterySelector(false);
    setSearchTerm('');
  };

  return (
    <Layout currentLang={activeTab}>
      <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-8 relative">
        <button 
          onClick={() => { setActiveTab(Language.ENGLISH); resetViews(); }} 
          className={`flex-1 flex items-center justify-center py-3 rounded-xl font-bold transition-all ${activeTab === Language.ENGLISH ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <span className="mr-2 text-xl">🇺🇸</span> <span className="hidden sm:inline">English</span>
        </button>
        <button 
          onClick={() => { setActiveTab(Language.CATALAN); resetViews(); }} 
          className={`flex-1 flex items-center justify-center py-3 rounded-xl font-bold transition-all ${activeTab === Language.CATALAN ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <span className="mr-2 text-xl">🚩</span> <span className="hidden sm:inline">Català</span>
        </button>
        <button 
          onClick={() => { setActiveTab(Language.FRENCH); resetViews(); }} 
          className={`flex-1 flex items-center justify-center py-3 rounded-xl font-bold transition-all ${activeTab === Language.FRENCH ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <span className="mr-2 text-xl">🇫🇷</span> <span className="hidden sm:inline">Français</span>
        </button>
      </div>

      {isLoadingCards ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <i className="fas fa-circle-notch fa-spin text-4xl text-indigo-500"></i>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Sincronizando con la Nube...</p>
        </div>
      ) : !isPracticing && !isExamining && !examReport && !masteryCard && !showMasterySelector && !isViewingStats && !isFreePracticing && !isLiveTutorOpen ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <button 
              onClick={startDailySession} 
              className={`p-6 rounded-[2.5rem] flex flex-col items-center transition-all hover:scale-[1.02] border-4 ${overdueCardsForToday.length > 0 ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-default'}`}
            >
              <div className="text-4xl font-black mb-1">{overdueCardsForToday.length}</div>
              <p className="font-bold opacity-80 mb-4 text-[9px] uppercase tracking-widest">{t.wordsReady}</p>
              <div className={`px-6 py-2 rounded-full text-[10px] font-black ${overdueCardsForToday.length > 0 ? 'bg-white/20' : 'bg-slate-200'}`}>{t.startSession}</div>
            </button>

            <button 
              onClick={startExam} 
              disabled={currentTabCards.length < 5}
              className={`p-6 rounded-[2.5rem] flex flex-col items-center transition-all hover:scale-[1.02] border-4 ${currentTabCards.length < 5 ? 'bg-slate-50 text-slate-300 border-dashed border-slate-200' : 'bg-violet-600 text-white border-violet-500 shadow-xl'}`}
            >
              <i className="fas fa-award text-4xl mb-2 opacity-30"></i>
              <div className="text-xl font-black">{t.weeklyChallenge}</div>
              <p className="text-[9px] opacity-70 mt-1 uppercase tracking-widest font-black text-center">{t.examSub}</p>
            </button>

            <button 
              onClick={() => setIsLiveTutorOpen(true)}
              className="p-6 rounded-[2.5rem] bg-slate-900 border-4 border-slate-800 text-white flex flex-col items-center transition-all hover:scale-[1.02] shadow-xl"
            >
              <i className="fas fa-headset text-4xl mb-2 text-indigo-400"></i>
              <div className="text-xl font-black">Tutor de Voz</div>
              <p className="text-[9px] opacity-70 mt-1 uppercase tracking-widest font-black">Práctica Inmersiva</p>
            </button>

            <button 
              onClick={() => setIsViewingStats(true)}
              className="p-6 rounded-[2.5rem] bg-white border-4 border-slate-100 flex flex-col items-center transition-all hover:scale-[1.02] shadow-sm hover:border-indigo-200"
            >
              <i className="fas fa-chart-line text-4xl mb-2 text-indigo-400"></i>
              <div className="text-xl font-black text-slate-800">{t.statsTitle}</div>
              <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-black">{t.viewHistory}</p>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <button 
              onClick={startFreePractice}
              disabled={currentTabCards.length === 0}
              className={`p-6 rounded-[2.5rem] border-4 transition-all hover:scale-[1.02] flex items-center space-x-6 ${currentTabCards.length === 0 ? 'bg-slate-50 border-slate-100 text-slate-300' : 'bg-white text-slate-800 border-slate-100 shadow-sm'}`}
            >
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl"><i className="fas fa-play"></i></div>
              <div className="text-left">
                <div className="text-lg font-black">{t.freePractice}</div>
                <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">{t.practiceSub}</p>
              </div>
            </button>

            <button 
              onClick={() => masteredCards.length > 0 && setShowMasterySelector(true)}
              disabled={masteredCards.length === 0}
              className={`p-6 rounded-[2.5rem] border-4 transition-all hover:scale-[1.02] flex items-center space-x-6 ${masteredCards.length === 0 ? 'bg-slate-50 border-slate-100 text-slate-300' : 'bg-emerald-600 text-white border-emerald-500 shadow-xl'}`}
            >
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl"><i className="fas fa-microscope"></i></div>
              <div className="text-left">
                <div className="text-lg font-black">{t.labTitle}</div>
                <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">{t.labSub}</p>
              </div>
            </button>
          </div>

          <PhraseInput onAdd={handleAddPhrase} isLoading={isLoadingAdd} currentLang={activeTab} />
          
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <h2 className="text-xl font-black text-slate-800 flex items-center whitespace-nowrap">
                {t.dictionary}
                <span className="ml-3 text-xs text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-full">{currentTabCards.length} {t.total}</span>
              </h2>
              
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium text-slate-700 bg-white shadow-sm"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                      <i className="fas fa-times-circle"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredDictionaryCards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDictionaryCards.map(card => (
                  <FlashcardItem key={card.id} card={card} onDelete={handleDeleteCard} onOpenMastery={c => setMasteryCard(c)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-4 border-dashed border-slate-50">
                <i className="fas fa-search text-4xl text-slate-100 mb-4"></i>
                <p className="text-slate-400 font-bold italic">{searchTerm ? (activeTab === Language.FRENCH ? 'Aucun résultat trouvé' : 'Sin resultados') : t.emptyDict}</p>
              </div>
            )}
          </div>
        </>
      ) : isLiveTutorOpen ? (
        <LiveTutor currentLang={activeTab} onClose={() => setIsLiveTutorOpen(false)} />
      ) : showMasterySelector ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <button onClick={() => setShowMasterySelector(false)} className="px-6 py-3 bg-white rounded-2xl shadow-sm text-slate-600 font-bold border hover:bg-slate-50 transition-colors"><i className="fas fa-arrow-left mr-2"></i> {t.backToDashboard}</button>
          <div className="bg-white rounded-[2.5rem] p-10 border-4 border-emerald-100 shadow-2xl">
            <div className="mb-8 text-center">
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-100"><i className="fas fa-microscope text-3xl"></i></div>
              <h2 className="text-2xl font-black text-slate-800">{t.labSelection}</h2>
              <p className="text-slate-500 font-medium">{t.labSelectionSub}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {masteredCards.map(card => (
                <button key={card.id} onClick={() => { setMasteryCard(card); setShowMasterySelector(false); }} className="flex items-center justify-between p-6 rounded-[1.5rem] border-2 border-slate-50 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group">
                  <div>
                    <span className="text-xl font-black text-slate-800 block mb-1">{card.phrase}</span>
                    <span className="text-sm text-slate-500 font-medium italic">"{card.translation}"</span>
                  </div>
                  <i className="fas fa-arrow-right text-slate-200 group-hover:text-emerald-500 transition-all transform group-hover:translate-x-1"></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : isViewingStats ? (
        <StatisticsView history={examHistory.filter(h => h.language === activeTab)} cards={currentTabCards} currentLang={activeTab} onClose={() => setIsViewingStats(false)} />
      ) : isExamining ? (
        <ExamMode cards={currentSessionCards} currentLang={activeTab} onFinish={handleExamFinish} onClose={() => {setIsExamining(false); setCurrentSessionCards([]);}} />
      ) : examReport ? (
        <ExamReportView report={examReport} cards={cards} onClose={() => setExamReport(null)} lang={activeTab} />
      ) : isPracticing || isFreePracticing ? (
        <div className="space-y-6">
          <button onClick={() => {setIsPracticing(false); setIsFreePracticing(false); setCurrentSessionCards([]);}} className="px-6 py-3 bg-white rounded-2xl shadow-sm text-slate-600 font-bold border hover:bg-slate-50 transition-colors"><i className="fas fa-times mr-2"></i> {t.abandonSession}</button>
          <PracticeMode 
            cards={currentSessionCards} 
            currentLang={activeTab} 
            onFinish={handlePracticeFinish} 
            onClose={() => {setIsPracticing(false); setIsFreePracticing(false); setCurrentSessionCards([]);}} 
          />
        </div>
      ) : masteryCard ? (
        <div className="space-y-6">
          <button onClick={() => setMasteryCard(null)} className="px-6 py-3 bg-white rounded-2xl shadow-sm text-slate-600 font-bold border hover:bg-slate-50 transition-colors"><i className="fas fa-arrow-left mr-2"></i> {t.backToDashboard}</button>
          <MasteryLab card={masteryCard} onSentenceAdded={() => {}} onClose={() => setMasteryCard(null)} currentLang={activeTab} />
        </div>
      ) : null}
    </Layout>
  );
};

export default App;
