
import React, { useState, useRef, useEffect } from 'react';
import { PronunciationEvaluation, Language } from '../types';
import AudioPlayer from './AudioPlayer';

interface PronunciationFeedbackProps {
  evaluation: PronunciationEvaluation;
  targetText: string;
  lang: Language;
  userAudioUrl: string | null;
}

const PronunciationFeedback: React.FC<PronunciationFeedbackProps> = ({ evaluation, targetText, lang, userAudioUrl }) => {
  const [isPlayingUser, setIsPlayingUser] = useState(false);
  const audioTagRef = useRef<HTMLAudioElement | null>(null);

  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-green-500';
    if (s >= 70) return 'text-indigo-500';
    if (s >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  const playUserAudio = () => {
    const audio = audioTagRef.current;
    if (!audio || !userAudioUrl) return;

    if (isPlayingUser) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlayingUser(false);
      return;
    }

    // El evento 'ended' se encargará de resetear el estado
    audio.play().catch(err => {
      console.error("Audio playback error:", err);
      setIsPlayingUser(false);
    });
  };

  return (
    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* Elemento de audio oculto pero persistente en el DOM */}
      {userAudioUrl && (
        <audio 
          ref={audioTagRef} 
          src={userAudioUrl} 
          onPlay={() => setIsPlayingUser(true)}
          onEnded={() => setIsPlayingUser(false)}
          onPause={() => setIsPlayingUser(false)}
          className="hidden"
          preload="auto"
        />
      )}

      <div className="flex justify-between items-center">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análisis de Pronunciación</h5>
        <div className={`text-2xl font-black ${getScoreColor(evaluation.score)}`}>
          {evaluation.score}%
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
          <span className="text-[9px] font-black uppercase text-slate-400 mb-3">Modelo Nativo</span>
          <AudioPlayer text={targetText} lang={lang} size="lg" />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
          <span className="text-[9px] font-black uppercase text-slate-400 mb-3">Tu Intento</span>
          <button 
            onClick={playUserAudio}
            disabled={!userAudioUrl}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlayingUser ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'} disabled:opacity-30`}
          >
            <i className={`fas ${isPlayingUser ? 'fa-square' : 'fa-play'}`}></i>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-white rounded-2xl border border-indigo-50">
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            <i className="fas fa-comment-dots text-indigo-400 mr-2"></i>
            {evaluation.feedback}
          </p>
        </div>

        {evaluation.syllabicBreakdown?.length > 0 && (
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">Práctica por Sílabas</span>
            <div className="flex flex-wrap gap-2">
              {evaluation.syllabicBreakdown.map((s, i) => (
                <button 
                  key={i} 
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 font-black rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {evaluation.phoneticMistakes?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {evaluation.phoneticMistakes.map((m, i) => (
              <span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100">
                <i className="fas fa-exclamation-triangle mr-1"></i> {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PronunciationFeedback;
