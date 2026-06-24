/**
 * GET /api/analysis?competition=PL&homeId=57&awayId=61&home=Arsenal&away=Chelsea
 *
 * Free statistical match prediction. No external AI: it derives win/draw/away
 * probabilities from the live league table (points per game, goal difference,
 * recent form) plus a home-advantage factor, and writes a short rationale.
 */

const FD_BASE = 'https://api.football-data.org/v4';

// Tunable model weights.
const HOME_ADVANTAGE = 0.35; // extra "points per game" the host gets
const GD_WEIGHT = 0.15; // how much goal difference per game contributes
const DRAW_BIAS = 0.62; // baseline pull toward a draw

interface Row {
  position: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalDifference: number;
  form?: string | null;
  teamId: number;
  teamName: string;
}

function strength(row: Row, home: boolean): number {
  const games = Math.max(row.playedGames, 1);
  const ppg = row.points / games;
  const gd = row.goalDifference / games;
  return Math.max(ppg + GD_WEIGHT * gd + (home ? HOME_ADVANTAGE : 0), 0.05);
}

function pct(n: number) {
  return Math.round(n * 100);
}

function describeForm(form?: string | null): string {
  if (!form) return 'no recent form data';
  const parts = form.split(',').map((s) => s.trim()).filter(Boolean);
  const w = parts.filter((p) => p === 'W').length;
  const d = parts.filter((p) => p === 'D').length;
  const l = parts.filter((p) => p === 'L').length;
  return `${w}W-${d}D-${l}L in their last ${parts.length}`;
}

export default async function handler(req: any, res: any) {
  const KEY = process.env.FOOTBALL_DATA_KEY;
  if (!KEY) {
    res.status(500).json({ error: 'FOOTBALL_DATA_KEY is not configured on the server.' });
    return;
  }

  const { competition, homeId, awayId, home = 'Home', away = 'Away' } = req.query as Record<
    string,
    string
  >;

  // Neutral fallback when there's no league table (cup ties / World Cup
  // knockouts have no standings and are played at neutral venues).
  const neutral = () => {
    const result = {
      home: 38,
      draw: 24,
      away: 38,
      predictedWinner: 'Too close to call',
      confidence: 38,
      analysis: `${home} vs ${away} is a knockout/cup-style fixture with no league table to draw on, so this is an evenly-matched baseline estimate. Form on the day will decide it.`,
      basis: 'no-standings',
    };
    res.status(200).json(result);
  };

  if (!competition || !homeId || !awayId) {
    neutral();
    return;
  }

  try {
    const r = await fetch(`${FD_BASE}/competitions/${competition}/standings`, {
      headers: { 'X-Auth-Token': KEY },
    });
    if (!r.ok) {
      neutral();
      return;
    }
    const data = await r.json();
    const table: any[] = data.standings?.find((s: any) => s.type === 'TOTAL')?.table ?? [];

    const toRow = (t: any): Row => ({
      position: t.position,
      playedGames: t.playedGames,
      won: t.won,
      draw: t.draw,
      lost: t.lost,
      points: t.points,
      goalDifference: t.goalDifference,
      form: t.form,
      teamId: t.team?.id,
      teamName: t.team?.shortName || t.team?.name,
    });

    const homeRow = table.map(toRow).find((t) => t.teamId === Number(homeId));
    const awayRow = table.map(toRow).find((t) => t.teamId === Number(awayId));

    if (!homeRow || !awayRow) {
      neutral();
      return;
    }

    const sHome = strength(homeRow, true);
    const sAway = strength(awayRow, false);
    const total = sHome + sAway + DRAW_BIAS;

    const home_p = sHome / total;
    const away_p = sAway / total;
    const draw_p = DRAW_BIAS / total;

    const homePct = pct(home_p);
    const drawPct = pct(draw_p);
    const awayPct = pct(away_p);

    const ranked = [
      { name: home, p: homePct },
      { name: 'Draw', p: drawPct },
      { name: away, p: awayPct },
    ].sort((a, b) => b.p - a.p);

    const confidence = ranked[0].p;
    const predictedWinner = ranked[0].name;

    const analysis =
      `${home} sit ${homeRow.position}${ordinal(homeRow.position)} (${homeRow.points} pts, ` +
      `${describeForm(homeRow.form)}) and host ${away}, ${awayRow.position}${ordinal(
        awayRow.position
      )} (${awayRow.points} pts, ${describeForm(awayRow.form)}). ` +
      `Factoring home advantage and goal difference, the model favours ` +
      `${predictedWinner === 'Draw' ? 'a draw' : predictedWinner} ` +
      `(${homePct}% home / ${drawPct}% draw / ${awayPct}% away).`;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      home: homePct,
      draw: drawPct,
      away: awayPct,
      predictedWinner,
      confidence,
      analysis,
      homeRank: homeRow.position,
      awayRank: awayRow.position,
      homeForm: homeRow.form ?? null,
      awayForm: awayRow.form ?? null,
      basis: 'league-standings',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Failed to compute analysis.' });
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
