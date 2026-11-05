export type ClubIdentity = {
  logo?: string;
  primary: string;
  secondary: string;
  officialSource?: string;
};

// A crest is only added when it can be traced to a club-owned page. The
// remaining teams keep a neutral, colour-coded monogram until a source is
// verified; this prevents a generated badge from being mistaken for a crest.
export const clubIdentities: Record<string, ClubIdentity> = {
  'SANSERIF FC': {
    logo: '/clubs/sanserif-fc.png',
    primary: '#101f3d',
    secondary: '#d7c789',
    officialSource: 'https://linktr.ee/fcsanserif',
  },
  'AZUR RCS 4': {
    logo: '/clubs/azur-rcs.png',
    primary: '#0e67ae',
    secondary: '#ffffff',
    officialSource: 'https://rcsazur.be/',
  },
  'ZIJP FC': { primary: '#17191b', secondary: '#f4f4ef' },
  'NEPTUNE FC': { primary: '#1658a8', secondary: '#e9f2ff' },
  'WATERMAEL FC 3': { primary: '#125c8f', secondary: '#f2d64b' },
  'BRUSSELS LTC 3': { primary: '#243c78', secondary: '#f2f4ff' },
  'TIEKSS WEMMEL': { primary: '#2d6948', secondary: '#dff5df' },
  'COSMOS BRUWOLF MJ 1': { primary: '#442366', secondary: '#f0ddff' },
  'CORNAC UNITED FC 1': { primary: '#8a3a2c', secondary: '#ffe8ca' },
  'BLUE THRILLS': { primary: '#176ba0', secondary: '#e4f6ff' },
  'BLEU-BLANC (ENT)R.': { primary: '#155ab6', secondary: '#ffffff' },
  'FRIENDS SPIRIT AUD': { primary: '#744467', secondary: '#ffe6f6' },
  'STRING PENELOPE 2': { primary: '#d05b22', secondary: '#fff0df' },
  'PICARDIE AS 1': { primary: '#6c2738', secondary: '#ffe7eb' },
};

export function clubIdentity(team: string): ClubIdentity {
  return clubIdentities[team] ?? { primary: '#17323b', secondary: '#dff36c' };
}
