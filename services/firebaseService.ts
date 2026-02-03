
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy
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

let db: any = null;
let firebaseActive = true;

try {
  // Use existing app if initialized, otherwise initialize new one
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase/Firestore initialization failed:", e);
  firebaseActive = false;
}

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
    if (db && firebaseActive) {
      try {
        const cardsCol = collection(db, `users/${UID}/flashcards`);
        const q = query(cardsCol, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const cards = snapshot.docs.map(doc => doc.data() as Flashcard);
        saveLocalData(LOCAL_CARDS_KEY, cards);
        return cards;
      } catch (e: any) {
        console.error("Firestore fetch error:", e.message);
        if (e.message?.includes("not-found") || e.code === "not-found") {
          firebaseActive = false;
        }
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

    if (db && firebaseActive) {
      try {
        const cardToSave = { ...card };
        if (cardToSave.mnemonicImageUrl && cardToSave.mnemonicImageUrl.length > 800000) {
           console.warn(`Imagen mnemotécnica para "${card.phrase}" demasiado grande para Firestore. Se omitirá en la nube.`);
           delete cardToSave.mnemonicImageUrl;
        }

        const cardDoc = doc(db, `users/${UID}/flashcards`, card.id);
        await setDoc(cardDoc, cardToSave);
      } catch (e: any) {
        console.error("Firestore save error:", e.message);
        if (e.message?.includes("not-found") || e.code === "not-found") firebaseActive = false;
      }
    }
  },

  async removeCard(id: string): Promise<void> {
    const localCards = getLocalData<Flashcard>(LOCAL_CARDS_KEY);
    const filtered = localCards.filter(c => c.id !== id);
    saveLocalData(LOCAL_CARDS_KEY, filtered);

    if (db && firebaseActive) {
      try {
        const cardDoc = doc(db, `users/${UID}/flashcards`, id);
        await deleteDoc(cardDoc);
      } catch (e: any) {
        console.error("Firestore delete error:", e.message);
        if (e.message?.includes("not-found") || e.code === "not-found") firebaseActive = false;
      }
    }
  },

  async getExamHistory(): Promise<ExamReport[]> {
    if (db && firebaseActive) {
      try {
        const historyCol = collection(db, `users/${UID}/examHistory`);
        const q = query(historyCol, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => doc.data() as ExamReport);
        saveLocalData(LOCAL_HISTORY_KEY, history);
        return history;
      } catch (e: any) {
        console.error("Firestore history fetch error:", e.message);
        if (e.message?.includes("not-found") || e.code === "not-found") firebaseActive = false;
      }
    }
    return getLocalData<ExamReport>(LOCAL_HISTORY_KEY);
  },

  async addExamReport(report: ExamReport): Promise<void> {
    const localHistory = getLocalData<ExamReport>(LOCAL_HISTORY_KEY);
    localHistory.unshift(report);
    saveLocalData(LOCAL_HISTORY_KEY, localHistory);

    if (db && firebaseActive) {
      try {
        const reportDoc = doc(db, `users/${UID}/examHistory`, report.id);
        await setDoc(reportDoc, report);
      } catch (e: any) {
        console.error("Firestore report save error:", e.message);
        if (e.message?.includes("not-found") || e.code === "not-found") firebaseActive = false;
      }
    }
  }
};
