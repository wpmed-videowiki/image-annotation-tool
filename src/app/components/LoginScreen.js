"use client";
import { Button, Stack, Typography } from "@mui/material";
import { Login } from "@mui/icons-material";
import { useTranslations } from "next-intl";
import { loginHref } from "./AuthProvider";

const LoginScreen = () => {
  const t = useTranslations();
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={3}
      sx={{ flex: 1, py: 4 }}
    >
      <img src="/logo.png" width={260} alt="" />
      <Typography variant="body1" color="text.secondary" textAlign="center">
        {t("Login_intro")}
      </Typography>
      <Button
        variant="contained"
        size="large"
        startIcon={<Login />}
        href={loginHref("wikimedia", "/")}
      >
        {t("Login_with_wikimedia")}
      </Button>
    </Stack>
  );
};

export default LoginScreen;
