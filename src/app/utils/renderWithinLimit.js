// Preserve the edited image's pixel dimensions by default. Callers can supply
// explicit scale fallbacks; null means no render succeeded within the upload
// limit and the upload must not be attempted.
export const renderWithinLimit = async (
  render,
  { maxBytes, multipliers = [1] }
) => {
  for (const multiplier of multipliers) {
    const blob = await render(multiplier);
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
};
