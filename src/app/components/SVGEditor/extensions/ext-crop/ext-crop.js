import { shortNum, translateSvgContent } from "../../services/viewBox.js";

const name = "crop";
const cropRectOverlayId = "crop-rect-overlay";
const MIN_CROP_SIZE = 2;

const getBBoxInContentSpace = (element, content) => {
  const contentCTM = content.getScreenCTM();
  const elementCTM = element.getScreenCTM();
  if (!contentCTM || !elementCTM) return null;

  const bbox = element.getBBox();
  const matrix = contentCTM.inverse().multiply(elementCTM);
  const points = [
    [bbox.x, bbox.y],
    [bbox.x + bbox.width, bbox.y],
    [bbox.x, bbox.y + bbox.height],
    [bbox.x + bbox.width, bbox.y + bbox.height],
  ].map(([x, y]) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  }));

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const clampToDrawing = (box, width, height) => {
  const x = Math.max(0, Math.min(box.x, width));
  const y = Math.max(0, Math.min(box.y, height));

  return {
    x,
    y,
    width: Math.min(box.x + box.width, width) - x,
    height: Math.min(box.y + box.height, height) - y,
  };
};

export default {
  name,
  init: (data) =>
    async function () {
      const updateCanvas = data.updateCanvas;
      const svgEditor = this;
      const canv = svgEditor;
      const svgroot = canv.getSvgRoot();

      const modeId = name;

      let curShape;
      let startX;
      let startY;

      return {
        callback() {},
        mouseDown(opts) {
          const mode = canv.getMode();
          if (!mode.startsWith(modeId)) {
            return undefined;
          }
          const [_, name] = mode.split("-");

          startX = opts.start_x;
          const x = startX;
          startY = opts.start_y;
          const y = startY;
          const curStyle = canv.getStyle();

          curShape = canv.addSVGElementsFromJson({
            element: "rect",
            curStyles: true,
            attr: {
              // d: currentD,
              id: cropRectOverlayId,
              opacity: curStyle.opacity / 4,
              style: "pointer-events:none",
              x,
              y,
              width: 5,
              height: 5,
              "stroke-width": 1,
            },
          });

          canv.recalculateDimensions(curShape);

          return {
            started: true,
          };
        },
        mouseMove(opts) {
          const mode = canv.getMode();
          if (!mode.startsWith(modeId)) {
            return;
          }

          const zoom = canv.getZoom();
          const evt = opts.event;

          const x = opts.mouse_x / zoom;
          const y = opts.mouse_y / zoom;
          let w = Math.abs(x - canv.getStartX());
          let h = Math.abs(y - canv.getStartY());

          const newX = Math.min(canv.getStartX(), x);
          const newY = Math.min(canv.getStartY(), y);

          curShape.setAttribute("width", w);
          curShape.setAttribute("height", h);
          curShape.setAttribute("x", newX);
          curShape.setAttribute("y", newY);

          canv.recalculateDimensions(curShape);
        },
        mouseUp(opts, ...other) {
          const mode = canv.getMode();
          if (!mode.startsWith(modeId)) {
            return undefined;
          }

          const content = canv.getSvgContent();
          const drawnBBox = getBBoxInContentSpace(curShape, content);
          const cropBox =
            drawnBBox &&
            clampToDrawing(
              drawnBBox,
              Number(canv.contentW),
              Number(canv.contentH)
            );
          const keepObject =
            cropBox &&
            cropBox.width >= MIN_CROP_SIZE &&
            cropBox.height >= MIN_CROP_SIZE;

          if (keepObject) {
            const el = document.createElement("div");
            el.innerHTML = canv.svgCanvasToString();
            const svg = el.childNodes[0];
            // Remove cropRectOverlay
            const cropRectOverlay = svg.querySelector(`#${cropRectOverlayId}`);
            cropRectOverlay?.parentElement.removeChild(cropRectOverlay);

            translateSvgContent(svg, cropBox.x, cropBox.y);

            const width = shortNum(cropBox.width);
            const height = shortNum(cropBox.height);
            svg.setAttribute("width", width);
            svg.setAttribute("height", height);
            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

            canv.setSvgString(svg.outerHTML);
            updateCanvas();
          }
          return {
            keep: false,
            element: curShape,
            started: false,
          };
        },
      };
    },
};
