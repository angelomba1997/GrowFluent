
import React, { useState, useRef, useEffect } from 'react';
import { Language } from '../types';
import { generateAudio } from '../services/geminiService';

interface AudioPlayerProps {
  text: string;
  lang: Language;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, lang, size = 'md', className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedDataUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Helper to create a WAV header for 24kHz, 16-bit, Mono PCM data
  const createWavHeader = (dataLength: number) => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, 24000, true); // Sample Rate
    view.setUint32(28, 24000 * 2, true); // Byte Rate
    view.setUint16(32, 2, true); // Block Align
    view.setUint16(34, 16, true); // Bits per Sample
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    return new Uint8Array(buffer);
  };

  const playAudio = async () => {
    if (isPlaying || isLoading) return;

    if (cachedDataUrl.current && audioRef.current) {
      audioRef.current.playbackRate = isSlow ? 0.7 : 1.0;
      audioRef.current.play().catch(console.error);
      return;
    }

    setIsLoading(true);
    try {
      const base64Pcm = await generateAudio(text, lang);
      if (!base64Pcm) throw new Error("No audio data received");

      // Convert Base64 to binary
      const binaryString = atob(base64Pcm);
      const pcmData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmData[i] = binaryString.charCodeAt(i);
      }

      // Add WAV header
      const header = createWavHeader(pcmData.length);
      const wavData = new Uint8Array(header.length + pcmData.length);
      wavData.set(header);
      wavData.set(pcmData, header.length);

      // Convert back to Base64 for a Data URL
      let binary = '';
      for (let i = 0; i < wavData.length; i++) {
        binary += String.fromCharCode(wavData[i]);
      }
      const base64Wav = btoa(binary);
      const dataUrl = `data:audio/wav;base64,${base64Wav}`;
      cachedDataUrl.current = dataUrl;

      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.playbackRate = isSlow ? 0.7 : 1.0;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        cachedDataUrl.current = null;
      };

      await audio.play();
    } catch (error) {
      console.error("Audio playback error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-xl'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <button
        onClick={playAudio}
        disabled={isLoading}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all ${
          isPlaying 
            ? 'bg-indigo-600 text-white shadow-lg' 
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
        } disabled:opacity-50`}
        title="Escuchar pronunciación"
      >
        {isLoading ? (
          <i className="fas fa-spinner fa-spin"></i>
        ) : (
          <i className={`fas ${isPlaying ? 'fa-volume-up' : 'fa-volume-low'}`}></i>
        )}
      </button>
      
      {size !== 'sm' && (
        <button
          onClick={() => setIsSlow(!isSlow)}
          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-colors ${
            isSlow ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
          title="Alternar velocidad"
        >
          {isSlow ? 'Lento' : 'Normal'}
        </button>
      )}
    </div>
  );
};

export default AudioPlayer;
