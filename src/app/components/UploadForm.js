"use client";
import { Button, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { uploadFile } from "../actions/commons";
import { useState } from "react";
import { UploadFile } from "@mui/icons-material";
import { toast } from "react-toastify";
import { base64ToBlob } from "../utils/base64ToBlob";
import { useTranslations } from "next-intl";
import { SUPPORTED_OVERWRITE_EXTENSIONS } from "../config/constants";
import { updateUserDefaultUploadOption } from "../actions/user";
import RequireUploadAuth from "./RequireUploadAuth";
import UploadSuccess from "./UploadSuccess";

const MIME_BY_EXTENSION = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// Quick overwrite path: re-upload the annotated canvas over the original file,
// keeping the original wikitext. "Upload as new file" just switches modes.
const UploadForm = ({
  title,
  wikiSource,
  provider,
  originalFileName,
  editorRef,
  pageContent,
  mode,
  onModeChange,
}) => {
  const t = useTranslations();

  const fileExtension = title.split(".").pop().toLowerCase();
  const canOverwrite = SUPPORTED_OVERWRITE_EXTENSIONS.includes(fileExtension);
  const overwriteFile = mode === "overwrite";

  const [loading, setLoading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadComment, setUploadComment] = useState("");

  const destinationName =
    provider === "nccommons" ? "NC Commons" : "Wikimedia Commons";

  const onOverwriteFileChange = async (overwrite) => {
    onModeChange(overwrite ? "overwrite" : "new");
    await updateUserDefaultUploadOption(overwrite ? "overwrite" : "new");
  };

  const onUpload = async () => {
    setLoading(true);
    try {
      const dataUrl = await editorRef.current.toDataURL({
        format: fileExtension === "jpg" ? "jpeg" : fileExtension,
        quality: 1,
        multiplier: 2,
      });
      const imageBlob = base64ToBlob(
        dataUrl.split(",")[1],
        MIME_BY_EXTENSION[fileExtension] || "application/octet-stream"
      );
      const formData = new FormData();
      formData.set("filename", `File:${title}`);
      formData.set("comment", uploadComment.trim());
      // overwrites keep the original page text
      formData.set("text", pageContent);
      formData.set("file", imageBlob);
      formData.set("wikiSource", wikiSource);
      formData.set("provider", provider);

      const response = await uploadFile(formData);

      setUploadedUrl(response.imageinfo.descriptionurl);
      toast.success("File uploaded successfully");
    } catch (err) {
      console.log(err);
      toast.error(t("UploadForm_image_upload_failed"));
    }
    setLoading(false);
  };

  if (uploadedUrl) {
    return (
      <UploadSuccess
        uploadedUrl={uploadedUrl}
        wikiSource={wikiSource}
        originalFileName={originalFileName}
      />
    );
  }

  return (
    <RequireUploadAuth provider={provider}>
      <Stack direction="column" spacing={2}>
        {canOverwrite && (
          <RadioGroup
            row
            value={overwriteFile}
            onChange={(e) => onOverwriteFileChange(e.target.value === "true")}
          >
            {/* wrap so a narrow sidebar doesn't overflow */}
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              <Stack
                direction="row"
                alignItems="center"
                sx={{ cursor: "pointer" }}
                onClick={() => onOverwriteFileChange(true)}
              >
                <Radio value="true" color="primary" size="small" />
                {t("UploadForm_overwrite_file")}
              </Stack>
              <Stack
                direction="row"
                alignItems="center"
                sx={{ cursor: "pointer" }}
                onClick={() => onOverwriteFileChange(false)}
              >
                <Radio value="false" color="primary" size="small" />
                {t("UploadForm_upload_as_new_file")}
              </Stack>
            </Stack>
          </RadioGroup>
        )}

        {overwriteFile ? (
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Typography variant="body2">
                {t("UploadForm_upload_comment")}
              </Typography>
              <TextField
                name="comment"
                value={uploadComment}
                onChange={(e) => setUploadComment(e.target.value)}
                size="small"
                multiline
                rows={5}
              />
            </Stack>
            <Button
              variant="contained"
              color="primary"
              sx={{ minWidth: 200 }}
              startIcon={<UploadFile />}
              onClick={onUpload}
              disabled={loading}
            >
              {loading
                ? t("UploadForm_uploading")
                : t("UploadForm_upload_to", { destination: destinationName })}
            </Button>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("UploadForm_new_file_uses_wizard")}
          </Typography>
        )}
      </Stack>
    </RequireUploadAuth>
  );
};

export default UploadForm;
