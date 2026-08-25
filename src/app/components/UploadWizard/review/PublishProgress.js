"use client";
import { LinearProgress, Stack, Typography } from "@mui/material";

const PublishProgress = ({ stage, progress }) => {
  if (!stage) return null;
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2">{stage}</Typography>
      <LinearProgress variant="determinate" value={progress} />
      <Typography variant="caption">{Math.round(progress)}%</Typography>
    </Stack>
  );
};

export default PublishProgress;
