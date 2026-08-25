"use client";
import { Stack } from "@mui/material";
import { useTranslations } from "next-intl";

import UpdateArticleSourceForm from "./UpdateArticleSourceForm";

// success screen, extracted from UploadForm unchanged
const UploadSuccess = ({ uploadedUrl, wikiSource, originalFileName, children }) => {
  const t = useTranslations();

  return (
    <Stack justifyContent="center" alignItems="center" width="100%" spacing={2}>
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
      {children}
    </Stack>
  );
};

export default UploadSuccess;
