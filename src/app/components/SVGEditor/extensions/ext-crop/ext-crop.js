const name = "crop";
const cropRectOverlayId = "crop-rect-overlay";

export default {
  name,
  init: (data) =>
    async function () {
      const updateCanvas = data.updateCanvas;
      const svgEditor = this;
      const canv = svgEditor;
      const svgroot = canv.getSvgRoot();
      let lastBBox = {};

      const modeId = name;
      const startClientPos = {};

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

          startClientPos.x = opts.event.clientX;
          startClientPos.y = opts.event.clientY;

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

          lastBBox = curShape.getBBox();

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

          lastBBox = curShape.getBBox();
        },
        mouseUp(opts, ...other) {
          const mode = canv.getMode();
          if (!mode.startsWith(modeId)) {
            return undefined;
          }

          const keepObject =
            opts.event.clientX !== startClientPos.x &&
            opts.event.clientY !== startClientPos.y;
          if (keepObject) {
            const el = document.createElement("div");
            el.innerHTML = canv.svgCanvasToString();
            const svg = el.childNodes[0];
            // Remove cropRectOverlay
            const cropRectOverlay = svg.querySelector(`#${cropRectOverlayId}`);
            cropRectOverlay.parentElement.removeChild(cropRectOverlay);

            svg.setAttribute(
              "viewBox",
              `${lastBBox.x} ${lastBBox.y} ${lastBBox.width} ${lastBBox.height}`
            );

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
