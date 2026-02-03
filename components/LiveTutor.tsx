
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Language } from '../types';

interface LiveTutorProps {
  currentLang: Language;
  onClose: () => void;
}

const LiveTutor: React.FC<LiveTutorProps> = ({ currentLang, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  
  const nextStartTimeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  const startSession = async () => {
    setIsConnecting(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    outputNodeRef.current = audioContextRef.current.createGain();
    outputNodeRef.current.connect(audioContextRef.current.destination);

    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const voiceName = currentLang === Language.ENGLISH ? 'Zephyr' : currentLang === Language.CATALAN ? 'Kore' : 'Puck';
    const langLabel = currentLang === Language.ENGLISH ? 'Inglés' : currentLang === Language.CATALAN ? 'Catalán' : 'Francés';

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsActive(true);
          setIsConnecting(false);
          const source = inputAudioContext.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
            const pcmBlob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64EncodedAudioString && audioContextRef.current) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), audioContextRef.current, 24000, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNodeRef.current!);
            source.addEventListener('ended', () => sourcesRef.current.delete(source));
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
            sourcesRef.current.add(source);
          }
          if (message.serverContent?.interrupted) {
            for (const source of sourcesRef.current.values()) {
              source.stop();
              sourcesRef.current.delete(source);
            }
            nextStartTimeRef.current = 0;
          }
          if (message.serverContent?.outputTranscription) {
            setTranscript(prev => [...prev.slice(-4), message.serverContent!.outputTranscription!.text]);
          }
        },
        onclose: () => setIsActive(false),
        onerror: () => setIsActive(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        systemInstruction: `Eres un tutor nativo de ${langLabel}. Tu objetivo es ayudar al usuario a practicar conversación de forma fluida y natural. Habla principalmente en ${langLabel}, pero puedes usar español brevemente si el usuario parece confundido. Mantén respuestas cortas y fomenta que el usuario hable.`,
        outputAudioTranscription: {},
      },
    });
    sessionRef.current = await sessionPromise;
  };

  const stopSession = () => {
    if (sessionRef.current) sessionRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    setIsActive(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="bg-indigo-600 p-8 text-white text-center relative">
          <button onClick={stopSession} className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
            <i className="fas fa-times"></i>
          </button>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30">
            <i className={`fas fa-headset text-3xl ${isActive ? 'animate-bounce' : ''}`}></i>
          </div>
          <h2 className="text-2xl font-black">{isActive ? 'Tutor en Vivo' : 'Iniciando Tutor...'}</h2>
          <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest mt-1">Sesión de Voz Inmersiva</p>
        </div>

        <div className="p-8 min-h-[200px] flex flex-col justify-center space-y-4">
          {!isActive && !isConnecting && (
            <button onClick={startSession} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
              COMENZAR PRÁCTICA DE VOZ
            </button>
          )}
          
          {isConnecting && (
            <div className="text-center py-10">
              <i className="fas fa-spinner fa-spin text-4xl text-indigo-400"></i>
            </div>
          )}

          {isActive && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-center space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`w-2 h-8 bg-indigo-500 rounded-full animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }}></div>
                ))}
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 italic text-slate-500 text-center min-h-[80px]">
                {transcript.length > 0 ? `"${transcript.join(' ')}"` : "Esperando a que hables..."}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-50 flex justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
          {isActive ? 'Habla ahora con tu tutor' : 'Pulsa el botón para conectar'}
        </div>
      </div>
    </div>
  );
};

export default LiveTutor;
