"use client";
import { Chip, CircularProgress } from "@mui/material";
import { useTranslations } from "next-intl";

import { statusChipKind } from "../../utils/jobStatus";

const KIND_COLOR = {
  queued: "default",
  running: "primary",
  done: "success",
  error: "error",
  cancelled: "warning",
};

const StatusChip = ({ status }) => {
  const t = useTranslations("Uploads");
  const kind = statusChipKind(status);
  return (
    <Chip
      size="small"
      variant={kind === "queued" ? "outlined" : "filled"}
      color={KIND_COLOR[kind]}
      label={t(`status.${status}`)}
      icon={
        kind === "running" ? (
          <CircularProgress size={14} color="inherit" thickness={5} />
        ) : undefined
      }
    />
  );
};

export default StatusChip;
