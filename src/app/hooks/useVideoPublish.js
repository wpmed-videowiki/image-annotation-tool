"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { createVideoJob, getVideoJobStatus } from "../actions/video";
import { uploadDeviceFileToServer } from "../utils/uploadDeviceFile";
import useBeforeUnload from "./useBeforeUnload";

const ACTIVE_STATUSES = [
  "queued",
  "downloading",
  "processing",
  "uploading",
  "publishing",
];

const POLL_INTERVAL_MS = 2000;

// Video publish pipeline: chunk-upload the file, queue a VideoJob, poll it.
export const useVideoPublish = ({ provider, wikiSource, editorRef }) => {
  const t = useTranslations();
  const pollRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [sdc, setSdc] = useState(null);
  const [jobId, setJobId] = useState("");

  const destinationName =
    provider === "nccommons" ? "NC Commons" : "Wikimedia Commons";

  useEffect(() => () => clearInterval(pollRef.current), []);
  useBeforeUnload(loading);

  const pollVideoJob = useCallback(
    (id) => {
      pollRef.current = setInterval(async () => {
        try {
          const status = await getVideoJobStatus(id);
          if (!status) return;
          setProgress(status.progress || 0);
          if (ACTIVE_STATUSES.includes(status.status)) {
            setStage(
              t(`UploadForm_video_stage_${status.status}`, {
                destination: destinationName,
              })
            );
          }
          if (status.status === "done") {
            clearInterval(pollRef.current);
            setStage("");
            setUploadedUrl(status.result?.descriptionurl || "");
            setSdc(status.sdc || null);
            toast.success("File uploaded successfully");
            setLoading(false);
          } else if (status.status === "error") {
            clearInterval(pollRef.current);
            setStage("");
            toast.error(status.error || t("UploadForm_video_job_failed"));
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
    async ({ filename, text, comment, metadata, otherVersions, textEdited }) => {
      setLoading(true);
      setProgress(0);
      try {
        const videoData = editorRef.current.getVideoData();

        let deviceUploadId = "";
        if (videoData.sourceType === "device") {
          setStage(t("UploadForm_video_stage_uploading_to_server"));
          const uploadResponse = await uploadDeviceFileToServer(
            videoData.deviceFile,
            setProgress
          );
          deviceUploadId = uploadResponse.uploadId;
        }

        setStage(
          t("UploadForm_video_stage_queued", { destination: destinationName })
        );
        setProgress(0);

        const response = await createVideoJob({
          sourceType: videoData.sourceType,
          sourceUrl: videoData.sourceUrl || "",
          deviceUploadId,
          ops: videoData.ops,
          target: {
            filename,
            text,
            comment: (comment || "").trim(),
            provider,
            wikiSource: wikiSource || "",
            otherVersions: otherVersions || "",
            textEdited: !!textEdited,
          },
          ...(metadata ? { metadata } : {}),
        });

        if (response?.error || !response?.jobId) {
          const error = new Error(response?.error || t("UploadForm_video_job_failed"));
          error.code = response?.error;
          error.fields = response?.fields || [];
          throw error;
        }
        setJobId(response.jobId);
        pollVideoJob(response.jobId);
        return { ok: true, jobId: response.jobId };
      } catch (err) {
        console.log(err);
        setStage("");
        setLoading(false);
        // returned as well as toasted so the wizard can offer a retry
        return { ok: false, code: err.code, fields: err.fields || [], message: err.message };
      }
    },
    [destinationName, editorRef, pollVideoJob, provider, t, wikiSource]
  );

  return { publish, loading, stage, progress, uploadedUrl, sdc, jobId, destinationName };
};

export default useVideoPublish;
