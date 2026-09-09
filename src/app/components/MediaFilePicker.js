"use client";
import { useRef, useState } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  MAX_DEVICE_IMAGE_BYTES,
  MAX_DEVICE_VIDEO_BYTES,
  MAX_HEIC_CONVERT_BYTES,
  SUPPORTED_DEVICE_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
} from "../config/constants";

const EXTENSIONS = [...new Set([
  ...SUPPORTED_DEVICE_IMAGE_EXTENSIONS,
  ...SUPPORTED_VIDEO_EXTENSIONS,
])].map((ext) => `.${ext}`);
const ACCEPT = EXTENSIONS.join(",");

// HEIC/HEIF get converted to JPEG server-side, so downstream only ever sees
// jpg/jpeg/png/svg
const convertHeicToJpeg = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/convert-heic", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("conversion_failed");
  const blob = await response.blob();
  const stem = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${stem}.jpg`, { type: "image/jpeg" });
};

const MediaFilePicker = ({ onImageSelected, onVideoSelected }) => {
  const inputRef = useRef(null);
  const convertingRef = useRef(false);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const t = useTranslations();

  const selectFiles = async (files) => {
    if (convertingRef.current) return;
    if (files?.length > 1) {
      toast.error(t("MediaFilePicker_one_file"));
      return;
    }
    const file = files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    if (SUPPORTED_VIDEO_EXTENSIONS.includes(extension)) {
      if (file.size > MAX_DEVICE_VIDEO_BYTES) {
        toast.error(t("UploadForm_video_too_large"));
        return;
      }
      onVideoSelected(file);
      return;
    }
    if (!SUPPORTED_DEVICE_IMAGE_EXTENSIONS.includes(extension)) {
      toast.error(t("MediaFilePicker_unsupported_type"));
      return;
    }
    if (file.size > MAX_DEVICE_IMAGE_BYTES) {
      toast.error(t("UploadForm_image_too_large"));
      return;
    }
    if (extension === "heic" || extension === "heif") {
      // server-side conversion buffers the whole file, so HEIC keeps a
      // lower cap than plain device images
      if (file.size > MAX_HEIC_CONVERT_BYTES) {
        toast.error(t("UploadForm_image_heic_too_large"));
        return;
      }
      convertingRef.current = true;
      setConverting(true);
      try {
        onImageSelected(await convertHeicToJpeg(file));
      } catch (err) {
        console.log(err);
        toast.error(t("UploadForm_image_convert_failed"));
      } finally {
        convertingRef.current = false;
        setConverting(false);
      }
      return;
    }
    onImageSelected(file);
  };

  return (
    <Stack spacing={2} sx={{ width: "100%", minWidth: 0 }}>
      <Stack
        role="group"
        aria-label={t("MediaFilePicker_select")}
        aria-describedby="media-extensions"
        aria-busy={converting}
        alignItems="center"
        justifyContent="center"
        spacing={2}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          dragDepth.current += 1;
          if (!convertingRef.current) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = convertingRef.current ? "none" : "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          selectFiles(event.dataTransfer.files);
        }}
        sx={{
          minHeight: { xs: 220, sm: 260 },
          px: 3,
          py: 5,
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 2,
          bgcolor: dragging ? "action.selected" : "background.paper",
          transition: "border-color 150ms ease, background-color 150ms ease",
          "&:hover, &:focus-within": {
            borderColor: "primary.main",
          },
        }}
      >
        <Button
          variant="contained"
          size="large"
          disableElevation
          startIcon={
            converting ? <CircularProgress size={20} color="inherit" /> : <UploadFile />
          }
          disabled={converting}
          aria-describedby="media-extensions"
          onClick={() => inputRef.current?.click()}
          sx={{ textTransform: "none" }}
        >
          {t("MediaFilePicker_select")}
        </Button>
        <Typography color="text.secondary" role="status">
          {converting
            ? t("UploadForm_image_converting")
            : t("MediaFilePicker_drop")}
        </Typography>
      </Stack>
      <Box sx={{ overflowX: "auto", maxWidth: "100%" }}>
        <Typography
          id="media-extensions"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", width: "max-content", minWidth: "100%", textAlign: "center", whiteSpace: "nowrap" }}
        >
          {EXTENSIONS.join(", ")}
        </Typography>
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        disabled={converting}
        onChange={(event) => {
          selectFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </Stack>
  );
};

export default MediaFilePicker;
