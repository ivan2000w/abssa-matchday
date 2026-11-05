export type ClubIdentity = {
  logo?: string;
  primary: string;
  secondary: string;
  officialSource?: string;
  sourceLabel?: string;
};

// Only source-verified club artwork is used; see docs/club-logos.md.
// Unverified clubs retain plain initials, never a generated crest.
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
  'ZIJP FC': {
    logo: '/clubs/zijp-fc.jpg',
    primary: '#181819',
    secondary: '#c8ab57',
    officialSource: 'https://www.instagram.com/fczijp/',
    sourceLabel: 'Club Instagram',
  },
  'NEPTUNE FC': {
    logo: '/clubs/neptune-fc.png',
    primary: '#252446',
    secondary: '#ffffff',
    officialSource: 'https://rfc-neptune.sporteasy.net/',
    sourceLabel: 'Club SportEasy',
  },
  'WATERMAEL FC 3': {
    logo: '/clubs/watermael-fc.jpg',
    primary: '#176fae',
    secondary: '#ffffff',
    officialSource: 'https://www.instagram.com/fcwatermael/',
    sourceLabel: 'Club Instagram',
  },
  'BRUSSELS LTC 3': { primary: '#58656c', secondary: '#edf0f2' },
  'TIEKSS WEMMEL': {
    logo: '/clubs/tiekss-wemmel.png',
    primary: '#202020',
    secondary: '#d42e32',
    officialSource: 'https://www.wemmel.be/fr/association/160/tieks-asbl',
    sourceLabel: 'Wemmel club directory',
  },
  'COSMOS BRUWOLF MJ 1': {
    logo: '/clubs/cosmos-bruwolf.jpg',
    primary: '#282a2c',
    secondary: '#ef9b32',
    officialSource: 'https://www.instagram.com/cosmos_bruwolf_mj/',
    sourceLabel: 'Club Instagram',
  },
  'CORNAC UNITED FC 1': {
    logo: '/clubs/cornac-united.jpg',
    primary: '#ac1f2d',
    secondary: '#ffffff',
    officialSource: 'https://cornac-united-fc-1.sporteasy.net/',
    sourceLabel: 'Club SportEasy',
  },
  'BLUE THRILLS': {
    logo: '/clubs/blue-thrills.jpg',
    primary: '#14549b',
    secondary: '#ffffff',
    officialSource: 'https://www.instagram.com/bluethrillsunited/',
    sourceLabel: 'Club Instagram',
  },
  'BLEU-BLANC (ENT)R.': { primary: '#58656c', secondary: '#edf0f2' },
  'FRIENDS SPIRIT AUD': {
    logo: '/clubs/friends-spirit.jpg',
    primary: '#1a5798',
    secondary: '#ffffff',
    officialSource: 'https://www.instagram.com/friendsspiritfc/',
    sourceLabel: 'Club Instagram',
  },
  'STRING PENELOPE 2': {
    logo: '/clubs/string-penelope.png',
    primary: '#185a9a',
    secondary: '#ffffff',
    officialSource: 'https://string-penelope-1.sporteasy.net/',
    sourceLabel: 'Club SportEasy',
  },
  'PICARDIE AS 1': { primary: '#58656c', secondary: '#edf0f2' },
};

export function clubIdentity(team: string): ClubIdentity {
  return clubIdentities[team] ?? { primary: '#17323b', secondary: '#dff36c' };
}
