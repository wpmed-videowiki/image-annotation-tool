"use client";
import { createContext, useContext } from "react";

const AuthContext = createContext({ user: null });

export const AuthProvider = ({ user, children }) => (
  <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
);

export const useAuth = () => useContext(AuthContext);

// full-page redirect into the OAuth flow; returnTo must be a same-origin path
export const loginHref = (provider, returnTo) => {
  const path =
    returnTo ||
    (typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/");
  return `/api/auth/login/${provider}?returnTo=${encodeURIComponent(path)}`;
};

export default AuthProvider;
