"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

import { buildFilePageWikitext } from "../../utils/commonsWikitext";
import { buildFileName } from "../../utils/fileName";
import {
  hasBlockingError,
  normalizeUploadMetadata,
} from "../../utils/uploadMetadata";
import RequireUploadAuth from "../RequireUploadAuth";
import UploadSuccess from "../UploadSuccess";
import WizardProvider from "./WizardProvider";
import {
  createInitialState,
  STEPS,
  toMetadata,
  validateStep,
  wizardReducer,
} from "./wizardReducer";
import StepDescribe from "./steps/StepDescribe";
import StepRights from "./steps/StepRights";
import StepReview from "./steps/StepReview";

// Paper stays full width on every step; the form steps center in this fixed
// column so nothing jumps between edit and the forms. alignSelf needed because
// Stack spacing resets child margins and kills mx:auto.
const FORM_COLUMN_SX = {
  maxWidth: 900,
  mx: "auto",
  alignSelf: "center",
  width: "100%",
};

const STEP_TITLE_KEYS = [
  "edit_title",
  "rights_title",
  "describe_title",
  "review_title",
];

// Media-agnostic wizard shell. The publish surface comes in as a prop since each
// wrapper (Video/ImageUploadWizard) calls its own publish hook.
const UploadWizardShell = ({
  provider = "commons",
  wikiSource,
  source = {},
  prefill = {},
  publishState,
  editorSlot,
  media = { kind: "video", extensionChoices: ["webm"], defaultExtension: "webm" },
}) => {
  const t = useTranslations("UploadWizard");
  const locale = useLocale();
  const theme = useTheme();
  const { data: session } = useSession();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));

  const [state, dispatch] = useReducer(
    wizardReducer,
    undefined,
    () => createInitialState(prefill, locale, { extension: media.defaultExtension })
  );
  const [publishError, setPublishError] = useState(null);
  const headingRef = useRef(null);
  const hydratedRef = useRef(false);

  // prefill lands once; guard against a late async result clobbering user input
  useEffect(() => {
    if (hydratedRef.current || !prefill?.metadata) return;
    hydratedRef.current = true;
    dispatch({ type: "HYDRATE", metadata: prefill.metadata });
  }, [prefill]);

  // move focus to the step heading for keyboard/screen-reader users
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const stepErrors = useMemo(() => validateStep(state, state.step), [state]);
  const blocked = hasBlockingError(stepErrors);
  const fieldErrors = stepErrors.filter(
    (error) => !hasBlockingError([error])
  );
  const touched = state.touched[STEPS[state.step]];

  const otherVersions = prefill.originalFileName
    ? `See [[:${prefill.originalFileName}|original file]].`
    : "";

  const goTo = (step) => {
    setPublishError(null);
    dispatch({ type: "GOTO_STEP", step });
  };

  const onNext = () => {
    if (fieldErrors.length) {
      // show errors instead of silently disabling Next
      dispatch({ type: "TOUCH_STEP" });
      return;
    }
    goTo(state.step + 1);
  };

  const onPublish = async () => {
    const metadata = toMetadata(state);
    const extension = state.publish.extension;
    const { ok, value } = normalizeUploadMetadata(metadata, { extension });
    if (!ok) {
      dispatch({ type: "TOUCH_STEP" });
      return;
    }
    setPublishError(null);

    const profile =
      provider === "nccommons"
        ? session?.user?.nccommonsProfile
        : session?.user?.wikimediaProfile;
    const username = profile?.username || profile?.name || "";

    const result = await publishState.publish({
      filename: buildFileName(value.describe.title, extension),
      title: value.describe.title,
      extension,
      text: state.publish.wikitextEdited
        ? state.publish.wikitext
        : buildFilePageWikitext(value, { username, otherVersions }),
      textEdited: state.publish.wikitextEdited,
      comment: state.publish.comment,
      metadata,
      otherVersions,
    });

    // keep answers on screen so a recoverable failure is just a retry
    if (!result.ok) setPublishError(result);
  };

  if (publishState.uploadedUrl) {
    return (
      <UploadSuccess
        uploadedUrl={publishState.uploadedUrl}
        wikiSource={wikiSource}
        originalFileName={prefill.originalFileName}
      >
        {publishState.sdc && !publishState.sdc.ok && (
          <Alert
            severity="warning"
            sx={{ width: "100%" }}
            action={
              publishState.retrySdc && (
                <Button
                  color="inherit"
                  size="small"
                  disabled={publishState.loading}
                  onClick={publishState.retrySdc}
                >
                  {t("review.sdc_retry")}
                </Button>
              )
            }
          >
            {t("review.sdc_failed")}
          </Alert>
        )}
      </UploadSuccess>
    );
  }

  const stepName = STEPS[state.step];
  const isLastStep = state.step === STEPS.length - 1;

  return (
    <RequireUploadAuth provider={provider}>
      <Paper
        variant="outlined"
        // no global box-sizing reset; content-box would overhang the grid column
        sx={{ p: { xs: 2, md: 3 }, width: "100%", boxSizing: "border-box" }}
      >
        <Stack spacing={3}>
          {/* narrower than the form column so the steps stay centered */}
          <Box sx={{ ...FORM_COLUMN_SX, maxWidth: 600 }}>
            {isCompact ? (
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ textAlign: "center" }}>
                  {t("common.step_of", {
                    current: state.step + 1,
                    total: STEPS.length,
                    title: t(`steps.${STEP_TITLE_KEYS[state.step]}`),
                  })}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={((state.step + 1) / STEPS.length) * 100}
                />
              </Stack>
            ) : (
              <Stepper activeStep={state.step} alternativeLabel nonLinear>
                {STEP_TITLE_KEYS.map((key, index) => (
                  <Step key={key} completed={index < state.maxVisitedStep}>
                    {index <= state.maxVisitedStep ? (
                      <StepButton onClick={() => goTo(index)}>
                        {t(`steps.${key}`)}
                      </StepButton>
                    ) : (
                      <StepLabel>{t(`steps.${key}`)}</StepLabel>
                    )}
                  </Step>
                ))}
              </Stepper>
            )}
          </Box>

          {/* announce step changes to screen readers */}
          {/* width/height must be "1px", a bare 1 means 100% in sx */}
          <Box aria-live="polite" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {t("common.step_of", {
              current: state.step + 1,
              total: STEPS.length,
              title: t(`steps.${STEP_TITLE_KEYS[state.step]}`),
            })}
          </Box>

          <Box component="section">
            <Box sx={FORM_COLUMN_SX}>
              <Typography
                variant="h6"
                component="h2"
                tabIndex={-1}
                ref={headingRef}
                sx={{ outline: "none", mb: 2 }}
              >
                {t(`steps.${STEP_TITLE_KEYS[state.step]}`)}
              </Typography>

              {touched && fieldErrors.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>
                    {t("errors.fix_issues", { count: fieldErrors.length })}
                  </AlertTitle>
                </Alert>
              )}

              {publishError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {t.has(`errors.${publishError.code}`)
                    ? t(`errors.${publishError.code}`)
                    : publishError.message}
                </Alert>
              )}
            </Box>

            {editorSlot && (
              // hidden, not unmounted: the editors lose all edits on remount
              <Box sx={{ display: stepName === "edit" ? "block" : "none" }}>
                {editorSlot}
              </Box>
            )}

            <Box sx={FORM_COLUMN_SX}>
              <WizardProvider
                state={state}
                dispatch={dispatch}
                errors={fieldErrors}
                touched={touched}
                media={media}
              >
                {stepName === "rights" && <StepRights provider={provider} />}
                {stepName === "describe" && (
                  <StepDescribe provider={provider} source={source} />
                )}
                {stepName === "review" && (
                  <StepReview
                    provider={provider}
                    otherVersions={otherVersions}
                    publishState={publishState}
                  />
                )}
              </WizardProvider>
            </Box>
          </Box>

          <Box
            sx={{
              position: "sticky",
              bottom: 0,
              py: 1.5,
              bgcolor: "background.paper",
              borderTop: 1,
              borderColor: "divider",
              zIndex: 1,
            }}
          >
            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              sx={FORM_COLUMN_SX}
            >
              <Button
                onClick={() => goTo(state.step - 1)}
                disabled={state.step === 0 || publishState.loading}
              >
                {t("common.back")}
              </Button>

              {isLastStep ? (
                <Button
                  variant="contained"
                  startIcon={<UploadFile />}
                  onClick={onPublish}
                  disabled={publishState.loading || blocked}
                  sx={{ minWidth: 200 }}
                >
                  {publishState.loading ? t("review.publishing") : t("review.publish")}
                </Button>
              ) : (
                // span wrapper so the tooltip still works when disabled
                <span>
                  <Button
                    variant="contained"
                    onClick={onNext}
                    disabled={blocked}
                    aria-describedby={blocked ? "blocking-warning" : undefined}
                    sx={{ minWidth: 160 }}
                  >
                    {t("common.next")}
                  </Button>
                </span>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </RequireUploadAuth>
  );
};

export default UploadWizardShell;
