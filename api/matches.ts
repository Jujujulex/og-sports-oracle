/**
 * GET /api/matches
 *
 * Vercel serverless function: real live + upcoming football fixtures from
 * football-data.org, normalized for the frontend. Logic is shared with the
 * Vite dev middleware via ./_sports.js. Set FOOTBALL_DATA_KEY in the env.
 */
import { getMatches } from './_sports.js';

export default async function handler(_req: any, res: any) {
  try {
    const result = await getMatches(process.env.FOOTBALL_DATA_KEY);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(err?.status ?? 500).json({
      error: err?.message ?? 'Failed to fetch matches.',
      detail: err?.detail,
    });
  }
}
