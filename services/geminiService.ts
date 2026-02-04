
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, TranslationResponse, GradingResponse, ExamExercise, Flashcard, PronunciationEvaluation, SentenceEvaluation } from "../types";

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = 
      error?.message?.includes('429') || 
      error?.status === 429 || 
      error?.code === 429 ||
      error?.message?.toLowerCase().includes('quota');

    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

const getAI = () => {
  if (!process.env.API_KEY) throw new Error("API Key missing.");
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getLangName = (lang: Language) => {
  switch(lang) {
    case Language.ENGLISH: return "Inglés (US)";
    case Language.CATALAN: return "Catalán";
    case Language.FRENCH: return "Francés";
    default: return "Inglés";
  }
};

const compressImage = async (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 512;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
};

export const generateMnemonicImage = async (phrase: string, translation: string): Promise<string | undefined> => {
  try {
    const ai = getAI();
    // Importante: No añadir thinkingConfig aquí.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A clear mnemonic illustration for the educational concept: "${phrase}" (${translation}). Minimalist style, vibrant colors, white background.` }],
      }
    });
    
    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return await compressImage(`data:image/png;base64,${imagePart.inlineData.data}`);
    }
  } catch (e) {
    console.error("Error generando imagen mnemotécnica:", e);
  }
  return undefined;
};

export const translatePhrase = async (phrase: string, sourceLang: Language): Promise<TranslationResponse> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza: "${phrase}" para un estudiante de ${getLangName(sourceLang)}. Nativo: Español (Latinoamericano). Devuelve JSON estructurado.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translation: { type: Type.STRING },
            explanation: { type: Type.STRING },
            example: { type: Type.STRING },
            exampleTranslation: { type: Type.STRING },
            synonyms: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, translation: { type: Type.STRING }, nuance: { type: Type.STRING }, register: { type: Type.STRING }, frequency: { type: Type.STRING } } } },
            antonyms: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, translation: { type: Type.STRING } } } },
            variants: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, term: { type: Type.STRING }, note: { type: Type.STRING } } } },
            derivatives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, type: { type: Type.STRING }, translation: { type: Type.STRING } } } },
            masteryPrompts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { target: { type: Type.STRING }, translation: { type: Type.STRING } } } }
          },
          required: ["translation", "explanation", "synonyms", "masteryPrompts"]
        }
      }
    });
    
    const baseData = JSON.parse(response.text.trim());
    const mnemonicImageUrl = await generateMnemonicImage(phrase, baseData.translation);
    return { ...baseData, mnemonicImageUrl };
  });
};

export const gradeAnswer = async (prompt: string, userAnswer: string, correctAnswer: string, targetLang: Language, isAudio = false, audioBase64?: string): Promise<GradingResponse> => {
  return withRetry(async () => {
    const ai = getAI();
    const parts: any[] = [{ text: `Evalúa respuesta. Contexto: ${prompt}. Esperado: ${correctAnswer}. Usuario: ${userAnswer}. Idioma: ${getLangName(targetLang)}. JSON.` }];
    if (isAudio && audioBase64) {
      parts.unshift({ inlineData: { mimeType: 'audio/webm', data: audioBase64 } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            errorType: { type: Type.STRING, enum: ['translation', 'context', 'pronunciation', 'grammar', 'spelling'] },
            explanation: { type: Type.STRING },
            example: { type: Type.STRING },
            exampleTranslation: { type: Type.STRING },
            pronunciation: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING }, isSuccess: { type: Type.BOOLEAN } } }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  });
};

export const generateExamQuestions = async (cards: Flashcard[], targetLang: Language): Promise<ExamExercise[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const cardsData = cards.map(c => `${c.phrase} -> ${c.translation}`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Crea 15 ejercicios variados (contexto, traducción inversa, opción múltiple, voz) para ${getLangName(targetLang)} usando este vocabulario:\n${cardsData}. Devuelve JSON ARRAY.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              cardId: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['reverse', 'voice', 'choice', 'context'] },
              question: { type: Type.STRING },
              correctAnswer: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["cardId", "type", "question", "correctAnswer"]
          }
        }
      }
    });
    return JSON.parse(response.text.trim());
  });
};

export const evaluateSentence = async (sentence: string, targetWord: string, lang: Language): Promise<SentenceEvaluation> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Evalúa si la oración "${sentence}" usa correctamente la palabra "${targetWord}" en ${getLangName(lang)}. JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            containsTargetWord: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            improvedVersion: { type: Type.STRING }
          },
          required: ["isCorrect", "containsTargetWord", "feedback", "improvedVersion"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  });
};

export const generateAudio = async (text: string, lang: Language): Promise<string | undefined> => {
  return withRetry(async () => {
    const ai = getAI();
    const voiceName = lang === Language.CATALAN ? 'Kore' : lang === Language.FRENCH ? 'Puck' : 'Zephyr';
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: `Say clearly: ${text}` }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  });
};

export const evaluatePronunciation = async (audioBase64: string, targetText: string, lang: Language, mimeType = 'audio/webm'): Promise<PronunciationEvaluation> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: `Evaluate pronunciation of: "${targetText}" in ${getLangName(lang)}. JSON feedback.` }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            isSuccess: { type: Type.BOOLEAN }
          },
          required: ["score", "feedback", "isSuccess"]
        },
      },
    });
    return JSON.parse(response.text.trim());
  });
};
