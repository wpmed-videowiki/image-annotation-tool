import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { whiteTheme } from "./white-theme";
import ImageEditorComp from "tui-image-editor";
import initBlurTool from "./blurTool";
import "./blurTool.css";
import initRemoveBackgroundButton from "./removeBackgroundButton";
import "./removeBackgroundButton.css";
import "./transparencyCheckerboard.css";
import RemoveBackgroundDialog from "./RemoveBackgroundDialog";
import {
  REMOVE_BACKGROUND_COMMAND,
  RESTORE_BACKGROUND_COMMAND,
} from "./backgroundCommands";

// default color red
const DEFAULT_COLOR = "#ff4040";

const ImageEditor = ({
  image,
  instanceRef,
  aspectRatio,
  id,
  height = "calc(100vh - 80px)",
  // true while a removed background is applied; the wizard then prefers PNG
  onTransparencyChange = () => {},
}) => {
  const containerRef = useRef(null);
  const containerWidth = useRef(null);
  // per-mount guard; instanceRef is shared with the SVG/video editors and never cleared
  const editorRef = useRef(null);
  const t = useTranslations("RemoveBackground");
  const [removeBackgroundOpen, setRemoveBackgroundOpen] = useState(false);

  useEffect(() => {
    if (editorRef.current || !image || !containerRef.current) return undefined;
    containerWidth.current = containerRef.current.getBoundingClientRect().width;
    const instance = new ImageEditorComp(document.querySelector(`#${id}`), {
      usageStatistics: false,
      includeUI: {
        loadImage: {
          path: image,
          name: "SampleImage",
        },
        // History panel labels for the background commands
        locale: {
          [REMOVE_BACKGROUND_COMMAND]: t("history_remove"),
          [RESTORE_BACKGROUND_COMMAND]: t("history_restore"),
        },
        menuBarPosition: "bottom",
        menu: [
          "icon",
          "resize",
          "crop",
          "flip",
          "rotate",
          "draw",
          "shape",
          "text",
          "mask",
          "filter",
        ],
        // theme: theme.current === "black" ? blackTheme : whiteTheme,
        theme: whiteTheme,
      },
    });
    editorRef.current = instance;
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
    initBlurTool(editor);

    const removeBackground = initRemoveBackgroundButton(editor, {
      label: t("button"),
      onClick: () => setRemoveBackgroundOpen(true),
    });
    // grey the button out when this server has no model installed
    fetch("/api/image/remove-background")
      .then((res) => res.json())
      .then((status) => {
        if (status && status.available === false) {
          removeBackground.setDisabled(true, t("unavailable"));
        }
      })
      .catch(() => {});

    return () => {
      editorRef.current = null;
      if (instanceRef.current === instance) instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, id]);

  return (
    <>
      <div ref={containerRef} style={{ height }}>
        <div id={id}></div>
      </div>
      <RemoveBackgroundDialog
        open={removeBackgroundOpen}
        editorRef={instanceRef}
        onClose={() => setRemoveBackgroundOpen(false)}
        onTransparencyChange={onTransparencyChange}
      />
    </>
  );
};

export default ImageEditor;
