import {ALL} from "./data";
import {lvl,mergeProgress} from "./progress";
import {unlockWorld,worldUnlocked} from "./unlock";

/**
 * Copy code: your progress as one pasteable line, so it survives clearing the browser or moving to a new phone.
 * Nothing is uploaded and no account exists; the code is just country levels (0-3) and the World unlock.
 *
 *   CAP1-<base64url of: 1 flag byte, 3 bytes per country you have started, 2 checksum bytes>
 *
 * Countries are identified by a 22-bit hash of their name instead of a list position, so adding or
 * reordering countries later never scrambles old codes (tests/backup.test.ts guards against hash collisions).
 * A pasted code is untrusted input: strict prefix, size cap, checksum, and only known countries with levels 1-3 are applied.
 */
const PREFIX="CAP1-";
const MAX_CHARS=2000;                       // a full code for 202 countries is ~810 characters
const FLAG_WORLD=1;

const fnv=(s:string)=>{
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}
  return h>>>0;
};
export const countryId=(name:string)=>fnv(name)&0x3fffff;
const checksum=(b:number[])=>{
  let h=0x811c9dc5;
  for(const x of b){h^=x;h=Math.imul(h,0x01000193)}
  return (h>>>0)&0xffff;
};

const toB64=(b:number[])=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64=(s:string):number[]|null=>{
  try{
    const bin=atob(s.replace(/-/g,"+").replace(/_/g,"/"));
    return Array.from(bin,c=>c.charCodeAt(0));
  }catch{return null}
};

export interface Backup{levels:Map<string,number>;world:boolean}

/** pure: turn levels into a code */
export function encodeBackup(levelOf:(country:string)=>number,world:boolean):string{
  const bytes:number[]=[world?FLAG_WORLD:0];
  for(const d of ALL){
    const l=Math.min(3,Math.max(0,Math.floor(levelOf(d.k)||0)));
    if(!l)continue;
    const v=(countryId(d.k)<<2)|l;                 // 24 bits
    bytes.push((v>>>16)&255,(v>>>8)&255,v&255);
  }
  const c=checksum(bytes);
  bytes.push(c>>>8,c&255);
  return PREFIX+toB64(bytes);
}

export type DecodeResult={ok:true;backup:Backup;skipped:number}|{ok:false;error:string};
const BAD="That does not look like a Learn Capitals code. Copy it again in full.";

const byId=new Map(ALL.map(d=>[countryId(d.k),d.k]));

/** pure: read a code, never throws */
export function decodeBackup(text:string):DecodeResult{
  const t=text.replace(/\s+/g,"");
  if(!t)return{ok:false,error:"Paste a code first."};
  if(t.length>MAX_CHARS||!t.startsWith(PREFIX)||!/^[A-Za-z0-9_-]+$/.test(t.slice(PREFIX.length)))return{ok:false,error:BAD};
  const b=fromB64(t.slice(PREFIX.length));
  if(!b||b.length<3||(b.length-3)%3!==0||(b.length-3)/3>ALL.length)return{ok:false,error:BAD};
  const body=b.slice(0,-2),want=(b[b.length-2]<<8)|b[b.length-1];
  if(checksum(body)!==want)return{ok:false,error:"The code is damaged or cut short. Copy it again in full."};
  const levels=new Map<string,number>();
  let skipped=0;
  for(let i=1;i<body.length;i+=3){
    const v=(body[i]<<16)|(body[i+1]<<8)|body[i+2];
    const l=v&3,name=byId.get(v>>>2);
    if(!name||!l){skipped++;continue}
    levels.set(name,Math.max(l,levels.get(name)??0));
  }
  return{ok:true,backup:{levels,world:(body[0]&FLAG_WORLD)!==0},skipped};
}

/** the code for what is saved in this browser right now */
export const currentCode=()=>encodeBackup(lvl,worldUnlocked());

/** merge a code into this browser. Higher level wins per country, so restoring can never lower progress. */
export function restoreCode(text:string):{ok:true;updated:number}|{ok:false;error:string}{
  const r=decodeBackup(text);
  if(!r.ok)return r;
  const updated=mergeProgress(r.backup.levels);
  if(r.backup.world)unlockWorld();
  return{ok:true,updated};
}
