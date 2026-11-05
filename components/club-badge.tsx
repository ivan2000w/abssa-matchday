import { useState, type CSSProperties } from 'react';
import { clubIdentity } from '@/lib/abssa/clubs';
const BASE = import.meta.env.BASE_URL;
function initials(team: string) {
  return (team.replace(/\([^)]*\)/g, '').match(/\p{L}+/gu) ?? []).map(part => part[0]).join('').slice(0, 3);
}

export function ClubBadge({ size = 'medium', team }: { size?: 'tiny' | 'small' | 'medium' | 'large'; team: string }) {
  const identity = clubIdentity(team);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const showLogo = Boolean(identity.logo && failedLogo !== identity.logo);
  const title = showLogo ? `${team} crest · ${identity.sourceLabel ?? "Club source"}` : `${team} initials — ${identity.logo ? "crest temporarily unavailable" : "official crest not yet verified"}`;
  return <span
    className={`club-badge club-badge-${size} ${showLogo ? 'club-badge-official' : 'club-badge-fallback'}`}
    style={{ '--club-primary': identity.primary, '--club-secondary': identity.secondary } as CSSProperties}
    title={title}
  >
    {showLogo ? <img src={`${BASE}${identity.logo!.replace(/^\//, '')}`} alt={`${team} crest`} decoding="async" onError={() => setFailedLogo(identity.logo!)} /> : <span aria-hidden="true">{initials(team)}</span>}
  </span>;
}

