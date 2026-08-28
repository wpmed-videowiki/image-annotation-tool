import { useEffect, useState } from "react";
import { fetchPageSource, updatePageSource } from "../actions/commons";
import { replaceTemplateWithFile } from "../utils/replaceTemplateWithFile";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { Login } from "@mui/icons-material";
import { loginHref, useAuth } from "./AuthProvider";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

const UpdateArticleSourceForm = ({
  wikiSource,
  originalFileName,
  fileName,
}) => {
  const { user } = useAuth();
  const t = useTranslations();

  const [originalPageSource, setOriginalPageSource] = useState("");
  const [loading, setLoading] = useState(false);

  const provider = wikiSource.includes("mdwiki.org") ? "mdwiki" : "wikimedia";

  const onGetPageSource = async () => {
    const page = await fetchPageSource(wikiSource);
    const text = page.revisions[0].content;
    const updatedText = replaceTemplateWithFile(
      text,
      originalFileName,
      fileName
    );

    setOriginalPageSource(updatedText);
  };

  const onUpdatePageSource = async () => {
    setLoading(true);
    // update page source
    try {
      const result = await updatePageSource(wikiSource, originalPageSource);
      if (result?.error) toast.error(t("UpdateArticleSourceForm_update_failed"));
      else toast.success(t("UpdateArticleSourceForm_update_success"));
    } catch (err) {
      console.log(err);
      toast.error(t("UpdateArticleSourceForm_update_failed"));
    }
    setLoading(false);
  };

  useEffect(() => {
    onGetPageSource();
  }, [wikiSource]);

  if (provider === "mdwiki" && !user?.linked?.mdwiki) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2">
          {t("UpdateArticleSourceForm_sing_in_to_mdwiki_to_update")}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          sx={{ minWidth: 200 }}
          startIcon={<Login />}
          href={loginHref("mdwiki")}
        >
          {t("UpdateArticleSourceForm_login_to_mdwiki")}
        </Button>
      </Stack>
    );
  }

  return (
    <>
      {originalPageSource && (
        <Box width="100%">
          <Typography variant="body2">
            {t("UpdateArticleSourceForm_new_page_source")}
          </Typography>
          <TextField
            maxRows={15}
            value={originalPageSource}
            onChange={(e) => setOriginalPageSource(e.target.value)}
            multiline
            fullWidth
          />
          <Stack alignItems="flex-end" marginTop={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                onUpdatePageSource();
              }}
              disabled={loading || !originalPageSource}
            >
              {loading
                ? t("UpdateArticleSourceForm_updating")
                : t("UpdateArticleSourceForm_update_page")}
            </Button>
          </Stack>
        </Box>
      )}
    </>
  );
};

export default UpdateArticleSourceForm;
