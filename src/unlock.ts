import {useSyncExternalStore} from "react";
import {overall,subscribeProgress} from "./progress";
import {subscribeSettings} from "./sets";

/**
 * The World quiz starts locked. It opens once 80% of the countries in the chosen set are mastered,
 * or when the hidden circle on Elephant Island (globe, Antarctic Peninsula) is tapped. Once open it stays open.
 */
export const WORLD_UNLOCK_AT=.8;
const KEY="capitals.unlock.v1";

const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null")?.world===true}catch{return false}};
let flag=load();
const listeners=new Set<()=>void>();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({world:flag}))}catch{/* ignore */}};
const emit=()=>listeners.forEach(l=>l());

const reached=()=>{const o=overall();return o.total>0&&o.mastered/o.total>=WORLD_UNLOCK_AT};
/** pure: safe to call while rendering */
export const worldUnlocked=()=>flag||reached();

/** remember the unlock (returns true only the first time) */
export function unlockWorld():boolean{
  if(flag)return false;
  flag=true;save();emit();
  return true;
}
/** tests only: lock again */
export function lockWorld(){flag=false;save();emit()}

// reaching 80% (or a smaller set making it easier) is remembered, so later changes can't lock World again
const latch=()=>{if(!flag&&reached()){flag=true;save()}};
subscribeProgress(latch);
subscribeSettings(latch);
latch();

const subscribe=(cb:()=>void)=>{
  listeners.add(cb);
  const a=subscribeProgress(cb),b=subscribeSettings(cb);
  return()=>{listeners.delete(cb);a();b()};
};
export const useWorldUnlocked=():boolean=>useSyncExternalStore(subscribe,worldUnlocked);
