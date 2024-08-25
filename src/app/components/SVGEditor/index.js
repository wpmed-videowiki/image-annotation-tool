"use client";

import { useEffect, useRef } from "react";
import Editor from "./editor.class";

const SVGEditor = ({ image, instanceRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current && image) {
      const editor = new Editor(document.getElementById("svg-editor"));
      ref.current = editor;
      if (instanceRef) {
        instanceRef.current = {
          async toDataURL(options) {
            // convert svg to base64
            const svgEl = document
              .getElementById("svg-editor")
              .querySelector("#svgcontent");
            svgEl.querySelector("#selectorParentGroup")?.remove();
            if (svgEl) {
              const svgData = new XMLSerializer().serializeToString(svgEl);
              return "data:image/svg+xml;base64," + btoa(svgData);
            }

            return "";
          },
        };
      }
      // editor.load(image);
      fetch(image)
        .then((response) => {
          return response.text();
        })
        .then((data) => {
          editor.load(data);
          // console.log({ data });
          // const el = document.createElement("div");
          // el.innerHTML = data;
          // const svg = el.childNodes[0];
          // // format svg into style, defs and a wrapping g element
          // let defs = svg.querySelector("defs");
          // const style = svg.querySelector("style");
          // const others = Array.from(svg.childNodes).filter(
          //   (node) => node.tagName !== "style" && node.tagName !== "defs"
          // );
          // // If we have more than one child, we need to wrap them in a g element to apply cropping
          // if (others.length > 1) {
          //   // remove others from svg
          //   others.forEach((node) => svg.removeChild(node));
          //   // create a wrapping g element
          //   const g = document.createElement("g");
          //   g.setAttribute("clip-path", "url(#crop-clipPath)");
          //   svg.appendChild(g);
          //   // append others to g
          //   others.forEach((node) => g.appendChild(node));
          // } else {
          //   // if we only have one child, we can apply cropping directly to the child
          //   const child = others[0];
          //   child.setAttribute("clip-path", "url(#crop-clipPath)");
          // }
          // if (!defs) {
          //   defs = document.createElement("defs");
          // }
          // const cropRect = document.createElement("rect");
          // cropRect.setAttribute("id", "crop-rect");
          // cropRect.setAttribute("x", "0");
          // cropRect.setAttribute("y", "0");
          // cropRect.setAttribute("width", svg.getAttribute("width"));
          // cropRect.setAttribute("height", svg.getAttribute("height"));
          // const cropClipPath = document.createElement("clipPath");
          // cropClipPath.setAttribute("id", "crop-clipPath");
          // cropClipPath.appendChild(cropRect);

          // defs.appendChild(cropClipPath);
          // svg.appendChild(defs);

          // const svgContent = svg.outerHTML.replace(/clippath/g, "clipPath"); // fix for react
          // console.log({
          //   style,
          //   defs,
          //   others,
          //   svg,
          //   svgHtml: svgContent,
          // });
          // editor.load(svgContent);
        });
    }
  }, [image]);
  return (
    <div>
      <div
        id="svg-editor"
        style={{ position: "relative", height: "calc(100vh - 80px)" }}
      ></div>
    </div>
  );
};

export default SVGEditor;