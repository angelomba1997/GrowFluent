
import React, { useState } from 'react';
import { Flashcard, Language } from '../types';
import { uiTranslations } from '../translations';
import AudioPlayer from './AudioPlayer';

interface FlashcardItemProps {
  card: Flashcard;
  onDelete: (id: string) => void;
  onOpenMastery?: (card: Flashcard) => void;
}

const FlashcardItem: React.FC<FlashcardItemProps> = ({ card, onDelete, onOpenMastery }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = uiTranslations[card.language];
  
  const isOverdue = Date.now() >= card.nextReviewAt;
  const isMastered = card.status === 'mastered';
  const strength = Math.min(100, Math.round((card.lastInterval / 30) * 100));
  
  const formatDate = (ts: number) => {
    const diff = ts - Date.now();
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
    if (days <= 0) return card.language === Language.ENGLISH ? 'Ahora' : 'Ara';
    if (days === 1) return card.language === Language.ENGLISH ? 'Mañana' : 'Demà';
    return `${days} d`;
  };

  const registerColors = {
    formal: 'bg-blue-100 text-blue-700',
    neutro: 'bg-slate-100 text-slate-700',
    informal: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className={`bg-white rounded-3xl border-2 transition-all relative group flex flex-col overflow-hidden ${isMastered ? 'border-emerald-200 shadow-lg shadow-emerald-50' : isOverdue ? 'border-orange-200 shadow-lg shadow-orange-50' : 'border-slate-100 shadow-sm'}`}>
      
      {/* Mnemonic Image */}
      {card.mnemonicImageUrl && (
        <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
          <img 
            src={card.mnemonicImageUrl} 
            alt={card.phrase} 
            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
        </div>
      )}

      {isMastered && (
        <div className="absolute top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full z-10 shadow-lg">
          <i className="fas fa-medal mr-1"></i> {t.masteredBadge}
        </div>
      )}

      {!isMastered && isOverdue && (
        <div className="absolute top-4 right-4 px-2 py-1 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg animate-pulse z-10">
          {t.reviewBadge}
        </div>
      )}

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-1">
              <h3 className="text-2xl font-black text-indigo-950 leading-tight">{card.phrase}</h3>
              <AudioPlayer text={card.phrase} lang={card.language} size="sm" />
            </div>
            <p className="text-sm font-bold text-indigo-500">"{card.translation}"</p>
          </div>
          <div className="flex items-center space-x-2">
            {isMastered && (
              <button 
                onClick={() => onOpenMastery?.(card)} 
                className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors shadow-sm"
                title={t.labTitle}
              >
                <i className="fas fa-microscope text-sm"></i>
              </button>
            )}
            <button onClick={() => onDelete(card.id)} className="text-slate-200 hover:text-red-500 transition-colors p-2">
              <i className="fas fa-trash-alt text-xs"></i>
            </button>
          </div>
        </div>

        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-4">
          <p className="text-xs text-slate-600 leading-relaxed italic">
            {card.explanation}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center space-x-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-slate-400">{t.memoryStrength}</span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className={`h-full ${isMastered ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${strength}%` }}></div>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-slate-400">{t.nextReview}</span>
              <span className="text-[10px] font-bold text-slate-700">{formatDate(card.nextReviewAt)}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
          >
            <span>{isExpanded ? t.closeMap : t.exploreNuances}</span>
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-8 border-t border-slate-50 bg-slate-50/30 rounded-b-3xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="mt-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center">
              <i className="fas fa-layer-group mr-2"></i> {t.synonymsTitle}
            </h4>
            <div className="space-y-4">
              {card.synonyms?.map((syn, idx) => (
                <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-slate-800">{syn.term}</span>
                      <AudioPlayer text={syn.term} lang={card.language} size="sm" />
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${registerColors[syn.register]}`}>
                      {syn.register}
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-600 font-bold mb-1">"{syn.translation}"</p>
                  <p className="text-[10px] text-slate-500 leading-normal mb-2">{syn.nuance}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardItem;
