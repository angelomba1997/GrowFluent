
import React from 'react';
import { ExamReport, Flashcard, Language } from '../types';
import { uiTranslations } from '../translations';

interface ExamReportProps {
  report: ExamReport;
  cards: Flashcard[];
  onClose: () => void;
  lang: Language;
}

const ExamReportView: React.FC<ExamReportProps> = ({ report, cards, onClose, lang }) => {
  const t = uiTranslations[lang];
  const score = Math.round(report.accuracy * 100);
  const timeSec = Math.round(report.totalTimeMs / 1000);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="bg-white rounded-3xl p-10 shadow-2xl border-2 border-indigo-50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 via-indigo-500 to-purple-500"></div>
        <div className="mb-8 text-center">
          <div className="w-24 h-24 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-xl shadow-indigo-100"><i className="fas fa-trophy"></i></div>
          <h2 className="text-3xl font-black text-slate-900">{t.examCompleted}</h2>
          <p className="text-slate-400 font-medium mt-1">{t.analyzedWords}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-50 p-6 rounded-3xl">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">{t.accuracy}</span>
            <div className="text-4xl font-black text-indigo-600">{score}%</div>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">{t.time}</span>
            <div className="text-4xl font-black text-slate-800">{timeSec}<span className="text-sm">s</span></div>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">{t.speed}</span>
            <div className="text-4xl font-black text-green-500">{(report.speedScore / 1000).toFixed(1)}<span className="text-sm">s/p</span></div>
          </div>
        </div>

        <div className="space-y-4 text-left max-w-lg mx-auto">
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">{t.tutorRecs}</h4>
          {report.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start space-x-3 text-slate-700">
              <i className="fas fa-check-circle text-indigo-500 mt-1"></i>
              <p className="text-sm font-medium leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-12 w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
          {t.saveAndContinue}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border-2 border-red-50">
          <h3 className="text-red-500 font-black text-sm uppercase tracking-widest mb-4">{t.weakPoints}</h3>
          <div className="space-y-2">
            {report.weakIds.map(id => {
              const card = cards.find(c => c.id === id);
              return <div key={id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl"><span className="font-bold text-slate-800">{card?.phrase}</span></div>;
            })}
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border-2 border-green-50">
          <h3 className="text-green-500 font-black text-sm uppercase tracking-widest mb-4">{t.mastered}</h3>
          <div className="space-y-2">
            {report.masteredIds.map(id => {
              const card = cards.find(c => c.id === id);
              return <div key={id} className="flex justify-between items-center p-3 bg-green-50/50 rounded-xl"><span className="font-bold text-slate-800">{card?.phrase}</span><i className="fas fa-star text-yellow-400 text-xs"></i></div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamReportView;
