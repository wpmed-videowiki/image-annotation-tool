function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

const generateTemplateRegex = (text) =>
  new RegExp(
    `\\{\\{Image Annotation[^file]*file.*=\\s*(File:)?${escapeRegExp(
      text
    )}[^\\}]*\\}\\}`,
    "ig"
  );

export const replaceTemplateWithFile = (
  pageText,
  originalFileName,
  targetFileName
) => {
  const replacement = `[[${targetFileName}|100px|left]]`;

  const regex = generateTemplateRegex(originalFileName.replace("File:", ""));
  const spaceRegex = generateTemplateRegex(
    originalFileName.replace("File:", "").replace(/\_/g, " ")
  );

  return pageText.replace(regex, replacement).replace(spaceRegex, replacement);
};
