"use client";
import { Button, Stack, Typography } from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { useTranslations } from "next-intl";
import { loginHref, useAuth } from "./AuthProvider";

// Wikimedia is guaranteed by the page-level gate; only NC Commons needs a link.
const RequireUploadAuth = ({ provider, children }) => {
  const { user } = useAuth();
  const t = useTranslations();

  if (provider !== "nccommons" || user?.linked?.nccommons) return children;

  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        {t("UploadForm_sign_in_to_upload_nccommons")}
      </Typography>
      <Button
        variant="contained"
        color="primary"
        sx={{ minWidth: 200 }}
        startIcon={<UploadFile />}
        href={loginHref("nccommons")}
      >
        {t("UploadForm_login_to_nccommons")}
      </Button>
    </Stack>
  );
};

export default RequireUploadAuth;
