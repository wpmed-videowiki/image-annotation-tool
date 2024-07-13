"use client";

import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function AppProviders({ children }) {
  return (
    <SessionProvider>
      <ToastContainer />
      <Suspense fallback="loading">{children}</Suspense>
    </SessionProvider>
  );
}
