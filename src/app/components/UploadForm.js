"use client";
import {
  Button,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { fetchCommonsImage, uploadFile } from "../actions/commons";
import { useEffect, useRef, useState } from "react";
import { UploadFile } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { popupCenter } from "../utils/popupTools";
import { toast } from "react-toastify";
import { base64ToBlob } from "../utils/base64ToBlob";
import { useDebounce } from "use-debounce";
import { useTranslations } from "next-intl";
import {
  SUPPORTED_OVERWRITE_EXTENSIONS,
  VIDEO_SERVER_CHUNK_BYTES,
} from "../config/constants";
import { updateUserDefaultUploadOption } from "../actions/user";
import { createVideoJob, getVideoJobStatus } from "../actions/video";
import UpdateArticleSourceForm from "./UpdateArticleSourceForm";

const getWikiPageText = ({
  description,
  source,
  date,
  license,
  author,
  permission,
  categories,
  otherVersions,
}) =>
  `
== {{int:filedesc}} ==
{{Information
|Description=${description}
|Date=${date}
|Source=${source}
|Permission=${permission}
${author ? `|Author=${author}` : ""}
${otherVersions ? `|other versions=${otherVersions}` : ""}
}}

== {{int:license-header}} ==
{{${license}}}

${categories.join("\n")}
`.trim();
const UploadForm = ({
  title,
  license,
  permission,
  wikiSource,
  provider,
  originalFileName,
  disabled,
  categories = [],
  editorRef,
  pageContent,
  author,
  isVideo,
  isDeviceVideo,
}) => {
  const { data: session } = useSession();
  const t = useTranslations();

  const fileTitleParts = title.split(".");
  fileTitleParts.pop();
  const tmpFileTitle = isDeviceVideo
    ? fileTitleParts.join(".")
    : fileTitleParts.join(".") + "_annotated";
  const fileExtension = title.split(".").pop().toLowerCase();

  const [loading, setLoading] = useState(false);
  const [overwriteFile, setOverwriteFile] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(
    isVideo ? "webm" : fileExtension === "svg" ? "svg" : "png"
  );
  const [videoStage, setVideoStage] = useState("");
  const [videoProgress, setVideoProgress] = useState(0);
  const pollRef = useRef(null);
  const [fileTitle, setFileTitle] = useState(tmpFileTitle);
  const [debouncedFileTitle] = useDebounce(fileTitle, 500);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [pageAlreadyExists, setPageAlreadyExists] = useState(false);
  const [uploadComment, setUploadComment] = useState("");
  const [text, setText] = useState("");

  const resetPageText = () => {
    if (pageContent && overwriteFile) {
      setText(pageContent);
      return;
    }

    if (isDeviceVideo) {
      const username =
        session?.user?.wikimediaProfile?.username ||
        session?.user?.wikimediaProfile?.name ||
        "";
      setText(
        getWikiPageText({
          description: `${fileTitle}. Uploaded by [https://image-annotation-tool.wmcloud.org/ Image Annotation Tool].`,
          date: new Date().toISOString().split("T")[0],
          source: "{{own}}",
          author: username ? `[[User:${username}|${username}]]` : "",
          license: license || "self|cc-by-sa-4.0",
          permission: permission || "",
          categories,
        })
      );
      return;
    }

    setText(
      getWikiPageText({
        description: `${fileTitle}. Created by [https://image-annotation-tool.wmcloud.org/ Image Annotation Tool].`,
        date: new Date().toISOString().split("T")[0],
        source: `[[:File:${title}]]`,
        author,
        otherVersions: `See [[:File:${title}|original file]].`,
        license: license,
        permission,
        categories,
      })
    );
  };

  const uploadDeviceFileToServer = async (file, onProgress) => {
    const totalChunks = Math.ceil(file.size / VIDEO_SERVER_CHUNK_BYTES) || 1;
    let uploadId = "";
    let lastResponse = null;
    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(
        i * VIDEO_SERVER_CHUNK_BYTES,
        (i + 1) * VIDEO_SERVER_CHUNK_BYTES
      );
      let attempt = 0;
      for (;;) {
        const response = await fetch("/api/video/upload-chunk", {
          method: "POST",
          body: chunk,
          headers: {
            "content-type": "application/octet-stream",
            "x-chunk-index": String(i),
            "x-total-chunks": String(totalChunks),
            "x-total-bytes": String(file.size),
            "x-file-name": encodeURIComponent(file.name),
            ...(uploadId ? { "x-upload-id": uploadId } : {}),
          },
        });
        if (response.ok) {
          lastResponse = await response.json();
          uploadId = lastResponse.uploadId;
          break;
        }
        attempt += 1;
        if (attempt >= 3) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to upload video to the server");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
      onProgress(((i + 1) / totalChunks) * 100);
    }
    return lastResponse;
  };

  const destinationName =
    provider === "nccommons" ? "NC Commons" : "Wikimedia Commons";

  const pollVideoJob = (jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getVideoJobStatus(jobId);
        if (!status) return;
        setVideoProgress(status.progress || 0);
        if (
          ["queued", "downloading", "processing", "uploading", "publishing"].includes(
            status.status
          )
        ) {
          setVideoStage(
            t(`UploadForm_video_stage_${status.status}`, {
              destination: destinationName,
            })
          );
        }
        if (status.status === "done") {
          clearInterval(pollRef.current);
          setVideoStage("");
          setUploadedUrl(status.result?.descriptionurl || "");
          toast.success("File uploaded successfully");
          setLoading(false);
        } else if (status.status === "error") {
          clearInterval(pollRef.current);
          setVideoStage("");
          toast.error(status.error || t("UploadForm_video_job_failed"));
          setLoading(false);
        }
      } catch (err) {
        console.log(err);
      }
    }, 2000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (!loading || !isVideo) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading, isVideo]);

  const onUploadVideo = async () => {
    setLoading(true);
    setVideoProgress(0);
    try {
      const videoData = editorRef.current.getVideoData();
      const filename = overwriteFile
        ? `File:${title}`
        : `File:${fileTitle}.webm`.trim();
      let deviceUploadId = "";
      if (videoData.sourceType === "device") {
        setVideoStage(t("UploadForm_video_stage_uploading_to_server"));
        const uploadResponse = await uploadDeviceFileToServer(
          videoData.deviceFile,
          setVideoProgress
        );
        deviceUploadId = uploadResponse.uploadId;
      }
      setVideoStage(
        t("UploadForm_video_stage_queued", { destination: destinationName })
      );
      setVideoProgress(0);
      const jobResponse = await createVideoJob({
        sourceType: videoData.sourceType,
        sourceUrl: videoData.sourceUrl || "",
        deviceUploadId,
        ops: videoData.ops,
        target: {
          filename,
          text,
          comment: uploadComment.trim(),
          provider,
          wikiSource: wikiSource || "",
        },
      });
      if (jobResponse?.error || !jobResponse?.jobId) {
        throw new Error(jobResponse?.error || t("UploadForm_video_job_failed"));
      }
      pollVideoJob(jobResponse.jobId);
    } catch (err) {
      console.log(err);
      toast.error(err.message || t("UploadForm_video_job_failed"));
      setVideoStage("");
      setLoading(false);
    }
  };

  const onUpload = async () => {
    if (editorRef.current?.isVideo) {
      return onUploadVideo();
    }
    setLoading(true);
    const dataUrl = await editorRef.current.toDataURL({
      format: overwriteFile
        ? fileExtension === "jpg"
          ? "jpeg"
          : fileExtension
        : selectedExtension === "jpg"
        ? "jpeg"
        : selectedExtension,
      quality: 1,
      multiplier: 2,
    });
    const imageBlob = base64ToBlob(
      dataUrl.split(",")[1],
      `image/${selectedExtension}`
    );
    try {
      const formData = new FormData();
      if (overwriteFile) {
        formData.set("filename", `File:${title}`);
      } else {
        formData.set(
          "filename",
          `File:${fileTitle}.${selectedExtension}`.trim()
        );
      }
      formData.set("comment", uploadComment.trim());
      formData.set("text", text);
      formData.set("file", imageBlob);
      formData.set("wikiSource", wikiSource);
      formData.set("provider", provider);

      const response = await uploadFile(formData);

      setUploadedUrl(response.imageinfo.descriptionurl);
      toast.success("File uploaded successfully");
    } catch (err) {
      console.log(err);
    }
    console.log({ dataUrl });
    setLoading(false);
  };

  const onOverwriteFileChange = async (overwrite) => {
    setOverwriteFile(overwrite);
    await updateUserDefaultUploadOption(overwrite ? "overwrite" : "new");
  };

  useEffect(() => {
    if (!debouncedFileTitle) return;
    async function checkFileExists() {
      const title = `File:${debouncedFileTitle}.${selectedExtension}`;
      const page = await fetchCommonsImage(title);
      if (page && page.pageid) {
        setPageAlreadyExists(true);
      } else {
        setPageAlreadyExists(false);
      }
    }
    checkFileExists();
  }, [debouncedFileTitle, selectedExtension]);

  useEffect(() => {
    resetPageText();
  }, [pageContent, overwriteFile, session?.user?.wikimediaProfile]);

  useEffect(() => {
    if (
      !isDeviceVideo &&
      session?.user?.defaultUploadOption &&
      SUPPORTED_OVERWRITE_EXTENSIONS.includes(fileExtension)
    ) {
      setOverwriteFile(session.user.defaultUploadOption === "overwrite");
    }
  }, [session?.user?.defaultUploadOption, fileExtension, isDeviceVideo]);

  switch (provider) {
    case "commons":
      if (!session?.user?.wikimediaId) {
        return (
          <Stack spacing={1}>
            <Typography variant="body2">
              {t("UploadForm_sign_in_to_upload_wikimedia")}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{
                minWidth: 200,
              }}
              startIcon={<UploadFile />}
              onClick={() => popupCenter("/login?provider=wikimedia", "Login")}
            >
              {t("UploadForm_login_to_wikimedia")}
            </Button>
          </Stack>
        );
      }
      break;
    case "nccommons":
      if (!session?.user?.nccommonsId) {
        return (
          <Stack spacing={1}>
            <Typography variant="body2">
              {t("UploadForm_sign_in_to_upload_nccommons")}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{
                minWidth: 200,
              }}
              startIcon={<UploadFile />}
              onClick={() => popupCenter("/login?provider=nccommons", "Login")}
            >
              {t("UploadForm_login_to_nccommons")}
            </Button>
          </Stack>
        );
      }
      break;
    default:
      break;
  }

  if (uploadedUrl) {
    return (
      <Stack
        justifyContent="center"
        alignItems="center"
        width="100%"
        spacing={2}
      >
        <a href={uploadedUrl} target="_blank" rel="noreferrer">
          {t("Index_view_on_commons")}
        </a>
        {wikiSource && (
          <>
            <a href={wikiSource} target="_blank" rel="noreferrer">
              {t("Index_view_original_page")}
            </a>
            <UpdateArticleSourceForm
              wikiSource={wikiSource}
              originalFileName={originalFileName}
              fileName={uploadedUrl.split("/").pop()}
            />
          </>
        )}
      </Stack>
    );
  }

  return (
    <Stack direction="column" spacing={2}>
      <RadioGroup
        row
        value={overwriteFile}
        onChange={(e) => onOverwriteFileChange(e.target.value === "true")}
      >
        <Stack direction="row" spacing={2}>
          {!isDeviceVideo && SUPPORTED_OVERWRITE_EXTENSIONS.includes(fileExtension) && (
            <Stack
              direction="row"
              alignItems="center"
              sx={{ cursor: "pointer" }}
              onClick={() => onOverwriteFileChange(true)}
            >
              <Radio value="true" color="primary" size="small" />
              {t("UploadForm_overwrite_file")}
            </Stack>
          )}
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
      {!overwriteFile && (
        <Stack spacing={1}>
          <Typography variant="body2">{t("UploadForm_file_name")}</Typography>
          <TextField
            name="title"
            value={fileTitle}
            onChange={(e) => setFileTitle(e.target.value)}
            size="small"
            InputProps={{
              sx: {
                paddingRight: 0,
              },
              startAdornment: "File:",
              endAdornment: isVideo ? (
                <Select
                  value={selectedExtension}
                  onChange={(e) => setSelectedExtension(e.target.value)}
                >
                  <MenuItem value="webm">.webm</MenuItem>
                </Select>
              ) : (
                <Select
                  value={selectedExtension}
                  onChange={(e) => setSelectedExtension(e.target.value)}
                >
                  <MenuItem value="svg">.svg</MenuItem>
                  <MenuItem value="png">.png</MenuItem>
                  <MenuItem value="jpg">.jpg</MenuItem>
                  <MenuItem value="jpeg">.jpeg</MenuItem>
                </Select>
              ),
            }}
          />
          {pageAlreadyExists && (
            <Typography variant="body2" color="orange">
              {t("UploadForm_file_name_already_exists")}
            </Typography>
          )}
          {fileTitle.length >= 230 && (
            <Typography variant="body2" color="red">
              {t("UploadForm_file_name_too_long")}
            </Typography>
          )}
        </Stack>
      )}
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              {t("UploadForm_file_page_source")}
            </Typography>
            <Button size="small" onClick={resetPageText}>
              {t("UploadForm_reset")}
            </Button>
          </Stack>
          <TextField
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            size="small"
            multiline
            rows={10}
          />
        </Stack>
        <Stack spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              {t("UploadForm_upload_comment")}
            </Typography>
          </Stack>
          <TextField
            name="text"
            value={uploadComment}
            onChange={(e) => setUploadComment(e.target.value)}
            size="small"
            multiline
            rows={5}
          />
        </Stack>
        {isVideo && loading && videoStage && (
          <Stack spacing={0.5}>
            <Typography variant="body2">{videoStage}</Typography>
            <LinearProgress variant="determinate" value={videoProgress} />
            <Typography variant="caption">
              {Math.round(videoProgress)}%
            </Typography>
          </Stack>
        )}
        <Button
          variant="contained"
          color="primary"
          sx={{
            minWidth: 200,
          }}
          startIcon={<UploadFile />}
          onClick={onUpload}
          disabled={loading || disabled || fileTitle.length >= 230}
        >
          {loading
            ? t("UploadForm_uploading")
            : t("UploadForm_upload_to", {
                destination: destinationName,
              })}
        </Button>
      </Stack>
    </Stack>
  );
};

export default UploadForm;
