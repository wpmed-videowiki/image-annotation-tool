"use client";
import { Divider, Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

// read-only recap of the user's answers before publishing
const Row = ({ label, value }) => {
  if (!value) return null;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Typography variant="body2" sx={{ minWidth: 160, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Stack>
  );
};

const ReviewSummary = ({ metadata, extension = "webm" }) => {
  const t = useTranslations("UploadWizard");
  const { describe, rights } = metadata;

  const rows = describe.sameAsCaption ? describe.captions : describe.descriptions;
  const location = describe.location.lat !== null
    ? [describe.location.lat, describe.location.lon]
        .concat(describe.location.heading !== null ? [`${describe.location.heading}°`] : [])
        .join(", ")
    : "";

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{t("review.summary_title")}</Typography>
      <Divider />
      <Row
        label={t("describe.title_label")}
        value={`File:${describe.title}.${extension}`}
      />
      <Row
        label={t("describe.caption_label")}
        value={describe.captions.map((c) => `${c.lang}: ${c.text}`).join("\n")}
      />
      {!describe.sameAsCaption && (
        <Row
          label={t("describe.description_label")}
          value={rows.map((r) => `${r.lang}: ${r.text}`).join("\n")}
        />
      )}
      <Row label={t("describe.date_label")} value={describe.date} />
      <Row
        label={t("describe.depicts_label")}
        value={describe.depicts.map((d) => d.label || d.id).join(", ")}
      />
      <Row label={t("describe.category_label")} value={describe.categories.join(", ")} />
      <Row label={t("describe.location_label")} value={location} />
      <Row
        label={t("review.rights_label")}
        value={t(
          rights.ownership === "own"
            ? "rights.ownership_own"
            : "rights.ownership_thirdparty"
        )}
      />
    </Stack>
  );
};

export default ReviewSummary;
