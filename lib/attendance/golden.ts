export const GOLDEN_BASE='https://golden-boy-seven.vercel.app/sanserif-fc-r7vzcq';
export type GoldenPlayer={id:string;display_name:string;position:string;photo_url:string|null;source_checked_at:string};
export type GoldenLink={user_id:string;player_id:string};
export function goldenCardUrl(id:string) {
  if(!/^[1-9][0-9]{0,8}$/.test(id))throw new Error('Invalid player ID');
  return `${GOLDEN_BASE}/joueur/${id}`;
}
export function goldenPortrait(userId:string,players:GoldenPlayer[],links:GoldenLink[]) {
  const id=links.find(link=>link.user_id===userId)?.player_id;
  return players.find(player=>player.id===id)?.photo_url??undefined;
}
