"use client";
import { useMemo } from "react";
import { Alert, Stack, TextField, Typography } from "@mui/material";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { buildFilePageWikitext } from "../../../utils/commonsWikitext";
import { normalizeUploadMetadata } from "../../../utils/uploadMetadata";
import { toMetadata } from "../wizardReducer";
import { useWizardDispatch, useWizardState } from "../WizardProvider";
import PublishProgress from "../review/PublishProgress";
import ReviewSummary from "../review/ReviewSummary";
import WikitextPreview from "../review/WikitextPreview";

const StepReview = ({ provider, otherVersions, publishState }) => {
  const t = useTranslations("UploadWizard");
  const state = useWizardState();
  const dispatch = useWizardDispatch();
  const { data: session } = useSession();

  const profile =
    provider === "nccommons"
      ? session?.user?.nccommonsProfile
      : session?.user?.wikimediaProfile;
  const username = profile?.username || profile?.name || "";

  // same function the server uses, so the preview is accurate
  const extension = state.publish.extension;
  const { value: normalized, ok } = useMemo(
    () => normalizeUploadMetadata(toMetadata(state), { extension }),
    [state, extension]
  );
  const generated = useMemo(
    () => (ok ? buildFilePageWikitext(normalized, { username, otherVersions }) : ""),
    [ok, normalized, username, otherVersions]
  );

  return (
    <Stack spacing={3}>
      <ReviewSummary metadata={normalized} extension={extension} />

      <WikitextPreview
        generated={generated}
        value={state.publish.wikitext}
        edited={state.publish.wikitextEdited}
        onChange={(wikitext) =>
          dispatch({ type: "SET_PUBLISH", value: { wikitext, wikitextEdited: true } })
        }
        onReset={() =>
          dispatch({
            type: "SET_PUBLISH",
            value: { wikitext: "", wikitextEdited: false },
          })
        }
      />

      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{t("review.comment_label")}</Typography>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={3}
          value={state.publish.comment}
          onChange={(event) =>
            dispatch({ type: "SET_PUBLISH", value: { comment: event.target.value } })
          }
        />
      </Stack>

      {provider !== "commons" && (
        <Alert severity="info">{t("review.no_sdc_on_provider")}</Alert>
      )}

      <PublishProgress stage={publishState.stage} progress={publishState.progress} />
    </Stack>
  );
};

export default StepReview;
