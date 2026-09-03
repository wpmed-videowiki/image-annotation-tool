const IMAGE_LOADER = "IMAGE_LOADER";

// not "loadImage": tui hides that name from the History panel
export const REMOVE_BACKGROUND_COMMAND = "removeBackground";
export const RESTORE_BACKGROUND_COMMAND = "restoreBackground";

export const createReplaceBackgroundCommand = (
  graphics,
  { name, url, onExecute = null, onUndo = null }
) => ({
  name,
  args: [graphics, name, url],
  undoData: {},
  execute(g, imageName, imageUrl) {
    const loader = g.getComponent(IMAGE_LOADER);
    // redo re-runs execute, so capture the current image each time
    this.undoData = {
      name: loader.getImageName(),
      image: loader.getCanvasImage(),
    };
    // tui sizes the canvas from the zoomed bounding box, so load at zoom 1
    g.resetZoom();
    return loader
      .load(imageName, imageUrl)
      .then((image) => ({ newWidth: image.width, newHeight: image.height }));
  },
  undo(g) {
    const loader = g.getComponent(IMAGE_LOADER);
    const { name: previousName, image } = this.undoData;
    g.resetZoom();
    return loader.load(previousName, image);
  },
  executeCallback: onExecute,
  undoCallback: onUndo,
});
