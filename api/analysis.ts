/**
 * GET /api/analysis?competition=PL&homeId=57&awayId=61&home=Arsenal&away=Chelsea
 *
 * Free statistical match prediction derived from the live league table.
 * Logic is shared with the Vite dev middleware via ./_sports.js.
 */
import { getAnalysis } from './_sports';

export default async function handler(req: any, res: any) {
  try {
    const result = await getAnalysis(process.env.FOOTBALL_DATA_KEY, req.query ?? {});
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(err?.status ?? 500).json({ error: err?.message ?? 'Failed to compute analysis.' });
  }
}
