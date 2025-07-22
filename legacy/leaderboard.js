import fs from 'fs';
import path from 'path';

const playerDir = path.join(process.cwd(), 'player');
if (!fs.existsSync(playerDir)) {
  console.error('No player directory found.');
  process.exit(1);
}

const files = fs.readdirSync(playerDir).filter(f => f.endsWith('.json'));
const players = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(playerDir, file), 'utf-8'));
  if ((data.games || 0) > 1) {
    players.push({
      name: file.replace('.json', ''),
      elo: data.elo || 0,
      games: data.games || 0,
      winLoss: data.winLoss || '',
    });
  }
}

players.sort((a, b) => b.elo - a.elo);

console.log('=== ELO Leaderboard ===');
players.forEach((p, i) => {
  console.log(
    `${String(i + 1).padStart(2, ' ')}. ${p.name.padEnd(20)} ELO: ${String(p.elo).padStart(4)}  Games: ${p.games}  W/L: ${p.winLoss}`
  );
});