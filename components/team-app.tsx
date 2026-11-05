'use client';

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Home,
  RefreshCw,
  Search,
  Share2,
  Star,
  Table2,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
const AttendancePanel = lazy(() => import('@/components/attendance-panel').then(module => ({ default: module.AttendancePanel })));
import initialSnapshot from '@/public/data/abssa.json';
import { validateSnapshot } from '@/lib/abssa/validate';
const verifiedSeed = initialSnapshot as AbssaSnapshot;
const BASE = import.meta.env.BASE_URL;
import { clubIdentity } from '@/lib/abssa/clubs';
import type { AbssaMatch, AbssaSnapshot } from '@/lib/abssa/types';

type View = 'home' | 'fixtures' | 'results' | 'table' | 'clubs' | 'team';
type Outcome = 'W' | 'D' | 'L';

const SOURCE_URL = 'https://www.abssa.be/Abssabe-01';
const DEFAULT_CLUB = 'SANSERIF FC';
const FAVORITE_KEY = 'abssa-favorite-club';
const nav: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'fixtures', label: 'Fixtures', icon: CalendarDays },
  { id: 'results', label: 'Results', icon: Trophy },
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'clubs', label: 'Clubs', icon: Users },
  { id: 'team', label: 'My team', icon: Users },
];

function dateAt(match: AbssaMatch) {
  // Only the calendar date is formatted; kickoff stays the published local time.
  return new Date(`${match.date}T12:00:00Z`);
}

function longDate(match: AbssaMatch) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' }).format(dateAt(match));
}

function shortDate(match: AbssaMatch) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' }).format(dateAt(match));
}

function checkedAt(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date(value));
}

function initials(team: string) {
  return (team.replace(/\([^)]*\)/g, '').match(/\p{L}+/gu) ?? []).map((part) => part[0]).join('').slice(0, 3);
}

function ordinalSuffix(position: number) {
  const mod = position % 100;
  return mod >= 11 && mod <= 13 ? 'th' : position % 10 === 1 ? 'st' : position % 10 === 2 ? 'nd' : position % 10 === 3 ? 'rd' : 'th';
}

function outcome(match: AbssaMatch, team: string): Outcome | null {
  if (match.status !== 'final' || match.homeScore === null || match.awayScore === null) return null;
  if (match.homeScore === match.awayScore) return 'D';
  const won = match.home === team ? match.homeScore > match.awayScore : match.awayScore > match.homeScore;
  return won ? 'W' : 'L';
}

function ClubBadge({ size = 'medium', team }: { size?: 'tiny' | 'small' | 'medium' | 'large'; team: string }) {
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

function TeamButton({ team, onSelect, className = '' }: { team: string; onSelect: (team: string) => void; className?: string }) {
  return <button type="button" className={`team-name-button ${className}`} onClick={() => onSelect(team)}><ClubBadge team={team} size="tiny" /><span>{team}</span></button>;
}

function MatchRow({ match, focusTeam, onTeamSelect }: { match: AbssaMatch; focusTeam: string; onTeamSelect: (team: string) => void }) {
  const [day, month] = shortDate(match).split(' ');
  const result = outcome(match, focusTeam);
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  return <article className="match-row">
    <div className="match-date"><strong>{day}</strong><span>{month}</span></div>
    <div className="match-card-body">
      <div className="match-status-line"><span>{match.status === 'final' ? 'Full time' : match.status === 'postponed' ? 'Postponed' : `Matchday ${match.round}`}</span><strong>{hasScore ? <span className={`outcome outcome-${result}`}>{result}</span> : <><Clock3 />{match.time}</>}</strong></div>
      <div className="match-team-line"><TeamButton team={match.home} onSelect={onTeamSelect} className={match.home === focusTeam ? 'focus-team' : ''} /><b>{hasScore ? match.homeScore : '—'}</b></div>
      <div className="match-team-line"><TeamButton team={match.away} onSelect={onTeamSelect} className={match.away === focusTeam ? 'focus-team' : ''} /><b>{hasScore ? match.awayScore : '—'}</b></div>
      {match.note ? <div className="match-note"><CheckCircle2 />{match.note}</div> : null}
    </div>
    <ChevronRight className="row-arrow" />
  </article>;
}

function ResultRow({ match, onTeamSelect }: { match: AbssaMatch; onTeamSelect: (team: string) => void }) {
  return <article className="result-row">
    <div className="result-date"><strong>{shortDate(match)}</strong><span>{match.time}</span></div>
    <div className="result-match">
      <div className="result-team-line"><TeamButton team={match.home} onSelect={onTeamSelect} /><b>{match.homeScore}</b></div>
      <div className="result-team-line"><TeamButton team={match.away} onSelect={onTeamSelect} /><b>{match.awayScore}</b></div>
      {match.note ? <small>{match.note}</small> : null}
    </div>
    <span className="full-time-chip">FT</span>
  </article>;
}

export function TeamApp() {
  const [view, setView] = useState<View>(new URLSearchParams(location.search).has('team') ? 'team' : 'home');
  const [snapshot, setSnapshot] = useState<AbssaSnapshot>(verifiedSeed);
  const [favoriteClub, setFavoriteClub] = useState(DEFAULT_CLUB);
  const [profileTeam, setProfileTeam] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [sourceLive, setSourceLive] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [profileMatches, setProfileMatches] = useState<'results' | 'fixtures'>('results');
  const fetching = useRef(false);
  const [now, setNow] = useState(Date.now());

  const loadSnapshot = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const response = await fetch(`${BASE}data/abssa.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Snapshot unavailable');
      const data = await response.json() as AbssaSnapshot;
      if (!validateSnapshot(data).valid) throw new Error('Invalid snapshot');
      setSnapshot(data);
      setSourceLive(data.sourceStatus === 'verified' && response.headers.get('x-abssa-offline') !== '1');
      setNow(Date.now());
    } catch { setSourceLive(false); }
    finally { fetching.current = false; }
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    await loadSnapshot();
    setRefreshing(false);
  };

  useEffect(() => {
    try {
      const savedClub = localStorage.getItem(FAVORITE_KEY);
      if (savedClub) setFavoriteClub(savedClub);
    } catch { /* Storage may be unavailable in private browsing. */ }
    setOnline(navigator.onLine);
    void loadSnapshot();
    const reloadVisible = () => { setNow(Date.now()); if (document.visibilityState === 'visible' && navigator.onLine) void loadSnapshot(); };
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) reloadVisible(); };
    addEventListener('online', update);
    addEventListener('offline', update);
    addEventListener('focus', reloadVisible);
    document.addEventListener('visibilitychange', reloadVisible);
    const interval = setInterval(reloadVisible, 120_000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => undefined);
    return () => { clearInterval(interval); removeEventListener('online', update); removeEventListener('offline', update); removeEventListener('focus', reloadVisible); document.removeEventListener('visibilitychange', reloadVisible); };
  }, [loadSnapshot]);

  const stale = now - Date.parse(snapshot.fetchedAt) > 7 * 24 * 60 * 60 * 1000;
  const dataLabel = !online ? 'Offline copy' : sourceLive === false ? 'Saved results' : sourceLive === null ? 'Checking results' : stale ? 'Update overdue' : 'ABSSA results';

  const orderedMatches = useMemo(() => [...snapshot.matches].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), [snapshot]);
  const allResults = useMemo(() => orderedMatches.filter((match) => match.status === 'final').reverse(), [orderedMatches]);
  const resultRounds = useMemo(() => {
    const rounds = new Map<number, AbssaMatch[]>();
    for (const match of allResults) rounds.set(match.round, [...(rounds.get(match.round) ?? []), match]);
    return [...rounds.entries()].sort(([a], [b]) => b - a);
  }, [allResults]);
  const clubFixtures = orderedMatches.filter((match) => match.status === 'scheduled' && (match.home === favoriteClub || match.away === favoriteClub));
  const clubResults = allResults.filter((match) => match.home === favoriteClub || match.away === favoriteClub);
  const nextMatch = clubFixtures[0];
  const lastResult = clubResults[0];
  const standing = snapshot.standings.find((row) => row.team === favoriteClub) ?? snapshot.standings[0] ?? verifiedSeed.standings[6];

  const openTeam = (team: string) => {
    setProfileTeam(team);
    setProfileMatches('results');
    setView('clubs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chooseFavorite = (team: string) => {
    setFavoriteClub(team);
    try { localStorage.setItem(FAVORITE_KEY, team); } catch { /* Keep the choice for this visit. */ }
  };

  const share = async () => {
    if (!nextMatch) return;
    const data = { title: `${favoriteClub} on ABSSA Matchday`, text: `Next match: ${nextMatch.home} vs ${nextMatch.away} · ${longDate(nextMatch)} at ${nextMatch.time}`, url: location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${data.text} ${data.url}`);
  };

  const addCalendar = () => {
    if (!nextMatch) return;
    const compact = nextMatch.date.replaceAll('-', '');
    const time = nextMatch.time.replace(':', '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ABSSA Matchday//EN', 'BEGIN:VEVENT', `UID:${nextMatch.id}@abssa-matchday`, `DTSTART;TZID=Europe/Brussels:${compact}T${time}00`, `SUMMARY:${nextMatch.home} vs ${nextMatch.away}`, 'DESCRIPTION:Official ABSSA Division 4B fixture', `URL:${SOURCE_URL}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a'); a.href = url; a.download = `${favoriteClub.toLowerCase().replaceAll(' ', '-')}-next-match.ics`; a.click(); URL.revokeObjectURL(url);
  };

  const renderClubs = () => {
    if (!profileTeam) {
      const visibleClubs = snapshot.standings.filter((row) => row.team.toLowerCase().includes(clubSearch.trim().toLowerCase()));
      return <>
      <div className="page-heading"><div><span className="eyebrow">Division 4B · {snapshot.season}</span><h1>The clubs</h1></div><span className="updated">Explore every team, result and upcoming fixture</span></div>
      <div className="club-tools"><label><Search /><input value={clubSearch} onChange={(event) => setClubSearch(event.target.value)} placeholder="Find a club" aria-label="Find a club" /></label><span>{visibleClubs.length} clubs</span></div>
      <p className="crest-note"><CheckCircle2 /> Club crests are checked against public sources. Initials mean a crest is still unverified.</p>
      <section className="club-directory">{visibleClubs.map((row) => <button key={row.team} className={row.team === favoriteClub ? 'favorite-club' : ''} style={{ '--club-accent': clubIdentity(row.team).primary } as CSSProperties} onClick={() => openTeam(row.team)}>
        <span className="directory-position" aria-label={`League position ${row.position}`}>#{row.position}</span><ClubBadge team={row.team} /><span className="directory-copy"><strong>{row.team}</strong><small>{row.played} played <span>·</span> <b>{row.points} pts</b></small><span className="directory-link">View matches <ChevronRight /></span></span>{row.team === favoriteClub ? <Star className="favorite-star" fill="currentColor" /> : <ChevronRight />}
      </button>)}</section>{visibleClubs.length === 0 ? <p className="empty-copy">No club matches “{clubSearch}”.</p> : null}
    </>;
    }

    const profileStanding = snapshot.standings.find((row) => row.team === profileTeam);
    const teamMatches = orderedMatches.filter((match) => match.home === profileTeam || match.away === profileTeam);
    const past = teamMatches.filter((match) => match.status === 'final').reverse();
    const future = teamMatches.filter((match) => match.status === 'scheduled');
    const postponed = teamMatches.filter((match) => match.status === 'postponed');
    const recentForm = past.slice(0, 5).map((match) => outcome(match, profileTeam)).filter(Boolean) as Outcome[];
    const isFavorite = profileTeam === favoriteClub;
    const profileIdentity = clubIdentity(profileTeam);
    return <div className="team-profile">
      <button className="back-button" onClick={() => setProfileTeam(null)}><ArrowLeft />All clubs</button>
      <section className="team-profile-hero" style={{ '--profile-accent': profileIdentity.primary } as CSSProperties}><ClubBadge team={profileTeam} size="large" /><div><span className="eyebrow">ABSSA Division 4B</span><h1>{profileTeam}</h1><p>{profileStanding ? `${profileStanding.position}${ordinalSuffix(profileStanding.position)} · ${profileStanding.points} points` : snapshot.season}</p>{profileIdentity.officialSource ? <a className="badge-status" href={profileIdentity.officialSource} target="_blank" rel="noreferrer"><CheckCircle2 /> {profileIdentity.sourceLabel ?? 'Club website'}</a> : <small className="badge-status">Initial badge · crest not yet verified</small>}</div><Button variant={isFavorite ? 'outline' : 'default'} onClick={() => chooseFavorite(profileTeam)} disabled={isFavorite}><Star fill={isFavorite ? 'currentColor' : 'none'} />{isFavorite ? 'My club' : 'Make my club'}</Button></section>
      {profileStanding ? <div className="profile-stats"><Card><CardContent><span>Played</span><strong>{profileStanding.played}</strong></CardContent></Card><Card><CardContent><span>Record</span><strong>{profileStanding.won}W · {profileStanding.drawn}D · {profileStanding.lost}L</strong></CardContent></Card><Card><CardContent><span>Goals</span><strong>{profileStanding.goalsFor}–{profileStanding.goalsAgainst}</strong></CardContent></Card><Card><CardContent><span>Recent form</span><div className="form-strip">{recentForm.length ? recentForm.map((item, index) => <i key={index} className={`outcome outcome-${item}`}>{item}</i>) : <small>—</small>}</div></CardContent></Card></div> : null}
      {future[0] ? <section className="profile-next"><div><span className="eyebrow">Next match</span><h2>{longDate(future[0])} · {future[0].time}</h2></div><div className="profile-next-teams"><TeamButton team={future[0].home} onSelect={openTeam} /><span>vs</span><TeamButton team={future[0].away} onSelect={openTeam} /></div></section> : null}
      <div className="match-segments" aria-label="Team matches"><button aria-pressed={profileMatches === 'results'} onClick={() => setProfileMatches('results')}>Results <span>{past.length}</span></button><button aria-pressed={profileMatches === 'fixtures'} onClick={() => setProfileMatches('fixtures')}>Fixtures <span>{future.length}</span></button></div>
      {profileMatches === 'fixtures' && <section className="section-card team-match-section"><div className="section-heading"><div><span className="eyebrow">Complete season</span><h2>Upcoming fixtures</h2></div><span>{future.length}</span></div>{future.length ? future.map((match) => <MatchRow key={match.id} match={match} focusTeam={profileTeam} onTeamSelect={openTeam} />) : <p className="empty-copy">No future fixture is currently published.</p>}</section>}
      {postponed.length ? <section className="section-card team-match-section"><div className="section-heading"><div><span className="eyebrow">Awaiting a new date</span><h2>Postponed</h2></div><span>{postponed.length}</span></div>{postponed.map((match) => <MatchRow key={match.id} match={match} focusTeam={profileTeam} onTeamSelect={openTeam} />)}</section> : null}
      {profileMatches === 'results' && <section className="section-card team-match-section"><div className="section-heading"><div><span className="eyebrow">Latest first</span><h2>Previous results</h2></div><span>{past.length}</span></div>{past.length ? past.map((match) => <MatchRow key={match.id} match={match} focusTeam={profileTeam} onTeamSelect={openTeam} />) : <p className="empty-copy">No official result yet.</p>}</section>}
    </div>;
  };

  return <main className="app-shell">
    <div className="stadium-glow" aria-hidden="true" />
    <header className="topbar"><div className="brand"><ClubBadge size="small" team={favoriteClub} /><span><strong>ABSSA</strong><small>MATCHDAY</small></span></div><div className={`source-pill ${online && sourceLive !== false && !stale ? '' : 'offline'}`} aria-label={dataLabel} title={dataLabel}>{online && sourceLive !== false ? <Wifi /> : <WifiOff />}<span>{dataLabel}</span></div></header>
    <section className="club-switcher" aria-label="Selected club"><button className="club-identity" onClick={() => openTeam(favoriteClub)}><ClubBadge size="medium" team={favoriteClub} /><div><span>My club · tap for team page</span><strong>{favoriteClub}</strong></div><ChevronRight /></button><div className="club-switch-actions"><button className="switch-club-action" onClick={() => { setProfileTeam(null); setView('clubs'); }}>Switch club</button><div className="verified-chip"><CheckCircle2 /> Checked {checkedAt(snapshot.fetchedAt)}</div></div></section>
    <Tabs value={view} onValueChange={(value) => { setView(value as View); if (value !== 'clubs') setProfileTeam(null); }} className="content-tabs">
      <div className={`freshness-bar ${stale || sourceLive === false ? 'freshness-warning' : ''}`}><span>{sourceLive === null ? 'Checking the latest results…' : `${!online || sourceLive === false ? 'Saved copy' : stale ? 'Update overdue' : 'Last checked'} · ${checkedAt(snapshot.fetchedAt)}`}</span><button onClick={() => void refreshData()} disabled={refreshing} aria-label="Reload latest results"><RefreshCw className={refreshing ? 'spin' : ''} />{refreshing ? 'Checking' : 'Refresh'}</button></div>
      <div className="desktop-tabs-wrap"><TabsList variant="line" className="desktop-tabs">{nav.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><Icon />{label}</TabsTrigger>)}</TabsList><Button variant="ghost" size="sm" onClick={() => void refreshData()} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} />{refreshing ? 'Loading…' : 'Reload latest'}</Button></div>
      <TabsContent value="home" className="view-grid">
        {nextMatch ? <section className="next-match hero-card"><div className="hero-topline"><span className="eyebrow">Next official match</span><span className="matchday-badge"><CircleDot /> Matchday {nextMatch.round}</span></div><div className="hero-date"><CalendarDays /><span>{longDate(nextMatch)}</span><strong>{nextMatch.time}</strong></div><div className="scoreboard"><div className="side home-side"><button className="crest-button" onClick={() => openTeam(nextMatch.home)}><ClubBadge team={nextMatch.home} size="large" /><strong>{nextMatch.home}</strong></button><span>Home</span></div><div className="score-center"><span>VS</span><small>Division 4B</small></div><div className="side away-side"><button className="crest-button" onClick={() => openTeam(nextMatch.away)}><ClubBadge team={nextMatch.away} size="large" /><strong>{nextMatch.away}</strong></button><span>Away</span></div></div><div className="venue-bar"><div><CheckCircle2 /><span><strong>Verified against ABSSA</strong><small>Latest source check {checkedAt(snapshot.fetchedAt)}</small></span></div><a href={SOURCE_URL} target="_blank" rel="noreferrer">Official source <ChevronRight /></a></div><div className="hero-actions"><Button onClick={addCalendar}><CalendarDays />Add to calendar</Button><Button variant="outline" onClick={share}><Share2 />Share</Button></div></section> : <section className="next-match hero-card"><div className="hero-topline"><span className="eyebrow">No future fixture published</span></div></section>}
        <div className="right-stack"><Card className="summary-card result-card"><CardContent><div className="card-label"><span>Latest official result</span>{lastResult ? <span className={`outcome outcome-${outcome(lastResult, favoriteClub)}`}>{outcome(lastResult, favoriteClub)}</span> : null}</div>{lastResult ? <div className="result-line"><div><TeamButton team={lastResult.home} onSelect={openTeam} /><small>{shortDate(lastResult)} · {lastResult.time}</small></div><div className="score"><b>{lastResult.homeScore}</b><span>–</span><b>{lastResult.awayScore}</b></div><div className="align-right"><TeamButton team={lastResult.away} onSelect={openTeam} className="align-right" /><small>{lastResult.note || 'Full time'}</small></div></div> : <p>No official result yet.</p>}<button onClick={() => setView('results')} className="text-link">All Division 4B results <ChevronRight /></button></CardContent></Card><Card className="summary-card table-card"><CardContent><div className="card-label"><span>Division 4B</span><span>After {standing.played} played</span></div><div className="position"><strong>{standing.position}<span>{ordinalSuffix(standing.position)}</span></strong><div><b>{standing.points} {standing.points === 1 ? 'pt' : 'pts'}</b><small>{standing.won} wins · {standing.drawn} draws · {standing.lost} losses</small></div></div><button onClick={() => setView('table')} className="text-link">Full table <ChevronRight /></button></CardContent></Card></div>
        <section className="up-next section-card"><div className="section-heading"><div><span className="eyebrow">Coming up</span><h2>{favoriteClub} fixtures</h2></div><button onClick={() => setView('fixtures')}>View all <ChevronRight /></button></div>{clubFixtures.slice(1, 3).map((match) => <MatchRow key={match.id} match={match} focusTeam={favoriteClub} onTeamSelect={openTeam} />)}</section>
        <aside className="alert-card integrity-card"><div className="alert-icon"><CheckCircle2 /></div><div><strong>Every club is now explorable.</strong><span>Tap a team name anywhere to open its results, fixtures, form and table position.</span></div><button onClick={() => { setProfileTeam(null); setView('clubs'); }}>Browse clubs</button></aside>
      </TabsContent>
      <TabsContent value="fixtures" className="single-view"><div className="page-heading"><div><span className="eyebrow">ABSSA · {snapshot.season}</span><h1>{favoriteClub} fixtures</h1></div><button className="change-club" onClick={() => { setProfileTeam(null); setView('clubs'); }}>Change club <ChevronRight /></button></div><section className="section-card fixture-list">{clubFixtures.length ? clubFixtures.map((match) => <MatchRow key={match.id} match={match} focusTeam={favoriteClub} onTeamSelect={openTeam} />) : <p className="empty-copy">No future fixture is currently published by ABSSA.</p>}</section></TabsContent>
      <TabsContent value="results" className="single-view"><div className="page-heading"><div><span className="eyebrow">All teams · official scores</span><h1>Division 4B results</h1></div><span className="updated">{allResults.length} official results · latest first</span></div><div className="result-rounds">{resultRounds.map(([round, results]) => <section className="section-card result-list" key={round}><div className="result-round-heading"><span>Matchday {round}</span><small>{results.length} results</small></div>{results.map((result) => <ResultRow key={result.id} match={result} onTeamSelect={openTeam} />)}</section>)}</div></TabsContent>
      <TabsContent value="table" className="single-view"><div className="page-heading"><div><span className="eyebrow">Official ABSSA standings</span><h1>Division 4B</h1></div><span className="updated">Tap a club to open its match centre</span></div><p className="table-key">GF: goals for · GA: goals against · GD: goal difference</p><section className="section-card standings"><div className="table-head"><span>Pos</span><span>Club</span><span>P</span><span title="Goals for">GF</span><span title="Goals against">GA</span><span>GD</span><span>Pts</span></div>{snapshot.standings.map((row) => <button key={row.team} className={row.team === favoriteClub ? 'selected-row' : ''} onClick={() => openTeam(row.team)}><span>{row.position}</span><span><ClubBadge team={row.team} size="tiny" /><strong>{row.team}</strong></span><span>{row.played}</span><span>{row.goalsFor}</span><span>{row.goalsAgainst}</span><span>{row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}</span><b>{row.points}</b></button>)}</section></TabsContent>
      <TabsContent value="team" className="single-view"><Suspense fallback={<p role="status">Opening team space…</p>}><AttendancePanel /></Suspense></TabsContent>
      <TabsContent value="clubs" className="single-view clubs-view">{renderClubs()}</TabsContent>
    </Tabs>
    <nav className="mobile-nav" aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => { setView(id); setProfileTeam(null); window.scrollTo({ top: 0, behavior: 'instant' }); }}><Icon /><span>{label}</span></button>)}</nav>
  </main>;
}
