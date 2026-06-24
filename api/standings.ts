/**
 * GET /api/standings
 *
 * Real Premier League standings from football-data.org, normalized for the dashboard.
 * Logic is shared with Vite dev middleware via ./_sports.js.
 */
import { getStandings } from './_sports.js';

export default async function handler(_req: any, res: any) {
  try {
    const result = await getStandings(process.env.FOOTBALL_DATA_KEY);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(err?.status ?? 500).json({
      error: err?.message ?? 'Failed to fetch standings.',
      detail: err?.detail,
    });
  }
}
