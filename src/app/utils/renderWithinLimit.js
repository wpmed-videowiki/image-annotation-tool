// The canvas export can be far larger than the source image (2x multiplier,
// full quality), and the publish server action rejects bodies over the
// configured limit with a bare 413. Try each multiplier from best to worst and
// keep the first render that fits; null means even the smallest render is too
// big and the upload must not be attempted.
export const renderWithinLimit = async (
  render,
  { maxBytes, multipliers = [2, 1] }
) => {
  for (const multiplier of multipliers) {
    const blob = await render(multiplier);
    if (blob.size <= maxBytes) return blob;
  }
  return null;
};
