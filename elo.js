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
    stats.avgGold = stats.totalGold / stats.games;
    stats.winLoss = `${stats.totalWins}:${stats.totalLosses}`;

    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));

    // Log ELO change with color in console
    const diff = newElo - oldElo;
    const colorStart = diff > 0 ? '\x1b[32m' : diff < 0 ? '\x1b[31m' : '\x1b[37m'; // green for +, red for -
    const colorEnd = '\x1b[0m';
    const sign = diff > 0 ? '+' : '';
    console.log(`${name} ELO changed: ${oldElo} -> ${newElo} (${colorStart}${sign}${diff}${colorEnd})`);

    // Append to log file with formatted date
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const formatted = `${now.getFullYear().toString().slice(2)}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${hours}-${String(now.getMinutes()).padStart(2,'0')}-${ampm}`;
    fs.appendFileSync('elo-log.txt', `${formatted},${name},${oldElo},${newElo}\n`);
  }
}

// Utility: Get participant role
function getRole(participant) {
  // Use teamPosition if available, fallback to 'UNKNOWN'
  return (participant.teamPosition && participant.teamPosition.toUpperCase()) || 'UNKNOWN';
}

// Calculate extra ELO for new metrics
function calculateExtraElo(participant, config) {
  const role = getRole(participant);
  let bonus = 0;

  // Normalize by game length (minutes)
  const timeMinutes = (participant.timePlayed || 1) / 60;

  // Damage taken/mitigated (normalized)
  const damageTaken = participant.totalDamageTaken || 0;
  const damageMitigated = participant.damageSelfMitigated || 0;
  if (config.damageTakenMitigatedDivider) {
    bonus += ((damageTaken + damageMitigated) / timeMinutes) / config.damageTakenMitigatedDivider;
  }

  // Role-specific
  if (role === 'UTILITY' || role === 'SUPPORT') {
    // Vision (normalized)
    if (config.support && config.support.visionScoreMultiplier && participant.visionScore) {
      bonus += (participant.visionScore / timeMinutes) * config.support.visionScoreMultiplier;
    }
    // Assists (normalized)
    if (config.support && config.support.assistMultiplier && participant.assists) {
      bonus += (participant.assists / timeMinutes) * config.support.assistMultiplier;
    }
    // Healing/shielding (normalized)
    const healShield = (participant.challenges && participant.challenges.effectiveHealAndShielding) || participant.effectiveHealAndShielding || 0;
    if (healShield && config.support && config.support.healShieldDivider) {
      bonus += (healShield / timeMinutes) / config.support.healShieldDivider;
    }
  } else if (role === 'JUNGLE' || role === 'JUNGLER') {
    // Jungle CS before 10 min (already normalized by definition)
    const jungleCS10 = (participant.challenges && participant.challenges.jungleCsBefore10Minutes) || participant.jungleCsBefore10Minutes || 0;
    if (jungleCS10 && config.jungler && config.jungler.jungleCsBefore10MinMultiplier) {
      bonus += jungleCS10 * config.jungler.jungleCsBefore10MinMultiplier;
    }
    // Neutral minions (normalized)
    if (config.jungler && config.jungler.neutralMinionsKilledMultiplier && participant.neutralMinionsKilled) {
      bonus += (participant.neutralMinionsKilled / timeMinutes) * config.jungler.neutralMinionsKilledMultiplier;
    }
    // Epic monster takedowns (normalized)
    const epicTakedowns = (participant.challenges && participant.challenges.junglerTakedownsNearDamagedEpicMonster) || participant.junglerTakedownsNearDamagedEpicMonster || 0;
    if (epicTakedowns && config.jungler && config.jungler.epicMonsterTakedownMultiplier) {
      bonus += (epicTakedowns / timeMinutes) * config.jungler.epicMonsterTakedownMultiplier;
    }
  } else if (role === 'BOTTOM' || role === 'CARRY' || role === 'DUO_CARRY') {
    // CS/min (already normalized)
    if (config.carry && config.carry.csPerMinMultiplier && participant.totalMinionsKilled && timeMinutes > 0) {
      bonus += (participant.totalMinionsKilled / timeMinutes) * config.carry.csPerMinMultiplier;
    }
    // Damage dealt (normalized)
    if (config.carry && config.carry.damageDealtDivider && participant.totalDamageDealtToChampions) {
      bonus += (participant.totalDamageDealtToChampions / timeMinutes) / config.carry.damageDealtDivider;
    }
  }

  // Kill participation (normalized)
  const kp = (participant.challenges && participant.challenges.killParticipation) || participant.killParticipation || 0;
  if (kp && config.killParticipationMultiplier) {
    bonus += kp * 100 * config.killParticipationMultiplier; // already a percent, not normalized by time
  }

  // Gold efficiency bonus (normalized)
  if (config.goldEfficiencyMultiplier && participant.goldEarned && participant.goldSpent) {
    const efficiency = participant.goldSpent / participant.goldEarned;
    if (efficiency > 0 && efficiency <= 1.05) {
      bonus += (efficiency / timeMinutes) * config.goldEfficiencyMultiplier;
    }
  }

  // Loss penalty
  if (config.lossPenalty && participant.win === false) {
    bonus -= config.lossPenalty;
  }

  return bonus;
}

// True ELO calculation based on teams and match result, with extra metrics
function calculateTrueElo(participants) {
  // Only run if hybrid method is enabled (safe check)
  if (!config.calculationMethods || !config.calculationMethods.hybrid || !config.calculationMethods.hybrid.enabled) {
    throw new Error('Hybrid calculation method must be enabled in config.');
  }

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

  // Update each player's ELO, add extra metrics
  team1.forEach(p => {
    let baseElo = Math.max(0, Math.round(p.elo + k * (actual1 - expected1)));
    p.elo = Math.max(0, Math.round(baseElo + calculateExtraElo(p, config)));
  });

  team2.forEach(p => {
    let baseElo = Math.max(0, Math.round(p.elo + k * (actual2 - expected2)));
    p.elo = Math.max(0, Math.round(baseElo + calculateExtraElo(p, config)));
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
