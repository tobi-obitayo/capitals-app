import {useEffect,useReducer,useRef,useState} from "react";
import type {ContinentName,Country} from "../data";
import {record} from "../progress";
import {useQuizClock,type ItemResult,type QuizCfg,type QuizClock,type QuizResult} from "../quiz";
import {autoMatches,checkAnswer,shuffle} from "../util";
import {ModalShell} from "./ModalShell";
import {ClockPill} from "./ui";

interface Props{
  cn:ContinentName;
  cfg:QuizCfg;
  items:Country[];
  onFinish:(r:QuizResult)=>void;
  onExit:()=>void;
}

/** Timed "type the capital" quiz. No map — typing is hard enough on a phone. */
export function CapitalQuiz({cn,cfg,items,onFinish,onExit}:Props){
  const [order]=useState(()=>shuffle(items));
  const [i,setI]=useState(0);
  const iRef=useRef(0);iRef.current=i;
  const [,force]=useReducer((n:number)=>n+1,0);
  const res=useRef<Record<string,ItemResult>>({});
  const [fb,setFb]=useState<{ok:boolean;close:boolean;skipped:boolean}|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const finished=useRef(false);

  const clockRef=useRef<QuizClock|null>(null);
  const finishRef=useRef<(r:QuizResult["reason"])=>void>(()=>{});
  const clock=useQuizClock(cfg,()=>finishRef.current("time"));
  clockRef.current=clock;
  finishRef.current=(reason)=>{
    if(finished.current)return;
    finished.current=true;
    const elapsed=clockRef.current?.stop()??0;
    onFinish({
      cn,cfg,reason,elapsed,
      items:items.map(c=>res.current[c.k]??{k:c.k,status:"unseen",attempts:0}),
    });
  };

  const q=order[i] as Country|undefined;
  const okCount=Object.values(res.current).filter(r=>r.status==="ok").length;

  /** keep the soft keyboard up across correct answers */
  const keepTyping=(clear:boolean)=>{
    const el=inputRef.current;
    if(!el)return;
    if(clear)el.value="";
    el.disabled=false;
    el.focus({preventScroll:true});
  };

  const advanceCorrect=()=>{
    const next=iRef.current+1;
    if(next>=order.length){finishRef.current("done");return}
    setI(next);setFb(null);force();
    // sync clear+focus before paint so iOS doesn't dismiss the keyboard
    keepTyping(true);
    requestAnimationFrame(()=>keepTyping(false));
  };

  const grade=()=>{
    if(!q||fb||finished.current)return;
    const typed=inputRef.current?.value??"";
    const r=checkAnswer([q.c,...q.ac],typed,cfg.spell);
    if(r.empty)return;
    res.current[q.k]={k:q.k,status:r.ok?"ok":"bad",attempts:1,typed:typed.trim()};
    record(q.k,r.ok);
    if(r.ok){advanceCorrect();return}
    setFb({ok:false,close:r.close,skipped:false});
  };
  const submit=(e:React.FormEvent)=>{e.preventDefault();grade()};
  /** spell check off: accept the moment the typed text is exactly right */
  const onTyping=(e:React.ChangeEvent<HTMLInputElement>)=>{
    if(q&&!cfg.spell&&!fb&&autoMatches([q.c,...q.ac],e.target.value))grade();
  };
  const skip=()=>{
    if(!q||fb||finished.current)return;
    res.current[q.k]={k:q.k,status:"bad",attempts:0,typed:""};
    record(q.k,false);
    setFb({ok:false,close:false,skipped:true});
  };
  const next=()=>{
    if(i+1>=order.length){finishRef.current("done");return}
    setI(i+1);setFb(null);force();
    keepTyping(true);
    requestAnimationFrame(()=>keepTyping(false));
  };

  useEffect(()=>{
    if(!fb)keepTyping(false);
  },[i,fb]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      if((e.target as HTMLElement).tagName==="INPUT")return;
      if(fb&&(e.key===" "||e.key==="Enter")){e.preventDefault();next()}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  });

  return(
    <ModalShell title={`${cn} · Name the capital`} dismissOnBackdrop={false} hideMap
      sub={cfg.spell?"Spell check on":"Spell check off · checks as you type"} onClose={onExit}
      right={null}>
      <div className="run-top">
        <div className="prog"><i style={{width:`${i/order.length*100}%`}}/></div>
        <span className="count">{i+1} / {order.length}</span>
      </div>
      <div className="clock-row">
        <ClockPill clock={clock} timerConfigured={cfg.timerOn}/>
        <span className="qscore">{okCount} correct</span>
      </div>

      {q&&(
        <>
          <div className="q">
            <div className="kind">Capital of</div>
            <h3>{q.k}</h3>
          </div>
          <form className="stack" onSubmit={submit}>
            <input ref={inputRef} type="text" readOnly={!!fb} placeholder="Type the capital…"
              autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next"
              inputMode="text" onChange={onTyping}/>
            {fb&&(
              <div className={"fb "+(fb.ok?"ok":"bad")}>
                {fb.skipped?"Skipped. ":""}The answer is <b>{q.c}</b>
              </div>
            )}
            {fb
              ?<button type="button" className="btn" onClick={next}>{i+1>=order.length?"Finish":"Next"}<span className="kbd-only"><kbd>↵</kbd></span></button>
              :<button type="submit" className="btn">Check<span className="kbd-only"><kbd>↵</kbd></span></button>}
          </form>
        </>
      )}

      <div className="quiz-foot sticky-foot">
        <button className="btn small ghost" onClick={skip} disabled={!!fb}>Skip</button>
        <button className="btn small danger" onClick={()=>finishRef.current("giveup")}>Give up</button>
      </div>
    </ModalShell>
  );
}
