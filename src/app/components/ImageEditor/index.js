import { useEffect, useRef } from "react";
import { whiteTheme } from "./white-theme";
import {blackTheme} from './black-theme'
import ImageEditorComp from "tui-image-editor";

// default color red
const DEFAULT_COLOR = "#ff4040";

const ImageEditor = ({ image, instanceRef, aspectRatio }) => {
  const containerRef = useRef(null);
  const containerWidth = useRef(null);

  useEffect(() => {
    if ((!instanceRef.current && image, containerRef.current)) {
      containerWidth.current =
        containerRef.current.getBoundingClientRect().width;
      const instance = new ImageEditorComp(
        document.querySelector("#tui-image-editor"),
        {
          usageStatistics: false,
          includeUI: {
            loadImage: {
              path: image,
              name: "SampleImage",
            },
            menuBarPosition: "bottom",
            // theme: theme.current === "black" ? blackTheme : whiteTheme,
            theme: whiteTheme,
          },
        }
      );
      instanceRef.current = instance;

      // Work around for default color
      const editor = instanceRef.current;
      editor.ui.shape.options.stroke = DEFAULT_COLOR;
      editor.ui.shape._els.strokeColorpicker._color = DEFAULT_COLOR;
      editor.ui.shape.colorPickerControls[1].colorElement.style.backgroundColor =
        DEFAULT_COLOR;

      const icon = editor.ui.icon;
      icon._els.iconColorpicker._color = DEFAULT_COLOR;
      icon._els.iconColorpicker.picker.options.color = DEFAULT_COLOR;
      icon.colorPickerInputBox.value = DEFAULT_COLOR;
      icon._els.iconColorpicker.colorElement.style.backgroundColor =
        DEFAULT_COLOR;

      // Draw
      const draw = editor.ui.draw;
      draw.color = DEFAULT_COLOR;
      draw.colorPickerInputBox.value = DEFAULT_COLOR;
      draw._els.drawColorPicker.colorElement.style.backgroundColor =
        DEFAULT_COLOR;

      // Text
      editor.ui.text.colorPickerInputBox.defaultValue = DEFAULT_COLOR;
      editor.ui.text._els.color = DEFAULT_COLOR;
      editor.ui.text._els.textColorpicker.color = DEFAULT_COLOR;
      editor.ui.text._els.textColorpicker.colorElement.style.backgroundColor =
        DEFAULT_COLOR;

      try {
        // Updating the color of the color picker preview
        const classNames = [
          ".tui-image-editor-menu-icon",
          ".tui-image-editor-menu-draw",
          ".tui-image-editor-menu-shape .tie-color-stroke",
          ".tui-image-editor-menu-text",
        ];

        classNames.forEach((className) => {
          const previewEl = document.querySelector(
            `${className} .tui-colorpicker-palette-preview`
          );
          previewEl.style.backgroundColor = DEFAULT_COLOR;
          previewEl.style.color = DEFAULT_COLOR;
          previewEl.textContent = DEFAULT_COLOR;
        });
      } catch (err) {
        console.error(err);
      }
      editor.ui.activeMenuEvent();
    }
  }, [image, instanceRef.current, containerRef.current]);
  return (
    <div ref={containerRef} style={{ height: "calc(100vh - 80px)" }}>
      <div id="tui-image-editor"></div>;
    </div>
  );
};

export default ImageEditor;
