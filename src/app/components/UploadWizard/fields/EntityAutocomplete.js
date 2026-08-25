"use client";
import { useEffect, useRef, useState } from "react";
import { Autocomplete, Chip, Stack, TextField, Typography } from "@mui/material";
import { useDebounce } from "use-debounce";
import { useLocale, useTranslations } from "next-intl";

import { searchWikidataEntities } from "../../../actions/wikidata";
import { MAX_DEPICTS } from "../../../config/constants";
import { useField } from "../WizardProvider";

// "main subjects" field -> SDC depicts (P180)
const EntityAutocomplete = ({ path, label, placeholder }) => {
  const t = useTranslations("UploadWizard");
  const locale = useLocale();
  const { value, setValue } = useField(path);

  const [input, setInput] = useState("");
  const [debouncedInput] = useDebounce(input, 300);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  // server actions can't be aborted, ignore stale responses
  const requestRef = useRef(0);

  useEffect(() => {
    if (debouncedInput.trim().length < 2) {
      setOptions([]);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    searchWikidataEntities(debouncedInput, locale)
      .then((results) => {
        if (requestRef.current === requestId) setOptions(results);
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
  }, [debouncedInput, locale]);

  return (
    <Autocomplete
      multiple
      size="small"
      value={value}
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(option) => option.label || option.id}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      loadingText={t("common.loading")}
      noOptionsText={t("describe.depicts_no_options")}
      onInputChange={(_, next) => setInput(next)}
      onChange={(_, next) => setValue(next.slice(0, MAX_DEPICTS))}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={option.id} {...rest}>
            <Stack>
              <Typography variant="body2">{option.label}</Typography>
              {option.description && (
                <Typography variant="caption" color="text.secondary">
                  {option.description}
                </Typography>
              )}
            </Stack>
          </li>
        );
      }}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => {
          const { key, ...rest } = getTagProps({ index });
          return <Chip key={tag.id} size="small" label={tag.label || tag.id} {...rest} />;
        })
      }
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} />
      )}
    />
  );
};

export default EntityAutocomplete;
