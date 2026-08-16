/**
 * Cropping replaces the whole #svgcontent element (svgCanvas.setSvgString).
 * Undoing or redoing that change restores the DOM, but svgCanvas keeps pointing at
 * the document it no longer displays: the canvas size, the white background and the
 * layer new elements are added to all stay on the values of the discarded document.
 * This re-attaches svgCanvas to the document that is actually displayed.
 */

/**
 * @param {SvgCanvas} canvas
 * @returns {boolean} true when the canvas had to be re-attached
 */
export const syncCanvasWithDocument = (canvas) => {
  if (!canvas) return false

  const root = canvas.getSvgRoot()
  const content = root?.querySelector('#svgcontent')
  if (!content || content === canvas.getSvgContent()) return false

  canvas.clearSelection()
  canvas.setSvgContent(content)

  const drawing = canvas.getCurrentDrawing()
  if (drawing) {
    // no public setter for the drawing element, but the layers have to be read
    // from the restored document for new elements to end up in it
    drawing.svgElem_ = content
    canvas.identifyLayers()
  }

  // updateCanvas() writes the viewBox as "0 0 <contentW> <contentH>", so it is the
  // place the restored dimensions can be read back from
  const [, , width, height] = (content.getAttribute('viewBox') || '')
    .split(/[\s,]+/)
    .map(Number)
  if (width > 0 && height > 0) {
    canvas.contentW = width
    canvas.contentH = height
  }

  return true
}

export default { syncCanvasWithDocument }
