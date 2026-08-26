// The canvas export can be far larger than the source image (2x multiplier,
// full quality), and the browser refuses to export at all past its canvas
// dimension limits. Try each multiplier from best to worst and keep the first
// render that exists and fits; null means even the smallest render failed or
// is too big and the upload must not be attempted.
export const renderWithinLimit = async (
  render,
  { maxBytes, multipliers = [2, 1] }
) => {
  for (const multiplier of multipliers) {
    const blob = await render(multiplier);
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
};
