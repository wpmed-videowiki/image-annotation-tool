"use client";
import { Alert } from "@mui/material";

// "Do not upload this file!" warning; referenced by the Next button's
// aria-describedby
const BlockingWarning = ({ id, children, severity = "warning" }) => (
  <Alert severity={severity} role="alert" id={id} sx={{ mt: 1 }}>
    {children}
  </Alert>
);

export default BlockingWarning;
