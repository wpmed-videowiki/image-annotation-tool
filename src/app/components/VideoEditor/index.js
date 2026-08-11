"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { Alert, Box, Chip, IconButton, Stack, Tooltip } from "@mui/material";
import {
  Crop,
  Pause,
  PlayArrow,
  Redo,
  RestartAlt,
  RotateLeft,
  RotateRight,
  Undo,
  VolumeOff,
  VolumeUp,
} from "@mui/icons-material";
import { useTranslations } from "next-intl";
import { initialOpsState, opsReducer } from "./opsReducer";
import CropOverlay from "./CropOverlay";
import TrimBar, { formatTime } from "./TrimBar";

const DEFAULT_CROP = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

// videoUrl is the original file (what the server processes); previewUrl is
// an optional browser-playable derivative (e.g. Commons' VP9 transcode of a
// Theora original) used only for the <video> preview.
const VideoEditor = ({ videoUrl, previewUrl, deviceFile, instanceRef }) => {
  const t = useTranslations();
  const videoRef = useRef(null);
  const boxRef = useRef(null);

  const [history, dispatch] = useReducer(opsReducer, initialOpsState);
  const ops = history.present;

  const [meta, setMeta] = useState(null); // { duration, width, height }
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewError, setPreviewError] = useState(false);

  // The object URL is created and revoked inside one effect so each mount
  // gets its own URL (StrictMode double-mounts would otherwise reuse a
  // revoked one).
  const [src, setSrc] = useState(deviceFile ? "" : previewUrl || videoUrl);
  useEffect(() => {
    if (!deviceFile) {
      setSrc(previewUrl || videoUrl);
      setPreviewError(false);
      return;
    }
    const url = URL.createObjectURL(deviceFile);
    setSrc(url);
    setPreviewError(false);
    return () => URL.revokeObjectURL(url);
  }, [deviceFile, videoUrl, previewUrl]);

  // getVideoData must always see the latest state, while instanceRef is
  // assigned only once, so the live values are mirrored into refs.
  const latestRef = useRef({});
  latestRef.current = { ops, meta };

  useEffect(() => {
    instanceRef.current = {
      isVideo: true,
      getVideoData: () => ({
        ops: latestRef.current.ops,
        sourceType: deviceFile ? "device" : "commons",
        sourceUrl: videoUrl || "",
        deviceFile: deviceFile || null,
        duration: latestRef.current.meta?.duration ?? null,
        width: latestRef.current.meta?.width ?? null,
        height: latestRef.current.meta?.height ?? null,
      }),
    };
  }, [instanceRef, deviceFile, videoUrl]);

  useEffect(() => {
    const measure = () => {
      if (boxRef.current) {
        setBoxSize({
          width: boxRef.current.clientWidth,
          height: boxRef.current.clientHeight,
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = ops.mute;
  }, [ops.mute]);

  // Fit the rotated video inside the preview box: for 90/270 the bounding
  // box has swapped dimensions, so the element is sized pre-rotation such
  // that the rotated result fits.
  const rotated = ops.rotation % 180 !== 0;
  const naturalW = meta?.width || 16;
  const naturalH = meta?.height || 9;
  const fitW = rotated ? naturalH : naturalW;
  const fitH = rotated ? naturalW : naturalH;
  const scale =
    boxSize.width && boxSize.height
      ? Math.min(boxSize.width / fitW, boxSize.height / fitH)
      : 0;
  const displayW = naturalW * scale;
  const displayH = naturalH * scale;
  const frameW = fitW * scale;
  const frameH = fitH * scale;

  const rotateBy = (delta) =>
    // crop coords are relative to the rotated frame, so rotating resets crop
    dispatch({
      type: "APPLY",
      payload: { rotation: (ops.rotation + delta + 360) % 360, crop: null },
    });

  const toggleCrop = () =>
    dispatch({
      type: "APPLY",
      payload: { crop: ops.crop ? null : DEFAULT_CROP },
    });

  const toggleMute = () =>
    dispatch({ type: "APPLY", payload: { mute: !ops.mute } });

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // play() rejects (NotSupportedError) when the browser cannot decode
      // this format, e.g. Theora .ogv in Chrome
      video.play().catch(() => setPreviewError(true));
    } else {
      video.pause();
    }
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setMeta({
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    });
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (ops.trim && !video.paused && video.currentTime >= ops.trim.end) {
      video.currentTime = ops.trim.start;
    }
  };

  const onPlay = () => {
    const video = videoRef.current;
    if (
      ops.trim &&
      (video.currentTime < ops.trim.start ||
        video.currentTime >= ops.trim.end - 0.05)
    ) {
      video.currentTime = ops.trim.start;
    }
    setPlaying(true);
  };

  const editingDisabled = previewError;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Tooltip title={t("VideoEditor_rotate_left")}>
          <IconButton onClick={() => rotateBy(-90)}>
            <RotateLeft />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("VideoEditor_rotate_right")}>
          <IconButton onClick={() => rotateBy(90)}>
            <RotateRight />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("VideoEditor_crop")}>
          <span>
            <IconButton
              onClick={toggleCrop}
              color={ops.crop ? "primary" : "default"}
              disabled={editingDisabled}
            >
              <Crop />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={ops.mute ? t("VideoEditor_unmute") : t("VideoEditor_mute")}>
          <IconButton onClick={toggleMute} color={ops.mute ? "primary" : "default"}>
            {ops.mute ? <VolumeOff /> : <VolumeUp />}
          </IconButton>
        </Tooltip>
        <Tooltip title={t("VideoEditor_undo")}>
          <span>
            <IconButton onClick={() => dispatch({ type: "UNDO" })} disabled={!history.past.length}>
              <Undo />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("VideoEditor_redo")}>
          <span>
            <IconButton onClick={() => dispatch({ type: "REDO" })} disabled={!history.future.length}>
              <Redo />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("VideoEditor_reset")}>
          <span>
            <IconButton
              onClick={() => dispatch({ type: "RESET" })}
              disabled={
                ops.rotation === 0 && !ops.trim && !ops.crop && !ops.mute
              }
            >
              <RestartAlt />
            </IconButton>
          </span>
        </Tooltip>
        {ops.rotation !== 0 && <Chip size="small" label={`${ops.rotation}°`} />}
        {ops.trim && (
          <Chip
            size="small"
            label={`${formatTime(ops.trim.start)} – ${formatTime(ops.trim.end)}`}
          />
        )}
        {ops.mute && <Chip size="small" label={t("VideoEditor_mute")} />}
      </Stack>
      {previewError && (
        <Alert severity="warning">{t("VideoEditor_preview_unavailable")}</Alert>
      )}
      <Box
        ref={boxRef}
        sx={{
          position: "relative",
          width: "100%",
          height: "60vh",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src || undefined}
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={() => setPlaying(false)}
          onError={() => setPreviewError(true)}
          onClick={togglePlay}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: displayW || "100%",
            height: displayH || "100%",
            transform: `translate(-50%, -50%) rotate(${ops.rotation}deg)`,
          }}
        />
        {ops.crop && frameW > 0 && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: frameW,
              height: frameH,
            }}
          >
            <CropOverlay
              width={frameW}
              height={frameH}
              crop={ops.crop}
              onCommit={(rect) =>
                dispatch({ type: "APPLY", payload: { crop: rect } })
              }
            />
          </Box>
        )}
      </Box>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <IconButton onClick={togglePlay} disabled={previewError}>
          {playing ? <Pause /> : <PlayArrow />}
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <TrimBar
            duration={meta?.duration}
            trim={ops.trim}
            currentTime={currentTime}
            disabled={editingDisabled}
            onSeek={(time) => {
              if (videoRef.current) videoRef.current.currentTime = time;
            }}
            onCommit={(trim) => dispatch({ type: "APPLY", payload: { trim } })}
          />
        </Box>
      </Stack>
    </Stack>
  );
};

export default VideoEditor;
