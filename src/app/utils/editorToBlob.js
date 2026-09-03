export const MIME_BY_EXTENSION = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

// fabric exports through the live viewport, so render at identity;
// backgroundOnly hides every object so only the background image is drawn
export const renderCanvas = (
  canvas,
  { multiplier = 1, backgroundOnly = false } = {}
) => {
  const viewport = canvas.viewportTransform;
  const hidden = backgroundOnly
    ? canvas.getObjects().filter((object) => object.visible !== false)
    : [];
  hidden.forEach((object) => {
    object.visible = false;
  });
  canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
  try {
    return canvas.toCanvasElement(multiplier);
  } finally {
    canvas.viewportTransform = viewport;
    hidden.forEach((object) => {
      object.visible = true;
    });
  }
};

// Renders the editor content straight to a Blob, skipping the
// toDataURL/base64 round-trip that cannot represent very large exports.
// Returns null when the canvas cannot export at this multiplier (browser
// canvas dimension/area limits) so callers can fall back to a smaller one.
export const editorToBlob = async (
  editor,
  { extension, multiplier = 1, quality = 1, backgroundOnly = false }
) => {
  // SVG editor shim exports its own Blob; multiplier does not apply
  if (typeof editor.toBlob === "function") {
    return editor.toBlob();
  }

  const mime = MIME_BY_EXTENSION[extension] || "application/octet-stream";
  try {
    // fabric's toDataURL is toCanvasElement(multiplier).toDataURL(), so
    // going through toCanvasElement + canvas.toBlob is pixel-identical
    const canvasEl = renderCanvas(editor._graphics.getCanvas(), {
      multiplier,
      backgroundOnly,
    });
    return await new Promise((resolve) =>
      canvasEl.toBlob((blob) => resolve(blob), mime, quality)
    );
  } catch (err) {
    console.log("canvas export failed", err);
    return null;
  }
};
