"use client";
import { Button, IconButton, Stack, TextField, Tooltip } from "@mui/material";
import { Add, DeleteOutline } from "@mui/icons-material";
import { useTranslations } from "next-intl";

import { useWizardDispatch, useWizardState, useFieldError } from "../WizardProvider";
import LanguageSelect from "./LanguageSelect";

// repeatable [language][text] rows, used for both captions and descriptions
const MultilingualTextRows = ({
  path,
  addLabel,
  placeholder,
  multiline = false,
  maxLength,
}) => {
  const t = useTranslations("UploadWizard");
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const groupError = useFieldError(path);

  const rows = path.split(".").reduce((acc, key) => acc[key], state.metadata);
  const usedCodes = rows.map((row) => row.lang);

  return (
    <Stack spacing={1.5}>
      {rows.map((row, index) => (
        <Stack
          key={row.key ?? index}
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
        >
          <LanguageSelect
            value={row.lang}
            disabledCodes={usedCodes}
            label={t("describe.caption_language")}
            onChange={(lang) =>
              dispatch({ type: "ROW_SET", path, index, value: { lang } })
            }
          />
          <TextField
            fullWidth
            size="small"
            multiline={multiline}
            minRows={multiline ? 3 : undefined}
            placeholder={placeholder}
            value={row.text}
            slotProps={{ htmlInput: { maxLength } }}
            onChange={(event) =>
              dispatch({
                type: "ROW_SET",
                path,
                index,
                value: { text: event.target.value },
              })
            }
            error={!!groupError && index === 0 && !row.text.trim()}
          />
          {rows.length > 1 && (
            <Tooltip title={t("common.remove")}>
              <IconButton
                aria-label={t("common.remove")}
                onClick={() => dispatch({ type: "ROW_REMOVE", path, index })}
                sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
              >
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ))}
      <Stack direction="row">
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => dispatch({ type: "ROW_ADD", path })}
        >
          {addLabel}
        </Button>
      </Stack>
    </Stack>
  );
};

export default MultilingualTextRows;
