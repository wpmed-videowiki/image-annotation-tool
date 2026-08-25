"use client";
import { useEffect, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";

// Thumbnail beside the Describe fields, sticky on desktop.
const PreviewCard = ({ source }) => {
  const [objectUrl, setObjectUrl] = useState("");

  useEffect(() => {
    if (!source?.deviceFile) return undefined;
    const url = URL.createObjectURL(source.deviceFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source?.deviceFile]);

  const isImage = source?.mediaType === "image";
  const src =
    objectUrl || source?.previewUrl || source?.videoUrl || source?.imageUrl || "";
  if (!src) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        width: { xs: "100%", md: 320 },
        flexShrink: 0,
        p: 1,
        position: { md: "sticky" },
        // clear the fixed AppBar + layout marginTop
        top: { md: 88 },
      }}
    >
      {isImage ? (
        <Box
          component="img"
          src={src}
          alt=""
          sx={{ width: "100%", borderRadius: 1, display: "block" }}
        />
      ) : (
        <Box
          component="video"
          src={src}
          muted
          playsInline
          preload="metadata"
          controls
          sx={{ width: "100%", borderRadius: 1, bgcolor: "common.black" }}
        />
      )}
      {source?.originalTitle && (
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
          {source.originalTitle}
        </Typography>
      )}
    </Paper>
  );
};

export default PreviewCard;
