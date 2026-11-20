import {useEffect,useLayoutEffect,useMemo,useReducer,useRef,useState} from "react";
import type {Country,Scope} from "../data";
import type {World} from "../geo";
import {buildScene,drawFind,hitTest,insetAt,zoomView,type Scene,type View} from "../map/find";
import {useQuizClock,type QuizCfg,type QuizClock,type QuizResult,type Status} from "../quiz";
import {shuffle,TAP_SLOP} from "../util";
import {useWorld50} from "./DrillMap";
import {ClockPill} from "./ui";

interface Props{
  cn:Scope;
  cfg:QuizCfg;
  items:Country[];
  onFinish:(r:QuizResult)=>void;
  onExit:()=>void;
}

const FLASH_MS=800;
const QUIZ_BAR_FALLBACK=84;
const RESET_BTN=44;

/** Full-screen "tap the country" quiz on a pan/zoom map. */
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
  const hudRef=useRef<HTMLDivElement>(null);
  const screenRef=useRef<HTMLDivElement>(null);
  const topInset=useRef(QUIZ_BAR_FALLBACK);
  const [toastTop,setToastTop]=useState(92);
  const view=useRef<View>({k:1,tx:0,ty:0});
  const [zoomed,setZoomed]=useState(false);
  const syncZoomed=()=>{const v=view.current;setZoomed(v.k!==1||v.tx!==0||v.ty!==0)};
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

  /** the player tapped `name` (a country in this continent) */
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
    if(worldRef.current&&W>0){
      // phones: keep islands boxes out from under the floating "reset view" button
      // desktop world map: the zoom buttons (bottom left) stay clear of the boxes
      const reserved=W<=700?[{x:W-RESET_BTN-16,y:topInset.current,w:RESET_BTN+16,h:RESET_BTN+16}]
        :cn==="World"?[{x:0,y:H-176,w:76,h:176}]:undefined;
      scene.current=buildScene(worldRef.current,cn,W,H,{top:topInset.current,reserved,cover:true});
    }
    dirty.current=true;
  };
  const zoomAt=(px:number,py:number,nk:number)=>{
    view.current=zoomView(view.current,px,py,nk);
    dirty.current=true;
    syncZoomed();
  };
  const resetView=()=>{view.current={k:1,tx:0,ty:0};dirty.current=true;syncZoomed()};

  useLayoutEffect(()=>{
    const hud=hudRef.current;
    if(!hud)return;
    const measure=()=>{
      // offsetHeight is 0 before layout / in some test mocks — keep the fallback so the map isn't crushed
      const h=hud.offsetHeight,y=hud.offsetTop;
      const top=h>0?Math.ceil(y+h+8):QUIZ_BAR_FALLBACK;
      topInset.current=top;
      setToastTop(h>0?Math.ceil(y+h+10):92);
      layout();
    };
    const ro=new ResizeObserver(measure);ro.observe(hud);
    measure();
    return()=>ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cn,cfg.hard,answered]);

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

    const pointers=new Map<number,{x:number;y:number}>();
    let drag:{x:number;y:number;tx:number;ty:number;moved:boolean;onInset:boolean}|null=null;
    let pinch:{dist:number;k:number}|null=null;
    const pos=(e:PointerEvent|WheelEvent):[number,number]=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
    const midDist=()=>{
      const pts=[...pointers.values()];
      if(pts.length<2)return null;
      return{
        mid:[(pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2] as [number,number],
        dist:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),
      };
    };
    const down=(e:PointerEvent)=>{
      const [x,y]=pos(e);
      pointers.set(e.pointerId,{x,y});
      canvas.setPointerCapture(e.pointerId);
      if(pointers.size>=2){
        drag=null;canvas.classList.remove("panning");
        const m=midDist();
        if(m&&m.dist>0)pinch={dist:m.dist,k:view.current.k};
      }else{
        pinch=null;
        drag={x,y,tx:view.current.tx,ty:view.current.ty,moved:false,onInset:!!(scene.current&&insetAt(scene.current,x,y))};
      }
    };
    const move=(e:PointerEvent)=>{
      if(!pointers.has(e.pointerId))return;
      const [x,y]=pos(e);
      pointers.set(e.pointerId,{x,y});
      if(pointers.size>=2){
        const m=midDist();
        if(m&&pinch&&pinch.dist>0){
          if(scene.current&&insetAt(scene.current,m.mid[0],m.mid[1]))return;
          zoomAt(m.mid[0],m.mid[1],pinch.k*(m.dist/pinch.dist));
        }
        return;
      }
      if(!drag)return;
      if(!drag.onInset&&Math.hypot(x-drag.x,y-drag.y)>TAP_SLOP){drag.moved=true;canvas.classList.add("panning")}
      if(drag.moved){view.current={...view.current,tx:drag.tx+x-drag.x,ty:drag.ty+y-drag.y};dirty.current=true;syncZoomed()}
    };
    const up=(e:PointerEvent)=>{
      const wasClick=drag&&!drag.moved&&pointers.size<=1;
      pointers.delete(e.pointerId);
      if(pointers.size<2)pinch=null;
      if(pointers.size===1){
        const [id,p]=[...pointers.entries()][0];
        drag={x:p.x,y:p.y,tx:view.current.tx,ty:view.current.ty,moved:false,onInset:!!(scene.current&&insetAt(scene.current,p.x,p.y))};
        void id;
      }else{
        const click=wasClick;drag=null;canvas.classList.remove("panning");
        const wd=peek.current;
        if(click&&wd){const [x,y]=pos(e);const n=hit(wd,x,y);if(n)guessRef.current(n)}
      }
    };
    const cancel=(e:PointerEvent)=>{
      pointers.delete(e.pointerId);
      if(pointers.size<2)pinch=null;
      if(pointers.size===0){drag=null;canvas.classList.remove("panning")}
    };
    const wheel=(e:WheelEvent)=>{
      e.preventDefault();
      const [x,y]=pos(e);
      if(scene.current&&insetAt(scene.current,x,y))return;   // insets are already magnified
      zoomAt(x,y,view.current.k*Math.exp(-e.deltaY*.002));
    };
    canvas.addEventListener("pointerdown",down);
    canvas.addEventListener("pointermove",move);
    canvas.addEventListener("pointerup",up);
    canvas.addEventListener("pointercancel",cancel);
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
      canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",cancel);
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
    <div className="quiz-screen" ref={screenRef}>
      <canvas ref={canvasRef} className="qcanvas" aria-label={`Map of ${cn}. Tap the country you are asked to find.`}/>

      <div className="qhud" ref={hudRef} role="region" aria-label="Quiz status">
        <div className="qh-prompt">
          <span className="qh-kicker">Find</span>
          <span className="qh-target" aria-live="polite">{target?.k??"…"}</span>
        </div>
        <div className="qh-meta">
          <b>{progressLabel}</b>
          <span className="qh-ok">{okCount} correct</span>
          {cfg.hard&&<span className="badge">Hard</span>}
        </div>
        <ClockPill clock={clock} timerConfigured={cfg.timerOn}/>
        <button className="icon-btn qh-close" aria-label="Exit quiz without results" title="Exit quiz" onClick={onExit}>✕</button>
        <div className="qh-actions">
          <button className="btn small ghost" onClick={skip} title="Skip this country (counts as missed)">Skip<span className="kbd-only"><kbd>S</kbd></span></button>
          <button className="btn small danger" onClick={()=>finishRef.current("giveup")}>Give up</button>
        </div>
      </div>

      {toast&&<div className="qtoast" style={{top:toastTop}} role="status">{toast}</div>}

      {!world&&<div className="qloading">Loading map…</div>}

      <div className="zoom-tools">
        <button className="icon-btn" aria-label="Zoom in" onClick={()=>zoomAt(size.current.W/2,size.current.H/2,view.current.k*1.5)}>+</button>
        <button className="icon-btn" aria-label="Zoom out" onClick={()=>zoomAt(size.current.W/2,size.current.H/2,view.current.k/1.5)}>−</button>
        <button className="icon-btn" aria-label="Reset zoom" title="Reset view" onClick={resetView}>⌖</button>
      </div>
      {zoomed&&(
        <button className="icon-btn reset-view" style={{top:toastTop}} aria-label="Reset view" title="Reset view" onClick={resetView}>⌖</button>
      )}
      <div className="qhint">Drag to pan · pinch or scroll to zoom{scene.current&&scene.current.panels.length>1?" · small islands are in the boxes":""}</div>
    </div>
  );
}
