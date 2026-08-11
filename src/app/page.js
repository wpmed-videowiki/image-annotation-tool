"use client";
import { useEffect, useRef, useState } from "react";
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
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import VideoFilePicker from "./components/VideoFilePicker";
import { getAppUser } from "./actions/auth";
import { useTranslations } from "next-intl";
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

export default function Home() {
  const instanceRef = useRef(null);

  const searchParams = useSearchParams();
  const t = useTranslations();

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
  const containerRef = useRef(null);
  const fileName = searchParams.get("file");

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

  if (!fileName && !deviceVideoFile) {
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
            <VideoFilePicker onFileSelected={setDeviceVideoFile} />
          </Stack>
        </Container>
      </div>
    );
  }

  if (deviceVideoFile) {
    return (
      <Container maxWidth="xl">
        <Grid container columnSpacing={4} rowSpacing={0}>
          <Grid item xs={12} md={9}>
            <VideoEditor
              key={deviceVideoFile.name}
              deviceFile={deviceVideoFile}
              instanceRef={instanceRef}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Stack spacing={5}>
              <UploadForm
                title={deviceVideoFile.name.replace(/\s/g, "_")}
                license=""
                editorRef={instanceRef}
                permission=""
                categories={[]}
                wikiSource={null}
                originalFileName={null}
                pageContent=""
                author=""
                provider="commons"
                isVideo
                isDeviceVideo
              />
            </Stack>
          </Grid>
        </Grid>
      </Container>
    );
  }

  const isVideo = mediaType === "VIDEO";

  return (
    <Container maxWidth="xl">
      <Grid container columnSpacing={4} rowSpacing={0}>
        <Grid item xs={12} md={9} ref={containerRef}>
          {!mediaType ? (
            // media type is unknown until the API responds; don't mount an
            // editor yet or images/videos briefly get the wrong one
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ height: "60vh" }}
            >
              <CircularProgress />
            </Stack>
          ) : isVideo ? (
            <VideoEditor
              key={originalImageUrl}
              videoUrl={originalImageUrl}
              previewUrl={videoPreviewUrl}
              instanceRef={instanceRef}
            />
          ) : fileName.toLowerCase().endsWith(".svg") ? (
            <SVGEditor
              image={originalImageUrl}
              key={originalImageUrl}
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
            {page && (
              <>
                <UploadForm
                  title={page?.title.replace(/\s/g, "_").replace("File:", "")}
                  license={
                    license || page?.imageinfo[0].extmetadata.License?.value
                  }
                  editorRef={instanceRef}
                  permission={permission}
                  categories={categories}
                  wikiSource={searchParams.get("wikiSource")}
                  originalFileName={searchParams.get("file")}
                  pageContent={originalPageSource}
                  author={author}
                  provider={
                    page?.imageinfo[0].descriptionurl.includes("nccommons.org")
                      ? "nccommons"
                      : "commons"
                  }
                  isVideo={isVideo}
                />
              </>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
