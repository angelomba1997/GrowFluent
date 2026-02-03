
import React from 'react';
import { ExamReport, Flashcard, Language } from '../types';
import { uiTranslations } from '../translations';

interface StatisticsViewProps {
  history: ExamReport[];
  cards: Flashcard[];
  currentLang: Language;
  onClose: () => void;
}

const StatisticsView: React.FC<StatisticsViewProps> = ({ history, cards, currentLang, onClose }) => {
  const t = uiTranslations[currentLang];

  const avgAccuracy = history.length > 0 
    ? Math.round((history.reduce((acc, h) => acc + h.accuracy, 0) / history.length) * 100)
    : 0;

  const strongestWords = [...cards]
    .sort((a, b) => b.easinessFactor - a.easinessFactor)
    .slice(0, 5);

  const weakestWords = [...cards]
    .sort((a, b) => a.easinessFactor - b.easinessFactor)
    .slice(0, 5);

  const errorTypes = history.reduce((acc: any, h) => {
    h.results.forEach(r => {
      if (!r.isCorrect && r.errorType) {
        acc[r.errorType] = (acc[r.errorType] || 0) + 1;
      }
    });
    return acc;
  }, {});

  const typeEntries = Object.entries(errorTypes).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t.statsTitle}</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Evolución en {currentLang === Language.ENGLISH ? 'Inglés' : 'Català'}</p>
        </div>
        <button onClick={onClose} className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all"></div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70 block mb-2">{t.globalAccuracy}</span>
          <div className="text-5xl font-black">{avgAccuracy}%</div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-slate-50 flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block mb-2">{t.sessionsPerformed}</span>
          <div className="text-5xl font-black text-slate-800">{history.length}</div>
        </div>
        <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all"></div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70 block mb-2">{t.mastered}</span>
          <div className="text-5xl font-black">{cards.filter(c => c.status === 'mastered').length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100">
          <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mr-4 shadow-sm"><i className="fas fa-crown"></i></div>
            {t.strongestWords}
          </h3>
          <div className="space-y-4">
            {strongestWords.map(c => (
              <div key={c.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-white">
                <span className="font-black text-slate-700">{c.phrase}</span>
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">Dominada</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-red-50">
          <h3 className="text-lg font-black text-red-600 mb-8 flex items-center">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mr-4 shadow-sm"><i className="fas fa-bolt"></i></div>
            {t.weakestWords}
          </h3>
          <div className="space-y-4">
            {weakestWords.map(c => (
              <div key={c.id} className="flex justify-between items-center p-5 bg-red-50/30 rounded-2xl border border-white">
                <span className="font-black text-slate-700">{c.phrase}</span>
                <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">Crítica</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {typeEntries.length > 0 && (
        <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl">
          <h3 className="text-xl font-black mb-8 flex items-center">
            <i className="fas fa-bug mr-4 text-indigo-400"></i> Tipos de Errores Comunes
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             {typeEntries.map(([type, count]: any) => (
               <div key={type} className="bg-white/10 p-5 rounded-2xl text-center border border-white/5 backdrop-blur-sm">
                  <span className="text-[9px] font-black uppercase opacity-50 block mb-2">{type}</span>
                  <div className="text-3xl font-black">{count}</div>
               </div>
             ))}
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100">
        <h3 className="text-xl font-black text-slate-800 mb-8 px-2 flex items-center justify-between">
          <span>{t.historyTitle}</span>
          <i className="fas fa-history text-slate-200"></i>
        </h3>
        <div className="space-y-6">
          {history.length > 0 ? (
            history.map(h => (
              <div key={h.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:bg-slate-100 transition-all cursor-default group">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-600 text-white flex flex-col items-center justify-center font-black shadow-lg shadow-indigo-100 group-hover:scale-105 transition-all">
                    <span className="text-lg">{Math.round(h.accuracy * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-800">{new Date(h.date).toLocaleDateString()}</span>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                      {h.results.length} preguntas • {Math.round(h.totalTimeMs / 1000)}s total
                    </p>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {h.results.slice(0, 6).map((r, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full border-4 border-white flex items-center justify-center text-[10px] text-white shadow-sm ${r.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                      <i className={`fas ${r.isCorrect ? 'fa-check' : 'fa-times'}`}></i>
                    </div>
                  ))}
                  {h.results.length > 6 && (
                    <div className="w-8 h-8 rounded-full border-4 border-white bg-slate-200 text-slate-500 text-[10px] flex items-center justify-center font-black">
                      +{h.results.length - 6}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-100">
              <i className="fas fa-ghost text-4xl text-slate-200 mb-4"></i>
              <p className="text-slate-400 font-bold italic">{t.historyEmpty}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticsView;
