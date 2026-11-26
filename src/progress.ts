import {useSyncExternalStore} from "react";
import {type Scope} from "./data";
import {countriesIn,getSettings,subscribeSettings} from "./sets";

/** Per-country level: 0 new, 1 learning, 2-3 mastered. Saved in localStorage. */
const KEY="capitals.progress.v1";
let prog:Record<string,number>={};
try{prog=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{/* ignore */}

let version=0;
const listeners=new Set<()=>void>();
const emit=()=>{version++;listeners.forEach(l=>l())};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(prog))}catch{/* ignore */}};

export const subscribeProgress=(cb:()=>void)=>{listeners.add(cb);return()=>{listeners.delete(cb)}};

export const lvl=(k:string)=>prog[k]||0;
export const isMastered=(k:string)=>lvl(k)>=2;

export function record(k:string,ok:boolean){
  prog[k]=ok?Math.min(3,lvl(k)+1):Math.max(0,lvl(k)-1);
  save();emit();
}
export function resetProgress(){prog={};save();emit()}
/** raise levels from a restored backup (never lowers one); returns how many countries changed. Callers pass only known country names. */
export function mergeProgress(levels:ReadonlyMap<string,number>):number{
  let n=0;
  for(const[k,v] of levels)if(v>lvl(k)){prog[k]=Math.min(3,v);n++}
  if(n){save();emit()}
  return n;
}

export function stats(cn:Scope){
  const a=countriesIn(cn);
  const mastered=a.filter(d=>isMastered(d.k)).length;
  const learning=a.filter(d=>lvl(d.k)===1).length;
  const frac=a.reduce((s,d)=>s+lvl(d.k)/3,0)/a.length;
  return{total:a.length,mastered,learning,frac};
}
export function overall(){
  const a=countriesIn("World");
  const mastered=a.filter(d=>isMastered(d.k)).length;
  const learning=a.filter(d=>lvl(d.k)===1).length;
  return{total:a.length,mastered,learning};
}

/** re-render when progress or the country settings change (both change the numbers) */
const SET_CODE={un:0,obs:1,all:2} as const;
const snapshot=()=>{const st=getSettings();return version*8+SET_CODE[st.set]*2+(st.cross?1:0)};
const subscribe=(cb:()=>void)=>{listeners.add(cb);const off=subscribeSettings(cb);return()=>{listeners.delete(cb);off()}};
export function useProgress():number{
  return useSyncExternalStore(subscribe,snapshot);
}
