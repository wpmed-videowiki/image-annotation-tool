"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Stack,
  GridLegacy as Grid,
  Container,
  CircularProgress,
} from "@mui/material";
import { useSearchParams } from "next/navigation";
import {
  fetchCommonsImage,
  fetchPageSource,
  fetchVideoDerivatives,
} from "./actions/commons";
import {
  extractLicenseTag,
  extractPermission,
  extractCategories,
  extractAuthor,
} from "./utils/sourceParser";
import UploadForm from "./components/UploadForm";
import VideoUploadWizard from "./components/UploadWizard/VideoUploadWizard";
import ImageUploadWizard from "./components/UploadWizard/ImageUploadWizard";
import {
  IMAGE_RASTER_EXTENSION_CHOICES,
  SUPPORTED_OVERWRITE_EXTENSIONS,
} from "./config/constants";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import VideoFilePicker from "./components/VideoFilePicker";
import ImageFilePicker from "./components/ImageFilePicker";
import { getAppUser } from "./actions/auth";
import { EMPTY_METADATA } from "./utils/uploadMetadata";
import { normalizeCategoryName, parseLicenseTag } from "./utils/licenseMapping";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import "tui-image-editor/dist/tui-image-editor.css";

const SVGEditor = dynamic(() => import("./components/SVGEditor"), {
  ssr: false,
});
const ImageEditor = dynamic(() => import("./components/ImageEditor"), {
  ssr: false,
});
const VideoEditor = dynamic(() => import("./components/VideoEditor"), {
  ssr: false,
});

// inside the wizard the editor shares the viewport with stepper + footer
const WIZARD_EDITOR_HEIGHT = "calc(100vh - 280px)";

// device uploads default to own work, still editable in step 1
const deviceFileMetadata = (file) => {
  const metadata = EMPTY_METADATA();
  metadata.rights.ownership = "own";
  metadata.describe.title = file.name.replace(/\.[^.]+$/, "").replace(/\s/g, "_");
  return metadata;
};

// Commons-sourced files are derivatives, prefill the third-party branch from
// whatever sourceParser found on the original page
const commonsDerivativeMetadata = ({ title, license, author, categories }) => {
  const metadata = EMPTY_METADATA();
  metadata.rights.ownership = "third-party";
  metadata.rights.thirdParty.reason = "creator-free-license";

  const parsed = parseLicenseTag(license);
  metadata.rights.thirdParty.creatorLicense = parsed.value;
  metadata.rights.thirdParty.customLicense = parsed.custom;
  metadata.rights.thirdParty.source = `[[:File:${title}]]`;
  metadata.rights.thirdParty.author = author || "";
  metadata.rights.thirdParty.authorUnknown = !author;

  metadata.describe.title = `${title.replace(/\.[^.]+$/, "")}_annotated`;
  metadata.describe.categories = (categories || []).map(normalizeCategoryName);
  // no extractDescription in sourceParser; blank caption beats a wrong one
  return metadata;
};

export default function Home() {
  const instanceRef = useRef(null);

  const searchParams = useSearchParams();
  const t = useTranslations();
  const { data: session } = useSession();

  const [page, setPage] = useState();
  const [originalPageSource, setOriginalPageSource] = useState("");
  const [permission, setPermission] = useState("");
  const [license, setLicense] = useState("");
  const [categories, setCategories] = useState([]);
  const [author, setAuthor] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [deviceVideoFile, setDeviceVideoFile] = useState(null);
  const [deviceImageFile, setDeviceImageFile] = useState(null);
  // "overwrite" | "new" for Commons-sourced images
  const [imageUploadMode, setImageUploadMode] = useState("new");
  const containerRef = useRef(null);
  const appliedDefaultModeRef = useRef(false);
  const fileName = searchParams.get("file");

  // apply the saved upload-mode preference once, before the layout first renders;
  // flipping it later would remount the editor and lose the tui instance
  useEffect(() => {
    if (appliedDefaultModeRef.current || !fileName) return;
    const extension = fileName.split(".").pop().toLowerCase();
    if (!SUPPORTED_OVERWRITE_EXTENSIONS.includes(extension)) {
      appliedDefaultModeRef.current = true;
      setImageUploadMode("new");
      return;
    }
    if (session?.user?.defaultUploadOption) {
      appliedDefaultModeRef.current = true;
      setImageUploadMode(
        session.user.defaultUploadOption === "overwrite" ? "overwrite" : "new"
      );
    }
  }, [session?.user?.defaultUploadOption, fileName]);

  // object URL for the device-image editors, they load from a URL not a File
  const deviceImageUrl = useMemo(
    () => (deviceImageFile ? URL.createObjectURL(deviceImageFile) : ""),
    [deviceImageFile]
  );
  useEffect(
    () => () => {
      if (deviceImageUrl) URL.revokeObjectURL(deviceImageUrl);
    },
    [deviceImageUrl]
  );

  useEffect(() => {
    async function init() {
      const fileName = searchParams.get("file");
      if (!fileName || !containerRef.current) {
        return;
      }
      if (!fileName.includes("File:")) {
        // redirect to include File: prefix with all search params
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("file", `File:${fileName}`);
        window.location.href = newUrl.href;
        return;
      }
      await getAppUser();
      const page = await fetchCommonsImage(
        searchParams.get("file"),
        searchParams.get("wikiSource")
      );
      // non-WebM originals (e.g. Theora .ogv) may not be decodable by the
      // browser; preview the highest WebM transcode instead, like Commons'
      // own player does. Processing still uses the original file. Resolved
      // before any setState so the editor mounts with the right source.
      let previewUrl = "";
      if (
        page.imageinfo[0].mediatype === "VIDEO" &&
        !page.imageinfo[0].url.toLowerCase().endsWith(".webm")
      ) {
        const derivatives = await fetchVideoDerivatives(
          searchParams.get("file"),
          page.wikiSource
        );
        const webmDerivatives = derivatives
          .filter((derivative) => (derivative.type || "").includes("webm"))
          .sort((a, b) => (b.height || 0) - (a.height || 0));
        previewUrl = webmDerivatives[0]?.src || "";
      }
      setMediaType(page.imageinfo[0].mediatype || "");
      setImageUrl(page.imageinfo[0].thumburl || page.imageinfo[0].url);
      setOriginalImageUrl(page.imageinfo[0].url);
      setVideoPreviewUrl(previewUrl);
      const pageSource = await fetchPageSource(
        page.imageinfo[0].descriptionurl
      );
      const license = extractLicenseTag(
        pageSource.revisions?.[0].content || ""
      );
      const permission = extractPermission(
        pageSource.revisions?.[0].content || ""
      );
      const categories = extractCategories(
        pageSource.revisions?.[0].content || ""
      );
      const author = extractAuthor(pageSource.revisions?.[0].content || "");
      setOriginalPageSource(pageSource.revisions?.[0].content || "");
      setCategories(categories);
      setLicense(license);
      setPermission(permission);
      setPage(page);
      setAuthor(author);
    }
    init();
  }, [fileName, containerRef.current]);

  if (!fileName && !deviceVideoFile && !deviceImageFile) {
    return (
      <div>
        <Header />
        <Container maxWidth="xl">
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={4}
            sx={{ height: "calc(100vh - 64px)" }}
          >
            <SearchForm />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <ImageFilePicker onFileSelected={setDeviceImageFile} />
              <VideoFilePicker onFileSelected={setDeviceVideoFile} />
            </Stack>
          </Stack>
        </Container>
      </div>
    );
  }

  if (deviceImageFile) {
    const deviceIsSvg = deviceImageFile.name.toLowerCase().endsWith(".svg");
    const deviceExtension = deviceImageFile.name.split(".").pop().toLowerCase();
    // editor is step 1; the shell keeps it mounted so edits survive navigation
    return (
      <Container maxWidth="xl">
        <Stack spacing={4} sx={{ pb: 4 }}>
          <ImageUploadWizard
            provider="commons"
            wikiSource={null}
            editorRef={instanceRef}
            editorSlot={
              deviceIsSvg ? (
                <SVGEditor
                  key={deviceImageFile.name}
                  image={deviceImageUrl}
                  instanceRef={instanceRef}
                  height={WIZARD_EDITOR_HEIGHT}
                />
              ) : (
                <ImageEditor
                  key={deviceImageFile.name}
                  image={deviceImageUrl}
                  instanceRef={instanceRef}
                  id="tui-image-editor"
                  height={WIZARD_EDITOR_HEIGHT}
                />
              )
            }
            source={{
              kind: "device",
              mediaType: "image",
              deviceFile: deviceImageFile,
            }}
            prefill={{
              metadata: deviceFileMetadata(deviceImageFile),
              originalFileName: null,
            }}
            extensionChoices={
              deviceIsSvg ? ["svg"] : IMAGE_RASTER_EXTENSION_CHOICES
            }
            defaultExtension={
              deviceIsSvg
                ? "svg"
                : IMAGE_RASTER_EXTENSION_CHOICES.includes(deviceExtension)
                ? deviceExtension
                : "jpg"
            }
          />
        </Stack>
      </Container>
    );
  }

  if (deviceVideoFile) {
    // same deal as the image wizard: keep the editor mounted across steps
    return (
      <Container maxWidth="xl">
        <Stack spacing={4} sx={{ pb: 4 }}>
          <VideoUploadWizard
            provider="commons"
            wikiSource={null}
            editorRef={instanceRef}
            editorSlot={
              <VideoEditor
                key={deviceVideoFile.name}
                deviceFile={deviceVideoFile}
                instanceRef={instanceRef}
              />
            }
            source={{ kind: "device", deviceFile: deviceVideoFile }}
            prefill={{
              metadata: deviceFileMetadata(deviceVideoFile),
              originalFileName: null,
            }}
          />
        </Stack>
      </Container>
    );
  }

  const isVideo = mediaType === "VIDEO";
  const isSvgFile = fileName.toLowerCase().endsWith(".svg");
  const provider = page?.imageinfo[0].descriptionurl.includes("nccommons.org")
    ? "nccommons"
    : "commons";

  // wait for `page` so the editor mounts once, in its final position
  return (
    <Container maxWidth="xl" ref={containerRef}>
      {!page ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ height: "60vh" }}
        >
          <CircularProgress />
        </Stack>
      ) : isVideo ? (
        <Stack sx={{ pb: 4 }}>
          <VideoUploadWizard
            provider={provider}
            wikiSource={searchParams.get("wikiSource")}
            editorRef={instanceRef}
            editorSlot={
              <VideoEditor
                key={originalImageUrl}
                videoUrl={originalImageUrl}
                previewUrl={videoPreviewUrl}
                instanceRef={instanceRef}
              />
            }
            source={{
              kind: "commons",
              videoUrl: originalImageUrl,
              previewUrl: videoPreviewUrl,
              originalTitle: page?.title,
            }}
            prefill={{
              metadata: commonsDerivativeMetadata({
                title: page?.title.replace(/\s/g, "_").replace("File:", ""),
                license:
                  license || page?.imageinfo[0].extmetadata.License?.value,
                author,
                categories,
              }),
              originalFileName: searchParams.get("file"),
            }}
          />
        </Stack>
      ) : (
        <Grid container columnSpacing={4} rowSpacing={0} sx={{ pb: 4 }}>
          <Grid item xs={12} md={9}>
            {/* mode switch remounts the editor and resets annotations */}
            {imageUploadMode === "new" ? (
              <ImageUploadWizard
                provider={provider}
                wikiSource={searchParams.get("wikiSource")}
                editorRef={instanceRef}
                editorSlot={
                  isSvgFile ? (
                    <SVGEditor
                      key={originalImageUrl}
                      image={originalImageUrl}
                      instanceRef={instanceRef}
                      height={WIZARD_EDITOR_HEIGHT}
                    />
                  ) : (
                    <ImageEditor
                      key={imageUrl}
                      image={imageUrl}
                      instanceRef={instanceRef}
                      id="tui-image-editor"
                      height={WIZARD_EDITOR_HEIGHT}
                    />
                  )
                }
                source={{
                  kind: "commons",
                  mediaType: "image",
                  imageUrl,
                  originalTitle: page?.title,
                }}
                prefill={{
                  metadata: commonsDerivativeMetadata({
                    title: page?.title.replace(/\s/g, "_").replace("File:", ""),
                    license:
                      license || page?.imageinfo[0].extmetadata.License?.value,
                    author,
                    categories,
                  }),
                  originalFileName: searchParams.get("file"),
                }}
                extensionChoices={
                  isSvgFile ? ["svg"] : IMAGE_RASTER_EXTENSION_CHOICES
                }
                defaultExtension={
                  isSvgFile
                    ? "svg"
                    : IMAGE_RASTER_EXTENSION_CHOICES.includes(
                        fileName.split(".").pop().toLowerCase()
                      )
                    ? fileName.split(".").pop().toLowerCase()
                    : "jpg"
                }
              />
            ) : isSvgFile ? (
              <SVGEditor
                key={originalImageUrl}
                image={originalImageUrl}
                instanceRef={instanceRef}
              />
            ) : (
              <ImageEditor
                key={imageUrl}
                image={imageUrl}
                instanceRef={instanceRef}
                id="tui-image-editor"
              />
            )}
          </Grid>
          <Grid item xs={12} md={3}>
            <Stack spacing={5}>
              <UploadForm
                title={page?.title.replace(/\s/g, "_").replace("File:", "")}
                editorRef={instanceRef}
                wikiSource={searchParams.get("wikiSource")}
                originalFileName={searchParams.get("file")}
                pageContent={originalPageSource}
                provider={provider}
                mode={imageUploadMode}
                onModeChange={setImageUploadMode}
              />
            </Stack>
          </Grid>
        </Grid>
      )}
    </Container>
  );
}
