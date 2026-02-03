
import { GoogleGenAI, Type } from "@google/genai";
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
      console.warn(`Quota exceeded, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key missing. Please configure your Gemini API Key.");
  }
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

/**
 * Comprime una imagen en base64 para asegurar que quepa en los límites de Firestore (1MB)
 */
const compressImage = async (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 512;
      const MAX_HEIGHT = 512;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
};

export const generateMnemonicImage = async (phrase: string, translation: string): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A clear, educational mnemonic illustration for the concept: "${phrase}" (${translation}). Minimalist style, vibrant colors, white background, no text inside the image. Concept focus.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const rawBase64 = `data:image/png;base64,${part.inlineData.data}`;
          return await compressImage(rawBase64);
        }
      }
    }
  } catch (e) {
    console.error("Mnemonic image generation failed, skipping image.", e);
  }
  return undefined;
};

export const translatePhrase = async (phrase: string, sourceLang: Language): Promise<TranslationResponse> => {
  return withRetry(async () => {
    const ai = getAI();
    const langName = getLangName(sourceLang);
    
    console.log(`Translating phrase: "${phrase}" to ${langName}...`);
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza: "${phrase}" para un estudiante de ${langName}. El idioma nativo del estudiante es Español (Latinoamericano). Responde en JSON.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
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
    
    const text = response.text;
    if (!text) {
      throw new Error("The AI returned an empty response.");
    }
    
    const baseData = JSON.parse(text.trim());
    console.log("Translation successful, generating mnemonic image...");
    
    // We attempt image generation but won't let it fail the whole translation if it errors out
    let mnemonicImageUrl;
    try {
      mnemonicImageUrl = await generateMnemonicImage(phrase, baseData.translation);
    } catch (imgErr) {
      console.warn("Failed to generate image, proceeding without it", imgErr);
    }
    
    return { ...baseData, mnemonicImageUrl };
  });
};

export const gradeAnswer = async (
  prompt: string, 
  userAnswer: string, 
  correctAnswer: string, 
  targetLang: Language,
  isAudio: boolean = false,
  audioBase64?: string
): Promise<GradingResponse> => {
  return withRetry(async () => {
    const ai = getAI();
    const langName = getLangName(targetLang);
    
    const contents: any[] = [{
      text: `Evalúa pedagógicamente.
      Contexto/Pregunta: ${prompt}
      Respuesta Esperada: ${correctAnswer}
      Respuesta Usuario: ${userAnswer}
      Idioma Objetivo: ${langName}
      Idioma Nativo: Español (Latinoamericano)
      
      Si el usuario falla, clasifica el error: translation, context, pronunciation, grammar o spelling.
      Provee una explicación del por qué está mal y un ejemplo bilingüe nuevo que use la palabra clave de forma natural.`
    }];

    if (isAudio && audioBase64) {
      contents.unshift({
        inlineData: {
          mimeType: 'audio/webm',
          data: audioBase64
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
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
            pronunciation: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
                syllabicBreakdown: { type: Type.ARRAY, items: { type: Type.STRING } },
                phoneticMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
                isSuccess: { type: Type.BOOLEAN }
              }
            }
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
    const langName = getLangName(targetLang);
    
    const cardsData = cards.map(c => `ID:${c.id} | Palabra:${c.phrase} | Significado:${c.translation}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Crea un Weekly Challenge de 15 ejercicios centrado exclusivamente en ORACIONES para un estudiante de ${langName}.
      Usa ÚNICAMENTE estas palabras del diccionario del usuario:
      ${cardsData}
      
      REGLAS DE DISEÑO:
      1. NO muestres la palabra clave directamente. El objetivo es que el usuario la deduzca por el contexto.
      2. NO proveas traducciones de la palabra clave ni pistas en español en la pregunta.
      3. Tipos de ejercicios permitidos:
         - 'context': Una oración en ${langName} con un hueco [____] donde debe ir la palabra clave.
         - 'reverse': Traducir una oración COMPLETA del español al ${langName} que use la palabra clave.
         - 'choice': Una oración en ${langName} con hueco y 4 opciones de respuesta (oraciones o palabras).
         - 'voice': Leer una oración compleja en ${langName} que contenga la palabra.
      4. Las oraciones deben ser naturales y de uso diario.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              cardId: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['reverse', 'voice', 'choice', 'context'] },
              question: { type: Type.STRING, description: "La instrucción o la oración con el hueco" },
              correctAnswer: { type: Type.STRING, description: "La palabra o frase completa correcta" },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Opciones para ejercicios tipo choice" },
              contextSentence: { type: Type.STRING, description: "Oración completa en la que se basa el ejercicio" }
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
      contents: `Evalúa la oración: "${sentence}" usando la palabra "${targetWord}" en el idioma ${getLangName(lang)}. Responde en JSON.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            containsTargetWord: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            improvedVersion: { type: Type.STRING },
            grammarNotes: { type: Type.ARRAY, items: { type: Type.STRING } }
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
    let voiceName = 'Zephyr';
    if (lang === Language.CATALAN) voiceName = 'Kore';
    if (lang === Language.FRENCH) voiceName = 'Puck';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  });
};

export const evaluatePronunciation = async (audioBase64: string, targetText: string, lang: Language, mimeType: string = 'audio/webm'): Promise<PronunciationEvaluation> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: `Evaluate pronunciation of: "${targetText}" in ${getLangName(lang)}. JSON feedback.` }] }],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            clarity: { type: Type.NUMBER },
            intonation: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            syllabicBreakdown: { type: Type.ARRAY, items: { type: Type.STRING } },
            phoneticMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
            isSuccess: { type: Type.BOOLEAN }
          },
          required: ["score", "feedback", "isSuccess"]
        },
      },
    });
    return JSON.parse(response.text.trim());
  });
};
