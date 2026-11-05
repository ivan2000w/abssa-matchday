export type MatchStatus = 'scheduled' | 'final' | 'postponed';

export type AbssaMatch = {
  id: string;
  round: number;
  date: string;
  time: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  note: string;
  status: MatchStatus;
};

export type Standing = {
  position: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type AbssaSnapshot = {
  division: '4B';
  season: '2026/27';
  sourceUrl: string;
  fetchedAt: string;
  sourceStatus: 'verified' | 'last-verified';
  matches: AbssaMatch[];
  standings: Standing[];
};

export type ValidationReport = {
  valid: boolean;
  checks: string[];
  errors: string[];
};
