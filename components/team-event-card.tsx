import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { ClubBadge } from './club-badge';
import { eventClubs } from '@/lib/attendance/event-clubs';
import type { TeamEvent } from '@/lib/attendance/client';

const format = (value:string, options:Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB',{...options,timeZone:'Europe/Brussels'}).format(new Date(value));
export function EventIdentity({event}:{event:TeamEvent}) {
  const clubs=eventClubs(event.title);
  return clubs ? <div className="event-matchup" aria-label={event.title}>
    <div><ClubBadge team={clubs[0]} size="large"/><strong>{clubs[0]}</strong></div>
    <span className="event-versus">vs</span>
    <div><ClubBadge team={clubs[1]} size="large"/><strong>{clubs[1]}</strong></div>
  </div> : <div className="event-gathering"><ClubBadge team="SANSERIF FC"/><h2>{event.title}</h2></div>;
}
export function TeamEventCard({event,onSelect}:{event:TeamEvent;onSelect:()=>void}) {
  const clubs=eventClubs(event.title);
  return <button className={`attendance-event event-card ${clubs?'event-card-match':'event-card-gathering'}`} onClick={onSelect}>
    <div className="event-card-top"><span><CalendarDays size={15}/>{format(event.starts_at,{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span><strong>{format(event.starts_at,{hour:'2-digit',minute:'2-digit'})}</strong></div>
    <EventIdentity event={event}/>
    <p className="event-card-location"><MapPin size={14}/>{event.location||'Venue not published'}</p>
    <div className="event-card-footer"><span>{event.status==='scheduled'?'Availability & squad':event.status==='cancelled'?'Cancelled':'Awaiting calendar confirmation'}</span><ChevronRight size={17}/></div>
  </button>;
}
