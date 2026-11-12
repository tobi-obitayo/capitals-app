import {DEFAULT_CFG,type QuizCfg} from "./quiz";

export interface Prefs{
  tab:"learn"|"quiz";
  /** 0 flashcards · 1 multiple choice · 2 type it */
  mi:0|1|2;
  dir:"c2k"|"k2c";
  batch:string;
  cfg:QuizCfg;
}
const KEY="capitals.prefs.v1";
const DEFAULT:Prefs={tab:"learn",mi:0,dir:"c2k",batch:"all",cfg:DEFAULT_CFG};

export function loadPrefs():Prefs{
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||"null");
    if(raw)return{...DEFAULT,...raw,cfg:{...DEFAULT_CFG,...raw.cfg}};
  }catch{/* ignore */}
  return DEFAULT;
}
export function savePrefs(p:Prefs){try{localStorage.setItem(KEY,JSON.stringify(p))}catch{/* ignore */}}
