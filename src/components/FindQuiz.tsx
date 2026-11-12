import {useEffect,useMemo,useReducer,useRef,useState} from "react";
import type {ContinentName,Country} from "../data";
import type {World} from "../geo";
import {buildScene,drawFind,hitTest,insetAt,zoomView,type Scene,type View} from "../map/find";
import {useQuizClock,type QuizCfg,type QuizClock,type QuizResult,type Status} from "../quiz";
import {shuffle} from "../util";
import {useWorld50} from "./DrillMap";
import {ClockPill} from "./ui";

interface Props{
  cn:ContinentName;
  cfg:QuizCfg;
  items:Country[];
  onFinish:(r:QuizResult)=>void;
  onExit:()=>void;
}

const FLASH_MS=800;
const QUIZ_BAR=84;   // px reserved at the top for the quiz bar

/** Full-screen "click the country" quiz on a pan/zoom map. */
export function FindQuiz({cn,cfg,items,onFinish,onExit}:Props){
  const world=useWorld50();
  const [order]=useState(()=>shuffle(items));
  const [,force]=useReducer((n:number)=>n+1,0);
  const idx=useRef(0);
  const status=useRef<Record<string,Status>>({});
  const attempts=useRef<Record<string,number>>({});
  const flash=useRef<{name:string;t0:number}|null>(null);
  const finished=useRef(false);
  const [toast,setToast]=useState<string|null>(null);
  const toastTimer=useRef<number>(0);

  const canvasRef=useRef<HTMLCanvasElement>(null);
  const view=useRef<View>({k:1,tx:0,ty:0});
  const dirty=useRef(true);
  const size=useRef({W:0,H:0});

  /* ---------- finishing ---------- */
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
      items:items.map(c=>({k:c.k,status:status.current[c.k]??"unseen",attempts:attempts.current[c.k]??0})),
    });
  };

  const target=order[idx.current] as Country|undefined;
  const answered=Object.keys(status.current).length;
  const okCount=Object.values(status.current).filter(s=>s==="ok").length;

  const advance=()=>{
    idx.current+=1;
    if(idx.current>=order.length)finishRef.current("done");
    force();dirty.current=true;
  };
  const say=(msg:string)=>{
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current=window.setTimeout(()=>setToast(null),1800);
  };
  const skip=()=>{
    if(!target||finished.current)return;
    status.current[target.k]="bad";
    advance();
  };

  /** the player clicked `name` (a country in this continent) */
  const guess=(name:string)=>{
    if(!target||finished.current)return;
    if(name===target.k){
      status.current[target.k]=(attempts.current[target.k]??0)>0?"bad":"ok";
      advance();return;
    }
    attempts.current[target.k]=(attempts.current[target.k]??0)+1;
    flash.current={name,t0:performance.now()};dirty.current=true;
    if(cfg.hard){
      status.current[target.k]="bad";
      say(`That's ${name}. ${target.k} marked as missed.`);
      advance();
    }else{
      say(`That's ${name}. Keep looking.`);
      force();
    }
  };
  const guessRef=useRef(guess);guessRef.current=guess;

  /* ---------- projection with pan/zoom ---------- */
  const scene=useRef<Scene|null>(null);
  const layout=()=>{
    const {W,H}=size.current;
    if(worldRef.current&&W>0)scene.current=buildScene(worldRef.current,cn,W,H,{top:QUIZ_BAR});
    dirty.current=true;
  };
  const zoomAt=(px:number,py:number,nk:number)=>{
    view.current=zoomView(view.current,px,py,nk);
    dirty.current=true;
  };

  /* ---------- draw + input ---------- */
  useEffect(()=>{
    const canvas=canvasRef.current!,ctx=canvas.getContext("2d")!;
    let raf=0,alive=true,dpr=1;
    const resize=()=>{
      const r=canvas.getBoundingClientRect();
      size.current={W:r.width,H:r.height};dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
      layout();
    };
    const draw=(wd:World)=>{
      const sc=scene.current;if(!sc)return;
      dirty.current=false;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const f=flash.current,fa=f?1-(performance.now()-f.t0)/FLASH_MS:0;
      drawFind(ctx,wd,sc,view.current,status.current,f&&fa>0?{name:f.name,alpha:fa}:null);
    };
    const hit=(wd:World,x:number,y:number):string|null=>{
      const sc=scene.current;
      return sc?hitTest(wd,sc,view.current,x,y):null;
    };

    let drag:{x:number;y:number;tx:number;ty:number;moved:boolean;onInset:boolean}|null=null;
    const pos=(e:PointerEvent|WheelEvent):[number,number]=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
    const down=(e:PointerEvent)=>{
      const [x,y]=pos(e);
      drag={x,y,tx:view.current.tx,ty:view.current.ty,moved:false,onInset:!!(scene.current&&insetAt(scene.current,x,y))};
      canvas.setPointerCapture(e.pointerId);
    };
    const move=(e:PointerEvent)=>{
      if(!drag)return;
      const [x,y]=pos(e);
      if(!drag.onInset&&Math.hypot(x-drag.x,y-drag.y)>5){drag.moved=true;canvas.classList.add("panning")}
      if(drag.moved){view.current={...view.current,tx:drag.tx+x-drag.x,ty:drag.ty+y-drag.y};dirty.current=true}
    };
    const up=(e:PointerEvent)=>{
      if(!drag)return;
      const wasClick=!drag.moved;drag=null;canvas.classList.remove("panning");
      const wd=peek.current;
      if(wasClick&&wd){const [x,y]=pos(e);const n=hit(wd,x,y);if(n)guessRef.current(n)}
    };
    const wheel=(e:WheelEvent)=>{
      e.preventDefault();
      const [x,y]=pos(e);
      if(scene.current&&insetAt(scene.current,x,y))return;   // insets are already magnified
      zoomAt(x,y,view.current.k*Math.exp(-e.deltaY*.002));
    };
    canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);
    canvas.addEventListener("wheel",wheel,{passive:false});
    const ro=new ResizeObserver(resize);ro.observe(canvas);
    resize();

    const peek={current:null as World|null};
    const loop=()=>{
      if(!alive)return;
      peek.current=worldRef.current;
      const f=flash.current;
      if(f){if(performance.now()-f.t0>FLASH_MS)flash.current=null;dirty.current=true}
      if(dirty.current&&peek.current)draw(peek.current);
      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{
      alive=false;cancelAnimationFrame(raf);ro.disconnect();
      canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);
      canvas.removeEventListener("wheel",wheel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cn]);
  const worldRef=useRef<World|null>(null);
  worldRef.current=world;
  useEffect(()=>{layout()},[world]); // eslint-disable-line react-hooks/exhaustive-deps

  /* keys: S skip, + / - zoom */
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      if(e.key==="s"||e.key==="S")skip();
      else if(e.key==="+"||e.key==="=")zoomAt(size.current.W/2,size.current.H/2,view.current.k*1.5);
      else if(e.key==="-"||e.key==="_")zoomAt(size.current.W/2,size.current.H/2,view.current.k/1.5);
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  });
  useEffect(()=>()=>window.clearTimeout(toastTimer.current),[]);

  const total=order.length;
  const progressLabel=useMemo(()=>`${Math.min(answered+1,total)} / ${total}`,[answered,total]);

  return(
    <div className="quiz-screen">
      <canvas ref={canvasRef} className="qcanvas" aria-label={`Map of ${cn}. Click the country you are asked to find.`}/>

      <div className="qhud" role="region" aria-label="Quiz status">
        <div className="qh-prompt">
          <span className="qh-kicker">Find</span>
          <span className="qh-target" aria-live="polite">{target?.k??"…"}</span>
        </div>
        <div className="qh-meta">
          <b>{progressLabel}</b>
          <span>{okCount} correct</span>
          {cfg.hard&&<span className="badge">Hard</span>}
        </div>
        <ClockPill clock={clock} timerConfigured={cfg.timerOn}/>
        <div className="qh-actions">
          <button className="btn small ghost" onClick={skip} title="Skip this country (counts as missed)">Skip<kbd>S</kbd></button>
          <button className="btn small danger" onClick={()=>finishRef.current("giveup")}>Give up</button>
          <button className="icon-btn" aria-label="Exit quiz without results" title="Exit quiz" onClick={onExit}>✕</button>
        </div>
      </div>

      {toast&&<div className="qtoast" role="status">{toast}</div>}

      {!world&&<div className="qloading">Loading map…</div>}

      <div className="zoom-tools">
        <button className="icon-btn" aria-label="Zoom in" onClick={()=>zoomAt(size.current.W/2,size.current.H/2,view.current.k*1.5)}>+</button>
        <button className="icon-btn" aria-label="Zoom out" onClick={()=>zoomAt(size.current.W/2,size.current.H/2,view.current.k/1.5)}>−</button>
        <button className="icon-btn" aria-label="Reset zoom" title="Reset view" onClick={()=>zoomAt(0,0,1)}>⌖</button>
      </div>
      <div className="qhint">Drag to pan · scroll to zoom{scene.current&&scene.current.panels.length>1?" · small islands are in the boxes":""}</div>
    </div>
  );
}
