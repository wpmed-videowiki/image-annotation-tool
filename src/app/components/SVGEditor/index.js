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
