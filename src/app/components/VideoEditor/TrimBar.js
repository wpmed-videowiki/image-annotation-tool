"use client";
import { useRef, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00.0";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

// Timeline with two drag handles marking the kept range. Commits a single
// trim value on pointer-up (null when the full range is selected).
const TrimBar = ({ duration, trim, currentTime, onSeek, onCommit, disabled }) => {
  const trackRef = useRef(null);
  const [transient, setTransient] = useState(null);

  if (!duration) return null;

  const effective = transient || trim || { start: 0, end: duration };

  const posToTime = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * duration, 0, duration);
  };

  const startHandleDrag = (e, which) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const base = trim || { start: 0, end: duration };
    let last = base;
    const handleMove = (ev) => {
      const time = posToTime(ev.clientX);
      if (which === "start") {
        last = { start: Math.min(time, base.end - 0.1), end: base.end };
      } else {
        last = { start: base.start, end: Math.max(time, base.start + 0.1) };
      }
      setTransient(last);
      onSeek(which === "start" ? last.start : last.end);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setTransient(null);
      const isFullRange = last.start <= 0.05 && last.end >= duration - 0.05;
      onCommit(
        isFullRange
          ? null
          : {
              start: Math.round(last.start * 100) / 100,
              end: Math.round(last.end * 100) / 100,
            }
      );
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const onTrackClick = (e) => {
    if (disabled) return;
    onSeek(posToTime(e.clientX));
  };

  const startPct = (effective.start / duration) * 100;
  const endPct = (effective.end / duration) * 100;
  const playheadPct = clamp((currentTime / duration) * 100, 0, 100);

  return (
    <Stack spacing={0.5} sx={{ opacity: disabled ? 0.4 : 1 }}>
      <Box
        ref={trackRef}
        onClick={onTrackClick}
        sx={{
          position: "relative",
          height: 28,
          borderRadius: 1,
          backgroundColor: "#ddd",
          cursor: disabled ? "default" : "pointer",
          touchAction: "none",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${startPct}%`,
            width: `${endPct - startPct}%`,
            backgroundColor: "primary.main",
            opacity: 0.5,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${playheadPct}%`,
            width: "2px",
            backgroundColor: "#d32f2f",
            pointerEvents: "none",
          }}
        />
        <Box
          onPointerDown={(e) => startHandleDrag(e, "start")}
          sx={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: `calc(${startPct}% - 5px)`,
            width: 10,
            borderRadius: 1,
            backgroundColor: "primary.dark",
            cursor: disabled ? "default" : "ew-resize",
          }}
        />
        <Box
          onPointerDown={(e) => startHandleDrag(e, "end")}
          sx={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: `calc(${endPct}% - 5px)`,
            width: 10,
            borderRadius: 1,
            backgroundColor: "primary.dark",
            cursor: disabled ? "default" : "ew-resize",
          }}
        />
      </Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{formatTime(effective.start)}</Typography>
        <Typography variant="caption">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
        <Typography variant="caption">{formatTime(effective.end)}</Typography>
      </Stack>
    </Stack>
  );
};

export default TrimBar;
