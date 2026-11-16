import {useEffect,useRef,useState} from "react";
import {dataByName,type Country} from "../data";
import {score,type ItemResult,type QuizResult} from "../quiz";
import {BAD_FILL,OK_FILL} from "../map/mini";
import {fmtTime} from "../util";
import {DrillMap} from "./DrillMap";
import {ModalShell} from "./ModalShell";

interface Props{
  result:QuizResult;
  onRetry:()=>void;
  onReview:(missed:Country[])=>void;
  onSetup:()=>void;
  onClose:()=>void;
}

const REASON={done:"Quiz complete",time:"Time's up",giveup:"You gave up"} as const;

function detail(r:QuizResult,it:ItemResult){
  if(it.status==="ok")return r.cfg.kind==="find"&&it.attempts===0?"First try":"";
  if(it.status==="unseen")return "Not reached";
  if(r.cfg.kind==="capital")return it.typed?`You typed “${it.typed}”`:"Skipped";
  if(it.attempts>0)return `${it.attempts} wrong tap${it.attempts>1?"s":""}`;
  return "Skipped";
}

/** Percentage, every answer (missed first) and the map in green and red. */
export function QuizResults({result,onRetry,onReview,onSetup,onClose}:Props){
  const {ok,total,pct}=score(result);
  const missed=result.items.filter(i=>i.status!=="ok");
  const got=result.items.filter(i=>i.status==="ok");
  const statusOf=new Map(result.items.map(i=>[i.k,i.status]));
  const fill=(n:string)=>statusOf.get(n)==="ok"?OK_FILL:statusOf.has(n)?BAD_FILL:"#FFFFFF";
  // tap/hover a row lifts its country on the map; map tap sticks the highlight
  const [hover,setHover]=useState<{k:string;from:"list"|"map"}|null>(null);
  const rows=useRef(new Map<string,HTMLLIElement>());
  useEffect(()=>{
    if(hover?.from==="map")rows.current.get(hover.k)?.scrollIntoView?.({block:"nearest",behavior:"smooth"});
  },[hover]);
  const kindName=result.cfg.kind==="find"?"Find the country":"Name the capital";

  const select=(k:string,from:"list"|"map")=>{
    setHover(h=>h?.k===k&&from==="list"?null:{k,from});
  };

  const row=(it:ItemResult)=>{
    const c=dataByName[it.k];
    const good=it.status==="ok";
    return(
      <li key={it.k} className={(good?"ok":"bad")+(hover?.k===it.k?" hot":"")} tabIndex={0}
        ref={el=>{if(el)rows.current.set(it.k,el);else rows.current.delete(it.k)}}
        onPointerEnter={e=>{if(e.pointerType!=="touch")setHover({k:it.k,from:"list"})}}
        onPointerLeave={e=>{if(e.pointerType!=="touch")setHover(h=>h?.k===it.k&&h.from==="list"?null:h)}}
        onClick={()=>select(it.k,"list")}
        onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(it.k,"list")}}}
        onFocus={()=>setHover({k:it.k,from:"list"})}
        onBlur={()=>setHover(h=>h?.k===it.k&&h.from==="list"?null:h)}>
        <span className="mk" aria-label={good?"Correct":"Missed"}>{good?"✓":"✗"}</span>
        <span className="who"><b>{c.k}</b><span className="cap">{c.c}</span></span>
        <span className="why">{detail(result,it)}</span>
      </li>
    );
  };

  return(
    <ModalShell title={`${result.cn} · ${kindName}`} sub="Results" onClose={onClose}
      right={(
        <DrillMap cn={result.cn} fill={fill} hl={null} emph={hover?.k??null}
          onHover={n=>setHover(n&&statusOf.has(n)?{k:n,from:"map"}:null)}>
          <div className="mlegend">
            <span><i className="sw" style={{background:OK_FILL}}/>Got it</span>
            <span><i className="sw" style={{background:BAD_FILL}}/>Missed</span>
          </div>
        </DrillMap>
      )}>
      <div className="done">
        <div className="eyebrow">{REASON[result.reason]}</div>
        <div className="pct">{pct}%</div>
        <div style={{color:"var(--muted)",fontSize:14}}>
          {ok} of {total} correct · {fmtTime(result.elapsed)}{result.cfg.hard&&result.cfg.kind==="find"?" · Hard mode":""}
        </div>
        <div className="resbar" aria-hidden="true">
          <i className="g" style={{width:`${ok/total*100}%`}}/><i className="r" style={{width:`${(total-ok)/total*100}%`}}/>
        </div>
      </div>

      <div className="reslist">
        {missed.length>0&&(
          <>
            <h4>Missed ({missed.length})</h4>
            <ul>{missed.map(row)}</ul>
          </>
        )}
        {got.length>0&&(
          <>
            <h4>Got it ({got.length})</h4>
            <ul>{got.map(row)}</ul>
          </>
        )}
      </div>

      <div className="stack">
        {missed.length>0&&(
          <button className="btn" autoFocus onClick={()=>onReview(missed.map(m=>dataByName[m.k]))}>Review missed ({missed.length})</button>
        )}
        <div className="row2">
          <button className="btn ghost" autoFocus={missed.length===0} onClick={onRetry}>Try again</button>
          <button className="btn ghost" onClick={onSetup}>Quiz settings</button>
        </div>
        <button className="btn plain" onClick={onClose}>Back to map</button>
      </div>
    </ModalShell>
  );
}
