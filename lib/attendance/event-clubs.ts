import { clubIdentities } from '../abssa/clubs';

const normalize = (name:string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const aliases:Record<string,string> = Object.fromEntries(Object.keys(clubIdentities).map(name=>[normalize(name),name]));
// Exact variants observed in the team's SportEasy calendar; never fuzzy-match
// another reserve side or turn a social/training event into a fixture.
for (const [alias,club] of Object.entries({
  'Cosmos Bruwolf 1':'COSMOS BRUWOLF MJ 1',
  'Friends Spirit':'FRIENDS SPIRIT AUD',
  'Bleu-Blanc Entr.':'BLEU-BLANC (ENT)R.',
})) aliases[normalize(alias)]=club;

export function eventClubs(title:string):[string,string]|null {
  const clean=title.replace(/\s+[-–—]\s+ABSSA\s*$/i,'').trim();
  const parts=clean.split(/\s+[-–—/]\s+|\s+vs\.?\s+/i);
  if(parts.length!==2)return null;
  const [first,second]=parts.map(name=>aliases[normalize(name)]);
  return first&&second&&first!==second?[first,second]:null;
}
