"use client";
import { useEffect, useState } from "react";
import { Box } from "@mui/material";

const MIN_SIZE = 0.05;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const HANDLES = [
  { key: "nw", left: 0, top: 0, cursor: "nwse-resize" },
  { key: "n", left: 0.5, top: 0, cursor: "ns-resize" },
  { key: "ne", left: 1, top: 0, cursor: "nesw-resize" },
  { key: "w", left: 0, top: 0.5, cursor: "ew-resize" },
  { key: "e", left: 1, top: 0.5, cursor: "ew-resize" },
  { key: "sw", left: 0, top: 1, cursor: "nesw-resize" },
  { key: "s", left: 0.5, top: 1, cursor: "ns-resize" },
  { key: "se", left: 1, top: 1, cursor: "nwse-resize" },
];

const applyDrag = (rect, mode, dx, dy) => {
  if (mode === "move") {
    return {
      ...rect,
      x: clamp(rect.x + dx, 0, 1 - rect.w),
      y: clamp(rect.y + dy, 0, 1 - rect.h),
    };
  }
  let { x, y, w, h } = rect;
  if (mode.includes("w")) {
    const newX = clamp(x + dx, 0, x + w - MIN_SIZE);
    w = x + w - newX;
    x = newX;
  }
  if (mode.includes("e")) {
    w = clamp(w + dx, MIN_SIZE, 1 - x);
  }
  if (mode.includes("n")) {
    const newY = clamp(y + dy, 0, y + h - MIN_SIZE);
    h = y + h - newY;
    y = newY;
  }
  if (mode.includes("s")) {
    h = clamp(h + dy, MIN_SIZE, 1 - y);
  }
  return { x, y, w, h };
};

// Renders a draggable/resizable rectangle over the (already rotated) video
// display box. All coordinates are normalized 0..1 relative to that box.
// Commits a single rect on pointer-up so each gesture is one undo step.
const CropOverlay = ({ width, height, crop, onCommit }) => {
  const [rect, setRect] = useState(crop);

  useEffect(() => {
    setRect(crop);
  }, [crop]);

  if (!rect || !width || !height) return null;

  const startDrag = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = rect;
    let lastRect = startRect;
    const handleMove = (ev) => {
      const dx = (ev.clientX - startX) / width;
      const dy = (ev.clientY - startY) / height;
      lastRect = applyDrag(startRect, mode, dx, dy);
      setRect(lastRect);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (
        lastRect.x !== startRect.x ||
        lastRect.y !== startRect.y ||
        lastRect.w !== startRect.w ||
        lastRect.h !== startRect.h
      ) {
        onCommit(lastRect);
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <Box
        onPointerDown={(e) => startDrag(e, "move")}
        sx={{
          position: "absolute",
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.w * 100}%`,
          height: `${rect.h * 100}%`,
          border: "2px dashed #fff",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          cursor: "move",
        }}
      >
        {HANDLES.map((handle) => (
          <Box
            key={handle.key}
            onPointerDown={(e) => startDrag(e, handle.key)}
            sx={{
              position: "absolute",
              left: `calc(${handle.left * 100}% - 6px)`,
              top: `calc(${handle.top * 100}% - 6px)`,
              width: 12,
              height: 12,
              backgroundColor: "#fff",
              border: "1px solid #333",
              borderRadius: "2px",
              cursor: handle.cursor,
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default CropOverlay;
