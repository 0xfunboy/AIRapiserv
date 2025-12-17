import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

const findEnvPath = () => {
  if (process.env.DOTENV_CONFIG_PATH) {
    return process.env.DOTENV_CONFIG_PATH;
  }

  let current = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(current, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
};

export const loadEnv = () => {
  const envPath = findEnvPath();
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
};
