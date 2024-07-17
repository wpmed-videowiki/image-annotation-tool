import {
  Button,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { fetchCommonsImage, uploadFile } from "../actions/commons";
import { useEffect, useState } from "react";
import { UploadFile } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { popupCenter } from "../utils/popupTools";
import { toast } from "react-toastify";
import { base64ToBlob } from "../utils/base64ToBlob";
import { useDebounce } from "use-debounce";
import { useTranslations } from "next-intl";
import { SUPPORTED_OVERWRITE_EXTENSIONS } from "../config/constants";
import UpdateArticleSourceForm from "./UpdateArticleSourceForm";

const getWikiPageText = ({
  description,
  source,
  date,
  license,
  author,
  permission,
  categories,
}) =>
  `
== {{int:filedesc}} ==
{{Information
|Description=${description}
|Date=${date}
|Source=${source}
|Permission=${permission}
|Author=${author}
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
}) => {
  const { data: session } = useSession();
  const t = useTranslations();

  const fileTitleParts = title.split(".");
  fileTitleParts.pop();
  const tmpFileTitle = fileTitleParts.join(".") + "_annotated";
  const fileExtension = title.split(".").pop();

  const [loading, setLoading] = useState(false);
  const [overwriteFile, setOverwriteFile] = useState(
    SUPPORTED_OVERWRITE_EXTENSIONS.includes(fileExtension)
  );
  const [selectedExtension, setSelectedExtension] = useState("png");
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

    setText(
      getWikiPageText({
        description: `${fileTitle}. Created by [https://image-annotation-tool.wmcloud.org/ Image Annotation Tool].`,
        date: new Date().toISOString().split("T")[0],
        source: `[[:File:${title}]]`,
        author: `See [[:File:${title}|original file]] for the list of authors.`,
        license: license,
        permission,
        categories,
      })
    );
  };

  const onUpload = async () => {
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

  useEffect(() => {
    if (!debouncedFileTitle) return;
    async function checkFileExists() {
      const page = await fetchCommonsImage(
        `File:${debouncedFileTitle}.${selectedExtension}`
      );
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
  }, [pageContent, overwriteFile]);

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
            <a
              href={wikiSource}
              target="_blank"
              rel="noreferrer"
            >
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
        onChange={(e) => setOverwriteFile(e.target.value === "true")}
      >
        <Stack direction="row" spacing={2}>
          {SUPPORTED_OVERWRITE_EXTENSIONS.includes(fileExtension) && (
            <Stack
              direction="row"
              alignItems="center"
              sx={{ cursor: "pointer" }}
              onClick={() => setOverwriteFile(true)}
            >
              <Radio value="true" color="primary" size="small" />
              {t("UploadForm_overwrite_file")}
            </Stack>
          )}
          <Stack
            direction="row"
            alignItems="center"
            sx={{ cursor: "pointer" }}
            onClick={() => setOverwriteFile(false)}
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
              endAdornment: (
                <Select
                  value={selectedExtension}
                  onChange={(e) => setSelectedExtension(e.target.value)}
                >
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
            maxRows={10}
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
            maxRows={5}
          />
        </Stack>
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
                destination:
                  provider === "nccommons" ? "NC Commons" : "Wikimedia Commons",
              })}
        </Button>
      </Stack>
    </Stack>
  );
};

export default UploadForm;
