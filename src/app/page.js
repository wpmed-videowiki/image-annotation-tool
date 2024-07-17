"use client";
import { useEffect, useRef, useState } from "react";
import { Stack, Grid, Container } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { fetchCommonsImage, fetchPageSource } from "./actions/commons";
import {
  extractLicenseTag,
  extractPermission,
  extractCategories,
} from "./utils/sourceParser";
import UploadForm from "./components/UploadForm";
import Header from "./components/Header";
import SearchForm from "./components/SearchForm";
import { getAppUser } from "./actions/auth";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import "tui-image-editor/dist/tui-image-editor.css";

const ImageEditor = dynamic(() => import("./components/ImageEditor"), {
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
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const containerRef = useRef(null);

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
      setImageUrl(page.imageinfo[0].thumburl || page.imageinfo[0].url);
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
      setOriginalPageSource(pageSource.revisions?.[0].content || "");
      setCategories(categories);
      setLicense(license);
      setPermission(permission);
      setPage(page);
    }
    init();
  }, [searchParams.get("file"), containerRef.current]);

  if (!searchParams.get("file")) {
    return (
      <main>
        <Header />
        <Container maxWidth="xl">
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ height: "calc(100vh - 64px)" }}
          >
            <SearchForm />
          </Stack>
        </Container>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <Container maxWidth="xl">
        <Grid container columnSpacing={4} rowSpacing={0} marginTop={11}>
          <Grid item xs={12} md={9} ref={containerRef}>
            <ImageEditor
              key={imageUrl}
              image={imageUrl}
              instanceRef={instanceRef}
            />
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
                    provider={
                      page?.imageinfo[0].descriptionurl.includes(
                        "nccommons.org"
                      )
                        ? "nccommons"
                        : "commons"
                    }
                  />
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </main>
  );
}
