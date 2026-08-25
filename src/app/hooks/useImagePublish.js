"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { publishImage, retryImageStructuredData } from "../actions/image";
import { base64ToBlob } from "../utils/base64ToBlob";
import { renderWithinLimit } from "../utils/renderWithinLimit";
import { MAX_IMAGE_UPLOAD_BYTES } from "../config/constants";
import useBeforeUnload from "./useBeforeUnload";

const MIME_BY_EXTENSION = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// canvas format name only differs from the extension for jpg
const canvasFormat = (extension) => (extension === "jpg" ? "jpeg" : extension);

// Image publish surface, same shape as useVideoPublish so the shell can drive
// either. Synchronous: one server action call, no job or polling.
export const useImagePublish = ({ provider, wikiSource, editorRef }) => {
  const t = useTranslations();

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [sdc, setSdc] = useState(null);
  const [uploadId, setUploadId] = useState(null);

  const destinationName =
    provider === "nccommons" ? "NC Commons" : "Wikimedia Commons";

  useBeforeUnload(loading);

  const publish = useCallback(
    async ({ title, extension, text, textEdited, comment, metadata, otherVersions }) => {
      setLoading(true);
      setProgress(0);
      try {
        setStage(t("UploadForm_image_stage_rendering"));
        setProgress(10);
        const blob = await renderWithinLimit(
          async (multiplier) => {
            const dataUrl = await editorRef.current.toDataURL({
              format: canvasFormat(extension),
              quality: 1,
              multiplier,
            });
            return base64ToBlob(
              dataUrl.split(",")[1],
              MIME_BY_EXTENSION[extension] || "application/octet-stream"
            );
          },
          { maxBytes: MAX_IMAGE_UPLOAD_BYTES }
        );
        if (!blob) {
          throw new Error(t("UploadForm_image_render_too_large"));
        }

        const formData = new FormData();
        formData.append("file", blob, `${title}.${extension}`);
        formData.append("metadata", JSON.stringify(metadata));
        formData.append("extension", extension);
        formData.append("comment", (comment || "").trim());
        formData.append("text", text || "");
        formData.append("textEdited", textEdited ? "true" : "false");
        formData.append("provider", provider || "commons");
        formData.append("wikiSource", wikiSource || "");
        formData.append("otherVersions", otherVersions || "");

        setStage(
          t("UploadForm_image_stage_uploading", { destination: destinationName })
        );
        setProgress(40);
        const response = await publishImage(formData);

        if (response?.error || !response?.ok) {
          const error = new Error(
            response?.error || t("UploadForm_image_upload_failed")
          );
          error.code = response?.error;
          error.fields = response?.fields || [];
          throw error;
        }

        setProgress(100);
        setStage("");
        setUploadedUrl(response.descriptionurl || "");
        setSdc(response.sdc || null);
        setUploadId(response.uploadId || null);
        toast.success("File uploaded successfully");
        setLoading(false);
        return { ok: true };
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
    [destinationName, editorRef, provider, t, wikiSource]
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
