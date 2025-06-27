import fs from 'fs';
import path from 'path';
import { parse } from 'jsonc-parser';
import Ajv from 'ajv';

// Load ELO config
const config = parse(fs.readFileSync('elo-config.jsonc', 'utf-8'));
const ajv = new Ajv();

// JSON schema for participant validation
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
    teamId: { type: 'number' },
    summonerName: { type: 'string' },
    riotIdGameName: { type: 'string' },
    riotIdTagline: { type: 'string' }
  },
  required: ['kills', 'deaths', 'assists', 'timePlayed', 'win', 'teamId'],
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

// Get player name from participant data
function getPlayerName(participant) {
  return (participant.riotIdGameName && participant.riotIdGameName.trim()) ||
         (participant.summonerName && participant.summonerName.trim()) ||
         (participant.riotIdTagline && participant.riotIdTagline.trim()) ||
         'unknown';
}

// Get participant role/position
function getRole(participant) {
  return (participant.individualPosition || participant.teamPosition || 'UNKNOWN').toUpperCase();
}

// Calculate normalized performance stats
function calculatePerformanceStats(participant, gameLengthSeconds) {
  const timeMinutes = Math.max(1, (participant.timePlayed || 1) / 60);
  const wardsPlaced = participant.wardsPlaced || participant.visionWardsBoughtInGame || 0;
  const wardsCleared = participant.wardsKilled || 0;
  const turretDamage = participant.damageDealtToTurrets || participant.challenges?.damageDealtToTurrets || 0;
  const killParticipation = participant.challenges?.killParticipation || 0;

  return {
    kda: participant.deaths > 0 ? (participant.kills + participant.assists) / participant.deaths : (participant.kills + participant.assists) || 1,
    kdaRaw: participant.kills + participant.assists - participant.deaths,
    killParticipation,
    damagePerMinute: (participant.totalDamageDealtToChampions || 0) / timeMinutes,
    visionScorePerMinute: (participant.visionScore || 0) / timeMinutes,
    csPerMinute: (participant.totalMinionsKilled || 0) / timeMinutes,
    goldPerMinute: (participant.goldEarned || 0) / timeMinutes,
    wardsPlaced,
    wardsCleared,
    turretDamage,
    objectiveParticipation: calculateObjectiveParticipation(participant),
    survivalRate: timeMinutes / Math.max(1, participant.deaths),
    utilityScore: calculateUtilityScore(participant),
    earlyGamePerformance: calculateEarlyGamePerformance(participant),
    lateGamePerformance: calculateLateGamePerformance(participant),
    teamFightParticipation: calculateTeamFightParticipation(participant),
    soloKills: participant.challenges?.soloKills || 0,
    comebackFactor: calculateComebackFactor(participant)
  };
}

// Add missing helper function
function calculateObjectiveParticipation(participant) {
  const dragonKills = participant.dragonKills || 0;
  const baronKills = participant.baronKills || 0;
  const turretKills = participant.turretKills || 0;
  const inhibitorKills = participant.inhibitorKills || 0;
  return dragonKills * 3 + baronKills * 5 + turretKills * 2 + inhibitorKills * 4;
}

// Add missing helper function
function calculateUtilityScore(participant) {
  const healsAndShields = participant.challenges?.effectiveHealAndShielding || 0;
  const ccScore = participant.challenges?.enemyChampionImmobilizations || 0;
  const visionScore = participant.visionScore || 0;
  return healsAndShields / 100 + ccScore * 2 + visionScore;
}

// Add missing helper function
function calculateEarlyGamePerformance(participant) {
  const earlyKills = participant.challenges?.killsNearEnemyTurret || 0;
  const earlyFarm = participant.challenges?.laneMinionsFirst10Minutes || 0;
  const firstBlood = (participant.firstBloodKill ? 10 : 0) + (participant.firstBloodAssist ? 5 : 0);
  return earlyKills * 3 + earlyFarm / 10 + firstBlood;
}

// Add missing helper function
function calculateLateGamePerformance(participant) {
  const lateKills = participant.challenges?.killsAfterHiddenWithAlly || 0;
  const teamFights = participant.challenges?.teamDamagePercentage || 0;
  return lateKills * 2 + teamFights * 50;
}

// Add missing helper function
function calculateTeamFightParticipation(participant) {
  const multikills = (participant.doubleKills || 0) * 2 + 
                     (participant.tripleKills || 0) * 4 + 
                     (participant.quadraKills || 0) * 8 + 
                     (participant.pentaKills || 0) * 16;
  const teamFightKills = participant.challenges?.killsInAllLanes || 0;
  return multikills + teamFightKills;
}

// Add missing helper function
function calculateComebackFactor(participant) {
  const goldDeficit = participant.challenges?.maxGoldDeficit || 0;
  const comeback = goldDeficit > 1000 ? Math.log(goldDeficit / 1000) : 0;
  return comeback;
}

// Helper to get dynamic weights based on game length
function getDynamicWeights(gameLengthSeconds) {
  // Early: <22min, Normal: 22-32min, Late: >32min
  const min = gameLengthSeconds / 60;
  let earlyWeight = 1, lateWeight = 1;
  if (min < 22) {
    earlyWeight = 1.5; lateWeight = 0.7;
  } else if (min > 32) {
    earlyWeight = 0.7; lateWeight = 1.5;
  }
  return { earlyWeight, lateWeight };
}

// Calculate lane-based performance comparison
function calculateLaneComparison(participants) {
  const laneGroups = {};
  
  // Group players by lane
  participants.forEach(p => {
    const lane = getRole(p);
    if (!laneGroups[lane]) laneGroups[lane] = [];
    laneGroups[lane].push(p);
  });
  
  // Calculate relative performance within each lane
  Object.keys(laneGroups).forEach(lane => {
    const players = laneGroups[lane];
    if (players.length < 2) return; // Need at least 2 players to compare
    
    const stats = players.map(p => calculatePerformanceStats(p));
    const priorities = config.laneStatPriorities[lane] || config.laneStatPriorities.MIDDLE;
    
    // Calculate weighted performance scores
    players.forEach((player, idx) => {
      const playerStats = stats[idx];
      let score = 0;
      
      // Calculate weighted score based on lane priorities
      Object.keys(priorities).forEach(statKey => {
        const weight = priorities[statKey];
        let statValue = 0;
        
        switch(statKey) {
          case 'damage':
            statValue = playerStats.damagePerMinute / 500; // Normalize to ~1
            break;
          case 'farm':
            statValue = playerStats.csPerMinute / 8; // Normalize to ~1
            break;
          case 'kda':
            statValue = Math.min(playerStats.kda / 3, 2); // Cap at 2
            break;
          case 'vision':
            statValue = playerStats.visionScorePerMinute / 2; // Normalize to ~1
            break;
          case 'objectives':
            statValue = playerStats.objectiveParticipation / 10; // Normalize to ~1
            break;
          case 'survival':
            statValue = Math.min(playerStats.survivalRate / 10, 2); // Cap at 2
            break;
          case 'utility':
            statValue = playerStats.utilityScore / 50; // Normalize to ~1
            break;
        }
        
        score += statValue * weight;
      });
      
      player.lanePerformanceScore = score;
    });
    
    // Rank players within the lane
    players.sort((a, b) => b.lanePerformanceScore - a.lanePerformanceScore);
    players.forEach((player, idx) => {
      player.laneRank = idx + 1;
      player.laneRankPercentile = (players.length - idx) / players.length;
    });
  });
}

// Method 1: Traditional ELO with performance modifiers
function calculateTraditionalElo(participants) {
  const method = config.calculationMethods && config.calculationMethods.traditional;
  if (!method || !method.enabled) return participants;

  // Ensure currentElo is set for all participants
  participants.forEach(p => {
    if (typeof p.currentElo !== 'number' || isNaN(p.currentElo)) {
      p.currentElo = loadPlayerElo(getPlayerName(p));
    }
  });

  // Calculate average game length and dynamic weights
  const avgGameLength = participants.reduce((sum, p) => sum + (p.timePlayed || 0), 0) / participants.length;
  const { earlyWeight, lateWeight } = getDynamicWeights(avgGameLength);

  // Group by teams
  const teams = {};
  participants.forEach(p => {
    if (!teams[p.teamId]) teams[p.teamId] = [];
    teams[p.teamId].push(p);
  });
  const teamIds = Object.keys(teams);
  if (teamIds.length < 2) return participants; // Not enough teams
  const team1 = teams[teamIds[0]];
  const team2 = teams[teamIds[1]];
  if (!team1.length || !team2.length) return participants; // Defensive: skip if any team is empty
  // Calculate expected results
  const avgEloTeam1 = team1.reduce((sum, p) => sum + (p.currentElo || 0), 0) / team1.length;
  const avgEloTeam2 = team2.reduce((sum, p) => sum + (p.currentElo || 0), 0) / team2.length;
  if (!isFinite(avgEloTeam1) || !isFinite(avgEloTeam2)) return participants;
  const expected1 = 1 / (1 + Math.pow(10, (avgEloTeam2 - avgEloTeam1) / 400));
  const expected2 = 1 - expected1;
  const actual1 = team1[0].win ? 1 : 0;
  const actual2 = 1 - actual1;
  // Calculate performance modifiers (dynamic scaling, KP > KDA, new metrics)
  participants.forEach(p => {
    const perfStats = calculatePerformanceStats(p, avgGameLength);
    const performanceScore = (
      perfStats.killParticipation * 0.28 +
      perfStats.kda * 0.12 +
      (perfStats.damagePerMinute / 500) * 0.18 +
      (perfStats.objectiveParticipation / 10) * 0.10 * earlyWeight +
      (perfStats.csPerMinute / 8) * 0.08 * earlyWeight +
      (perfStats.visionScorePerMinute / 2) * 0.06 +
      (perfStats.wardsPlaced / 5) * 0.04 +
      (perfStats.wardsCleared / 3) * 0.04 +
      (perfStats.turretDamage / 2000) * 0.05 * lateWeight +
      perfStats.lateGamePerformance * 0.05 * lateWeight
    );
    p.performanceScore = Math.max(0, Math.min(2, performanceScore));
    // Calculate performance modifier
    const minPerf = typeof method.minPerformanceBonus === 'number' ? method.minPerformanceBonus : 0;
    const maxPerf = typeof method.maxPerformanceBonus === 'number' ? method.maxPerformanceBonus : 100;
    const performanceModifier = Math.max(
      minPerf,
      Math.min(maxPerf, (p.performanceScore - 1) * 100)
    );
    p.performanceModifier = performanceModifier;
  });
  // Apply ELO changes
  const k = typeof config.kFactor === 'number' ? config.kFactor : 64;
  const teamResultWeight = typeof method.teamResultWeight === 'number' ? method.teamResultWeight : 1;
  const performanceWeight = typeof method.performanceWeight === 'number' ? method.performanceWeight : 1;
  team1.forEach(p => {
    const baseChange = k * (actual1 - expected1);
    const teamComponent = baseChange * teamResultWeight;
    const performanceComponent = p.performanceModifier * performanceWeight;
    let eloChange = Math.round(teamComponent + performanceComponent);
    // Ensure losers always lose ELO
    if (!p.win && eloChange >= 0) eloChange = -1;
    p.traditionalEloChange = eloChange;
    p.traditionalNewElo = Math.max(0, p.currentElo + p.traditionalEloChange);
  });
  team2.forEach(p => {
    const baseChange = k * (actual2 - expected2);
    const teamComponent = baseChange * teamResultWeight;
    const performanceComponent = p.performanceModifier * performanceWeight;
    let eloChange = Math.round(teamComponent + performanceComponent);
    // Ensure losers always lose ELO
    if (!p.win && eloChange >= 0) eloChange = -1;
    p.traditionalEloChange = eloChange;
    p.traditionalNewElo = Math.max(0, p.currentElo + p.traditionalEloChange);
  });
  return participants;
}

// Method 2: Lane-based comparison system
function calculateLaneComparisonElo(participants) {
  const method = config.calculationMethods && config.calculationMethods.laneComparison;
  if (!method || !method.enabled) return participants;

  // Ensure currentElo is set for all participants
  participants.forEach(p => {
    if (typeof p.currentElo !== 'number' || isNaN(p.currentElo)) {
      p.currentElo = loadPlayerElo(getPlayerName(p));
    }
  });

  // Calculate average game length and dynamic weights
  const avgGameLength = participants.reduce((sum, p) => sum + (p.timePlayed || 0), 0) / participants.length;
  const { earlyWeight, lateWeight } = getDynamicWeights(avgGameLength);

  calculateLaneComparison(participants);

  participants.forEach(p => {
    // Lane comparison bonus/penalty
    const laneBonus = p.laneRankPercentile ? 
      (p.laneRankPercentile - 0.5) * 2 * (typeof method.maxLaneBonus === 'number' ? method.maxLaneBonus : 20) : 0;
    // Team result bonus/penalty
    const teamBonus = p.win ? (typeof method.maxTeamBonus === 'number' ? method.maxTeamBonus : 20) : -(typeof method.maxTeamBonus === 'number' ? method.maxTeamBonus : 20);
    // Individual performance bonus (dynamic scaling, KP > KDA, new metrics)
    const perfStats = calculatePerformanceStats(p, avgGameLength);
    const individualScore = (
      perfStats.killParticipation * 0.28 +
      perfStats.kda * 0.12 +
      (perfStats.damagePerMinute / 500) * 0.18 +
      (perfStats.objectiveParticipation / 10) * 0.10 * earlyWeight +
      (perfStats.csPerMinute / 8) * 0.08 * earlyWeight +
      (perfStats.visionScorePerMinute / 2) * 0.06 +
      (perfStats.wardsPlaced / 5) * 0.04 +
      (perfStats.wardsCleared / 3) * 0.04 +
      (perfStats.turretDamage / 2000) * 0.05 * lateWeight +
      perfStats.lateGamePerformance * 0.05 * lateWeight
    );
    const maxIndividualBonus = typeof method.maxIndividualBonus === 'number' ? method.maxIndividualBonus : 20;
    const individualBonus = (individualScore - 1) * maxIndividualBonus;
    // Weighted combination
    const laneWeight = typeof method.laneWeight === 'number' ? method.laneWeight : 1;
    const teamWeight = typeof method.teamWeight === 'number' ? method.teamWeight : 1;
    const individualWeight = typeof method.individualWeight === 'number' ? method.individualWeight : 1;
    let eloChange = Math.round(
      laneBonus * laneWeight +
      teamBonus * teamWeight +
      individualBonus * individualWeight
    );
    // Ensure losers always lose ELO
    if (!p.win && eloChange >= 0) eloChange = -1;
    p.laneComparisonChange = eloChange;
    p.laneComparisonNewElo = Math.max(0, p.currentElo + p.laneComparisonChange);
  });
  return participants;
}

// Method 3: Hybrid performance-based system
function calculateHybridElo(participants) {
  const method = config.calculationMethods && config.calculationMethods.hybrid;
  if (!method || !method.enabled) return participants;

  // Use average game length for scaling
  const avgGameLength = participants.reduce((sum, p) => sum + (p.timePlayed || 0), 0) / participants.length;
  const { earlyWeight, lateWeight } = getDynamicWeights(avgGameLength);

  // Calculate performance scores and win/loss grouping
  const teamGroups = {};
  participants.forEach(p => {
    const perfStats = calculatePerformanceStats(p, avgGameLength);
    const performanceScore = (
      perfStats.killParticipation * 0.28 +
      perfStats.kda * 0.12 +
      (perfStats.damagePerMinute / 500) * 0.18 +
      (perfStats.objectiveParticipation / 10) * 0.10 * earlyWeight +
      (perfStats.csPerMinute / 8) * 0.08 * earlyWeight +
      (perfStats.visionScorePerMinute / 2) * 0.06 +
      (perfStats.wardsPlaced / 5) * 0.04 +
      (perfStats.wardsCleared / 3) * 0.04 +
      (perfStats.turretDamage / 2000) * 0.05 * lateWeight +
      perfStats.lateGamePerformance * 0.05 * lateWeight
    );
    p.performanceScore = performanceScore;
    if (!teamGroups[p.teamId]) teamGroups[p.teamId] = [];
    teamGroups[p.teamId].push(p);
  });

  // Identify winning and losing teams
  const teamIds = Object.keys(teamGroups);
  const team1 = teamGroups[teamIds[0]];
  const team2 = teamGroups[teamIds[1]];
  const team1Win = team1[0].win;
  const winningTeam = team1Win ? team1 : team2;
  const losingTeam = team1Win ? team2 : team1;

  // Assign ELO changes for winners (as before)
  winningTeam.forEach(p => {
    const baseWinElo = method.baseEloChange;
    let eloChange;
    if (p.performanceScore < 1) {
      const reductionFactor = method.winBonusReduction;
      eloChange = Math.max(5, baseWinElo * reductionFactor);
    } else {
      const performanceBonus = (p.performanceScore - 1) * method.performanceMultiplier;
      eloChange = baseWinElo + performanceBonus;
    }
    p.hybridEloChange = Math.round(eloChange);
    p.hybridNewElo = Math.max(0, p.currentElo + p.hybridEloChange);
  });

  // Assign unique, performance-based ELO losses for losers
  // 1. Calculate a base loss pool (sum of what would have been lost)
  // 2. Distribute losses so that lower performers lose more
  const baseLossElo = -method.baseEloChange;
  // Calculate inverse performance scores (lower score = higher loss)
  const perfScores = losingTeam.map(p => Math.max(0.1, p.performanceScore));
  const invScores = perfScores.map(s => 1 / s);
  const invSum = invScores.reduce((a, b) => a + b, 0);
  // Total loss pool (sum of base losses, or scale as needed)
  const totalLoss = baseLossElo * losingTeam.length;
  // Distribute losses
  losingTeam.forEach((p, idx) => {
    // Each player's share is proportional to their inverse performance
    const share = invScores[idx] / invSum;
    let eloChange = totalLoss * share;
    // Optionally, add a penalty for very low performance
    if (p.performanceScore < 0.7) eloChange *= 1.1;
    // Ensure losers always lose ELO
    if (eloChange >= 0) eloChange = -1;
    p.hybridEloChange = Math.round(eloChange);
    p.hybridNewElo = Math.max(0, p.currentElo + p.hybridEloChange);
  });

  return participants;
}

// Save updated player stats
function saveUserStats(gameId, participants) {
  const playerDir = path.join(process.cwd(), 'player');
  if (!fs.existsSync(playerDir)) fs.mkdirSync(playerDir);

  for (const participant of participants) {
    const name = getPlayerName(participant);
    const filePath = path.join(playerDir, `${name}.json`);
    
    let stats = {
      totalKills: 0,
      totalAssists: 0,
      totalDeaths: 0,
      totalGold: 0,
      totalWins: 0,
      totalLosses: 0,
      games: 0,
      elo: config.baseElo,
      eloHistory: [],
      performanceHistory: []
    };

    if (fs.existsSync(filePath)) {
      try {
        stats = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
    }

    const oldElo = stats.elo ?? config.baseElo;
    
    // Use the first enabled method's ELO calculation for actual saving
    let newElo = oldElo;
    let method = 'none';
    let eloChange = 0;
    
    if (config.calculationMethods && config.calculationMethods.traditional && config.calculationMethods.traditional.enabled && participant.traditionalNewElo !== undefined) {
      newElo = participant.traditionalNewElo;
      eloChange = participant.traditionalEloChange;
      method = 'traditional';
    } else if (config.calculationMethods && config.calculationMethods.laneComparison && config.calculationMethods.laneComparison.enabled && participant.laneComparisonNewElo !== undefined) {
      newElo = participant.laneComparisonNewElo;
      eloChange = participant.laneComparisonChange;
      method = 'laneComparison';
    } else if (config.calculationMethods && config.calculationMethods.hybrid && config.calculationMethods.hybrid.enabled && participant.hybridNewElo !== undefined) {
      newElo = participant.hybridNewElo;
      eloChange = participant.hybridEloChange;
      method = 'hybrid';
    }

    // Update stats
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
    
    // Add to history
    if (!stats.eloHistory) stats.eloHistory = [];
    if (!stats.performanceHistory) stats.performanceHistory = [];
    
    stats.eloHistory.push({
      gameId,
      oldElo,
      newElo,
      change: eloChange,
      method,
      timestamp: new Date().toISOString()
    });
    
    stats.performanceHistory.push({
      gameId,
      performanceScore: participant.performanceScore,
      laneRank: participant.laneRank,
      role: getRole(participant),
      win: participant.win,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 entries
    if (stats.eloHistory.length > 50) stats.eloHistory = stats.eloHistory.slice(-50);
    if (stats.performanceHistory.length > 50) stats.performanceHistory = stats.performanceHistory.slice(-50);

    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));

    // Log ELO change
    const diff = eloChange;
    const colorStart = diff > 0 ? '\x1b[32m' : diff < 0 ? '\x1b[31m' : '\x1b[37m';
    const colorEnd = '\x1b[0m';
    const sign = diff > 0 ? '+' : '';
    console.log(`${name} [${method}] ELO: ${oldElo} -> ${newElo} (${colorStart}${sign}${diff}${colorEnd})`);
    
    // Show method-specific details if in comparison mode
    const isComparisonMode = config.calculationMethods &&
                            config.calculationMethods.traditional && config.calculationMethods.traditional.enabled && 
                            config.calculationMethods.laneComparison && config.calculationMethods.laneComparison.enabled && 
                            config.calculationMethods.hybrid && config.calculationMethods.hybrid.enabled;
    
    if (isComparisonMode) {
      if (participant.traditionalEloChange !== undefined) {
        const tColor = participant.traditionalEloChange >= 0 ? '\x1b[32m' : '\x1b[31m';
        const tSign = participant.traditionalEloChange >= 0 ? '+' : '';
        console.log(`  Traditional: ${tColor}${tSign}${participant.traditionalEloChange}${colorEnd} (Perf: ${participant.performanceScore?.toFixed(2)})`);
      }
      if (participant.laneComparisonChange !== undefined) {
        const lColor = participant.laneComparisonChange >= 0 ? '\x1b[32m' : '\x1b[31m';
        const lSign = participant.laneComparisonChange >= 0 ? '+' : '';
        console.log(`  Lane Comp: ${lColor}${lSign}${participant.laneComparisonChange}${colorEnd} (Rank: ${participant.laneRank}/${participant.laneRankPercentile?.toFixed(2)})`);
      }
      if (participant.hybridEloChange !== undefined) {
        const hColor = participant.hybridEloChange >= 0 ? '\x1b[32m' : '\x1b[31m';
        const hSign = participant.hybridEloChange >= 0 ? '+' : '';
        console.log(`  Hybrid: ${hColor}${hSign}${participant.hybridEloChange}${colorEnd}`);
      }
    }

    // Append to log file
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const formatted = `${now.getFullYear().toString().slice(2)}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${hours}-${String(now.getMinutes()).padStart(2,'0')}-${ampm}`;
    fs.appendFileSync('elo-log.csv', `${formatted},${name},${oldElo},${newElo},${method}\n`);
  }
}

// Main calculation function
function calculateAllEloMethods(participants) {
  // Load current ELO for each participant
  participants.forEach(p => {
    p.currentElo = loadPlayerElo(getPlayerName(p));
  });
  
  // Calculate using all enabled methods
  participants = calculateTraditionalElo(participants);
  participants = calculateLaneComparisonElo(participants);
  participants = calculateHybridElo(participants);
  
  return participants;
}

function runGame(gameId) {
  const files = getParticipantFiles(gameId);
  const participants = files.map(file => {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!validateParticipant(data)) {
      console.warn(`Invalid participant data in ${file}, skipping validation`);
    }
    return data;
  });

  console.log(`Processing ${participants.length} participants...`);
  
  // Calculate ELO using all methods
  const updatedParticipants = calculateAllEloMethods(participants);

  // Save updated stats
  saveUserStats(gameId, updatedParticipants);
  
  // Show method comparison
  console.log('\nMethod Comparison:');
  updatedParticipants.forEach(p => {
    const name = getPlayerName(p);
    console.log(`${name}:`);
    if (p.traditionalNewElo !== undefined) {
      const tDiff = p.traditionalEloChange;
      const tColor = tDiff > 0 ? '\x1b[32m' : tDiff < 0 ? '\x1b[31m' : '\x1b[37m';
      const tSign = tDiff > 0 ? '+' : '';
      const tEnd = '\x1b[0m';
      console.log(`  Traditional: ${p.traditionalNewElo} (${tColor}${tSign}${tDiff}${tEnd})`);
    }
    if (p.laneComparisonNewElo !== undefined) {
      const lDiff = p.laneComparisonChange;
      const lColor = lDiff > 0 ? '\x1b[32m' : lDiff < 0 ? '\x1b[31m' : '\x1b[37m';
      const lSign = lDiff > 0 ? '+' : '';
      const lEnd = '\x1b[0m';
      console.log(`  Lane Comparison: ${p.laneComparisonNewElo} (${lColor}${lSign}${lDiff}${lEnd})`);
    }
    if (p.hybridNewElo !== undefined) {
      const hDiff = p.hybridEloChange;
      const hColor = hDiff > 0 ? '\x1b[32m' : hDiff < 0 ? '\x1b[31m' : '\x1b[37m';
      const hSign = hDiff > 0 ? '+' : '';
      const hEnd = '\x1b[0m';
      console.log(`  Hybrid: ${p.hybridNewElo} (${hColor}${hSign}${hDiff}${hEnd})`);
    }
  });
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

if (mode === 'compare') {
  // Ensure calculationMethods and sub-methods exist
  if (!config.calculationMethods) config.calculationMethods = {};
  if (!config.calculationMethods.traditional) config.calculationMethods.traditional = {};
  if (!config.calculationMethods.laneComparison) config.calculationMethods.laneComparison = {};
  if (!config.calculationMethods.hybrid) config.calculationMethods.hybrid = {};
  // Enable all methods for comparison
  config.calculationMethods.traditional.enabled = true;
  config.calculationMethods.laneComparison.enabled = true;
  config.calculationMethods.hybrid.enabled = true;
  
  console.log('ELO METHOD COMPARISON MODE');
  console.log('==========================\n');
  
  if (arg) {
    runGame(arg);
  } else {
    runAllGames();
  }
} else if (mode === 'all') {
  runAllGames();
} else if (mode === 'single' && arg) {
  runGame(arg);
} else {
  console.log('Usage: node elo-enhanced.js [all | single <gameId> | compare [gameId]]');
  console.log('');
  console.log('Commands:');
  console.log('  all              - Process all games with current config');
  console.log('  single <gameId>  - Process specific game with current config');
  console.log('  compare [gameId] - Compare all methods (specific game or all games)');
}
