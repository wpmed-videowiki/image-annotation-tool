const toBlob = async (file) => {
  if (file instanceof Blob) return file;
  if (Buffer.isBuffer(file) || ArrayBuffer.isView(file)) return new Blob([file]);
  if (file && typeof file[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of file) chunks.push(chunk);
    return new Blob([Buffer.concat(chunks.map((c) => Buffer.from(c)))]);
  }
  throw new Error("Unsupported file value passed to upload");
};

export const fetchCSRFToken = async (baseUrl, token) => {
  const url = `${baseUrl}?action=query&meta=tokens&type=csrf&format=json`;
  const data = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.USER_AGENT,
    },
  });
  let jsonData = null;
  try {
    jsonData = await data.json();
  } catch {
    jsonData = null;
  }
  if (jsonData?.error) {
    throw new Error(jsonData.error.code);
  }
  const csrf = jsonData?.query?.tokens?.csrftoken;
  if (!csrf) {
    // an expired/invalid bearer token comes back as a non-query body
    // (e.g. {"httpCode":401,"httpReason":"Unauthorized"}) rather than {error}
    const detail = jsonData?.message || jsonData?.httpReason || JSON.stringify(jsonData);
    throw new Error(
      data.status === 401 || data.status === 403
        ? `mwoauth-invalid-authorization (HTTP ${data.status}: ${detail})`
        : `csrf token request failed (HTTP ${data.status}: ${detail})`
    );
  }
  return csrf;
};

export const updateArticleText = async (baseUrl, token, { title, text }) => {
  const csrfToken = await fetchCSRFToken(baseUrl, token);

  const formData = new FormData();
  formData.append('title', title);
  formData.append('text', text);
  formData.append('token', csrfToken);
  formData.append('contentformat', 'text/x-wiki');

  const response = await fetch(
    `${baseUrl}?action=edit&ignorewarnings=true&format=json`,
    {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": process.env.USER_AGENT,
      },
    }
  );

  const data = await response.json();

  if (data.error) {
    const err = new Error(data.error.code || "edit failed");
    err.info = data.error.info || "";
    throw err;
  }
  if (data.edit && data.edit.result.toLowerCase() === "success") {
    return data.edit;
  }
  throw new Error("Failed to update article");
};

export const uploadFileToCommons = async (
  baseUrl,
  token,
  { filename, text, file, comment }
) => {
  const csrfToken = await fetchCSRFToken(baseUrl, token);

  const formData = new FormData();
  formData.append('filename', filename);
  formData.append('text', text);
  formData.append('token', csrfToken);
  formData.append('file', await toBlob(file), filename);
  formData.append('comment', comment || '');

  const response = await fetch(
    `${baseUrl}?action=upload&ignorewarnings=true&format=json`,
    {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": process.env.USER_AGENT,
      },
    }
  );

  const responseData = await response.json();

  // enrich and throw; callers own the logging (single-log rule)
  if (responseData.error) {
    const err = new Error(responseData.error.code || "upload failed");
    err.info = responseData.error.info || "";
    throw err;
  }

  await updateArticleText(baseUrl, token, {
    title: filename,
    text,
  });

  if (
    responseData.upload &&
    responseData.upload.result.toLowerCase() === "success"
  ) {
    return responseData.upload;
  }
  return responseData;
};
