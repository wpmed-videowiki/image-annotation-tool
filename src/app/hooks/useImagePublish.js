"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import {
  createImageJob,
  getImageJobStatus,
  retryImageStructuredData,
} from "../actions/image";
import { editorToBlob } from "../utils/editorToBlob";
import { renderWithinLimit } from "../utils/renderWithinLimit";
import { uploadDeviceFileToServer } from "../utils/uploadDeviceFile";
import { MAX_IMAGE_UPLOAD_BYTES } from "../config/constants";
import useBeforeUnload from "./useBeforeUnload";

const ACTIVE_STATUSES = ["queued", "uploading", "publishing"];

const POLL_INTERVAL_MS = 2000;

// Image publish pipeline, same shape as useVideoPublish so the shell can
// drive either: render, chunk-upload the blob, queue an image job, poll it.
export const useImagePublish = ({ provider, wikiSource, editorRef }) => {
  const t = useTranslations();
  const pollRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [sdc, setSdc] = useState(null);
  const [uploadId, setUploadId] = useState(null);

  const destinationName =
    provider === "nccommons" ? "NC Commons" : "Wikimedia Commons";

  useEffect(() => () => clearInterval(pollRef.current), []);
  useBeforeUnload(loading);

  const pollImageJob = useCallback(
    (id) => {
      pollRef.current = setInterval(async () => {
        try {
          const status = await getImageJobStatus(id);
          if (!status) return;
          setProgress(status.progress || 0);
          if (ACTIVE_STATUSES.includes(status.status)) {
            setStage(
              t(`UploadForm_image_stage_${status.status}`, {
                destination: destinationName,
              })
            );
          }
          if (status.status === "done") {
            clearInterval(pollRef.current);
            setStage("");
            setUploadedUrl(status.result?.descriptionurl || "");
            setSdc(status.sdc || null);
            setUploadId(status.result?.uploadId || null);
            toast.success("File uploaded successfully");
            setLoading(false);
          } else if (status.status === "error") {
            clearInterval(pollRef.current);
            setStage("");
            toast.error(status.error || t("UploadForm_image_upload_failed"));
            setLoading(false);
          }
        } catch (err) {
          console.log(err);
        }
      }, POLL_INTERVAL_MS);
    },
    [destinationName, t]
  );

  const publish = useCallback(
    async ({ title, extension, text, textEdited, comment, metadata, otherVersions }) => {
      setLoading(true);
      setProgress(0);
      try {
        setStage(t("UploadForm_image_stage_rendering"));
        setProgress(10);
        const blob = await renderWithinLimit(
          (multiplier) =>
            editorToBlob(editorRef.current, { extension, multiplier, quality: 1 }),
          { maxBytes: MAX_IMAGE_UPLOAD_BYTES }
        );
        if (!blob) {
          throw new Error(t("UploadForm_image_render_too_large"));
        }

        // the render travels to the server in chunks; the job only gets a
        // reference to the assembled temp file
        setStage(t("UploadForm_image_stage_uploading_to_server"));
        const file = new File([blob], `${title}.${extension}`, {
          type: blob.type,
        });
        const { uploadId: serverUploadId } = await uploadDeviceFileToServer(
          file,
          (pct) => setProgress(10 + pct * 0.5),
          "/api/image/upload-chunk"
        );

        const formData = new FormData();
        formData.append("uploadId", serverUploadId);
        formData.append("metadata", JSON.stringify(metadata));
        formData.append("extension", extension);
        formData.append("comment", (comment || "").trim());
        formData.append("text", text || "");
        formData.append("textEdited", textEdited ? "true" : "false");
        formData.append("provider", provider || "commons");
        formData.append("wikiSource", wikiSource || "");
        formData.append("otherVersions", otherVersions || "");

        setStage(
          t("UploadForm_image_stage_queued", { destination: destinationName })
        );
        setProgress(0);

        const response = await createImageJob(formData);
        if (response?.error || !response?.jobId) {
          const error = new Error(
            response?.error || t("UploadForm_image_upload_failed")
          );
          error.code = response?.error;
          error.fields = response?.fields || [];
          throw error;
        }
        pollImageJob(response.jobId);
        return { ok: true, jobId: response.jobId };
      } catch (err) {
        console.log(err);
        setStage("");
        setLoading(false);
        // returned as well as logged so the wizard can offer a retry
        return {
          ok: false,
          code: err.code,
          fields: err.fields || [],
          message: err.message,
        };
      }
    },
    [destinationName, editorRef, pollImageJob, provider, t, wikiSource]
  );

  const retrySdc = useCallback(async () => {
    if (!uploadId) return;
    setLoading(true);
    try {
      const response = await retryImageStructuredData(uploadId);
      if (response?.ok) {
        setSdc({ ok: true, error: "" });
      } else {
        toast.error(t("UploadWizard.review.sdc_retry_failed"));
      }
    } finally {
      setLoading(false);
    }
  }, [t, uploadId]);

  return {
    publish,
    loading,
    stage,
    progress,
    uploadedUrl,
    sdc,
    uploadId,
    retrySdc,
    destinationName,
  };
};

export default useImagePublish;
