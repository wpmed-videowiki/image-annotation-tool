"use client";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

import { fetchCommonsImage } from "../actions/commons";
import { buildFileName } from "../utils/fileName";

// debounced duplicate-name check; a hit is a warning, not a blocker
export const useFileExists = (title, extension) => {
  const [debouncedTitle] = useDebounce(title, 500);
  const [exists, setExists] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!debouncedTitle) {
      setExists(false);
      return undefined;
    }
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        const page = await fetchCommonsImage(buildFileName(debouncedTitle, extension));
        if (!cancelled) setExists(!!(page && page.pageid));
      } catch {
        if (!cancelled) setExists(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedTitle, extension]);

  return { exists, checking };
};

export default useFileExists;
