
import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, Language, GradingResponse, PracticeResult, PronunciationEvaluation } from '../types';
import { gradeAnswer, evaluatePronunciation } from '../services/geminiService';
import { uiTranslations } from '../translations';
import AudioPlayer from './AudioPlayer';
import PronunciationFeedback from './PronunciationFeedback';

interface PracticeModeProps {
  cards: Flashcard[];
  onFinish: (result: PracticeResult) => void;
  onClose: () => void;
  currentLang: Language;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ cards, onFinish, onClose, currentLang }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [grading, setGrading] = useState<GradingResponse | null>(null);
  const [pronunciation, setPronunciation] = useState<PronunciationEvaluation | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const t = uiTranslations[currentLang];
  const startTimeRef = useRef<number>(Date.now());
  const currentCard = cards[currentIndex];

  useEffect(() => {
    startTimeRef.current = Date.now();
    setGrading(null);
    setPronunciation(null);
    
    // Solo limpiamos el URL cuando cambiamos de tarjeta para no romper la reproducción
    setUserAnswer('');
  }, [currentIndex]);

  // Limpieza del URL del Blob para evitar fugas de memoria
  useEffect(() => {
    return () => {
      if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    };
  }, [userAudioUrl]);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsSupported(true);
    }
  }, []);

  const getSupportedMimeType = () => {
    // Reordenado: mp4 y aac suelen ser más compatibles en móviles que webm
    const types = [
      'audio/mp4',
      'audio/aac',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Cerramos los tracks aquí para asegurar que el grabador terminó de recibir datos
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const actualType = mediaRecorder.mimeType || 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
        
        // Revocamos el anterior si existía
        if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
        
        const url = URL.createObjectURL(audioBlob);
        setUserAudioUrl(url);
        
        setIsGrading(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const evalResult = await evaluatePronunciation(base64, currentCard.phrase, currentLang, actualType);
            setPronunciation(evalResult);
            setGrading({
              isCorrect: evalResult.isSuccess,
              feedback: evalResult.feedback,
              pronunciation: evalResult
            });
          } catch (e) {
            console.error("Evaluation failed:", e);
            setGrading({
              isCorrect: false,
              feedback: "No pudimos analizar tu audio. Intenta de nuevo o escribe la respuesta."
            });
          } finally {
            setIsGrading(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Recording error:", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTextCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userAnswer.trim() || isGrading) return;
    setIsGrading(true);
    try {
      const result = await gradeAnswer(currentCard.translation, userAnswer, currentCard.phrase, currentLang);
      setGrading(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGrading(false);
    }
  };

  const handleNext = () => {
    if (grading) {
      const responseTimeMs = Date.now() - startTimeRef.current;
      onFinish({ 
        cardId: currentCard.id, 
        isCorrect: grading.isCorrect, 
        responseTimeMs,
        pronunciationScore: pronunciation?.score
      });
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
    }
  };

  if (!currentCard) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-100 overflow-hidden max-w-2xl mx-auto">
      <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center space-x-2">
          <i className="fas fa-brain animate-pulse"></i>
          <h3 className="font-semibold">{t.smartSession}</h3>
        </div>
        <span className="text-sm bg-indigo-500 px-3 py-1 rounded-full font-bold">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>
      
      <div className="p-8 text-center">
        <div className="mb-6">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
            {currentLang === Language.ENGLISH ? 'How do you say?' : 'Com es diu?'}
          </span>
          <h4 className="text-4xl font-black text-indigo-900 leading-tight">
            {currentCard.translation}
          </h4>
        </div>

        {!grading ? (
          <div className="max-w-md mx-auto space-y-8">
            <div className="flex flex-col items-center space-y-6">
              <button 
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse scale-110 shadow-2xl shadow-red-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
              >
                <i className={`fas ${isRecording ? 'fa-microphone-lines' : 'fa-microphone'} text-3xl mb-1`}></i>
                <span className="text-[10px] font-black uppercase tracking-tighter">{isRecording ? 'Recording' : 'Hold to Speak'}</span>
              </button>
              <p className="text-xs text-slate-400 font-medium">Pulsa para hablar y recibir evaluación de pronunciación IA</p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="h-px bg-slate-100 flex-1"></div>
              <span className="text-[10px] font-black text-slate-300 uppercase">O escribe tu respuesta</span>
              <div className="h-px bg-slate-100 flex-1"></div>
            </div>

            <form onSubmit={handleTextCheck} className="space-y-4">
              <input 
                type="text" 
                value={userAnswer} 
                onChange={(e) => setUserAnswer(e.target.value)} 
                className="w-full px-4 py-5 text-center text-xl rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none" 
                placeholder={currentLang === Language.ENGLISH ? 'Type here...' : 'Escriu aquí...'} 
              />
              <button disabled={isGrading || !userAnswer.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-300">
                {isGrading ? <i className="fas fa-spinner fa-spin"></i> : t.check}
              </button>
            </form>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-left animate-in fade-in duration-300 space-y-6">
            <div className={`p-5 rounded-2xl border-l-4 ${grading.isCorrect ? 'bg-green-50 text-green-800 border-green-500' : 'bg-red-50 text-red-800 border-red-500'}`}>
              <div className="flex items-center mb-2">
                <i className={`fas ${grading.isCorrect ? 'fa-check-circle' : 'fa-times-circle'} mr-3 text-xl`}></i>
                <span className="font-black text-lg">{grading.feedback.split('.')[0]}</span>
              </div>
            </div>

            {pronunciation && (
              <PronunciationFeedback 
                evaluation={pronunciation} 
                targetText={currentCard.phrase} 
                lang={currentLang} 
                userAudioUrl={userAudioUrl} 
              />
            )}
            
            {!pronunciation && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest block mb-2">{t.correctForm}</span>
                    <p className="text-2xl font-black text-slate-800">{currentCard.phrase}</p>
                  </div>
                  <AudioPlayer text={currentCard.phrase} lang={currentLang} size="md" />
                </div>
                <div className="h-px bg-slate-200 my-3"></div>
                <p className="text-sm text-slate-500 italic">"{currentCard.explanation}"</p>
              </div>
            )}

            <button onClick={handleNext} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black flex items-center justify-center space-x-2">
              <span>{t.next}</span>
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeMode;
