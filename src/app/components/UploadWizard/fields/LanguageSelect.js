"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useDebounce } from "use-debounce";

import {
  fetchCommonsLanguages,
  searchCommonsLanguages,
} from "../../../actions/commons";
import { FALLBACK_CAPTION_LANGUAGES } from "../../../config/constants";

// module-scope cache, fetch the list once per page load
let languagesPromise = null;

const loadLanguages = () => {
  if (!languagesPromise) languagesPromise = fetchCommonsLanguages();
  return languagesPromise;
};

// Browsing shows the wiki's languages; typing hits the languagesearch API so
// "french" finds "français". Results get mapped back onto the wiki's list so we
// only offer codes the wiki accepts.
const LanguageSelect = ({ value, onChange, disabledCodes = [], label }) => {
  const [languages, setLanguages] = useState(FALLBACK_CAPTION_LANGUAGES);
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null); // null = not searching
  const [debouncedInput] = useDebounce(input, 300);
  // server actions can't be aborted, ignore stale responses
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadLanguages().then((list) => {
      if (!cancelled && list?.length) setLanguages(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const byCode = useMemo(
    () => new Map(languages.map((language) => [language.code, language])),
    [languages]
  );

  const browseOptions = useMemo(() => {
    // keep the current row's language selectable
    const list = byCode.has(value)
      ? languages
      : [{ code: value, name: value }, ...languages];
    // sort alphabetically by name, API returns code order
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [languages, byCode, value]);

  useEffect(() => {
    const query = debouncedInput.trim();
    if (!query) {
      setResults(null);
      setSearching(false);
      return;
    }
    const requestId = ++requestRef.current;
    setSearching(true);
    searchCommonsLanguages(query)
      .then((matches) => {
        if (requestRef.current !== requestId) return;
        // keep API relevance order, drop codes the wiki doesn't know
        setResults(matches.filter((match) => byCode.has(match.code)).map((match) => byCode.get(match.code)));
      })
      .finally(() => {
        if (requestRef.current === requestId) setSearching(false);
      });
  }, [debouncedInput, byCode]);

  const options = results ?? browseOptions;
  const selected = browseOptions.find((language) => language.code === value) ?? null;

  return (
    <Autocomplete
      size="small"
      options={options}
      value={selected}
      loading={searching}
      onChange={(event, option) => option && onChange(option.code)}
      onInputChange={(event, next, reason) => {
        // only real typing searches; selection/blur resets show the full list
        setInput(reason === "input" ? next : "");
      }}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, current) => option.code === current.code}
      getOptionDisabled={(option) =>
        option.code !== value && disabledCodes.includes(option.code)
      }
      // filtering is server-side
      filterOptions={(x) => x}
      // a row always has a language, nothing to clear
      disableClearable
      autoHighlight
      // key by code, some languages share an autonym across codes
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={option.code} {...rest}>
            {option.name}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} />}
      sx={{ minWidth: { xs: "100%", sm: 200 } }}
    />
  );
};

export default LanguageSelect;
