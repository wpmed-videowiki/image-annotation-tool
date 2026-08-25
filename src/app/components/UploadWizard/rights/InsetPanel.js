"use client";
import { Box } from "@mui/material";

// grey inset grouping a revealed sub-question, like Commons
const InsetPanel = ({ labelledBy, children }) => (
  <Box
    role="group"
    aria-labelledby={labelledBy}
    sx={{
      bgcolor: "grey.100",
      borderLeft: "3px solid",
      borderColor: "divider",
      borderRadius: 1,
      p: 2,
      mt: 1,
    }}
  >
    {children}
  </Box>
);

export default InsetPanel;
