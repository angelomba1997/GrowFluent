
import { initializeApp } from "firebase/app";
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
let isFirebaseInitialized = false;

// We use a flag to track if we should even try to use Firebase after a critical failure (like "not-found")
let firebaseActive = true;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isFirebaseInitialized = true;
} catch (e) {
  console.warn("Firebase initialization failed:", e);
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
    if (isFirebaseInitialized && firebaseActive) {
      try {
        const cardsCol = collection(db, `users/${UID}/flashcards`);
        const q = query(cardsCol, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const cards = snapshot.docs.map(doc => doc.data() as Flashcard);
        saveLocalData(LOCAL_CARDS_KEY, cards);
        return cards;
      } catch (e: any) {
        console.error("Firestore fetch error:", e.message);
        // Error code 404 or string "not-found" indicates DB is missing
        if (e.message?.includes("not-found") || e.code === "not-found") {
          firebaseActive = false; // Disable for this session
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

    if (isFirebaseInitialized && firebaseActive) {
      try {
        const cardDoc = doc(db, `users/${UID}/flashcards`, card.id);
        await setDoc(cardDoc, card);
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

    if (isFirebaseInitialized && firebaseActive) {
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
    if (isFirebaseInitialized && firebaseActive) {
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

    if (isFirebaseInitialized && firebaseActive) {
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
