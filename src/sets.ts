import {useSyncExternalStore} from "react";
import {ALL,ALL_CONT,CONT_NAMES,type ContinentName,type Country,type Scope} from "./data";

/**
 * Overall settings (the (i) panel on the main screen), shared by every quiz:
 *  - which countries count: UN members only (193), plus the two UN observers (195, default), or every state we have a map for (202)
 *  - whether transcontinental countries (Russia, Turkey...) also appear in the neighbouring continent
 */
export type CountrySet="un"|"obs"|"all";
export interface Settings{set:CountrySet;cross:boolean}

export const SET_INFO:Record<CountrySet,{total:number;label:string;short:string}>={
  un:{total:193,label:"UN members",short:"193"},
  obs:{total:195,label:"UN members + observers",short:"195"},
  all:{total:202,label:"All states",short:"202"},
};

/**
 * When a limited-recognition state is not in the chosen set, these fold into the country that claims
 * them (nobody but one neighbour recognises them). Everything else outside the set is greyed out.
 */
export const MERGE_INTO:Record<string,string>={Somaliland:"Somalia","Northern Cyprus":"Cyprus"};

/**
 * A transcontinental country keeps its home continent and, when the setting is on, also shows up in this one.
 * Only pairs where the country can really be tapped on that continent's map are listed (see tests/sets.test.ts).
 */
export const CROSS:Record<string,ContinentName>={
  Russia:"Asia",Turkey:"Europe",Cyprus:"Asia",Egypt:"Asia",Georgia:"Europe",Armenia:"Europe",Azerbaijan:"Europe",Indonesia:"Oceania",
};

const KEY="capitals.settings.v1";
const DEFAULT:Settings={set:"obs",cross:false};

const load=():Settings=>{
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||"null");
    if(raw&&(raw.set==="un"||raw.set==="obs"||raw.set==="all"))return{set:raw.set,cross:!!raw.cross};
  }catch{/* ignore */}
  return DEFAULT;
};

let st:Settings=load();
const listeners=new Set<()=>void>();
const memo=new Map<string,Country[]>();

export const getSettings=()=>st;
export function updateSettings(p:Partial<Settings>){
  st={...st,...p};
  try{localStorage.setItem(KEY,JSON.stringify(st))}catch{/* ignore */}
  listeners.forEach(l=>l());
}
export const subscribeSettings=(cb:()=>void)=>{listeners.add(cb);return()=>{listeners.delete(cb)}};
export const useSettings=():Settings=>useSyncExternalStore(subscribeSettings,getSettings);

export const inSet=(d:Country,set:CountrySet=st.set)=>set==="all"||d.tier==="un"||(set==="obs"&&d.tier==="obs");

/** countries a quiz covers: one continent (plus its transcontinental guests when that is on) or the whole world */
export function countriesIn(scope:Scope,s:Settings=st):Country[]{
  const key=`${s.set}|${s.cross}|${scope}`;
  let list=memo.get(key);
  if(!list){
    if(scope==="World")list=ALL.filter(d=>inSet(d,s.set));
    else{
      list=ALL_CONT[scope].filter(d=>inSet(d,s.set));
      if(s.cross)for(const cn of CONT_NAMES)for(const d of ALL_CONT[cn])if(CROSS[d.k]===scope&&inSet(d,s.set))list.push(d);
    }
    memo.set(key,list);
  }
  return list;
}

/** is the shape (a named country or an unnamed territory) part of the map area this quiz covers? */
export function shapeInScope(s:{n:string|null;cn:string|null},scope:Scope):boolean{
  if(scope==="World")return s.cn!=="Antarctica";
  if(s.cn===scope)return true;
  return st.cross&&!!s.n&&CROSS[s.n]===scope;
}
