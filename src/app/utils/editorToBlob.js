export const MIME_BY_EXTENSION = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// Renders the editor content straight to a Blob, skipping the
// toDataURL/base64 round-trip that cannot represent very large exports.
// Returns null when the canvas cannot export at this multiplier (browser
// canvas dimension/area limits) so callers can fall back to a smaller one.
export const editorToBlob = async (
  editor,
  { extension, multiplier = 1, quality = 1 }
) => {
  // SVG editor shim exports its own Blob; multiplier does not apply
  if (typeof editor.toBlob === "function") {
    return editor.toBlob();
  }

  const mime = MIME_BY_EXTENSION[extension] || "application/octet-stream";
  try {
    // fabric's toDataURL is toCanvasElement(multiplier).toDataURL(), so
    // going through toCanvasElement + canvas.toBlob is pixel-identical
    const canvasEl = editor._graphics
      .getCanvas()
      .toCanvasElement(multiplier);
    return await new Promise((resolve) =>
      canvasEl.toBlob((blob) => resolve(blob), mime, quality)
    );
  } catch (err) {
    console.log("canvas export failed", err);
    return null;
  }
};
