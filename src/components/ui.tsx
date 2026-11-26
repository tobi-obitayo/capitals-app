import {useRef,type ReactNode} from "react";
import {HourglassIcon,SettingsIcon,TimerIcon} from "lucide-react";
import {fmtTime} from "../util";
import {InfoPopover} from "./InfoPopover";
import type {QuizClock} from "../quiz";

export const InfoIcon=({size=16}:{size?:number})=>(
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="8" cy="8" r="6.6"/><path d="M8 7.2v4" strokeLinecap="round"/><circle cx="8" cy="4.9" r=".5" fill="currentColor"/>
  </svg>
);

export const GearIcon=()=><SettingsIcon size={20} strokeWidth={1.7} aria-hidden="true"/>;

/** (i) icon whose explanation shows on hover or keyboard focus */
export function Info({children,align="center",label="More info"}:{children:ReactNode;align?:"center"|"left"|"right";label?:string}){
  return(
    <span className={"info "+(align==="center"?"":align)} tabIndex={0} role="note" aria-label={label}>
      <InfoIcon/>
      <span className="tip">{children}</span>
    </span>
  );
}

export function Seg<T extends string|number>({value,options,onChange,full=false,label}:{
  value:T;options:{value:T;label:ReactNode;shortLabel?:ReactNode;disabled?:boolean;title?:string}[];
  onChange:(v:T)=>void;full?:boolean;label?:string;
}){
  return(
    <div className={"seg"+(full?" full":"")} role="group" aria-label={label}>
      {options.map(o=>(
        <button key={String(o.value)} type="button" aria-pressed={o.value===value} disabled={o.disabled}
          aria-label={typeof o.label==="string"?o.label:undefined}
          title={o.title??(typeof o.label==="string"?o.label:undefined)}
          onClick={()=>onChange(o.value)}>
          {o.shortLabel!=null
            ?<><span className="seg-long" aria-hidden="true">{o.label}</span><span className="seg-short" aria-hidden="true">{o.shortLabel}</span></>
            :o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({on,onChange,label}:{on:boolean;onChange:(v:boolean)=>void;label:string}){
  return(
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={()=>onChange(!on)}>
      <i/>
    </button>
  );
}

/** labelled setting; `note` is one quiet sentence of explanation (no hidden tooltips) */
export function Field({label,note,info,children}:{label:string;note?:ReactNode;/** explanation behind an (i) next to the label */info?:ReactNode;children:ReactNode}){
  return(
    <div className="field">
      <div className="lbl">{label}{info!=null&&<InfoPopover label={`About ${label.toLowerCase()}`}>{info}</InfoPopover>}</div>
      {children}
      {note&&<p className="note">{note}</p>}
    </div>
  );
}

export const Kbd=({children}:{children:ReactNode})=><kbd>{children}</kbd>;

/**
 * Countdown, or a stopwatch once the limit is off. Double-click (or double-tap) the clock to switch;
 * a single click does nothing, so a stray tap never drops the limit.
 */
export function ClockPill({clock,timerConfigured}:{clock:QuizClock;timerConfigured:boolean}){
  const low=clock.limitOn&&clock.remaining<=10;
  const lastTap=useRef(-Infinity);
  const cls="clock"+(low?" low":"")+(clock.limitOn?"":" off");
  const Icon=clock.limitOn?HourglassIcon:TimerIcon;
  const body=(
    <>
      <Icon size={16} strokeWidth={1.8} aria-hidden="true"/>
      <span className="t" aria-live="off">{clock.limitOn?fmtTime(clock.remaining):fmtTime(clock.elapsed)}</span>
    </>
  );
  if(!timerConfigured)return <div className={cls}>{body}</div>;
  // own double-tap timing: browsers differ on whether a double tap on a phone fires `dblclick`
  const tap=()=>{
    const now=performance.now();
    if(now-lastTap.current<400){lastTap.current=-Infinity;clock.toggleLimit()}
    else lastTap.current=now;
  };
  const what=clock.limitOn?"Countdown":"Stopwatch";
  return(
    <button type="button" className={cls+" switchable"} onClick={tap}
      aria-label={`${what} ${fmtTime(clock.limitOn?clock.remaining:clock.elapsed)}. Double-click to switch to the ${clock.limitOn?"stopwatch":"countdown"}.`}
      title={clock.limitOn?"Double-click for a stopwatch":"Double-click to bring the countdown back"}>
      {body}
    </button>
  );
}
