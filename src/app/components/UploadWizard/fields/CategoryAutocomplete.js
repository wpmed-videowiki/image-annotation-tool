"use client";
import { useEffect, useRef, useState } from "react";
import { Autocomplete, Chip, TextField } from "@mui/material";
import { useDebounce } from "use-debounce";
import { useTranslations } from "next-intl";

import { searchCommonsCategories } from "../../../actions/commons";
import { MAX_CATEGORIES } from "../../../config/constants";
import { useField } from "../WizardProvider";

// free-solo so brand-new categories can be added
const CategoryAutocomplete = ({ path, label, placeholder, provider }) => {
  const t = useTranslations("UploadWizard");
  const { value, setValue } = useField(path);

  const [input, setInput] = useState("");
  const [debouncedInput] = useDebounce(input, 300);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (debouncedInput.trim().length < 2) {
      setOptions([]);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    searchCommonsCategories(debouncedInput, provider)
      .then((results) => {
        if (requestRef.current === requestId) setOptions(results);
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [debouncedInput, provider]);

  return (
    <Autocomplete
      multiple
      freeSolo
      size="small"
      value={value}
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      loadingText={t("common.loading")}
      noOptionsText={t("describe.category_no_options")}
      onInputChange={(_, next) => setInput(next)}
      onChange={(_, next) =>
        setValue([...new Set(next.map((entry) => String(entry).trim()).filter(Boolean))]
          .slice(0, MAX_CATEGORIES))
      }
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => {
          const { key, ...rest } = getTagProps({ index });
          return <Chip key={tag} size="small" label={tag} {...rest} />;
        })
      }
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} />
      )}
    />
  );
};

export default CategoryAutocomplete;
