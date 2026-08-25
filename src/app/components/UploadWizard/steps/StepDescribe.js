"use client";
import {
  Alert,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";

import { MAX_CAPTION_LENGTH } from "../../../config/constants";
import { useField, useWizardState } from "../WizardProvider";
import CategoryAutocomplete from "../fields/CategoryAutocomplete";
import CollapsibleSection from "../fields/CollapsibleSection";
import DateCreatedField from "../fields/DateCreatedField";
import EntityAutocomplete from "../fields/EntityAutocomplete";
import FileNameField from "../fields/FileNameField";
import LocationFields from "../fields/LocationFields";
import MultilingualTextRows from "../fields/MultilingualTextRows";

const SectionLabel = ({ children, hint }) => (
  <Stack spacing={0.25}>
    <Typography variant="subtitle2">{children}</Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary">
        {hint}
      </Typography>
    )}
  </Stack>
);

const StepDescribe = ({ provider, source }) => {
  const t = useTranslations("UploadWizard");
  const state = useWizardState();
  const sameAsCaption = useField("describe.sameAsCaption");
  const otherInformation = useField("describe.otherInformation");

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">

      <Stack spacing={3} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        <FileNameField />

        <Stack spacing={1}>
          <SectionLabel hint={t("describe.caption_hint")}>
            {t("describe.caption_label")}
          </SectionLabel>
          <MultilingualTextRows
            path="describe.captions"
            addLabel={t("describe.caption_add")}
            maxLength={MAX_CAPTION_LENGTH}
          />
        </Stack>

        <Stack spacing={1}>
          <SectionLabel hint={t("describe.description_hint")}>
            {t("describe.description_label")}
          </SectionLabel>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!sameAsCaption.value}
                onChange={(event) => sameAsCaption.setValue(event.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                {t("describe.description_same_as_caption")}
              </Typography>
            }
          />
          {!sameAsCaption.value && (
            <MultilingualTextRows
              path="describe.descriptions"
              addLabel={t("describe.description_add")}
              multiline
            />
          )}
        </Stack>

        <Stack spacing={1}>
          <SectionLabel hint={t("describe.date_hint")}>
            {t("describe.date_label")}
          </SectionLabel>
          <DateCreatedField />
        </Stack>

        <Stack spacing={2}>
          <SectionLabel hint={t("describe.additional_hint")}>
            {t("describe.additional_label")}
          </SectionLabel>
          <EntityAutocomplete
            path="describe.depicts"
            label={t("describe.depicts_label")}
            placeholder={t("describe.depicts_placeholder")}
          />
          <CategoryAutocomplete
            path="describe.categories"
            label={t("describe.category_label")}
            placeholder={t("describe.category_placeholder")}
            provider={provider}
          />
          <Stack spacing={0.5}>
            <Typography variant="body2">{t("describe.location_label")}</Typography>
            <LocationFields />
          </Stack>
          <CollapsibleSection label={t("describe.other_info_label")} defaultOpen>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={3}
              value={otherInformation.value}
              onChange={(event) => otherInformation.setValue(event.target.value)}
            />
          </CollapsibleSection>
        </Stack>

        <Alert severity="info" icon={false} sx={{ fontSize: "0.8rem" }}>
          {t("describe.cc0_notice")}
        </Alert>
      </Stack>
    </Stack>
  );
};

export default StepDescribe;
