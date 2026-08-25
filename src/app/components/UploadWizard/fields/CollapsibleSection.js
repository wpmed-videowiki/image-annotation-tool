"use client";
import { useId, useState } from "react";
import { Box, Collapse, Stack, Typography } from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";

// "other information" section, collapsed by default like on Commons
const CollapsibleSection = ({ label, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <Box>
      <Stack
        component="button"
        type="button"
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
        sx={{
          background: "none",
          border: 0,
          p: 0,
          cursor: "pointer",
          color: "text.primary",
          font: "inherit",
        }}
      >
        {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        <Typography variant="body2">{label}</Typography>
      </Stack>
      <Collapse in={open} id={contentId} unmountOnExit>
        <Box sx={{ mt: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

export default CollapsibleSection;
