"use client";
import { Stack, Typography } from "@mui/material";
import { useTranslations } from "next-intl";

import { RIGHTS_TREE } from "../config/rightsTree";
import RightsNode from "../rights/RightsNode";

const StepRights = ({ provider }) => {
  const t = useTranslations("UploadWizard");

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        {t("steps.rights_subtitle")}
      </Typography>
      <RightsNode node={RIGHTS_TREE} provider={provider} />
    </Stack>
  );
};

export default StepRights;
