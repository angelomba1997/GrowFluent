
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

// Configuration for Firebase project 'grow-fluent'
const firebaseConfig = {
  apiKey: "AIzaSyCvrPjHLmBwIYOesAkZIbuvT2HA9A-oi-U",
  authDomain: "grow-fluent.firebaseapp.com",
  projectId: "grow-fluent",
  storageBucket: "grow-fluent.firebasestorage.app",
  messagingSenderId: "475885168904",
  appId: "1:475885168904:web:c7a05a3229b89cb09fa4bd"
};

let db: Firestore | null = null;
let firebaseActive = true;

const getDb = (): Firestore | null => {
  if (db) return db;
  try {
    const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firestore initialized successfully");
    return db;
  } catch (e) {
    console.error("Firebase/Firestore initialization failed:", e);
    firebaseActive = false;
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
  } catch {
    return [];
  }
};

const saveLocalData = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const firebaseService = {
  async getCards(): Promise<Flashcard[]> {
    const firestore = getDb();
    if (firestore && firebaseActive) {
      try {
        const cardsCol = collection(firestore, `users/${UID}/flashcards`);
        const q = query(cardsCol, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const cards = snapshot.docs.map(doc => doc.data() as Flashcard);
        saveLocalData(LOCAL_CARDS_KEY, cards);
        return cards;
      } catch (e: any) {
        console.warn("Firestore fetch error, falling back to local storage:", e.message);
      }
    }
    return getLocalData<Flashcard>(LOCAL_CARDS_KEY);
  },

  async saveCard(card: Flashcard): Promise<void> {
    const localCards = getLocalData<Flashcard>(LOCAL_CARDS_KEY);
    const existingIndex = localCards.findIndex(c => c.id === card.id);
    if (existingIndex > -1) {
      localCards[existingIndex] = card;
    } else {
      localCards.unshift(card);
    }
    saveLocalData(LOCAL_CARDS_KEY, localCards);

    const firestore = getDb();
    if (firestore && firebaseActive) {
      try {
        const cardToSave = { ...card };
        // Basic check for image size to avoid Firestore document limits (max 1MB)
        if (cardToSave.mnemonicImageUrl && cardToSave.mnemonicImageUrl.length > 800000) {
           console.warn(`Imagen mnemotécnica para "${card.phrase}" demasiado grande para Firestore. Se omitirá en la nube.`);
           delete cardToSave.mnemonicImageUrl;
        }

        const cardDoc = doc(firestore, `users/${UID}/flashcards`, card.id);
        await setDoc(cardDoc, cardToSave);
      } catch (e: any) {
        console.error("Firestore save error:", e.message);
      }
    }
  },

  async removeCard(id: string): Promise<void> {
    const localCards = getLocalData<Flashcard>(LOCAL_CARDS_KEY);
    const filtered = localCards.filter(c => c.id !== id);
    saveLocalData(LOCAL_CARDS_KEY, filtered);

    const firestore = getDb();
    if (firestore && firebaseActive) {
      try {
        const cardDoc = doc(firestore, `users/${UID}/flashcards`, id);
        await deleteDoc(cardDoc);
      } catch (e: any) {
        console.error("Firestore delete error:", e.message);
      }
    }
  },

  async getExamHistory(): Promise<ExamReport[]> {
    const firestore = getDb();
    if (firestore && firebaseActive) {
      try {
        const historyCol = collection(firestore, `users/${UID}/examHistory`);
        const q = query(historyCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => doc.data() as ExamReport);
        saveLocalData(LOCAL_HISTORY_KEY, history);
        return history;
      } catch (e: any) {
        console.warn("Firestore history fetch error, falling back to local storage:", e.message);
      }
    }
    return getLocalData<ExamReport>(LOCAL_HISTORY_KEY);
  },

  async addExamReport(report: ExamReport): Promise<void> {
    const localHistory = getLocalData<ExamReport>(LOCAL_HISTORY_KEY);
    localHistory.unshift(report);
    saveLocalData(LOCAL_HISTORY_KEY, localHistory);

    const firestore = getDb();
    if (firestore && firebaseActive) {
      try {
        const reportDoc = doc(firestore, `users/${UID}/examHistory`, report.id);
        await setDoc(reportDoc, report);
      } catch (e: any) {
        console.error("Firestore report save error:", e.message);
      }
    }
  }
};
