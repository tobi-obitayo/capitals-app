import {useEffect,useRef,useState} from "react";
import {loadWorld50,peekWorld50,type World} from "../geo";
import {drawMini,hitMini,sceneFor} from "../map/mini";
import type {Scene} from "../map/scene";
import type {ContinentName} from "../data";

export function useWorld50():World|null{
  const [w,setW]=useState<World|null>(peekWorld50());
  useEffect(()=>{
    let alive=true;
    if(!w)loadWorld50().then(x=>{if(alive)setW(x)});
    return()=>{alive=false};
  },[w]);
  return w;
}

interface Props{
  cn:ContinentName;
  fill:(name:string)=>string;
  hl:string|null;
  /** country lifted out of the map (hovered in a list) */
  emph?:string|null;
  /** called with the country under the pointer (or null) when it changes */
  onHover?:(name:string|null)=>void;
  /** tap/click on the map (setup: collapse menus) */
  onTap?:()=>void;
  children?:React.ReactNode;
}

/** continent map used in the drill, quiz and results panes: fills the pane, with boxed insets for tiny islands */
export function DrillMap({cn,fill,hl,emph=null,onHover,onTap,children}:Props){
  const wrap=useRef<HTMLDivElement>(null);
  const cv=useRef<HTMLCanvasElement>(null);
  const world=useWorld50();
  const latest=useRef({cn,fill,hl,emph,world,legend:!!children});
  latest.current={cn,fill,hl,emph,world,legend:!!children};
  const sceneRef=useRef<{key:string;scene:Scene}|null>(null);
  const lastHover=useRef<string|null>(null);
  const tap=useRef<{x:number;y:number}|null>(null);

  const paint=()=>{
    const el=wrap.current,canvas=cv.current,{world:wd,cn:c,fill:f,hl:h,emph:e,legend}=latest.current;
    if(!el||!canvas||!wd)return;
    const r=el.getBoundingClientRect();
    if(r.width<20||r.height<20)return;
    const ratio=Math.min(devicePixelRatio||1,2);
    const W=Math.round(r.width*ratio),H=Math.round(r.height*ratio);
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
    const ctx=canvas.getContext("2d")!;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    // the scene (projection + inset placement) only changes with size, continent and legend
    const key=`${c}|${Math.round(r.width)}|${Math.round(r.height)}|${legend}`;
    if(sceneRef.current?.key!==key){
      const reserved=legend?[{x:0,y:r.height-64,w:Math.min(r.width,400),h:64}]:[];
      sceneRef.current={key,scene:sceneFor(wd,r.width,r.height,{cn:c,reserved})};
    }
    drawMini(ctx,r.width,r.height,wd,{cn:c,fill:f,hl:h,emph:e},sceneRef.current.scene);
  };

  // repaint after every render (cheap) and on resize
  useEffect(paint);
  useEffect(()=>{
    const ro=new ResizeObserver(paint);
    ro.observe(wrap.current!);
    return()=>ro.disconnect();
  },[]);

  const move=(e:React.PointerEvent)=>{
    if(!onHover)return;
    const sc=sceneRef.current?.scene,wd=latest.current.world;
    if(!sc||!wd)return;
    const r=wrap.current!.getBoundingClientRect();
    const n=hitMini(wd,sc,e.clientX-r.left,e.clientY-r.top);
    if(n!==lastHover.current){lastHover.current=n;onHover(n)}
  };
  const leave=(e:React.PointerEvent)=>{
    // keep sticky highlight after a finger tap; mouse / test hover still clears on leave
    if(e.pointerType==="touch")return;
    if(onHover&&lastHover.current!==null){lastHover.current=null;onHover(null)}
  };
  const down=(e:React.PointerEvent)=>{tap.current={x:e.clientX,y:e.clientY}};
  const up=(e:React.PointerEvent)=>{
    const t=tap.current;tap.current=null;
    if(!onTap||!t)return;
    if(Math.hypot(e.clientX-t.x,e.clientY-t.y)<12)onTap();
  };

  return(
    <div className="right" ref={wrap} onPointerMove={move} onPointerLeave={leave}
      onPointerDown={down} onPointerUp={up}>
      <canvas ref={cv} id="mini"/>
      {children}
    </div>
  );
}
