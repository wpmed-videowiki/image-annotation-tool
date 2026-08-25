"use client";
import useVideoPublish from "../../hooks/useVideoPublish";
import UploadWizardShell from "./index";

// Wrapper owning the video publish hook. Each media type gets its own wrapper
// since hooks can't be called conditionally.
const VideoUploadWizard = ({
  provider,
  wikiSource,
  editorRef,
  source,
  prefill,
  editorSlot,
}) => {
  const publishState = useVideoPublish({ provider, wikiSource, editorRef });

  return (
    <UploadWizardShell
      provider={provider}
      wikiSource={wikiSource}
      source={source}
      prefill={prefill}
      publishState={publishState}
      editorSlot={editorSlot}
      media={{ kind: "video", extensionChoices: ["webm"], defaultExtension: "webm" }}
    />
  );
};

export default VideoUploadWizard;
