// Loads settings before anything reads process.env, and works out where the agent's files live.
// Imported first by sync.mjs.
//
// Run with Node (development): settings from `.env` next to sync.mjs.
// Run as the packaged hk-sync.exe (the store PC): settings from `hk-sync.env` next to the exe,
// and the cache and log files are written there too.

import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGED = !/^node(\.exe)?$/i.test(basename(process.execPath));
export const BASE_DIR = PACKAGED ? dirname(process.execPath) : dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = join(BASE_DIR, PACKAGED ? 'hk-sync.env' : '.env');

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
