import fs from 'fs';
import path from 'path';
import { parse } from 'jsonc-parser';

// Load ELO config
const config = parse(fs.readFileSync('elo-config.jsonc', 'utf-8'));

// Enable all methods for comparison
config.calculationMethods.traditional.enabled = true;
config.calculationMethods.laneComparison.enabled = true;
config.calculationMethods.hybrid.enabled = true;

// Update the config temporarily
fs.writeFileSync('elo-config-temp.jsonc', JSON.stringify(config, null, 2));

console.log('ELO Method Comparison Tool');
console.log('==========================\n');

// Run the enhanced system with all methods enabled
import('./elo-enhanced.js').then(() => {
  // Clean up temp file
  if (fs.existsSync('elo-config-temp.jsonc')) {
    fs.unlinkSync('elo-config-temp.jsonc');
  }
}).catch(err => {
  console.error('Error:', err);
  // Clean up temp file
  if (fs.existsSync('elo-config-temp.jsonc')) {
    fs.unlinkSync('elo-config-temp.jsonc');
  }
});
