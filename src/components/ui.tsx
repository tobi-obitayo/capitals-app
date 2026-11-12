import type {ReactNode} from "react";
import {fmtTime} from "../util";
import type {QuizClock} from "../quiz";

export const InfoIcon=({size=16}:{size?:number})=>(
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="8" cy="8" r="6.6"/><path d="M8 7.2v4" strokeLinecap="round"/><circle cx="8" cy="4.9" r=".5" fill="currentColor"/>
  </svg>
);

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
  value:T;options:{value:T;label:ReactNode;disabled?:boolean;title?:string}[];onChange:(v:T)=>void;full?:boolean;label?:string;
}){
  return(
    <div className={"seg"+(full?" full":"")} role="group" aria-label={label}>
      {options.map(o=>(
        <button key={String(o.value)} type="button" aria-pressed={o.value===value} disabled={o.disabled} title={o.title}
          onClick={()=>onChange(o.value)}>{o.label}</button>
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
export function Field({label,note,children}:{label:string;note?:ReactNode;children:ReactNode}){
  return(
    <div className="field">
      <div className="lbl">{label}</div>
      {children}
      {note&&<p className="note">{note}</p>}
    </div>
  );
}

export const Kbd=({children}:{children:ReactNode})=><kbd>{children}</kbd>;

/** countdown (or count-up when the limit is off) with a button that turns the limit off/on */
export function ClockPill({clock,timerConfigured}:{clock:QuizClock;timerConfigured:boolean}){
  const low=clock.limitOn&&clock.remaining<=10;
  return(
    <div className={"clock"+(low?" low":"")+(clock.limitOn?"":" off")}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="9" r="5.2"/><path d="M8 6.2V9l1.8 1.2M6.3 1.8h3.4"/>
      </svg>
      <span className="t" aria-live="off">{clock.limitOn?fmtTime(clock.remaining):fmtTime(clock.elapsed)}</span>
      {timerConfigured&&(
        <button type="button" className="clock-toggle" onClick={clock.toggleLimit} aria-pressed={clock.limitOn}
          title={clock.limitOn?"Turn the time limit off":"Turn the time limit back on"}>
          {clock.limitOn?"Limit on":"No limit"}
        </button>
      )}
    </div>
  );
}
