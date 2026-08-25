"use client";
import { useEffect } from "react";

// warn before navigating away while `enabled`
export const useBeforeUnload = (enabled) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
};

export default useBeforeUnload;
