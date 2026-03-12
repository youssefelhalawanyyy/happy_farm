import { useEffect, useState } from "react";
import type { QueryConstraint } from "firebase/firestore";
import { subscribeCollection, type FirestoreWithMeta } from "@/lib/firestore";

interface UseRealtimeCollectionResult<T> {
  data: FirestoreWithMeta<T>[];
  loading: boolean;
}

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export const useRealtimeCollection = <T>(
  collectionName: string,
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS
): UseRealtimeCollectionResult<T> => {
  const [data, setData] = useState<FirestoreWithMeta<T>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeCollection<T>(collectionName, (rows) => {
      setData(rows);
      setLoading(false);
    }, constraints);

    return () => unsubscribe();
  }, [collectionName, ...constraints]);

  return { data, loading };
};
