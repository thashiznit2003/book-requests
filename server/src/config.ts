import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const cwdEnv = path.resolve(process.cwd(), ".env");
const rootEnv = path.resolve(process.cwd(), "..", ".env");
const envPath = fs.existsSync(cwdEnv)
  ? cwdEnv
  : fs.existsSync(rootEnv)
  ? rootEnv
  : undefined;

dotenv.config({ path: envPath });

type InstanceConfig = {
  name: "ebooks" | "audio";
  baseUrl: string;
  apiKey: string;
  rootFolderPath: string;
  qualityProfileId: number;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildInstance = (
  name: InstanceConfig["name"],
  urlVar: string,
  keyVar: string,
  rootVar: string,
  qualityVar: string
): InstanceConfig => ({
  name,
  baseUrl: normalizeBaseUrl(required(urlVar)),
  apiKey: required(keyVar),
  rootFolderPath: process.env[rootVar]?.trim() || "/books",
  qualityProfileId: toNumber(process.env[qualityVar], 1)
});

export const config = {
  port: toNumber(process.env.PORT, 3000),
  auth: process.env.AUTH?.trim() || "",
  ebooks: buildInstance(
    "ebooks",
    "READARR_EBOOKS_URL",
    "READARR_EBOOKS_APIKEY",
    "EBOOKS_ROOT_FOLDER",
    "EBOOKS_QUALITY_PROFILE_ID"
  ),
  audio: buildInstance(
    "audio",
    "READARR_AUDIO_URL",
    "READARR_AUDIO_APIKEY",
    "AUDIO_ROOT_FOLDER",
    "AUDIO_QUALITY_PROFILE_ID"
  )
};
