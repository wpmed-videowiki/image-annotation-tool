import { useEffect, useState } from "react";
import { fetchPageSource, updatePageSource } from "../actions/commons";
import { replaceTemplateWithFile } from "../utils/replaceTemplateWithFile";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useSession } from "next-auth/react";
import { Login } from "@mui/icons-material";
import { popupCenter } from "../utils/popupTools";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

const UpdateArticleSourceForm = ({
  wikiSource,
  originalFileName,
  fileName,
}) => {
  const { data: session } = useSession();
  const t = useTranslations();

  const [originalPageSource, setOriginalPageSource] = useState("");
  const [loading, setLoading] = useState(false);

  const provider = wikiSource.includes("mdwiki.org") ? "nccommons" : "commons";

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
      await updatePageSource(wikiSource, originalPageSource);
      toast.success(t("UpdateArticleSourceForm_update_success"));
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    onGetPageSource();
  }, [wikiSource]);

  switch (provider) {
    case "commons":
      if (!session?.user?.wikimediaId) {
        return (
          <Stack spacing={2}>
            <Typography variant="body2">
              {t("UpdateArticleSourceForm_sing_in_to_wikimedia_to_update")}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{
                minWidth: 200,
              }}
              startIcon={<Login />}
              onClick={() => popupCenter("/login?provider=wikimedia", "Login")}
            >
              {t("UpdateArticleSourceForm_login_to_wikimedia")}
            </Button>
          </Stack>
        );
      }
      break;
    case "nccommons":
      if (!session?.user?.mdwikiId) {
        return (
          <Stack spacing={2}>
            <Typography variant="body2">
              {t("UpdateArticleSourceForm_sing_in_to_mdwiki_to_update")}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{
                minWidth: 200,
              }}
              startIcon={<Login />}
              onClick={() => popupCenter("/login?provider=mdwiki", "Login")}
            >
              {t("UpdateArticleSourceForm_login_to_mdwiki")}
            </Button>
          </Stack>
        );
      }
      break;
    default:
      break;
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
