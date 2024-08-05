export const extractLicenseTag = (text) => {
  const regex = /==\s*{{int:license.*}}\s*==\s*{{([^}]+)}}/gi;
  const matches = text.match(regex);

  if (matches) {
    // Extract the license info from the matches
    const licenseInfo = matches.map((match) =>
      match
        .replace(/==\s*{{int:license.*}}\s*==\s*/, "")
        .replace(/{{|}}/g, "")
        .trim()
    );
    return licenseInfo[0];
  } else {
    console.log("No license information found.");
    return "";
  }
};

export const extractPermission = (text) => {
  const regex = /Permission[=\s*:]([^\n]*)/gi;
  const match = text.match(regex);

  if (match) {
    return match[0].replace(/Permission[=\s*:]/gi, "").trim();
  }
  return "";
};

export const extractAuthor = (text) => {
  const regex = /author[=\s*:]([^\n]*)/gi;
  const match = text.match(regex);

  if (match) {
    return match[0].replace(/author[=\s*:]/gi, "").trim();
  }
  return "";
};


export const extractCategories = text => {
  const regex = /\[\[Category:([^\]]*)\]\]/gi;
  const matches = text.match(regex);

  if (matches) {
    return matches;
  }
  return [];
}