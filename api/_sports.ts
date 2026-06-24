import https from 'https';

// A lightweight fetch fallback using Node's built-in https module for older
// Node versions that don't have a global fetch (e.g. Node 16 or environment mismatches).
function nodeFetch(url: string, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
          status: res.statusCode,
          text: async () => data,
          json: async () => JSON.parse(data),
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

const safeFetch = typeof fetch !== 'undefined' ? fetch : nodeFetch;

const FD_BASE = 'https://api.football-data.org/v4';

// ---- Matches ----------------------------------------------------------------

function mapStatus(s: string) {
  if (s === 'IN_PLAY' || s === 'PAUSED' || s === 'LIVE') return 'live';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return 'upcoming';
}

function fmtDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtLabel(utcDate: string, status: string) {
  const d = new Date(utcDate);
  if (status === 'finished') return 'Full time';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalize(m: any) {
  const status = mapStatus(m.status);
  return {
    id: String(m.id),
    sport: 'football',
    league: m.competition?.name ?? 'Football',
    competition: m.competition?.code ?? null,
    homeTeam: m.homeTeam?.shortName || m.homeTeam?.name || 'TBD',
    awayTeam: m.awayTeam?.shortName || m.awayTeam?.name || 'TBD',
    homeId: m.homeTeam?.id ?? null,
    awayId: m.awayTeam?.id ?? null,
    homeScore: m.score?.fullTime?.home ?? undefined,
    awayScore: m.score?.fullTime?.away ?? undefined,
    status,
    // Only a half-time marker; the live dot/label is added by the UI (the free
    // tier doesn't expose the live minute), avoiding a doubled "LIVE LIVE".
    time: status === 'live' && m.status === 'PAUSED' ? 'HT' : undefined,
    date: fmtLabel(m.utcDate, status),
    utcDate: m.utcDate,
  };
}

const DEFAULT_KEY = '5dcc8513f3f94eb49222c91c5eceea2c';

export async function getMatches(key?: string) {
  const apiKey = key || DEFAULT_KEY;
  if (!apiKey) {
    const err: any = new Error('FOOTBALL_DATA_KEY is not configured on the server.');
    err.status = 500;
    throw err;
  }

  const today = new Date();
  const weekLater = new Date(today.getTime() + 7 * 86_400_000);
  const url = `${FD_BASE}/matches?dateFrom=${fmtDay(today)}&dateTo=${fmtDay(weekLater)}`;

  const r = await safeFetch(url, { headers: { 'X-Auth-Token': apiKey } });
  if (!r.ok) {
    const err: any = new Error(`football-data.org returned ${r.status}`);
    err.status = r.status;
    err.detail = (await r.text()).slice(0, 200);
    throw err;
  }

  const data = await r.json();
  const matches = (data.matches || [])
    .filter((m: any) => m.homeTeam?.name && m.awayTeam?.name)
    .map(normalize);

  const rank: Record<string, number> = { live: 0, upcoming: 1, finished: 2 };
  matches.sort((a: any, b: any) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
  });

  return { matches, count: matches.length, source: 'football-data.org' };
}

// ---- Analysis ---------------------------------------------------------------

const HOME_ADVANTAGE = 0.35;
const GD_WEIGHT = 0.15;
const DRAW_BIAS = 0.62;

function strength(row: any, home: boolean) {
  const games = Math.max(row.playedGames, 1);
  const ppg = row.points / games;
  const gd = row.goalDifference / games;
  return Math.max(ppg + GD_WEIGHT * gd + (home ? HOME_ADVANTAGE : 0), 0.05);
}

const pct = (n: number) => Math.round(n * 100);

function describeForm(form: string) {
  if (!form) return 'no recent form data';
  const parts = form.split(',').map((s) => s.trim()).filter(Boolean);
  const w = parts.filter((p) => p === 'W').length;
  const d = parts.filter((p) => p === 'D').length;
  const l = parts.filter((p) => p === 'L').length;
  return `${w}W-${d}D-${l}L in their last ${parts.length}`;
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function neutralAnalysis(home: string, away: string) {
  return {
    home: 38,
    draw: 24,
    away: 38,
    predictedWinner: 'Too close to call',
    confidence: 38,
    analysis: `${home} vs ${away} is a knockout/cup-style fixture with no league table to draw on, so this is an evenly-matched baseline estimate. Form on the day will decide it.`,
    basis: 'no-standings',
  };
}

export async function getAnalysis(key: string | undefined, { competition, homeId, awayId, home = 'Home', away = 'Away' }: any) {
  const apiKey = key || DEFAULT_KEY;
  if (!apiKey) {
    const err: any = new Error('FOOTBALL_DATA_KEY is not configured on the server.');
    err.status = 500;
    throw err;
  }

  if (!competition || !homeId || !awayId) return neutralAnalysis(home, away);

  const r = await safeFetch(`${FD_BASE}/competitions/${competition}/standings`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!r.ok) return neutralAnalysis(home, away);

  const data = await r.json();
  const table = data.standings?.find((s: any) => s.type === 'TOTAL')?.table ?? [];

  const toRow = (t: any) => ({
    position: t.position,
    playedGames: t.playedGames,
    points: t.points,
    goalDifference: t.goalDifference,
    form: t.form,
    teamId: t.team?.id,
  });

  const homeRow = table.map(toRow).find((t: any) => t.teamId === Number(homeId));
  const awayRow = table.map(toRow).find((t: any) => t.teamId === Number(awayId));
  if (!homeRow || !awayRow) return neutralAnalysis(home, away);

  const sHome = strength(homeRow, true);
  const sAway = strength(awayRow, false);
  const total = sHome + sAway + DRAW_BIAS;

  const homePct = pct(sHome / total);
  const drawPct = pct(DRAW_BIAS / total);
  const awayPct = pct(sAway / total);

  const ranked = [
    { name: home, p: homePct },
    { name: 'Draw', p: drawPct },
    { name: away, p: awayPct },
  ].sort((a, b) => b.p - a.p);

  const analysis =
    `${home} sit ${homeRow.position}${ordinal(homeRow.position)} (${homeRow.points} pts, ` +
    `${describeForm(homeRow.form)}) and host ${away}, ${awayRow.position}${ordinal(awayRow.position)} ` +
    `(${awayRow.points} pts, ${describeForm(awayRow.form)}). Factoring home advantage and goal ` +
    `difference, the model favours ${ranked[0].name === 'Draw' ? 'a draw' : ranked[0].name} ` +
    `(${homePct}% home / ${drawPct}% draw / ${awayPct}% away).`;

  return {
    home: homePct,
    draw: drawPct,
    away: awayPct,
    predictedWinner: ranked[0].name,
    confidence: ranked[0].p,
    analysis,
    homeRank: homeRow.position,
    awayRank: awayRow.position,
    homeForm: homeRow.form ?? null,
    awayForm: awayRow.form ?? null,
    basis: 'league-standings',
  };
}

export async function getStandings(key?: string) {
  const apiKey = key || DEFAULT_KEY;
  if (!apiKey) {
    const err: any = new Error('FOOTBALL_DATA_KEY is not configured on the server.');
    err.status = 500;
    throw err;
  }

  const r = await safeFetch(`${FD_BASE}/competitions/PL/standings`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!r.ok) {
    const err: any = new Error(`football-data.org returned ${r.status}`);
    err.status = r.status;
    throw err;
  }

  const data = await r.json();
  const table = data.standings?.find((s: any) => s.type === 'TOTAL')?.table ?? [];

  const standings = table.slice(0, 10).map((t: any) => ({
    rank: t.position,
    team: t.team?.shortName || t.team?.name || 'Unknown',
    played: t.playedGames,
    won: t.won,
    drawn: t.draw,
    lost: t.lost,
    points: t.points,
    form: t.form ? t.form.split(',').map((s: string) => s.trim()).filter(Boolean) : []
  }));

  return { standings, count: standings.length, source: 'football-data.org' };
}
