"use client";
import { useRef } from "react";
import { Button } from "@mui/material";
import { VideoFile } from "@mui/icons-material";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  MAX_DEVICE_VIDEO_BYTES,
  SUPPORTED_VIDEO_EXTENSIONS,
} from "../config/constants";

const ACCEPT = SUPPORTED_VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(",");

const VideoFilePicker = ({ onFileSelected }) => {
  const inputRef = useRef(null);
  const t = useTranslations();

  const onChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    if (!SUPPORTED_VIDEO_EXTENSIONS.includes(extension)) {
      toast.error(t("UploadForm_video_unsupported_type"));
      return;
    }
    if (file.size > MAX_DEVICE_VIDEO_BYTES) {
      toast.error(t("UploadForm_video_too_large"));
      return;
    }
    onFileSelected(file);
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<VideoFile />}
        onClick={() => inputRef.current?.click()}
      >
        {t("SearchForm_upload_device_video")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={onChange}
      />
    </>
  );
};

export default VideoFilePicker;
