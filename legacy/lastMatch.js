// riot_match_fetcher.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
dotenv.config();

// --- 1. Config & Constants ---
const RIOT_API_KEY = process.env.RIOT_API_KEY;
if (!RIOT_API_KEY) throw new Error('Missing RIOT_API_KEY in environment');

const REGIONS = {
  oce: { platform: 'oc1', match: 'sea' },
  na: { platform: 'na1', match: 'americas' },
  euw: { platform: 'euw1', match: 'europe' }
};

const REGION = REGIONS.oce.platform;
const MATCH_REGION = REGIONS.oce.match;

// --- 2. Network Hygiene ---
async function riotFetch(url, tries = 3) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': RIOT_API_KEY },
      timeout: 10000
    });

    if (res.status === 429 && attempt < tries) {
      const wait = (+res.headers.get('Retry-After') || 1) * 1000;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }

    return res.json();
  }
}

// --- API Wrappers ---
async function getSummonerPUUID(summonerName) {
  const url = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
  return (await riotFetch(url)).puuid;
}

async function getSummonerByPUUID(puuid) {
  const url = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  return riotFetch(url);
}

async function getPUUIDByRiotId(gameName, tagLine) {
  const url = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return (await riotFetch(url)).puuid;
}

async function getLastMatchIds(puuid, count = 3) {
  const url = `https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
  return riotFetch(url);
}

async function getMatchDetails(matchId) {
  const url = `https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  return riotFetch(url);
}

// --- 3. Filesystem helpers ---
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9#_\-]/g, '_');
}

async function saveAllParticipants(match) {
  if (!match?.info?.participants) return;

  const gameId = match.info.gameId || match.metadata.matchId || 'unknown_game';
  const dir = `game_${gameId}`;
  await fs.mkdir(dir, { recursive: true });

  for (const p of match.info.participants) {
    const name = p.riotIdGameName && p.riotIdTagline
      ? `${p.riotIdGameName}#${p.riotIdTagline}`
      : p.summonerName || p.puuid;
    const filename = sanitizeFilename(name);
    await fs.writeFile(path.join(dir, `${filename}.json`), JSON.stringify(p, null, 2));
  }
}

// --- Format Match Info ---
function formatMatchData(match, summonerName) {
  if (!match?.info?.participants?.length) {
    return 'Invalid match data: No participants.';
  }

  const participant = match.info.participants.find(p => {
    if (typeof p.riotIdGameName === 'string' && typeof summonerName === 'string') {
      return p.riotIdGameName.toLowerCase() === summonerName.toLowerCase();
    } else if (typeof p.summonerName === 'string' && typeof summonerName === 'string') {
      return p.summonerName.toLowerCase() === summonerName.toLowerCase();
    }
    return false;
  });

  if (!participant) {
    const first = match.info.participants[0];
    return `No matching player found. Example: ${first.riotIdGameName || first.summonerName || 'unknown'} | Champion: ${first.championName} | K/D/A: ${first.kills}/${first.deaths}/${first.assists}`;
  }

  return `Last Match for ${participant.riotIdGameName || participant.summonerName}:
  Champion: ${participant.championName}
  K/D/A: ${participant.kills}/${participant.deaths}/${participant.assists}
  Win: ${participant.win}
  Game Mode: ${match.info.gameMode}
  Date: ${new Date(match.info.gameStartTimestamp).toLocaleString()}`;
}

// --- Main Execution ---
async function main() {
  const puuid = process.argv[2];
  const numGames = parseInt(process.argv[3], 10) || 3;

  if (!puuid) {
    console.log('Usage: node riot_match_fetcher.js <puuid> [numGames]');
    return;
  }

  try {
    const summoner = await getSummonerByPUUID(puuid);
    const matchIds = await getLastMatchIds(puuid, numGames);

    for (const matchId of matchIds) {
      const match = await getMatchDetails(matchId);
      const d = new Date(match.info.gameStartTimestamp);
      const stamp = d.toISOString().slice(2, 16).replace(/[:T]/g, '-');
      const outFile = `Match_${stamp}_${matchId}.json`;

      const output = formatMatchData(match, summoner.name);
      console.log(output);

      await fs.writeFile(outFile, JSON.stringify(match, null, 2));
      console.log(`Match data saved to ${outFile}`);

      await saveAllParticipants(match); // no logging of individual saves
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
