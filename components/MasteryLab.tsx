
import React, { useState } from 'react';
import { Flashcard, Language, SentenceEvaluation, SentenceEntry } from '../types';
import { evaluateSentence } from '../services/geminiService';
import { uiTranslations } from '../translations';
import AudioPlayer from './AudioPlayer';

interface MasteryLabProps {
  card: Flashcard;
  onSentenceAdded: (cardId: string, entry: SentenceEntry) => void;
  onClose: () => void;
  currentLang: Language;
}

const MasteryLab: React.FC<MasteryLabProps> = ({ card, onSentenceAdded, onClose, currentLang }) => {
  const [userSentence, setUserSentence] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<SentenceEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const t = uiTranslations[currentLang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSentence.trim() || isEvaluating) return;

    setError(null);
    setIsEvaluating(true);

    try {
      const result = await evaluateSentence(userSentence, card.phrase, card.language);
      
      if (!result.containsTargetWord) {
        setError(`${t.labVariantError} "${card.phrase}"`);
        setIsEvaluating(false);
        return;
      }

      const entry: SentenceEntry = {
        id: crypto.randomUUID(),
        userSentence,
        feedback: result.feedback,
        improvedVersion: result.improvedVersion,
        date: Date.now(),
        isCorrect: result.isCorrect
      };

      onSentenceAdded(card.id, entry);
      setEvaluation(result);
    } catch (err) {
      console.error(err);
      setError("Error analizando...");
    } finally {
      setIsEvaluating(false);
    }
  };

  const resetForm = () => {
    setEvaluation(null);
    setUserSentence('');
    setError(null);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border-4 border-emerald-500 overflow-hidden max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
      <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block mb-1">{t.advanced} {t.labTitle}</span>
          <h3 className="font-bold text-lg flex items-center">
            <i className="fas fa-microscope mr-2 text-emerald-200"></i> {card.phrase}
          </h3>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="p-8">
        {!evaluation ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t.writePhrase}</label>
              <textarea
                autoFocus
                value={userSentence}
                onChange={(e) => setUserSentence(e.target.value)}
                placeholder={`${card.phrase}...`}
                className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-emerald-500 outline-none text-lg min-h-[120px] resize-none transition-all shadow-inner bg-slate-50/50"
              />
              {error && <p className="text-red-500 text-xs font-bold"><i className="fas fa-exclamation-circle mr-1"></i> {error}</p>}
            </div>

            <button
              disabled={!userSentence.trim() || isEvaluating}
              className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 disabled:bg-slate-200 shadow-xl flex items-center justify-center space-x-3 transition-all"
            >
              {isEvaluating ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane"></i> <span>{t.labAnalyze}</span></>}
            </button>
          </form>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-2xl border-l-8 ${evaluation.isCorrect ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
              <div className="flex items-center space-x-3 mb-3">
                <i className={`fas ${evaluation.isCorrect ? 'fa-check-circle text-green-500' : 'fa-info-circle text-orange-500'} text-2xl`}></i>
                <h5 className="font-black text-slate-800">{t.labCorrect}</h5>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium mb-4 italic">"{evaluation.feedback}"</p>
              
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-2 tracking-tighter">{t.labImproved}</span>
                <p className="text-lg font-black text-indigo-950 leading-tight mb-2">{evaluation.improvedVersion}</p>
                <AudioPlayer text={evaluation.improvedVersion} lang={card.language} size="sm" />
              </div>
            </div>

            <div className="flex space-x-4">
              <button onClick={resetForm} className="flex-1 py-4 bg-emerald-50 text-emerald-700 font-black rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200">
                {t.labTryAnother}
              </button>
              <button onClick={onClose} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-black transition-colors">
                {t.closeMap}
              </button>
            </div>
          </div>
        )}

        <div className="mt-10 pt-10 border-t border-slate-100">
          <h4 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center">
            <i className="fas fa-history mr-2"></i> {t.historyTitle}
          </h4>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {card.sentenceHistory && card.sentenceHistory.length > 0 ? (
              card.sentenceHistory.sort((a,b) => b.date - a.date).map(s => (
                <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-800 mb-1">{s.userSentence}</p>
                  <p className="text-[10px] text-slate-500 italic">"{s.feedback}"</p>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-300 py-6 italic text-sm">{t.historyEmpty}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasteryLab;
