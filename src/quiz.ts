import {useEffect,useRef,useState,useCallback} from "react";
import {CONT_NAMES,type ContinentName} from "./data";

export type QuizKind="find"|"capital";

export interface QuizCfg{
  kind:QuizKind;
  timerOn:boolean;
  seconds:number;
  /** find-the-country: one try per country */
  hard:boolean;
  /** name-the-capital: forgive small typos */
  spell:boolean;
}
export const DEFAULT_CFG:QuizCfg={kind:"find",timerOn:true,seconds:300,hard:false,spell:true};
export const TIMER_PRESETS=[60,120,300,600];

/** every continent has Find-the-country and Name-the-capital quizzes */
export const QUIZ_CONTINENTS:ContinentName[]=[...CONT_NAMES];

export type Status="ok"|"bad";
export interface ItemResult{k:string;status:Status|"unseen";attempts:number;typed?:string}
export interface QuizResult{
  cn:ContinentName;
  cfg:QuizCfg;
  items:ItemResult[];
  reason:"done"|"time"|"giveup";
  elapsed:number;
}

export function score(r:QuizResult){
  const ok=r.items.filter(i=>i.status==="ok").length;
  const total=r.items.length;
  return{ok,total,pct:total?Math.round(ok/total*100):0};
}

/**
 * Quiz clock. `elapsed` always runs. The countdown only consumes time while the limit is on,
 * so switching it off mid-quiz lifts the limit and switching it back on resumes where it left off.
 */
export function useQuizClock(cfg:Pick<QuizCfg,"timerOn"|"seconds">,onExpire:()=>void){
  const [,force]=useState(0);
  const st=useRef({elapsed:0,consumed:0,last:performance.now(),limitOn:cfg.timerOn,stopped:false});
  const expire=useRef(onExpire);
  expire.current=onExpire;
  const limit=cfg.seconds*1000;

  useEffect(()=>{
    st.current.last=performance.now();
    const id=setInterval(()=>{
      const s=st.current;if(s.stopped)return;
      const now=performance.now(),dt=now-s.last;s.last=now;
      s.elapsed+=dt;if(s.limitOn)s.consumed+=dt;
      force(n=>n+1);
      if(s.limitOn&&s.consumed>=limit){s.stopped=true;expire.current()}
    },200);
    return()=>clearInterval(id);
  },[limit]);

  const stop=useCallback(()=>{st.current.stopped=true;return st.current.elapsed/1000},[]);
  const toggleLimit=useCallback(()=>{st.current.limitOn=!st.current.limitOn;force(n=>n+1)},[]);
  const s=st.current;
  return{
    limitOn:s.limitOn,
    remaining:Math.max(0,(limit-s.consumed)/1000),
    elapsed:s.elapsed/1000,
    stop,toggleLimit,
  };
}
export type QuizClock=ReturnType<typeof useQuizClock>;
