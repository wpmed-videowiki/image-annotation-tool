import { useEffect, useRef } from "react";
import ImageEditorComp from "tui-image-editor";

const ImageEditor = ({ image, instanceRef }) => {
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
          },
          cssMaxWidth: containerWidth.current,
          cssMaxHeight: containerWidth.current,
          cssHeight: containerWidth,
        }
      );
      instanceRef.current = instance;
    }
  }, [image, instanceRef.current, containerRef.current]);
  return (
    <div
      ref={containerRef}
      style={{ height: (containerWidth.current * 3) / 5 }}
    >
      <div id="tui-image-editor"></div>;
    </div>
  );
};

export default ImageEditor;
