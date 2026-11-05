import type { AbssaMatch, AbssaSnapshot, Standing } from './types';

const ORIGIN = 'https://www.abssa.be';
const ENTRY = `${ORIGIN}/Abssabe-01`;
const DIVISION_VALUE = '9';

type Session = { cookie: string };
export type AbssaTransport = (url: string, init?: RequestInit) => Promise<string>;

function absolute(path: string) {
  return new URL(path, ORIGIN).toString();
}

function updateCookie(session: Session, response: Response) {
  const header = response.headers.get('set-cookie');
  const match = header?.match(/(?:^|,\s*)([A-Za-z0-9_]+=[^;,]+)/);
  if (match) session.cookie = match[1];
}

async function request(session: Session, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ABSSA-Matchday/1.0; +https://www.abssa.be)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(session.cookie ? { cookie: session.cookie } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(12000),
  });
  updateCookie(session, response);
  if (!response.ok) throw new Error(`ABSSA returned HTTP ${response.status}`);
  return response.text();
}

function formAction(html: string, name: string) {
  const pattern = new RegExp(`<form[^>]+name=["']${name}["'][^>]+action=["']([^"']+)`, 'i');
  const match = html.match(pattern);
  if (!match) throw new Error(`ABSSA ${name} form was not found`);
  return absolute(match[1]);
}

function decode(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cell(row: string, alias: string) {
  const match = row.match(new RegExp(`<td[^>]+id=["']c\\d+-${alias}["'][^>]*>([\\s\\S]*?)<\\/td>`, 'i'));
  return match ? decode(match[1]) : '';
}

function isoDate(frenchDate: string) {
  const [day, month, year] = frenchDate.split('/');
  return `${year}-${month}-${day}`;
}

function roundOptions(html: string) {
  const select = html.match(/<select[^>]+id=["']A3["'][\s\S]*?<\/select>/i)?.[0] ?? '';
  return [...select.matchAll(/<option[^>]+value=["']?(\d+)["']?[^>]*>[\s\S]*?(\d{2}\/\d{2}\/\d{4})[\s\S]*?<\/option>/gi)].map((match) => ({
    round: Number(match[1]),
    date: isoDate(match[2]),
  }));
}

function parseMatches(xml: string, round: number, date: string): AbssaMatch[] {
  const rows = [...xml.matchAll(/<tr[^>]+id=["']A8_(\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map((match) => {
    const index = Number(match[1]);
    const row = match[2];
    const homeScoreText = cell(row, 'A17');
    const awayScoreText = cell(row, 'A18');
    const scorePresent = /^\d+$/.test(homeScoreText) && /^\d+$/.test(awayScoreText);
    const note = cell(row, 'A5');
    const postponed = /remis|report|postpon/i.test(note);
    return {
      id: `4b-${String(round).padStart(2, '0')}-${index}`,
      round,
      date,
      time: cell(row, 'A10'),
      home: cell(row, 'A13'),
      away: cell(row, 'A16'),
      homeScore: scorePresent ? Number(homeScoreText) : null,
      awayScore: scorePresent ? Number(awayScoreText) : null,
      note,
      status: postponed ? 'postponed' : scorePresent ? 'final' : 'scheduled',
    };
  });
}

function parseStandings(xml: string): Standing[] {
  const rows = [...xml.matchAll(/<tr[^>]+id=["']A4_(\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map((match) => {
    const row = match[2];
    return {
      position: Number(cell(row, 'A5')),
      team: cell(row, 'A21'),
      played: Number(cell(row, 'A25')),
      won: Number(cell(row, 'A26')),
      lost: Number(cell(row, 'A27')),
      drawn: Number(cell(row, 'A28')),
      goalsFor: Number(cell(row, 'A29')),
      goalsAgainst: Number(cell(row, 'A30')),
      points: Number(cell(row, 'A31')),
    };
  });
}

function ajaxBody(context: 'A7' | 'A1', fields: Record<string, string>) {
  return new URLSearchParams({
    WD_ACTION_: 'AJAXPAGE',
    EXECUTE: '47',
    WD_CONTEXTE_: context,
    WD_JSON_PROPRIETE_: '{"m_oProprietesSecurisees":{"M4":{"12":1}}}',
    WD_BUTTON_CLICK_: 'M7',
    ...fields,
  }).toString();
}

export async function collectAbssa(_previous: AbssaSnapshot, transport?: AbssaTransport): Promise<AbssaSnapshot> {
  const session: Session = { cookie: '' };
  const read: AbssaTransport = transport ?? ((url, init) => request(session, url, init));
  const root = await read(ENTRY);
  if (!/Royale Association Belge des Sports du Samedi/i.test(root)) throw new Error('ABSSA identity check failed');

  const menu = await read(`${formAction(root, 'MENU')}?A2`, { headers: { referer: ENTRY } });
  const departAction = formAction(menu, 'DEPART_NEW');
  const calendar = await read(`${departAction}?A1`, { headers: { referer: formAction(root, 'MENU') } });
  const options = roundOptions(calendar);
  if (options.length < 20) throw new Error('ABSSA matchday list is incomplete');

  const calendarAction = formAction(calendar, 'PAGE_CAL');
  const matches: AbssaMatch[] = [];
  for (const matchday of options) {
    const calendarXml = await read(calendarAction, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', referer: calendarAction },
      body: ajaxBody('A7', {
        A7: DIVISION_VALUE,
        A3: String(matchday.round),
        A8: '1',
        A8_DEB: '1',
        _A8_OCC: '7',
      }),
    });
    const matchdayMatches = parseMatches(calendarXml, matchday.round, matchday.date);
    if (matchdayMatches.length !== 7) throw new Error(`ABSSA returned ${matchdayMatches.length} matches for matchday ${matchday.round}`);
    matches.push(...matchdayMatches);
  }

  const ranking = await read(`${departAction}?A2`, { headers: { referer: calendarAction } });
  const rankingAction = formAction(ranking, 'PAGE_CLASSEEMENT_04');
  const rankingXml = await read(rankingAction, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: rankingAction },
    body: ajaxBody('A1', {
      A1: DIVISION_VALUE,
      A4: '1',
      A4_DEB: '1',
      _A4_OCC: '14',
    }),
  });
  const standings = parseStandings(rankingXml);
  if (standings.length !== 14) throw new Error(`ABSSA returned ${standings.length} table rows`);

  return {
    division: '4B',
    season: '2026/27',
    sourceUrl: ENTRY,
    fetchedAt: new Date().toISOString(),
    sourceStatus: 'verified',
    matches: matches.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    standings,
  };
}

export async function snapshotHash(snapshot: AbssaSnapshot) {
  const stable = JSON.stringify({ ...snapshot, fetchedAt: undefined, sourceStatus: undefined });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
