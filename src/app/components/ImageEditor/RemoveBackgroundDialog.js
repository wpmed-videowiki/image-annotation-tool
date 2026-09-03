"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { DEFAULT_BACKGROUND_REMOVAL_THRESHOLD } from "../../config/constants";
import { editorToBlob } from "../../utils/editorToBlob";
import {
  REMOVE_BACKGROUND_COMMAND,
  RESTORE_BACKGROUND_COMMAND,
  createReplaceBackgroundCommand,
} from "./backgroundCommands";

const API_URL = "/api/image/remove-background";

const PANE_SX = {
  position: "relative",
  width: "100%",
  height: 360,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "#fafafa",
};

const CHECKERBOARD_SX = {
  backgroundColor: "#e6e6e6",
  backgroundImage:
    "linear-gradient(45deg, #bdbdbd 25%, transparent 25%), " +
    "linear-gradient(-45deg, #bdbdbd 25%, transparent 25%), " +
    "linear-gradient(45deg, transparent 75%, #bdbdbd 75%), " +
    "linear-gradient(-45deg, transparent 75%, #bdbdbd 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

const IMAGE_STYLE = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" };

const OVERLAY_SX = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 1,
  bgcolor: "rgba(255,255,255,0.6)",
};

const LOSSY = ["jpg", "jpeg"];

// POST the editor PNG; non-OK responses carry { error: <code> }
const requestRemoval = async (blob, threshold) => {
  const formData = new FormData();
  formData.append("file", blob, "editor.png");
  formData.append("threshold", String(threshold));
  const response = await fetch(API_URL, { method: "POST", body: formData });
  if (!response.ok) {
    let code = "generic";
    try {
      code = (await response.json()).error || code;
    } catch {
      // non-JSON body (proxy error page); keep the generic code
    }
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return response.blob();
};

// Stays mounted next to the editor so the captured original survives Cancel.
const RemoveBackgroundDialog = ({
  open,
  editorRef,
  onClose,
  onTransparencyChange = () => {},
}) => {
  const t = useTranslations("RemoveBackground");
  const [threshold, setThreshold] = useState(DEFAULT_BACKGROUND_REMOVAL_THRESHOLD);
  const [previewedThreshold, setPreviewedThreshold] = useState(null);
  const [original, setOriginal] = useState(null); // { blob, url } pre-removal background
  const [result, setResult] = useState(null); // { blob, url } transparent PNG
  const [applied, setApplied] = useState(false);
  const [stage, setStage] = useState(null); // capturing | processing | applying
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  // the undo-stack callbacks below outlive any single render
  const transparencyRef = useRef(onTransparencyChange);
  transparencyRef.current = onTransparencyChange;
  // revoked only on unmount: tui reloads from the URL on redo
  const urls = useRef([]);
  const busy = stage !== null;

  const trackUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    return url;
  };

  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = [];
    },
    []
  );

  const showError = useCallback(
    (code) => {
      const key = `errors.${code}`;
      const message = t.has(key) ? t(key) : t("errors.generic");
      setError(message);
      toast.error(message);
    },
    [t]
  );

  const runPreview = useCallback(
    async (blob, value) => {
      const id = ++requestId.current;
      setStage("processing");
      setError(null);
      try {
        const out = await requestRemoval(blob, value);
        if (id !== requestId.current) return;
        setResult({ blob: out, url: trackUrl(out) });
        setPreviewedThreshold(value);
      } catch (err) {
        if (id !== requestId.current) return;
        showError(err.code || "generic");
      } finally {
        if (id === requestId.current) setStage(null);
      }
    },
    [showError]
  );

  // capture on open unless a removal is applied (the canvas is transparent then)
  useEffect(() => {
    if (!open || applied) return undefined;
    const editor = editorRef.current;
    if (!editor) return undefined;
    let cancelled = false;
    (async () => {
      setStage("capturing");
      setError(null);
      setResult(null);
      setPreviewedThreshold(null);
      const blob = await editorToBlob(editor, {
        extension: "png",
        multiplier: 1,
        quality: 1,
        backgroundOnly: true,
      });
      if (cancelled) return;
      if (!blob) {
        setStage(null);
        showError("capture_failed");
        onClose();
        return;
      }
      setOriginal({ blob, url: trackUrl(blob) });
      runPreview(blob, threshold);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // tui re-invokes these on Undo/Redo, so applied follows the editor's history
  const markApplied = (value) => {
    setApplied(value);
    transparencyRef.current(value);
  };

  const replaceBackground = async (url, commandName, nextApplied) => {
    const editor = editorRef.current;
    if (!editor) return;
    setStage("applying");
    setError(null);
    try {
      const command = createReplaceBackgroundCommand(editor._graphics, {
        name: commandName,
        url,
        onExecute: () => markApplied(nextApplied),
        onUndo: () => markApplied(!nextApplied),
      });
      await editor.execute(command);
      onClose();
    } catch (err) {
      console.error("remove background: editor swap failed", err);
      showError("generic");
    } finally {
      setStage(null);
    }
  };

  const apply = () =>
    result && replaceBackground(result.url, REMOVE_BACKGROUND_COMMAND, true);
  const restore = () =>
    original &&
    applied &&
    replaceBackground(original.url, RESTORE_BACKGROUND_COMMAND, false);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("title")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">{t("apply_warning")}</Alert>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("before")}
              </Typography>
              <Box sx={PANE_SX}>
                {original ? (
                  <img src={original.url} alt={t("before")} style={IMAGE_STYLE} />
                ) : (
                  <CircularProgress size={24} />
                )}
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t("after")}
              </Typography>
              <Box sx={{ ...PANE_SX, ...CHECKERBOARD_SX }}>
                {result && (
                  <img
                    src={result.url}
                    alt={t("after")}
                    style={{ ...IMAGE_STYLE, opacity: busy ? 0.4 : 1 }}
                  />
                )}
                {busy && (
                  <Box sx={OVERLAY_SX}>
                    <CircularProgress size={28} />
                    <Typography variant="body2">
                      {t(stage === "capturing" ? "capturing" : "processing")}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Stack>

          <Box>
            <Typography id="remove-background-threshold" variant="body2" gutterBottom>
              {t("threshold_label")}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Slider
                aria-labelledby="remove-background-threshold"
                min={0}
                max={100}
                step={1}
                value={threshold}
                onChange={(_event, value) => setThreshold(value)}
                valueLabelDisplay="auto"
                disabled={busy || !original}
                sx={{ flex: 1 }}
              />
              <Typography variant="body2" sx={{ minWidth: 32, textAlign: "right" }}>
                {threshold}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => runPreview(original.blob, threshold)}
                disabled={busy || !original || threshold === previewedThreshold}
              >
                {t("update_preview")}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t("threshold_help")}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info">{t("png_hint")}</Alert>
          {applied && (
            <Typography variant="caption" color="text.secondary">
              {t("restore_warning")}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="warning" onClick={restore} disabled={busy || !applied}>
          {t("restore")}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button variant="contained" onClick={apply} disabled={busy || !result}>
          {t("apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { LOSSY as LOSSY_EXTENSIONS };
export default RemoveBackgroundDialog;
