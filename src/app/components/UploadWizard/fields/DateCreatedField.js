"use client";
import { TextField } from "@mui/material";
import { useTranslations } from "next-intl";

import { useField } from "../WizardProvider";

// native date input instead of @mui/x-date-pickers: we just need the ISO string
// and it saves two dependencies
const DateCreatedField = () => {
  const t = useTranslations("UploadWizard");
  const { value, setValue, error } = useField("describe.date");
  const today = new Date().toISOString().split("T")[0];

  return (
    <TextField
      type="date"
      size="small"
      required
      value={value}
      onChange={(event) => setValue(event.target.value)}
      error={!!error}
      helperText={error ? t(`errors.${error}`) : t("describe.date_help")}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { max: today },
      }}
      sx={{ maxWidth: 260 }}
    />
  );
};

export default DateCreatedField;
