import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import { uploadFileToCommons } from "../utils/uploadUtils";
import UserModel from "../../models/User";

const COMMONS_BASE_URL = "https://commons.wikimedia.org/w/api.php";
const NCCOMMONS_BASE_URL = "https://nccommons.org/w/api.php";

const generateRandomId = () => Math.random().toString(36).substring(7);

const addSilentToFile = (filePath, encodedFilePath) => {
  return new Promise((resolve, reject) => {
    // reencode the file using ffmpeg to webm and add silent audio
    const cmd = `ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -i ${filePath} -crf 23  -c:v libvpx-vp9 -pix_fmt yuv420p -c:a libvorbis -shortest ${encodedFilePath}`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve();
    });
  });
};

export const POST = async (req, res) => {
  const appUserId = req.cookies.get("app-user-id")?.value;

  const user = await UserModel.findById(appUserId);

  const data = await req.formData();
  const filename = data.get("filename");
  const text = data.get("text");
  const file = data.get("file");
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

  const response = await uploadFileToCommons(baseUrl, token, {
    filename,
    text,
    file: fileStream,
  });

  await fs.promises.unlink(fileLocation);
  return NextResponse.json(response);
};
