/**
 * svgCanvas.updateCanvas() rewrites the root viewBox to "0 0 <width> <height>"
 * on every canvas update, so the drawing origin can never be carried by the
 * viewBox: an offset is silently dropped and the drawing ends up shifted.
 * Anything that changes the visible area (loading a file, cropping) therefore
 * has to move the content itself and keep the viewBox at the origin.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
// Elements holding drawable content: they have to be moved with the drawing.
const CONTENT_ELEMENTS = [
  "a",
  "circle",
  "ellipse",
  "foreignObject",
  "g",
  "image",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "svg",
  "switch",
  "text",
  "use",
];

export const shortNum = (value) => Math.round(value * 1000) / 1000;

/**
 * Moves every content element of an SVG root so that (dx, dy) becomes the new origin.
 * @param {SVGSVGElement} svg root element, modified in place
 */
export const translateSvgContent = (svg, dx, dy) => {
  if (!dx && !dy) return svg;
  const transform = `translate(${shortNum(-dx)} ${shortNum(-dy)})`;

  Array.from(svg.children).forEach((child) => {
    if (!CONTENT_ELEMENTS.includes(child.localName)) return;

    const isLayer =
      child.localName === "g" &&
      (child.getAttribute("class") || "").split(/\s+/).includes("layer");

    if (isLayer) {
      // svgCanvas expects its layers to stay untransformed, so the drawing is
      // moved by a group inside the layer rather than by the layer itself.
      const group = svg.ownerDocument.createElementNS(SVG_NS, "g");
      group.setAttribute("transform", transform);
      Array.from(child.childNodes).forEach((node) => {
        if (node.localName === "title") return;
        group.appendChild(node);
      });
      child.appendChild(group);
      return;
    }

    const currentTransform = child.getAttribute("transform");
    child.setAttribute(
      "transform",
      currentTransform ? `${transform} ${currentTransform}` : transform
    );
  });

  return svg;
};

/**
 * Moves the content of an SVG file whose viewBox does not start at (0, 0), so it
 * is displayed - and cropped - at the right place by the editor.
 * The string is returned untouched when there is nothing to fix.
 * @param {string} svgString
 * @returns {string}
 */
export const normalizeViewBoxOrigin = (svgString) => {
  if (typeof svgString !== "string" || !svgString.includes("viewBox")) {
    return svgString;
  }

  try {
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
    const svg = doc.documentElement;
    if (
      !svg ||
      svg.localName !== "svg" ||
      doc.querySelector("parsererror")
    ) {
      return svgString;
    }

    const viewBox = (svg.getAttribute("viewBox") || "")
      .split(/[\s,]+/)
      .filter((value) => value !== "")
      .map(Number);
    if (viewBox.length !== 4 || viewBox.some(Number.isNaN)) return svgString;

    const [minX, minY, width, height] = viewBox;
    if (!minX && !minY) return svgString;
    if (width <= 0 || height <= 0) return svgString;

    translateSvgContent(svg, minX, minY);
    svg.setAttribute("viewBox", `0 0 ${shortNum(width)} ${shortNum(height)}`);

    return new XMLSerializer().serializeToString(svg);
  } catch (error) {
    console.error("Could not normalize the SVG viewBox", error);
    return svgString;
  }
};

export default { normalizeViewBoxOrigin, translateSvgContent, shortNum };
