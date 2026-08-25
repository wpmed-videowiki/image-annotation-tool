"use client";
import { Button, Stack, Typography } from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { popupCenter } from "../utils/popupTools";

// Sign-in gate for the target wiki, extracted from UploadForm.
const RequireUploadAuth = ({ provider, children }) => {
  const { data: session } = useSession();
  const t = useTranslations();

  const config = {
    commons: {
      signedIn: !!session?.user?.wikimediaId,
      prompt: "UploadForm_sign_in_to_upload_wikimedia",
      action: "UploadForm_login_to_wikimedia",
      loginProvider: "wikimedia",
    },
    nccommons: {
      signedIn: !!session?.user?.nccommonsId,
      prompt: "UploadForm_sign_in_to_upload_nccommons",
      action: "UploadForm_login_to_nccommons",
      loginProvider: "nccommons",
    },
  }[provider];

  // unknown providers fall through unguarded, like the old switch default
  if (!config || config.signedIn) return children;

  return (
    <Stack spacing={1}>
      <Typography variant="body2">{t(config.prompt)}</Typography>
      <Button
        variant="contained"
        color="primary"
        sx={{ minWidth: 200 }}
        startIcon={<UploadFile />}
        onClick={() => popupCenter(`/login?provider=${config.loginProvider}`, "Login")}
      >
        {t(config.action)}
      </Button>
    </Stack>
  );
};

export default RequireUploadAuth;
