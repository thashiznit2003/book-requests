import fs from "fs";
import path from "path";
import { logger } from "./logger.js";

export type InstanceSettings = {
  baseUrl: string;
  apiKey: string;
  rootFolderPath: string;
  qualityProfileId: number;
};

export type Settings = {
  ebooks: InstanceSettings;
  audio: InstanceSettings;
};

export type SettingsState = {
  configured: boolean;
  settings?: Settings;
};

export class SettingsError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.status = 400;
  }
}

const baseDir = process.env.INIT_CWD || process.cwd();
const settingsPath = path.resolve(baseDir, "data", "settings.json");
let cached: Settings | null = null;

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readOptional = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const buildFromEnv = (): Settings | null => {
  const ebooksUrl = readOptional(process.env.READARR_EBOOKS_URL);
  const ebooksKey = readOptional(process.env.READARR_EBOOKS_APIKEY);
  const audioUrl = readOptional(process.env.READARR_AUDIO_URL);
  const audioKey = readOptional(process.env.READARR_AUDIO_APIKEY);

  if (!ebooksUrl || !ebooksKey || !audioUrl || !audioKey) {
    return null;
  }

  return {
    ebooks: {
      baseUrl: normalizeBaseUrl(ebooksUrl),
      apiKey: ebooksKey,
      rootFolderPath: readOptional(process.env.EBOOKS_ROOT_FOLDER) || "/books",
      qualityProfileId: toNumber(process.env.EBOOKS_QUALITY_PROFILE_ID, 1)
    },
    audio: {
      baseUrl: normalizeBaseUrl(audioUrl),
      apiKey: audioKey,
      rootFolderPath: readOptional(process.env.AUDIO_ROOT_FOLDER) || "/books",
      qualityProfileId: toNumber(process.env.AUDIO_QUALITY_PROFILE_ID, 1)
    }
  };
};

const loadFromFile = (): Settings | null => {
  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as Settings;
    return parsed;
  } catch (error) {
    logger.error({ err: error }, "settings_load_failed");
    return null;
  }
};

const validateInstance = (instance: InstanceSettings, label: string): void => {
  if (!instance.baseUrl?.trim()) {
    throw new SettingsError(`${label} base URL is required.`);
  }
  if (!instance.apiKey?.trim()) {
    throw new SettingsError(`${label} API key is required.`);
  }
  if (!instance.rootFolderPath?.trim()) {
    throw new SettingsError(`${label} root folder path is required.`);
  }
  if (!Number.isFinite(instance.qualityProfileId) || instance.qualityProfileId <= 0) {
    throw new SettingsError(`${label} quality profile ID is required.`);
  }
};

const normalizeSettings = (settings: Settings): Settings => ({
  ebooks: {
    baseUrl: normalizeBaseUrl(settings.ebooks.baseUrl),
    apiKey: settings.ebooks.apiKey.trim(),
    rootFolderPath: settings.ebooks.rootFolderPath.trim(),
    qualityProfileId: Number(settings.ebooks.qualityProfileId)
  },
  audio: {
    baseUrl: normalizeBaseUrl(settings.audio.baseUrl),
    apiKey: settings.audio.apiKey.trim(),
    rootFolderPath: settings.audio.rootFolderPath.trim(),
    qualityProfileId: Number(settings.audio.qualityProfileId)
  }
});

export const getSettings = (): SettingsState => {
  if (cached) {
    return { configured: true, settings: cached };
  }

  const fileSettings = loadFromFile();
  if (fileSettings) {
    cached = fileSettings;
    return { configured: true, settings: cached };
  }

  const envSettings = buildFromEnv();
  if (envSettings) {
    cached = envSettings;
    return { configured: true, settings: cached };
  }

  return { configured: false };
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  const normalized = normalizeSettings(settings);
  validateInstance(normalized.ebooks, "Ebooks");
  validateInstance(normalized.audio, "Audiobooks");

  await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.promises.writeFile(
    settingsPath,
    JSON.stringify(normalized, null, 2),
    "utf8"
  );
  cached = normalized;
};
