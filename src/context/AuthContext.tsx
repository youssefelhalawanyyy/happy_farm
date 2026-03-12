import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/types";
import { COLLECTIONS } from "@/lib/constants";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrapAdmin: (email: string, password: string, displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const createUserProfileIfMissing = async (currentUser: User): Promise<UserProfile> => {
  const ref = doc(db, COLLECTIONS.users, currentUser.uid);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    return existing.data() as UserProfile;
  }

  const fallbackRole: UserRole = "worker";
  const profile: UserProfile = {
    uid: currentUser.uid,
    email: currentUser.email ?? "",
    displayName: currentUser.displayName ?? "Farm User",
    role: fallbackRole,
    disabled: false
  };

  await setDoc(ref, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid
  });

  return profile;
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await createUserProfileIfMissing(nextUser);
        if (nextProfile.disabled) {
          await signOut(auth);
          setProfile(null);
          return;
        }

        setProfile(nextProfile);
      } catch (error) {
        console.error("Failed to load user profile from Firestore:", error);
        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error("Failed to sign out after profile load failure:", signOutError);
        }
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        await signOut(auth);
      },
      bootstrapAdmin: async (email: string, password: string, displayName: string) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const ref = doc(db, COLLECTIONS.users, credential.user.uid);
        await setDoc(ref, {
          uid: credential.user.uid,
          email,
          displayName,
          role: "admin",
          disabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: credential.user.uid,
          updatedBy: credential.user.uid
        });
      }
    }),
    [loading, profile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
