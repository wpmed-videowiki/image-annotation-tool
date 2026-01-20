import fetch from "node-fetch";

export const fetchCSRFToken = async (baseUrl, token) => {
  const url = `${baseUrl}?action=query&meta=tokens&type=csrf&format=json`;
  const data = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.USER_AGENT,
    },
  });
  const jsonData = await data.json();
  if (jsonData.error) {
    throw new Error(jsonData.error.code);
  }
  return jsonData.query.tokens.csrftoken;
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
        ...formData.getHeaders()
      },
    }
  );

  const body = await response.text();
  console.log(body);
  const data = JSON.parse(body);

  if (data.error) {
    console.log(data.error);
    throw new Error(data.error.toString());
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
  try {
    const csrfToken = await fetchCSRFToken(baseUrl, token);

    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('text', text);
    formData.append('token', csrfToken);
    formData.append('file', file);
    formData.append('comment', comment || '');

    const response = await fetch(
      `${baseUrl}?action=upload&ignorewarnings=true&format=json`,
      {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": process.env.USER_AGENT,
          ...formData.getHeaders()
        },
      }
    );

    const responseData = await response.json();

    if (responseData.error) {
      console.log("============ ERROR ============");
      console.log(responseData.error);
      throw new Error(responseData.error.code);
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
    return responseData; // Fixed: was 'response' which is undefined
  } catch (err) {
    console.log(err);
    throw err; // Re-throw for proper error handling
  }
};
