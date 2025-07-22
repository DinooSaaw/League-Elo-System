#!/usr/bin/env node

/**
 * League ELO System - Main Entry Point
 * 
 * This is a simplified entry point that delegates to the main application.
 * You can run commands like:
 * 
 * npm start help
 * npm start elo all
 * npm start leaderboard show
 * npm start fetch riotid PlayerName TAG1
 * npm start migrate all
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mainScript = join(__dirname, 'src', 'main.js');

// Pass all arguments to the main script
const args = process.argv.slice(2);
const child = spawn('node', [mainScript, ...args], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => {
  process.exit(code);
});
