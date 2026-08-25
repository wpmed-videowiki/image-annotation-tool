"use client";
import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useTranslations } from "next-intl";

import { previewWikitext } from "../../../actions/commons";

// renders a custom license tag through action=parse so the user can check it
// resolves; the HTML is sanitized by the MediaWiki parser
const TemplatePreviewDialog = ({ text, provider, disabled }) => {
  const t = useTranslations("UploadWizard");
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);

  const preview = async () => {
    setOpen(true);
    setLoading(true);
    setHtml(await previewWikitext(text, provider));
    setLoading(false);
  };

  return (
    <>
      <Button size="small" variant="outlined" onClick={preview} disabled={disabled || !text}>
        {t("common.preview")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("common.preview")}</DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Box
              sx={{ "& img": { maxWidth: "100%" }, overflowX: "auto" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TemplatePreviewDialog;
