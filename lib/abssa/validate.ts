import type { AbssaSnapshot, ValidationReport } from './types';

export function validateSnapshot(snapshot: AbssaSnapshot): ValidationReport {
  const errors: string[] = [];
  const checks: string[] = [];
  if (!snapshot || !Array.isArray(snapshot.matches) || !Array.isArray(snapshot.standings)) return {valid:false,checks,errors:['Missing matches or standings']};
  if (snapshot.division !== '4B' || snapshot.season !== '2026/27') errors.push('Unexpected division or season');
  if (snapshot.sourceStatus !== 'verified' || snapshot.sourceUrl !== 'https://www.abssa.be/Abssabe-01') errors.push('Unexpected source');
  if (!Number.isFinite(Date.parse(snapshot.fetchedAt))) errors.push('Invalid source timestamp');
  const teams = new Set(snapshot.standings.map(row => row?.team));
  if (snapshot.standings.length !== 14 || teams.size !== 14 || !teams.has('SANSERIF FC')) errors.push('Expected all 14 Division 4B teams');
  const positions = new Set<number>();
  for (const row of snapshot.standings) {
    if (!row || typeof row.team !== 'string' || !row.team.trim()) { errors.push('Missing team'); continue; }
    if (!Number.isInteger(row.position) || row.position < 1 || row.position > 14 || positions.has(row.position)) errors.push(`Invalid position for ${row.team}`);
    positions.add(row.position);
    if ([row.played,row.won,row.lost,row.drawn,row.goalsFor,row.goalsAgainst,row.points].some(value => !Number.isInteger(value) || value < 0)) errors.push(`Invalid table values for ${row.team}`);
    if (row.played !== row.won + row.lost + row.drawn) errors.push(`Played total mismatch for ${row.team}`);
  }
  const ids = new Set<string>();
  const rounds = new Map<number, Set<string>>();
  const counts = new Map<number, number>();
  for (const match of snapshot.matches) {
    if (!match || typeof match.id !== 'string' || ids.has(match.id)) { errors.push('Missing or duplicate match ID'); continue; }
    ids.add(match.id);
    if (!Number.isInteger(match.round) || match.round < 1 || match.round > 26) errors.push(`Invalid round in ${match.id}`);
    if (!teams.has(match.home) || !teams.has(match.away) || match.home === match.away) errors.push(`Invalid teams in ${match.id}`);
    const parsed = new Date(`${match.date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== match.date || match.date < '2026-07-01' || match.date > '2027-06-30' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(match.time)) errors.push(`Invalid date or kickoff in ${match.id}`);
    if (!['final','scheduled','postponed'].includes(match.status)) errors.push(`Invalid status in ${match.id}`);
    if ((match.homeScore === null) !== (match.awayScore === null)) errors.push(`Partial score in ${match.id}`);
    if ([match.homeScore,match.awayScore].some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) errors.push(`Invalid score in ${match.id}`);
    if (match.status === 'final' && (match.homeScore === null || match.awayScore === null)) errors.push(`Final match has no score in ${match.id}`);
    if (match.status === 'scheduled' && (match.homeScore !== null || match.awayScore !== null)) errors.push(`Unfinished match has a score in ${match.id}`);
    const appearances = rounds.get(match.round) ?? new Set<string>();
    appearances.add(match.home); appearances.add(match.away); rounds.set(match.round, appearances);
    counts.set(match.round, (counts.get(match.round) ?? 0) + 1);
  }
  if (rounds.size !== 26 || snapshot.matches.length !== 182) errors.push('Expected the complete 26-round season');
  for (const [round,appearances] of rounds) if (appearances.size !== 14 || counts.get(round) !== 7) errors.push(`Incomplete or duplicate teams in round ${round}`);
  if (!errors.length) checks.push('Official source and season','All 182 fixtures and 14 teams','Scores, dates and statuses','Standings arithmetic');
  return {valid:errors.length === 0,checks,errors};
}
