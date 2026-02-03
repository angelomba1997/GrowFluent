
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { Flashcard, ExamReport, Language } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyCvrPjHLmBwIYOesAkZIbuvT2HA9A-oi-U",
  authDomain: "grow-fluent.firebaseapp.com",
  projectId: "grow-fluent",
  storageBucket: "grow-fluent.firebasestorage.app",
  messagingSenderId: "475885168904",
  appId: "1:475885168904:web:c7a05a3229b89cb09fa4bd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Simple anonymous user ID to separate data in a shared environment without auth system yet
const getUserId = () => {
  let uid = localStorage.getItem('grow_fluent_uid');
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem('grow_fluent_uid', uid);
  }
  return uid;
};

const UID = getUserId();

export const firebaseService = {
  /**
   * Obtiene todas las flashcards del usuario actual
   */
  async getCards(): Promise<Flashcard[]> {
    const cardsCol = collection(db, `users/${UID}/flashcards`);
    const q = query(cardsCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Flashcard);
  },

  /**
   * Guarda o actualiza una flashcard
   */
  async saveCard(card: Flashcard): Promise<void> {
    const cardDoc = doc(db, `users/${UID}/flashcards`, card.id);
    await setDoc(cardDoc, card);
  },

  /**
   * Elimina una flashcard
   */
  async removeCard(id: string): Promise<void> {
    const cardDoc = doc(db, `users/${UID}/flashcards`, id);
    await deleteDoc(cardDoc);
  },

  /**
   * Obtiene el historial de exámenes
   */
  async getExamHistory(): Promise<ExamReport[]> {
    const historyCol = collection(db, `users/${UID}/examHistory`);
    const q = query(historyCol, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ExamReport);
  },

  /**
   * Añade un nuevo reporte de examen
   */
  async addExamReport(report: ExamReport): Promise<void> {
    const reportDoc = doc(db, `users/${UID}/examHistory`, report.id);
    await setDoc(reportDoc, report);
  }
};
