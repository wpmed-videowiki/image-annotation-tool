"use client";
import { useRef, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import { AddPhotoAlternate } from "@mui/icons-material";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  MAX_DEVICE_IMAGE_BYTES,
  MAX_HEIC_CONVERT_BYTES,
  SUPPORTED_DEVICE_IMAGE_EXTENSIONS,
} from "../config/constants";

const ACCEPT = SUPPORTED_DEVICE_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

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

const ImageFilePicker = ({ onFileSelected }) => {
  const inputRef = useRef(null);
  const [converting, setConverting] = useState(false);
  const t = useTranslations();

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    if (!SUPPORTED_DEVICE_IMAGE_EXTENSIONS.includes(extension)) {
      toast.error(t("UploadForm_image_unsupported_type"));
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
      setConverting(true);
      try {
        onFileSelected(await convertHeicToJpeg(file));
      } catch (err) {
        console.log(err);
        toast.error(t("UploadForm_image_convert_failed"));
      } finally {
        setConverting(false);
      }
      return;
    }
    onFileSelected(file);
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={
          converting ? <CircularProgress size={18} /> : <AddPhotoAlternate />
        }
        disabled={converting}
        onClick={() => inputRef.current?.click()}
      >
        {converting
          ? t("UploadForm_image_converting")
          : t("SearchForm_upload_device_image")}
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

export default ImageFilePicker;
