import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type QueryConstraint,
  updateDoc,
  where,
  type DocumentData
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type FirestoreWithMeta<T> = T & {
  id: string;
};

const EMPTY_QUERY_CONSTRAINTS: QueryConstraint[] = [];

export const createDocument = async <T extends DocumentData>(
  collectionName: string,
  payload: T,
  actorUid?: string
): Promise<string> => {
  const ref = await addDoc(collection(db, collectionName), {
    ...payload,
    createdBy: actorUid,
    updatedBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return ref.id;
};

export const setDocument = async <T extends DocumentData>(
  collectionName: string,
  id: string,
  payload: T,
  actorUid?: string
): Promise<void> => {
  await setDoc(
    doc(db, collectionName, id),
    {
      ...payload,
      updatedBy: actorUid,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const updateDocument = async <T extends DocumentData>(
  collectionName: string,
  id: string,
  payload: Partial<T>,
  actorUid?: string
): Promise<void> => {
  await updateDoc(doc(db, collectionName, id), {
    ...payload,
    updatedBy: actorUid,
    updatedAt: serverTimestamp()
  });
};

export const removeDocument = async (collectionName: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, collectionName, id));
};

export const subscribeCollection = <T>(
  collectionName: string,
  onData: (rows: FirestoreWithMeta<T>[]) => void,
  constraints: QueryConstraint[] = EMPTY_QUERY_CONSTRAINTS
): (() => void) => {
  const q = query(collection(db, collectionName), ...constraints);
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as T)
    }));
    onData(rows);
  });
};

export const subscribeCollectionBy = <T>(
  collectionName: string,
  field: string,
  op: "==" | ">=" | "<=" | "in" | "array-contains",
  value: unknown,
  onData: (rows: FirestoreWithMeta<T>[]) => void
): (() => void) =>
  subscribeCollection<T>(collectionName, onData, [where(field, op as never, value)]);
