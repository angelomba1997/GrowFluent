
import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, Language, ExamExercise, ExamReport, ExamQuestionResult, GradingResponse } from '../types';
import { generateExamQuestions, gradeAnswer } from '../services/geminiService';
import { uiTranslations } from '../translations';
import AudioPlayer from './AudioPlayer';

interface ExamModeProps {
  cards: Flashcard[];
  currentLang: Language;
  onFinish: (report: ExamReport) => void;
  onClose: () => void;
}

const ExamMode: React.FC<ExamModeProps> = ({ cards, currentLang, onFinish, onClose }) => {
  const [exercises, setExercises] = useState<ExamExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<GradingResponse | null>(null);
  const [results, setResults] = useState<ExamQuestionResult[]>([]);
  const [startTime] = useState(Date.now());
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  
  const t = uiTranslations[currentLang];
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const initExam = async () => {
      try {
        const generated = await generateExamQuestions(cards, currentLang);
        setExercises(generated);
        setIsLoading(false);
        setCardStartTime(Date.now());
      } catch (e) {
        console.error(e);
        onClose();
      }
    };
    initExam();
  }, []);

  const currentExercise = exercises[currentIndex];

  const handleCheck = async () => {
    if (!userAnswer.trim() && !isListening) return;
    setIsGrading(true);
    const responseTimeMs = Date.now() - cardStartTime;
    
    try {
      const grade = await gradeAnswer(
        currentExercise.question, 
        userAnswer, 
        currentExercise.correctAnswer, 
        currentLang
      );
      
      setGradingResult(grade);
      
      const questionResult: ExamQuestionResult = {
        cardId: currentExercise.cardId,
        isCorrect: grade.isCorrect,
        responseTimeMs,
        question: currentExercise.question,
        userAnswer,
        correctAnswer: currentExercise.correctAnswer,
        type: currentExercise.type,
        errorType: grade.errorType,
        explanation: grade.explanation,
        example: grade.example,
        exampleTranslation: grade.exampleTranslation,
        pronunciation: grade.pronunciation
      };
      
      setResults(prev => [...prev, questionResult]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGrading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setGradingResult(null);
      setCardStartTime(Date.now());
    } else {
      const finalResults = results;
      const totalTime = Date.now() - startTime;
      const accuracy = finalResults.filter(r => r.isCorrect).length / finalResults.length;
      const speed = finalResults.reduce((acc, r) => acc + r.responseTimeMs, 0) / finalResults.length;
      
      const pronScores = finalResults.filter(r => r.pronunciation?.score !== undefined).map(r => r.pronunciation!.score);
      const pronAvg = pronScores.length > 0 ? pronScores.reduce((a, b) => a + b, 0) / pronScores.length : 0;

      const report: ExamReport = {
        id: crypto.randomUUID(),
        date: Date.now(),
        language: currentLang,
        totalTimeMs: totalTime,
        accuracy,
        speedScore: speed,
        results: finalResults,
        masteredIds: finalResults.filter(r => r.isCorrect && r.responseTimeMs < 6000).map(r => r.cardId),
        weakIds: finalResults.filter(r => !r.isCorrect || r.responseTimeMs > 15000).map(r => r.cardId),
        forgottenIds: finalResults.filter(r => !r.isCorrect && r.responseTimeMs > 25000).map(r => r.cardId),
        recommendations: [
          accuracy > 0.8 ? "¡Excelente! Tu dominio de oraciones es sólido." : "Practica más la construcción de frases en el Mastery Lab.",
          speed < 10000 ? "Tienes buena agilidad procesando oraciones." : "Tómate tu tiempo para leer bien cada contexto."
        ],
        pronunciationAvg: pronAvg
      };
      onFinish(report);
    }
  };

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setIsGrading(true);
          const grade = await gradeAnswer(currentExercise.question, "[Voz]", currentExercise.correctAnswer, currentLang, true, base64);
          setGradingResult(grade);
          setIsGrading(false);
        };
      };
      mediaRecorder.start();
      setIsListening(true);
    } catch (e) { console.error(e); }
  };

  const stopVoice = () => {
    mediaRecorderRef.current?.stop();
    setIsListening(false);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-4 border-indigo-50 shadow-inner max-w-2xl mx-auto">
      <div className="relative">
        <i className="fas fa-brain text-6xl text-indigo-600 animate-pulse"></i>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
      </div>
      <h2 className="text-2xl font-black text-slate-800 mt-6 tracking-tight">{t.generatingExam}</h2>
      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Construyendo desafíos de oraciones...</p>
    </div>
  );

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border-4 border-indigo-600 overflow-hidden max-w-2xl mx-auto relative">
      <div className="bg-indigo-600 p-8 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 block mb-1">{t.weeklyChallenge}</span>
            <h3 className="font-black text-2xl flex items-center">
              <i className="fas fa-rocket mr-3 text-indigo-300"></i> Oraciones y Contexto
            </h3>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">{currentIndex + 1}<span className="text-sm opacity-50 font-bold">/{exercises.length}</span></div>
          </div>
        </div>
        <div className="w-full h-2 bg-indigo-900/30 rounded-full overflow-hidden">
          <div className="h-full bg-white transition-all duration-700" style={{ width: `${((currentIndex + 1) / exercises.length) * 100}%` }}></div>
        </div>
      </div>

      <div className="p-10">
        {!gradingResult ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider mb-6">
                <i className="fas fa-tasks mr-2"></i> {t.type}: {currentExercise.type}
              </span>
              <h4 className="text-3xl font-black text-slate-900 leading-[1.2] px-2">
                {currentExercise.question}
              </h4>
            </div>

            {currentExercise.type === 'choice' ? (
              <div className="grid grid-cols-1 gap-4">
                {currentExercise.options?.map((opt, i) => (
                  <button key={i} onClick={() => setUserAnswer(opt)} className={`group w-full p-5 rounded-2xl border-2 font-black transition-all text-left flex justify-between items-center ${userAnswer === opt ? 'border-indigo-600 bg-indigo-50 text-indigo-700 scale-[1.02]' : 'border-slate-100 hover:border-indigo-200 text-slate-500'}`}>
                    <span>{opt}</span>
                    <i className={`fas fa-check-circle transition-all ${userAnswer === opt ? 'text-indigo-600' : 'text-slate-100'}`}></i>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative">
                  <textarea 
                    autoFocus 
                    className="w-full px-8 py-6 rounded-3xl border-4 border-slate-50 focus:border-indigo-500 outline-none text-xl text-center font-black placeholder:text-slate-200 transition-all bg-slate-50/50 min-h-[120px] resize-none" 
                    value={userAnswer} 
                    onChange={e => setUserAnswer(e.target.value)} 
                    placeholder="Escribe la oración completa o la palabra..."
                  />
                  {currentExercise.type === 'voice' && (
                    <button 
                      onMouseDown={startVoice} 
                      onMouseUp={stopVoice}
                      className={`absolute right-4 bottom-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 shadow-sm'}`}
                    >
                      <i className="fas fa-microphone text-xl"></i>
                    </button>
                  )}
                </div>
              </div>
            )}

            <button onClick={handleCheck} disabled={!userAnswer.trim() || isGrading} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black hover:bg-black disabled:bg-slate-100 disabled:text-slate-300 shadow-2xl flex items-center justify-center space-x-3 transition-all active:scale-95">
              {isGrading ? <i className="fas fa-spinner fa-spin"></i> : <><span className="uppercase tracking-widest">{t.check}</span> <i className="fas fa-arrow-right"></i></>}
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
            <div className={`p-8 rounded-[2rem] border-4 ${gradingResult.isCorrect ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}`}>
              <div className="flex items-center space-x-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${gradingResult.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  <i className={`fas ${gradingResult.isCorrect ? 'fa-check' : 'fa-times'}`}></i>
                </div>
                <div>
                  <h5 className="font-black text-xl text-slate-800">{gradingResult.isCorrect ? t.wellDone : t.tryAgain}</h5>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${gradingResult.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {gradingResult.errorType ? `Error detectado: ${gradingResult.errorType}` : ''}
                  </span>
                </div>
              </div>
              
              {!gradingResult.isCorrect && (
                <div className="space-y-4">
                  <div className="bg-red-100/30 p-6 rounded-2xl shadow-sm border border-red-100/50">
                    <span className="text-[10px] font-black uppercase text-red-400 block mb-2 tracking-tighter">{t.yourAnswer}</span>
                    <p className="text-xl font-bold text-red-800 leading-tight italic">"{userAnswer || '[Vacío]'}"</p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-tighter">Solución Correcta</span>
                    <p className="text-2xl font-black text-slate-900 leading-tight">{currentExercise.correctAnswer}</p>
                  </div>
                  
                  {gradingResult.explanation && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-tighter">{t.explanation}</span>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium mb-4 italic">"{gradingResult.explanation}"</p>
                    </div>
                  )}

                  {gradingResult.example && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-tighter">Ejemplo de uso natural</span>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-lg font-black text-indigo-950 leading-tight">"{gradingResult.example}"</p>
                          <p className="text-xs text-indigo-500 font-black mt-2">{gradingResult.exampleTranslation}</p>
                        </div>
                        <AudioPlayer text={gradingResult.example} lang={currentLang} size="md" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={handleNext} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black hover:bg-indigo-700 shadow-xl flex items-center justify-center space-x-3 transition-all active:scale-95">
              <span className="uppercase tracking-widest">{currentIndex === exercises.length - 1 ? t.finishExam : t.next}</span>
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamMode;
