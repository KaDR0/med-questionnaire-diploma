import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  getIdToken,
} from "firebase/auth";
import { auth } from "../firebase";
import api from "../api/axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [backendUser, setBackendUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncUserWithBackend = async (user) => {
    const idToken = await getIdToken(user);

    const response = await api.post("auth/firebase-login/", {
      id_token: idToken,
    });

    setBackendUser(response.data.user);
    return response.data.user;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setFirebaseUser(null);
          setBackendUser(null);
          setLoading(false);
          return;
        }

        setFirebaseUser(user);
        await syncUserWithBackend(user);
      } catch (error) {
        console.error("Auth sync error:", error);
        setFirebaseUser(null);
        setBackendUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await syncUserWithBackend(result.user);
  };

  const signup = async ({ email, password, first_name, last_name }) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    const fullName = `${first_name || ""} ${last_name || ""}`.trim();

    if (fullName) {
      await updateProfile(result.user, {
        displayName: fullName,
      });
    }

    await syncUserWithBackend(result.user);

    return {
      message: "SIGNUP_SUCCESS",
    };
  };

  const logout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setBackendUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: backendUser,
        firebaseUser,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!firebaseUser && !!backendUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}