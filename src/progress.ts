import {useSyncExternalStore} from "react";
import {CONT,DATA,type ContinentName} from "./data";

/** Per-country level: 0 new, 1 learning, 2-3 mastered. Saved in localStorage. */
const KEY="capitals.progress.v1";
let prog:Record<string,number>={};
try{prog=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{/* ignore */}

let version=0;
const listeners=new Set<()=>void>();
const emit=()=>{version++;listeners.forEach(l=>l())};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(prog))}catch{/* ignore */}};

export const lvl=(k:string)=>prog[k]||0;
export const isMastered=(k:string)=>lvl(k)>=2;

export function record(k:string,ok:boolean){
  prog[k]=ok?Math.min(3,lvl(k)+1):Math.max(0,lvl(k)-1);
  save();emit();
}
export function resetProgress(){prog={};save();emit()}

export function stats(cn:ContinentName){
  const a=CONT[cn];
  const mastered=a.filter(d=>isMastered(d.k)).length;
  const learning=a.filter(d=>lvl(d.k)===1).length;
  const frac=a.reduce((s,d)=>s+lvl(d.k)/3,0)/a.length;
  return{total:a.length,mastered,learning,frac};
}
export function overall(){
  const mastered=DATA.filter(d=>isMastered(d.k)).length;
  const learning=DATA.filter(d=>lvl(d.k)===1).length;
  return{total:DATA.length,mastered,learning};
}

/** re-render when progress changes */
export function useProgress():number{
  return useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>version);
}
