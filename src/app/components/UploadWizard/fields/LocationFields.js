"use client";
import { useState } from "react";
import { IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { MyLocation } from "@mui/icons-material";
import { useTranslations } from "next-intl";

import { useFieldError, useWizardDispatch, useWizardState } from "../WizardProvider";

// lat/lon/heading + geolocate button. Values stay strings while typing so "-"
// and "48." are editable; the normalizer coerces them.
const LocationFields = () => {
  const t = useTranslations("UploadWizard");
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const [denied, setDenied] = useState(false);

  const location = state.metadata.describe.location;
  // called unconditionally, `||` would skip hook calls
  const groupError = useFieldError("describe.location");
  const latError = useFieldError("describe.location.lat");
  const lonError = useFieldError("describe.location.lon");
  const headingError = useFieldError("describe.location.heading");
  const error = groupError || latError || lonError || headingError;

  const set = (field) => (event) =>
    dispatch({
      type: "SET_FIELD",
      path: `describe.location.${field}`,
      value: event.target.value === "" ? null : event.target.value,
    });

  const geolocate = () => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDenied(false);
        dispatch({
          type: "SET_FIELD",
          path: "describe.location.lat",
          value: position.coords.latitude,
        });
        dispatch({
          type: "SET_FIELD",
          path: "describe.location.lon",
          value: position.coords.longitude,
        });
      },
      () => setDenied(true)
    );
  };

  const field = (label, key) => (
    <TextField
      size="small"
      label={label}
      value={location[key] ?? ""}
      onChange={set(key)}
      error={!!error}
      slotProps={{ htmlInput: { inputMode: "decimal" } }}
      sx={{ flex: 1, minWidth: 110 }}
    />
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap">
        {field(t("describe.latitude"), "lat")}
        {field(t("describe.longitude"), "lon")}
        {field(t("describe.heading"), "heading")}
        <Tooltip title={t("describe.geolocate")}>
          <IconButton aria-label={t("describe.geolocate")} onClick={geolocate}>
            <MyLocation fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {error && (
        <Typography variant="caption" color="error">
          {t(`errors.${error}`)}
        </Typography>
      )}
      {denied && (
        <Typography variant="caption" color="text.secondary">
          {t("describe.geolocate_denied")}
        </Typography>
      )}
    </Stack>
  );
};

export default LocationFields;
