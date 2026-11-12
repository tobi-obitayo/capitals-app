import {useEffect,useRef} from "react";
import {geoNaturalEarth1,geoOrthographic,geoPath,type GeoProjection} from "d3";
import {getLanding,type World} from "../geo";
import {drawLanding,pickContinent,vq} from "../map/landing";
import {stats,useProgress} from "../progress";
import type {ContinentName} from "../data";
import {isCoarsePointer,TAP_SLOP} from "../util";

export type View="globe"|"flat";
interface Props{
  view:View;
  /** pixels at the bottom the map gives up (continent list open) */
  inset:number;
  autoSpin:boolean;
  resetKey:number;
  /** an overlay is open: freeze interaction and spin */
  paused:boolean;
  /** continent highlighted from outside (e.g. hovering the list) */
  highlight:ContinentName|null;
  onPick:(cn:ContinentName)=>void;
  onTouch:()=>void;
}

const HOME:[number,number,number]=[-15,-25,0];
const INTRO_MS=1800;

interface State{
  view:View;rotate:[number,number,number];zoom:number;inset:number;
  hover:ContinentName|null;lastHv:ContinentName|null;
  dragging:boolean;lastTouch:number;dirty:boolean;introStart:number|null;
  applyView:(v:View)=>void;reset:()=>void;
}

/** Full-bleed globe / flat world map. Imperative canvas inside, React props around it. */
export function WorldMap(props:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const labelRef=useRef<HTMLDivElement>(null);
  const pr=useRef(props);pr.current=props;
  const S=useRef<State>({
    view:props.view,rotate:[HOME[0]-58,HOME[1],0],zoom:1,inset:0,hover:null,lastHv:null,
    dragging:false,lastTouch:0,dirty:true,introStart:null,applyView:()=>{},reset:()=>{},
  });
  const version=useProgress();
  useEffect(()=>{S.current.dirty=true},[version,props.highlight]);

  useEffect(()=>{
    const canvas=canvasRef.current!,ctx=canvas.getContext("2d")!,label=labelRef.current!;
    const s=S.current;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.rotate=[HOME[0]-(reduced?0:58),HOME[1],0];
    let world:World|null=null,W=0,H=0,dpr=1,raf=0,alive=true;
    const flat=geoNaturalEarth1();
    const globe=geoOrthographic().clipAngle(90).precision(.4);
    const proj=():GeoProjection=>s.view==="flat"?flat:globe;

    const setCursor=(c:""|"grab"|"dragging"|"pointer")=>{
      canvas.classList.remove("grab","dragging","pointer");
      if(c)canvas.classList.add(c);
    };
    const homeCursor=()=>setCursor(s.view==="globe"?"grab":"");

    const introK=()=>{
      if(s.introStart==null)return .84;
      const p=Math.min(1,(performance.now()-s.introStart)/INTRO_MS);
      return .84+.16*(1-Math.pow(1-p,3));
    };
    const availH=()=>H-s.inset;
    const globeScale=()=>Math.min(W,availH())/2*.9*s.zoom*introK();

    /** place both projections for the current size and free space */
    const layout=()=>{
      const AH=availH(),sph={type:"Sphere"} as const;
      flat.fitWidth(W-16,sph);
      let b=geoPath(flat).bounds(sph);
      if(b[1][1]-b[0][1]>AH-16){flat.fitHeight(AH-16,sph);b=geoPath(flat).bounds(sph)}
      const t=flat.translate();
      flat.translate([t[0]+W/2-(b[0][0]+b[1][0])/2,t[1]+AH/2-(b[0][1]+b[1][1])/2]);
      globe.translate([W/2,AH/2]).scale(globeScale()).rotate(s.rotate);
      s.dirty=true;
    };
    const setup=()=>{
      W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
      layout();
    };

    const hv=()=>s.hover??pr.current.highlight;
    const draw=()=>{
      s.dirty=false;
      if(!world)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(s.view==="globe")globe.translate([W/2,availH()/2]).rotate(s.rotate).scale(globeScale());
      drawLanding(ctx,world,{W,H,view:s.view,proj:proj(),hover:hv(),frac:cn=>stats(cn).frac});
    };

    /* ---- label ---- */
    const showLabel=(cn:ContinentName|null,e?:PointerEvent)=>{
      if(!cn||!e||pr.current.paused){label.hidden=true;return}
      const st=stats(cn);
      const verb=isCoarsePointer()?"tap":"click";
      label.innerHTML=`<b>${cn}</b>${st.total} countries · ${st.mastered} mastered · ${verb} to drill`;
      label.hidden=false;label.style.left=e.clientX+"px";label.style.top=e.clientY+"px";
    };
    const setHover=(cn:ContinentName|null)=>{if(s.hover!==cn){s.hover=cn;s.dirty=true}};
    const local=(e:PointerEvent):[number,number]=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
    const pick=(x:number,y:number)=>world?pickContinent(world,proj(),s.view,x,y):null;

    /* ---- pointer: hover, click, trackball drag, pinch zoom ---- */
    const pointers=new Map<number,[number,number]>();
    let drag:null|{pt:[number,number];moved:boolean;v0?:[number,number,number];q0?:ReturnType<typeof vq.fromEuler>;r0?:[number,number,number]}=null;
    let pinch:null|{dist:number;zoom:number}=null;
    const midDist=()=>{
      const pts=[...pointers.values()];
      if(pts.length<2)return null;
      return{mid:[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2] as [number,number],dist:Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1])};
    };
    const onDown=(e:PointerEvent)=>{
      if(pr.current.paused)return;
      pr.current.onTouch();
      const pt=local(e);
      pointers.set(e.pointerId,pt);
      canvas.setPointerCapture(e.pointerId);
      if(pointers.size>=2&&s.view==="globe"){
        drag=null;s.dragging=false;
        const m=midDist();
        if(m&&m.dist>0)pinch={dist:m.dist,zoom:s.zoom};
        showLabel(null);return;
      }
      pinch=null;drag={pt,moved:false};
      if(s.view==="globe"){
        globe.rotate(s.rotate);
        const ll=globe.invert!(pt) as [number,number];
        drag.v0=vq.cart(ll);drag.q0=vq.fromEuler(s.rotate);drag.r0=[...s.rotate];
      }
    };
    const onMove=(e:PointerEvent)=>{
      if(pr.current.paused)return;
      const pt=local(e);
      if(pointers.has(e.pointerId))pointers.set(e.pointerId,pt);
      if(pointers.size>=2&&s.view==="globe"&&pinch&&pinch.dist>0){
        const m=midDist();
        if(m){
          s.zoom=Math.max(.7,Math.min(3,pinch.zoom*(m.dist/pinch.dist)));
          layout();s.lastTouch=performance.now();
        }
        showLabel(null);return;
      }
      if(drag&&s.view==="globe"){
        if(Math.hypot(pt[0]-drag.pt[0],pt[1]-drag.pt[1])>TAP_SLOP){drag.moved=true;s.dragging=true;setCursor("dragging")}
        if(drag.moved&&drag.r0&&drag.q0&&drag.v0){
          const ll=globe.rotate(drag.r0).invert!(pt) as [number,number];
          const q1=vq.mul(drag.q0,vq.delta(drag.v0,vq.cart(ll)));
          s.rotate=vq.toEuler(q1);globe.rotate(s.rotate);s.dirty=true;s.lastTouch=performance.now();
        }
        showLabel(null);return;
      }
      const cn=pick(pt[0],pt[1]);
      setHover(cn);showLabel(cn,e);
      if(cn)pr.current.onTouch();
      setCursor(cn?"pointer":s.view==="globe"?"grab":"");
    };
    const onUp=(e:PointerEvent)=>{
      const wasClick=drag&&!drag.moved&&pointers.size<=1;
      pointers.delete(e.pointerId);
      if(pointers.size<2)pinch=null;
      if(pointers.size===0){
        const pt=local(e);
        drag=null;s.dragging=false;s.lastTouch=performance.now();
        if(wasClick&&!pr.current.paused){const cn=pick(pt[0],pt[1]);if(cn)pr.current.onPick(cn)}
        homeCursor();
      }else if(pointers.size===1&&s.view==="globe"){
        const pt=[...pointers.values()][0];
        drag={pt,moved:false};
        globe.rotate(s.rotate);
        const ll=globe.invert!(pt) as [number,number];
        drag.v0=vq.cart(ll);drag.q0=vq.fromEuler(s.rotate);drag.r0=[...s.rotate];
      }
    };
    const onCancel=(e:PointerEvent)=>{
      pointers.delete(e.pointerId);
      if(pointers.size<2)pinch=null;
      if(pointers.size===0){drag=null;s.dragging=false;homeCursor()}
    };
    const onLeave=()=>{if(!drag&&pointers.size===0){setHover(null);showLabel(null)}};
    const onWheel=(e:WheelEvent)=>{
      if(s.view!=="globe"||pr.current.paused)return;
      e.preventDefault();
      s.zoom=Math.max(.7,Math.min(3,s.zoom*Math.exp(-e.deltaY*.0015)));
      layout();s.lastTouch=performance.now();
    };
    canvas.addEventListener("pointerdown",onDown);
    canvas.addEventListener("pointermove",onMove);
    canvas.addEventListener("pointerup",onUp);
    canvas.addEventListener("pointercancel",onCancel);
    canvas.addEventListener("pointerleave",onLeave);
    canvas.addEventListener("wheel",onWheel,{passive:false});
    addEventListener("resize",setup);

    /* ---- view switch + reset ---- */
    s.applyView=(v)=>{
      if(v===s.view)return;
      canvas.classList.add("fade");
      setTimeout(()=>{
        if(!alive)return;
        s.view=v;s.hover=null;label.hidden=true;
        homeCursor();layout();draw();
        requestAnimationFrame(()=>canvas.classList.remove("fade"));
      },150);
    };
    s.reset=()=>{s.rotate=[...HOME];s.zoom=1;layout()};

    /* ---- frame loop ---- */
    const frame=(t:number)=>{
      if(!alive)return;
      const p=pr.current;
      if(Math.abs(s.inset-p.inset)>.4){
        s.inset+=(p.inset-s.inset)*.2;
        if(Math.abs(s.inset-p.inset)<=.4)s.inset=p.inset;
        layout();
      }
      const intro=s.introStart!=null&&t-s.introStart<INTRO_MS;
      if(s.view==="globe"){
        if(intro){
          const k=Math.max(0,(t-s.introStart!)/INTRO_MS);
          s.rotate=[s.rotate[0]+1.6*Math.pow(1-k,2),s.rotate[1],s.rotate[2]];
        }else if(p.autoSpin&&!s.dragging&&!hv()&&!p.paused&&!document.hidden&&t-s.lastTouch>3000){
          s.rotate=[s.rotate[0]+.12,s.rotate[1],s.rotate[2]];s.dirty=true;
        }
      }
      if(intro)s.dirty=true;
      const h=hv();if(h!==s.lastHv){s.lastHv=h;s.dirty=true}
      if(s.dirty)draw();
      raf=requestAnimationFrame(frame);
    };

    setup();
    getLanding().then(w=>{
      if(!alive)return;
      world=w;s.introStart=reduced?-1e9:performance.now();
      canvas.classList.remove("intro");homeCursor();s.dirty=true;
    });
    raf=requestAnimationFrame(frame);

    return()=>{
      alive=false;cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown",onDown);
      canvas.removeEventListener("pointermove",onMove);
      canvas.removeEventListener("pointerup",onUp);
      canvas.removeEventListener("pointercancel",onCancel);
      canvas.removeEventListener("pointerleave",onLeave);
      canvas.removeEventListener("wheel",onWheel);
      removeEventListener("resize",setup);
    };
  },[]);

  useEffect(()=>{S.current.applyView(props.view)},[props.view]);
  const prevReset=useRef(props.resetKey);
  useEffect(()=>{
    if(prevReset.current===props.resetKey)return;
    prevReset.current=props.resetKey;
    S.current.reset();
  },[props.resetKey]);

  return(
    <>
      <canvas ref={canvasRef} id="map" className="intro" aria-label="World map. Press 1 to 6 to open a continent, or press C for the continent list."/>
      <div ref={labelRef} className="label" hidden/>
    </>
  );
}
