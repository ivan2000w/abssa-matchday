import {load} from 'cheerio';
import {GOLDEN_BASE} from '../attendance/golden';
export type ImportedGoldenPlayer={id:string;display_name:string;position:string;photo_url:string|null};
export function parseGoldenRoster(html:string):ImportedGoldenPlayer[] {
  if(!html.includes('</html>'))throw new Error('Incomplete Golden Squad response');
  const $=load(html);
  if($('title').text().trim()!=='Classement · Golden Squad')throw new Error('Golden Squad rankings page was not returned');
  const prefix=new URL(GOLDEN_BASE).pathname+'/joueur/';
  const players:ImportedGoldenPlayer[]=[];
  $(`a[href^="${prefix}"]`).each((_,element)=>{
    const row=$(element);const id=row.attr('href')!.slice(prefix.length);
    const display_name=row.find('[class*="__name"]').text().trim();
    const position=row.find('[class*="__position"]').text().trim();
    const photo_url=row.find('img').attr('src')??null;
    if(!/^[1-9][0-9]{0,8}$/.test(id)||display_name.length<2||display_name.length>100||position.length>20)throw new Error('Invalid player row');
    if(photo_url&&!/^https:\/\/6q9heyh4no23cgi4\.public\.blob\.vercel-storage\.com\/(?:teams\/1\/)?players\/[A-Za-z0-9_-]+\.(webp|png|jpe?g)$/.test(photo_url))throw new Error('Unexpected player photo source');
    players.push({id,display_name,position,photo_url});
  });
  if(players.length<25||players.length>100||new Set(players.map(p=>p.id)).size!==players.length)throw new Error('Incomplete or duplicated Golden Squad roster');
  return players;
}
