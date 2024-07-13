import rawRequest from "request";
import fetch from "node-fetch";

const request = rawRequest.defaults({
  headers: {
    "User-Agent": process.env.USER_AGENT,
  },
});

export const fetchCSRFToken = async (baseUrl, token) => {
  const url = `${baseUrl}/w/api.php?action=query&meta=tokens&type=csrf&format=json`;
  const data = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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

  const data = await new Promise((resolve, reject) =>
    request(
      `${baseUrl}?action=edit&ignorewarnings=true&format=json`,
      {
        method: "POST",
        formData: {
          title,
          text,
          token: csrfToken,
          contentformat: "text/x-wiki",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (err, res, body) => {
        if (err) {
          return reject(err);
        }
        console.log(body);
        resolve(JSON.parse(body));
      }
    )
  );

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
  { filename, text, file }
) => {
  try {
    const csrfToken = await fetchCSRFToken(baseUrl, token);

    const responseData = await new Promise((resolve, reject) =>
      request(
        `${baseUrl}?action=upload&ignorewarnings=true&format=json`,
        {
          method: "POST",
          formData: {
            filename: filename,
            text: text,
            token: csrfToken,
            file,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        (err, res, body) => {
          if (err) {
            return reject(err);
          }
          resolve(JSON.parse(body));
        }
      )
    );

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

    return response;
  } catch (err) {
    console.log(err);
  }
};
