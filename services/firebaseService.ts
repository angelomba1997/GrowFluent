
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Firestore
} from "firebase/firestore";
import { Flashcard, ExamReport } from "../types";

// Configuración de Firebase para el proyecto 'grow-fluent'
const firebaseConfig = {
  apiKey: "AIzaSyCvrPjHLmBwIYOesAkZIbuvT2HA9A-oi-U",
  authDomain: "grow-fluent.firebaseapp.com",
  projectId: "grow-fluent",
  storageBucket: "grow-fluent.firebasestorage.app",
  messagingSenderId: "475885168904",
  appId: "1:475885168904:web:c7a05a3229b89cb09fa4bd"
};

let db: Firestore | null = null;

/**
 * Obtiene la instancia de Firestore asegurando que la App esté inicializada.
 * Se unifica a la versión 11.1.0 importada en el index.html.
 */
const getDb = (): Firestore | null => {
  if (db) return db;
  try {
    const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    return db;
  } catch (e) {
    console.error("Error crítico inicializando Firestore:", e);
    return null;
  }
};

const getUserId = () => {
  let uid = localStorage.getItem('grow_fluent_uid');
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem('grow_fluent_uid', uid);
  }
  return uid;
};

const UID = getUserId();
const LOCAL_CARDS_KEY = `grow_fluent_cards_${UID}`;
const LOCAL_HISTORY_KEY = `grow_fluent_history_${UID}`;

const getLocalData = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const saveLocalData = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const firebaseService = {
  async getCards(): Promise<Flashcard[]> {
    const firestore = getDb();
    if (firestore) {
      try {
        const cardsCol = collection(firestore, `users/${UID}/flashcards`);
        const q = query(cardsCol, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const cards = snapshot.docs.map(doc => doc.data() as Flashcard);
        saveLocalData(LOCAL_CARDS_KEY, cards);
        return cards;
      } catch (e) {
        console.warn("Firestore no disponible, usando almacenamiento local.");
      }
    }
    return getLocalData<Flashcard>(LOCAL_CARDS_KEY);
  },

  async saveCard(card: Flashcard): Promise<void> {
    const localCards = getLocalData<Flashcard>(LOCAL_CARDS_KEY);
    const existingIndex = localCards.findIndex(c => c.id === card.id);
    if (existingIndex > -1) localCards[existingIndex] = card;
    else localCards.unshift(card);
    saveLocalData(LOCAL_CARDS_KEY, localCards);

    const firestore = getDb();
    if (firestore) {
      try {
        const cardToSave = { ...card };
        // Limitar tamaño de imagen para Firestore
        if (cardToSave.mnemonicImageUrl && cardToSave.mnemonicImageUrl.length > 800000) {
           delete cardToSave.mnemonicImageUrl;
        }
        await setDoc(doc(firestore, `users/${UID}/flashcards`, card.id), cardToSave);
      } catch (e) {
        console.error("Error al guardar en la nube:", e);
      }
    }
  },

  async removeCard(id: string): Promise<void> {
    const localCards = getLocalData<Flashcard>(LOCAL_CARDS_KEY);
    saveLocalData(LOCAL_CARDS_KEY, localCards.filter(c => c.id !== id));

    const firestore = getDb();
    if (firestore) {
      try {
        await deleteDoc(doc(firestore, `users/${UID}/flashcards`, id));
      } catch (e) {
        console.error("Error al eliminar en la nube:", e);
      }
    }
  },

  async getExamHistory(): Promise<ExamReport[]> {
    const firestore = getDb();
    if (firestore) {
      try {
        const historyCol = collection(firestore, `users/${UID}/examHistory`);
        const q = query(historyCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => doc.data() as ExamReport);
        saveLocalData(LOCAL_HISTORY_KEY, history);
        return history;
      } catch (e) {
        console.warn("Historial en la nube no disponible.");
      }
    }
    return getLocalData<ExamReport>(LOCAL_HISTORY_KEY);
  },

  async addExamReport(report: ExamReport): Promise<void> {
    const localHistory = getLocalData<ExamReport>(LOCAL_HISTORY_KEY);
    localHistory.unshift(report);
    saveLocalData(LOCAL_HISTORY_KEY, localHistory);

    const firestore = getDb();
    if (firestore) {
      try {
        await setDoc(doc(firestore, `users/${UID}/examHistory`, report.id), report);
      } catch (e) {
        console.error("Error al guardar reporte:", e);
      }
    }
  }
};
