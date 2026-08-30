"use client";
import useImagePublish from "../../hooks/useImagePublish";
import UploadWizardShell from "./index";

import { IMAGE_RASTER_EXTENSION_CHOICES } from "../../config/constants";

// Wrapper owning the image publish hook. SVG sources are locked to ["svg"],
// raster picks from png/jpg/jpeg.
const ImageUploadWizard = ({
  provider,
  wikiSource,
  editorRef,
  source,
  prefill,
  extensionChoices = IMAGE_RASTER_EXTENSION_CHOICES,
  defaultExtension,
  editorSlot,
  onStartAnother,
}) => {
  const publishState = useImagePublish({ provider, wikiSource, editorRef });

  return (
    <UploadWizardShell
      provider={provider}
      wikiSource={wikiSource}
      source={source}
      prefill={prefill}
      publishState={publishState}
      editorSlot={editorSlot}
      onStartAnother={onStartAnother}
      media={{
        kind: "image",
        extensionChoices,
        defaultExtension: defaultExtension || extensionChoices[0],
      }}
    />
  );
};

export default ImageUploadWizard;
