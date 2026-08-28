"use client";

import { Suspense } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./components/AuthProvider";

export default function AppProviders({ user, children }) {
  return (
    <AuthProvider user={user}>
      <ToastContainer />
      <Suspense fallback="loading">{children}</Suspense>
    </AuthProvider>
  );
}
