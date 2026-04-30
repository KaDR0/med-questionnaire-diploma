import { createContext, useContext, useEffect, useState } from "react";
import api, { clearStoredTokens, getStoredTokens, setAuthHandlers, storeTokens } from "../api/axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthHandlers({
      handleLogout: () => {
        setUser(null);
      },
      handleTokenRefresh: () => {},
    });
    return () => setAuthHandlers({ handleLogout: null, handleTokenRefresh: null });
  }, []);

  const fetchMe = async () => {
    const meResponse = await api.get("auth/me/");
    setUser(meResponse.data);
    return meResponse.data;
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { access, refresh } = getStoredTokens();
        if (!access && !refresh) {
          setLoading(false);
          return;
        }
        if (!access && refresh) {
          const refreshResponse = await api.post("auth/token/refresh/", { refresh });
          storeTokens({ access: refreshResponse.data.access });
        }
        await fetchMe();
      } catch (error) {
        clearStoredTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email, password) => {
    const response = await api.post("auth/login/", { email, password });
    if (response.data?.verification_required) {
      return response.data;
    }
    storeTokens({ access: response.data.access, refresh: response.data.refresh });
    setUser(response.data.user);
    return response.data;
  };

  const verifyPatientLoginCode = async (challengeToken, code) => {
    const response = await api.post("auth/patient-login/verify-code/", {
      challenge_token: challengeToken,
      code,
    });
    storeTokens({ access: response.data.access, refresh: response.data.refresh });
    setUser(response.data.user);
    return response.data;
  };

  const signup = async () => {
    throw new Error("Legacy signup is disabled. Use patient or doctor OTP signup flow.");
  };

  const logout = async () => {
    try {
      const { refresh } = getStoredTokens();
      if (refresh) {
        await api.post("auth/logout/", { refresh });
      }
    } catch (_e) {
      // Ignore logout network errors, local cleanup is still required.
    } finally {
      clearStoredTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyPatientLoginCode,
        signup,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}