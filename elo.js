import fs from 'fs';
import path from 'path';
import { parse } from 'jsonc-parser';
import Ajv from 'ajv';

// Load ELO config
const config = parse(fs.readFileSync('elo-config.jsonc', 'utf-8'));
const ajv = new Ajv();

// JSON schema for participant validation (added teamId & summonerName for True ELO)
const participantSchema = {
  type: 'object',
  properties: {
    kills: { type: 'number' },
    deaths: { type: 'number' },
    assists: { type: 'number' },
    totalMinionsKilled: { type: 'number' },
    neutralMinionsKilled: { type: 'number' },
    timePlayed: { type: 'number' },
    win: { type: 'boolean' },
    teamId: { type: 'number' },         // Needed for team grouping
    summonerName: { type: 'string' }    // Needed for player ID
  },
  required: ['kills', 'deaths', 'assists', 'timePlayed', 'win', 'teamId', 'summonerName'],
};
const validateParticipant = ajv.compile(participantSchema);

function getParticipantFiles(gameId) {
  const dir = `game_${gameId}`;
  if (!fs.existsSync(dir)) throw new Error('Game folder not found');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
}

// Load saved player stats to get current ELO or return baseElo
function loadPlayerElo(name) {
  const playerDir = path.join(process.cwd(), 'player');
  const filePath = path.join(playerDir, `${name}.json`);
  if (!fs.existsSync(filePath)) return config.baseElo;
  try {
    const stats = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return stats.elo ?? config.baseElo;
  } catch {
    return config.baseElo;
  }
}

// Save updated player stats including new ELO and aggregated stats
function saveUserStats(gameId, participants) {
  const playerDir = path.join(process.cwd(), 'player');
  if (!fs.existsSync(playerDir)) fs.mkdirSync(playerDir);

  for (const participant of participants) {
    // Use first non-empty name field to get filename
    const name = (participant.riotIdGameName && participant.riotIdGameName.trim()) ||
                 (participant.summonerName && participant.summonerName.trim()) ||
                 (participant.riotIdTagline && participant.riotIdTagline.trim()) ||
                 'unknown';

    const filePath = path.join(playerDir, `${name}.json`);
    let stats = {
      totalKills: 0,
      totalAssists: 0,
      totalDeaths: 0,
      totalGold: 0,
      totalWins: 0,
      totalLosses: 0,
      games: 0,
      elo: config.baseElo
    };

    if (fs.existsSync(filePath)) {
      try {
        stats = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
    }

    const oldElo = stats.elo ?? config.baseElo;
    const newElo = participant.elo ?? oldElo;

    stats.totalKills += participant.kills ?? 0;
    stats.totalAssists += participant.assists ?? 0;
    stats.totalDeaths += participant.deaths ?? 0;
    stats.totalGold += participant.goldEarned ?? 0;
    stats.totalWins += participant.win ? 1 : 0;
    stats.totalLosses += participant.win ? 0 : 1;
    stats.games += 1;
    stats.elo = newElo;
    stats.avgKills = stats.totalKills / stats.games;
    stats.avgAssists = stats.totalAssists / stats.games;
    stats.avgDeaths = stats.totalDeaths / stats.games;
    stats.winLoss = `${stats.totalWins}:${stats.totalLosses}`;

    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));

    // Log ELO change with color in console
    const diff = newElo - oldElo;
    const colorStart = diff > 0 ? '\x1b[32m' : diff < 0 ? '\x1b[31m' : '\x1b[37m';
    const colorEnd = '\x1b[0m';
    const sign = diff > 0 ? '+' : '';
    console.log(`${name} ELO changed: ${oldElo} -> ${newElo} (${colorStart}${sign}${diff}${colorEnd})`);

    // Append to log file
    fs.appendFileSync('elo-log.txt', `${Date.now()},${name},${oldElo},${newElo}\n`);
  }
}


// True ELO calculation based on teams and match result
function calculateTrueElo(participants) {
  // Load current ELO for each participant
  participants.forEach(p => {
    p.elo = loadPlayerElo(p.summonerName);
  });

  // Group participants by teamId (assumed 2 teams)
  const teams = {};
  participants.forEach(p => {
    if (!teams[p.teamId]) teams[p.teamId] = [];
    teams[p.teamId].push(p);
  });

  const teamIds = Object.keys(teams);
  if (teamIds.length !== 2) {
    throw new Error(`Expected exactly 2 teams, found ${teamIds.length}`);
  }

  const team1 = teams[teamIds[0]];
  const team2 = teams[teamIds[1]];

  const avgEloTeam1 = team1.reduce((sum, p) => sum + p.elo, 0) / team1.length;
  const avgEloTeam2 = team2.reduce((sum, p) => sum + p.elo, 0) / team2.length;

  const expected1 = 1 / (1 + Math.pow(10, (avgEloTeam2 - avgEloTeam1) / 400));
  const expected2 = 1 - expected1;

  // Assume all participants on same team share the same 'win' boolean
  const actual1 = team1[0].win ? 1 : 0;
  const actual2 = 1 - actual1;

  const k = config.kFactor || 64;

  // Update each player's ELO
  team1.forEach(p => {
    p.elo = Math.max(0, Math.round(p.elo + k * (actual1 - expected1)));
  });

  team2.forEach(p => {
    p.elo = Math.max(0, Math.round(p.elo + k * (actual2 - expected2)));
  });

  return participants;
}

function runGame(gameId) {
  const files = getParticipantFiles(gameId);
  const participants = files.map(file => {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!validateParticipant(data)) throw new Error(`Invalid participant data in ${file}`);
    return data;
  });

  // Calculate new ELO ratings using True ELO system
  const updatedParticipants = calculateTrueElo(participants);

  // Save updated stats including new ELOs
  saveUserStats(gameId, updatedParticipants);
}

function runAllGames() {
  const cwd = process.cwd();
  const dirs = fs.readdirSync(cwd).filter(f => /^game_\d+$/.test(f));
  for (const dir of dirs) {
    const gameId = dir.replace('game_', '');
    console.log(`\n=== Processing Game ${gameId} ===`);
    try {
      runGame(gameId);
    } catch (err) {
      console.error(`Error processing game ${gameId}: ${err.message}`);
    }
  }
}

// CLI interface
const [,, mode, arg] = process.argv;
if (mode === 'all') runAllGames();
else if (mode === 'single' && arg) runGame(arg);
else console.log('Usage: node elo.js [all | single <gameId>]');
