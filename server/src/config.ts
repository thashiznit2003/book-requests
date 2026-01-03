import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const baseDir = process.env.INIT_CWD || process.cwd();
const cwdEnv = path.resolve(baseDir, ".env");
const rootEnv = path.resolve(baseDir, "..", ".env");
const envPath = fs.existsSync(cwdEnv)
  ? cwdEnv
  : fs.existsSync(rootEnv)
  ? rootEnv
  : undefined;

dotenv.config({ path: envPath });

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 3000),
  auth: process.env.AUTH?.trim() || ""
};
