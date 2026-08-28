const LEGACY_FIELDS = [
  "wikimediaToken", "wikimediaRefreshToken", "wikimediaTokenExpiresAt", "wikimediaProfile",
  "nccommonsId", "nccommonsToken", "nccommonsRefreshToken", "nccommonsTokenExpiresAt", "nccommonsProfile",
  "mdwikiId", "mdwikiToken", "mdwikiRefreshToken", "mdwikiTokenExpiresAt", "mdwikiProfile",
  "authenticated",
];

const isMigrated = (user) =>
  user.accounts && typeof user.accounts === "object" && "wikimedia" in user.accounts;

const toTime = (d) => (d instanceof Date ? d.getTime() : new Date(d || 0).getTime() || 0);

export const planUserMigration = (users) => {
  const deleteIds = [];
  const updates = [];
  const repoints = [];

  const byWikimediaId = new Map();
  for (const user of users) {
    const id = String(user._id);
    if (!user.wikimediaId) {
      deleteIds.push(id);
      continue;
    }
    const group = byWikimediaId.get(user.wikimediaId) || [];
    group.push(user);
    byWikimediaId.set(user.wikimediaId, group);
  }

  for (const group of byWikimediaId.values()) {
    group.sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt));
    const [survivor, ...losers] = group;
    for (const loser of losers) {
      repoints.push({ from: String(loser._id), to: String(survivor._id) });
      deleteIds.push(String(loser._id));
    }
    if (isMigrated(survivor)) continue;

    const profile = survivor.wikimediaProfile || {};
    const unset = {};
    for (const field of LEGACY_FIELDS) unset[field] = 1;
    updates.push({
      _id: String(survivor._id),
      set: {
        username: profile.username || profile.name || survivor.username || "",
        "accounts.wikimedia": {
          accessToken: survivor.wikimediaToken || "",
          refreshToken: survivor.wikimediaRefreshToken || "",
          expiresAt: Number(survivor.wikimediaTokenExpiresAt) || 0,
          profile,
        },
        "accounts.nccommons": null,
        "accounts.mdwiki": null,
      },
      unset,
    });
  }

  return { deleteIds, updates, repoints };
};
