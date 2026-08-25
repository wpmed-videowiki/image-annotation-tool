"use client";
import { useState } from "react";
import { Button, Stack, TextField, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

// Preview of the file page wikitext, with the old form's raw-edit escape hatch.
// The server validates metadata separately so edits can't bypass a blocking answer.
const WikitextPreview = ({ generated, value, edited, onChange, onReset }) => {
  const t = useTranslations("UploadWizard");
  const [editing, setEditing] = useState(false);

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2">{t("review.wikitext_title")}</Typography>
        <Stack direction="row" spacing={1}>
          {edited && (
            <Button size="small" onClick={onReset}>
              {t("review.reset_wikitext")}
            </Button>
          )}
          <Button size="small" onClick={() => setEditing((open) => !open)}>
            {editing ? t("review.done_editing") : t("review.edit_raw")}
          </Button>
        </Stack>
      </Stack>
      <TextField
        size="small"
        fullWidth
        multiline
        minRows={10}
        value={edited ? value : generated}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{
          input: {
            readOnly: !editing,
            sx: { fontFamily: "monospace", fontSize: "0.8rem" },
          },
        }}
      />
      {edited && (
        <Typography variant="caption" color="warning.main">
          {t("review.wikitext_edited_note")}
        </Typography>
      )}
    </Stack>
  );
};

export default WikitextPreview;
