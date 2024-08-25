import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import { uploadFileToCommons } from "../utils/uploadUtils";
import UserModel from "../../models/User";
import ImageUploadModel from "../../models/ImageUpload";

const COMMONS_BASE_URL = "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL = "https://nccommons.org/w/api.php";

const generateRandomId = () => Math.random().toString(36).substring(7);

export const POST = async (req, res) => {
  const appUserId = req.cookies.get("app-user-id")?.value;

  const user = await UserModel.findById(appUserId);

  const data = await req.formData();
  const filename = data.get("filename");
  const text = data.get("text");
  const file = data.get("file");
  const comment = data.get("comment");
  const provider = data.get("provider");
  const fileId = generateRandomId();
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const fileLocation = `./${fileId}.${filename.split(".").pop()}`;
  console.log({ fileLocation, filename, text, provider });
  console.log({ fileBuffer });
  await fs.promises.writeFile(fileLocation, fileBuffer);

  const baseUrl =
    provider === "nccommons" ? NCCOMMONS_BASE_URL : COMMONS_BASE_URL;
  const token =
    provider === "nccommons" ? user.nccommonsToken : user.wikimediaToken;

  const fileStream = fs.createReadStream(fileLocation);

  // return NextResponse.json({ filename, text, comment, provider });
  const response = await uploadFileToCommons(baseUrl, token, {
    filename,
    text,
    comment,
    file: fileStream,
  });
  if (response?.imageinfo?.descriptionurl) {
    try {
      const existingUpload = await ImageUploadModel.findOne({
        url: response.imageinfo.descriptionurl,
      });

      if (!existingUpload) {
        await ImageUploadModel.create({
          url: response.imageinfo.descriptionurl,
          fileName: filename,
          provider: provider === "nccommons" ? "nccommons" : "commons",
          uploadedBy: user._id,
        });
      }
    } catch (err) {
      console.log("Error saving uplaod to db", err);
    }
  }

  await fs.promises.unlink(fileLocation);
  return NextResponse.json(response);
};
