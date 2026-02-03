
export enum Language {
  ENGLISH = 'ENGLISH',
  CATALAN = 'CATALAN',
  FRENCH = 'FRENCH'
}

export interface LexicalEntry {
  term: string;
  translation: string;
  nuance: string;
  register: 'formal' | 'neutro' | 'informal';
  frequency: 'muy común' | 'común' | 'poco común';
  example: string;
  exampleTranslation: string;
}

export interface Variant {
  type: 'gramatical' | 'regional' | 'coloquial';
  term: string;
  note: string;
}

export interface SentenceEntry {
  id: string;
  userSentence: string;
  feedback: string;
  improvedVersion?: string;
  date: number;
  isCorrect: boolean;
}

export interface MasteryPrompt {
  target: string;
  translation: string;
}

export interface TranslationResponse {
  translation: string;
  explanation: string;
  example: string;
  exampleTranslation: string;
  synonyms: LexicalEntry[];
  antonyms: { term: string; translation: string }[];
  variants: Variant[];
  derivatives: { term: string; type: string; translation: string }[];
  masteryPrompts: MasteryPrompt[];
  mnemonicImageUrl?: string;
}

export interface PronunciationEvaluation {
  score: number;
  clarity: number;
  intonation: number;
  feedback: string;
  syllabicBreakdown: string[];
  phoneticMistakes: string[];
  isSuccess: boolean;
}

export interface Flashcard extends TranslationResponse {
  id: string;
  phrase: string;
  language: Language;
  createdAt: number;
  nextReviewAt: number;
  lastInterval: number;
  repetitionCount: number;
  easinessFactor: number;
  status: 'new' | 'learning' | 'mastered';
  timesReviewed: number;
  successCount: number;
  failureCount: number;
  lastExamScore?: number;
  pronunciationHistory: number[];
  sentenceHistory: SentenceEntry[];
}

export interface SentenceEvaluation {
  isCorrect: boolean;
  containsTargetWord: boolean;
  feedback: string;
  improvedVersion: string;
  grammarNotes: string[];
}

export interface ExamExercise {
  cardId: string;
  type: 'translation' | 'reverse' | 'voice' | 'choice' | 'context';
  question: string;
  correctAnswer: string;
  options?: string[];
  contextSentence?: string;
}

export interface ExamQuestionResult {
  cardId: string;
  isCorrect: boolean;
  responseTimeMs: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  type: string;
  errorType?: 'translation' | 'context' | 'pronunciation' | 'grammar' | 'spelling';
  explanation?: string;
  example?: string;
  exampleTranslation?: string;
  pronunciation?: PronunciationEvaluation;
}

export interface ExamReport {
  id: string;
  date: number;
  language: Language;
  totalTimeMs: number;
  accuracy: number;
  speedScore: number;
  results: ExamQuestionResult[];
  masteredIds: string[];
  weakIds: string[];
  forgottenIds: string[];
  recommendations: string[];
  pronunciationAvg: number;
}

export interface PracticeResult {
  cardId: string;
  isCorrect: boolean;
  responseTimeMs: number;
  pronunciationScore?: number;
}

export interface GradingResponse {
  isCorrect: boolean;
  feedback: string;
  explanation?: string;
  example?: string;
  exampleTranslation?: string;
  errorType?: 'translation' | 'context' | 'pronunciation' | 'grammar' | 'spelling';
  pronunciation?: PronunciationEvaluation;
}
