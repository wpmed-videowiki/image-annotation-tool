"use client";
import { MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

import useFileExists from "../../../hooks/useFileExists";
import {
  useField,
  useWizardDispatch,
  useWizardMedia,
  useWizardState,
} from "../WizardProvider";

// Video is always .webm so its extension is a static adornment; raster images
// pick from png/jpg/jpeg, SVG is locked to .svg.
const FileNameField = () => {
  const t = useTranslations("UploadWizard");
  const { value, setValue, error } = useField("describe.title");
  const { extensionChoices, hasTransparency } = useWizardMedia();
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const extension = state.publish.extension;
  const { exists } = useFileExists(value, extension);

  return (
    <Stack spacing={0.5}>
      <TextField
        size="small"
        required
        label={t("describe.title_label")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={!!error}
        helperText={error ? t(`errors.${error}`) : t("describe.title_help")}
        slotProps={{
          input: {
            startAdornment: (
              <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                File:
              </Typography>
            ),
            endAdornment:
              extensionChoices.length > 1 ? (
                <Select
                  variant="standard"
                  disableUnderline
                  value={extension}
                  onChange={(event) =>
                    dispatch({
                      type: "SET_PUBLISH",
                      value: { extension: event.target.value },
                    })
                  }
                  inputProps={{ "aria-label": t("describe.extension_label") }}
                  sx={{ ml: 0.5, "& .MuiSelect-select": { py: 0 } }}
                >
                  {extensionChoices.map((choice) => (
                    <MenuItem key={choice} value={choice}>
                      .{choice}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                  .{extension}
                </Typography>
              ),
          },
        }}
      />
      {/* duplicate name is a warning, not a blocker */}
      {exists && !error && (
        <Typography variant="caption" color="warning.main">
          {t("errors.title_exists")}
        </Typography>
      )}
      {/* a removed background only survives as PNG; JPEG fills it with black */}
      {hasTransparency && (extension === "jpg" || extension === "jpeg") && (
        <Typography variant="caption" color="warning.main">
          {t("describe.png_recommended_for_transparency")}
        </Typography>
      )}
    </Stack>
  );
};

export default FileNameField;
