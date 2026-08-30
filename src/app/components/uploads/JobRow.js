"use client";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { OpenInNew } from "@mui/icons-material";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { retryImageStructuredData } from "../../actions/image";
import { retryStructuredData } from "../../actions/video";
import { canArchive, canCancel, canRetry, isActive } from "../../utils/jobStatus";
import PublishProgress from "../UploadWizard/review/PublishProgress";
import StatusChip from "./StatusChip";

const stripPrefix = (filename) => (filename || "").replace(/^File:/, "");

// One card per job. `busy` disables the actions while the list has an
// in-flight request for this job; `onAction(name)` is handled by the list.
const JobRow = ({ job, busy, onAction, onChanged }) => {
  const t = useTranslations();
  const tu = useTranslations("Uploads");
  const locale = useLocale();
  const [sdcBusy, setSdcBusy] = useState(false);
  const [sdcFixed, setSdcFixed] = useState(false);

  const destination = tu(`destination_${job.provider}`);
  const stageText = isActive(job.status)
    ? t(`UploadForm_${job.kind}_stage_${job.status}`, { destination })
    : "";

  const sdcFailed = job.status === "done" && job.sdc && !job.sdc.ok && !sdcFixed;
  const canRetrySdc =
    sdcFailed &&
    job.provider === "commons" &&
    (job.kind === "video" || !!job.result?.uploadId);

  const onRetrySdc = async () => {
    setSdcBusy(true);
    try {
      const response =
        job.kind === "video"
          ? await retryStructuredData(job.id)
          : await retryImageStructuredData(job.result.uploadId);
      if (response?.ok) {
        setSdcFixed(true);
        onChanged?.();
      } else {
        toast.error(t("UploadWizard.review.sdc_retry_failed"));
      }
    } finally {
      setSdcBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Tooltip title={stripPrefix(job.filename)}>
            <Typography
              variant="subtitle1"
              component="h3"
              sx={{
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {stripPrefix(job.filename)}
            </Typography>
          </Tooltip>
          <StatusChip status={job.status} />
        </Stack>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
          {tu(`kind_${job.kind}`)} · {destination}
          {job.createdAt && ` · ${new Date(job.createdAt).toLocaleString(locale)}`}
        </Typography>

        {stageText && <PublishProgress stage={stageText} progress={job.progress} />}

        {job.status === "error" && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {job.error}
            {job.errorDetail && (
              <Box component="details" sx={{ mt: 0.5 }}>
                <summary>{tu("actions.show_details")}</summary>
                <Box
                  component="pre"
                  sx={{ whiteSpace: "pre-wrap", fontSize: 11, m: 0, maxHeight: 160, overflow: "auto" }}
                >
                  {job.errorDetail}
                </Box>
              </Box>
            )}
          </Alert>
        )}

        {sdcFailed && (
          <Alert
            severity="warning"
            sx={{ mt: 1 }}
            action={
              canRetrySdc && (
                <Button color="inherit" size="small" disabled={sdcBusy} onClick={onRetrySdc}>
                  {t("UploadWizard.review.sdc_retry")}
                </Button>
              )
            }
          >
            {t("UploadWizard.review.sdc_failed")}
          </Alert>
        )}
      </CardContent>

      <CardActions sx={{ flexWrap: "wrap", gap: 0.5 }}>
        {job.result?.descriptionurl && (
          <Button
            size="small"
            endIcon={<OpenInNew fontSize="small" />}
            href={job.result.descriptionurl}
            target="_blank"
            rel="noreferrer"
          >
            {tu("actions.view_file")}
          </Button>
        )}
        {isActive(job.status) && (
          <Button
            size="small"
            color="error"
            disabled={busy || !canCancel(job)}
            onClick={() => onAction("cancel")}
          >
            {job.cancelRequested ? tu("actions.cancelling") : tu("actions.cancel")}
          </Button>
        )}
        {canRetry(job) && (
          <Button size="small" disabled={busy} onClick={() => onAction("retry")}>
            {tu("actions.retry")}
          </Button>
        )}
        {canArchive(job) && (
          <Button
            size="small"
            disabled={busy}
            onClick={() => onAction(job.archived ? "unarchive" : "archive")}
          >
            {job.archived ? tu("actions.unarchive") : tu("actions.archive")}
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default JobRow;
