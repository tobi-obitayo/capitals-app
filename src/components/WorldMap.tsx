import {useEffect,useRef} from "react";
import {geoOrthographic,type GeoProjection} from "d3";
import {getLanding,loadLanding50,peekLanding50,type World} from "../geo";
import {drawLanding,elephantHit,pickContinent,vq} from "../map/landing";
import {flingFrom,pushSample,stepFling,type Fling,type Sample} from "../map/fling";
import {
  DETAIL_SCALE,drawFlat,FLAT_HOME,FLAT_ZOOM_MAX,flatLayout,LABEL_ZOOM,labelsStale,makeFlatProjection,newLabels,pickCountryFlat,unwrapFlatX,zoomFlatAt,
  type FlatLayout,type FlatView,
} from "../map/flat";
import {lvl,stats,useProgress} from "../progress";
import {lvlFill} from "../map/palette";
import {buildFlatGeo,ensureFlatGeo,peekFlatGeo,type FlatGeo} from "../map/flatcache";
import {Gestures,type Camera} from "../map/gesture";
import {dataByName,type ContinentName} from "../data";
import {useSettings} from "../sets";
import {unlockWorld,useWorldUnlocked,worldUnlocked} from "../unlock";
import {toast} from "sonner";
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
  /** flat map, zoomed in: the country that was tapped (null clears it) */
  onCountry:(name:string|null)=>void;
  onTouch:()=>void;
}

const HOME:[number,number,number]=[-15,-25,0];
const INTRO_MS=1800;

interface State{
  view:View;rotate:[number,number,number];zoom:number;inset:number;
  hover:ContinentName|null;lastHv:ContinentName|null;
  dragging:boolean;lastTouch:number;dirty:boolean;introStart:number|null;
  /** flat map pan/zoom and its current layout */
  flat:FlatView;lay:FlatLayout|null;hoverCountry:string|null;
  applyView:(v:View)=>void;reset:()=>void;zoomBy:(f:number)=>void;ensureDetail:()=>void;
}

/** Full-bleed globe / flat world map. Imperative canvas inside, React props around it. */
export function WorldMap(props:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const labelRef=useRef<HTMLDivElement>(null);
  const pr=useRef(props);pr.current=props;
  const S=useRef<State>({
    view:props.view,rotate:[HOME[0]-58,HOME[1],0],zoom:1,inset:0,hover:null,lastHv:null,
    dragging:false,lastTouch:0,dirty:true,introStart:null,flat:{...FLAT_HOME},lay:null,hoverCountry:null,
    applyView:()=>{},reset:()=>{},zoomBy:()=>{},ensureDetail:()=>{},
  });
  const version=useProgress();
  const{set}=useSettings();
  const worldOpen=useWorldUnlocked();
  useEffect(()=>{S.current.dirty=true},[version,props.highlight,worldOpen]);
  // another country set gives other names, so fetch (and then redraw with) that detailed map
  useEffect(()=>{if(S.current.view==="flat")S.current.ensureDetail();S.current.dirty=true},[set]);

  useEffect(()=>{
    const canvas=canvasRef.current!,ctx=canvas.getContext("2d")!,label=labelRef.current!;
    const s=S.current;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.rotate=[HOME[0]-(reduced?0:58),HOME[1],0];
    let world:World|null=null,W=0,H=0,dpr=1,raf=0,alive=true;
    /* the flat map draws from cached, already-projected outlines (flatcache.ts) */
    let baseGeo:FlatGeo|null=null,movingFlat=false;
    const labels=newLabels();
    const flat=makeFlatProjection();
    const globe=geoOrthographic().clipAngle(90).precision(.4);
    const proj=():GeoProjection=>s.view==="flat"?flat:globe;
    const zoomLevel=()=>s.lay?.view.zoom??1;
    const countryMode=()=>s.view==="flat"&&zoomLevel()>=LABEL_ZOOM;

    const setCursor=(c:""|"grab"|"dragging"|"pointer")=>{
      canvas.classList.remove("grab","dragging","pointer");
      if(c)canvas.classList.add(c);
    };
    const homeCursor=()=>setCursor("grab");

    const introK=()=>{
      if(s.introStart==null)return .84;
      const p=Math.min(1,(performance.now()-s.introStart)/INTRO_MS);
      return .84+.16*(1-Math.pow(1-p,3));
    };
    const availH=()=>H-s.inset;
    const globeScale=()=>Math.min(W,availH())/2*.9*s.zoom*introK();

    /** place both projections for the current size and free space */
    const layout=()=>{
      const AH=availH();
      s.lay=flatLayout(flat,W,AH,s.flat);
      s.flat=s.lay.view;
      globe.translate([W/2,AH/2]).scale(globeScale()).rotate(s.rotate);
      s.dirty=true;
    };
    const setup=()=>{
      W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
      layout();
    };

    /* pan / zoom input is recorded by the handlers and applied once per frame by Gestures.tick() */
    const cam:Camera={
      zoom:()=>s.view==="globe"?s.zoom:s.flat.zoom,
      range:()=>s.view==="globe"?[.7,3]:[s.lay?.minZoom??1,FLAT_ZOOM_MAX],
      zoomAt:(x,y,z)=>{
        if(s.view==="globe")s.zoom=Math.max(.7,Math.min(3,z));
        else if(s.lay)s.flat=zoomFlatAt(s.lay,x,y,z);
        layout();
      },
      panBy:(dx,dy)=>{
        if(s.view!=="flat")return;
        s.flat={...s.flat,px:s.flat.px+dx,py:s.flat.py+dy};
        layout();
      },
    };
    const g=new Gestures(cam);

    const hv=()=>s.hover??pr.current.highlight;
    const draw=()=>{
      s.dirty=false;
      if(!world)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(s.view==="flat"&&s.lay){
        const detail=peekLanding50();
        const detGeo=detail?peekFlatGeo(detail):null;
        const geo=detGeo&&s.lay.abs>=DETAIL_SCALE?detGeo:(baseGeo??=buildFlatGeo(world));
        drawFlat(ctx,{
          W,H,lay:s.lay,geo,detail:countryMode()?detGeo:null,hover:hv(),hoverCountry:s.hoverCountry,
          frac:cn=>stats(cn).frac,level:lvl,lvlFill,labels,now:performance.now(),
        });
        return;
      }
      if(s.view==="globe")globe.translate([W/2,availH()/2]).rotate(s.rotate).scale(globeScale());
      drawLanding(ctx,world,{W,H,view:s.view,proj:proj(),hover:hv(),frac:cn=>stats(cn).frac,elephant:!worldUnlocked()});
    };

    /* ---- label ---- */
    const showLabel=(cn:ContinentName|null,e?:PointerEvent)=>{
      if(!cn||!e||pr.current.paused){label.hidden=true;return}
      const st=stats(cn);
      const verb=isCoarsePointer()?"tap":"click";
      label.innerHTML=`<b>${cn}</b>${st.total} countries · ${st.mastered} mastered · ${verb} to drill`;
      label.hidden=false;label.style.left=e.clientX+"px";label.style.top=e.clientY+"px";
    };
    const showCountryLabel=(k:string|null,e?:PointerEvent)=>{
      const d=k?dataByName[k]:null;
      if(!d||!e||pr.current.paused){label.hidden=true;return}
      const verb=isCoarsePointer()?"tap":"click";
      label.innerHTML=`<b>${d.k}</b>${d.c} · ${d.cn} · ${verb} for details`;
      label.hidden=false;label.style.left=e.clientX+"px";label.style.top=e.clientY+"px";
    };
    const setHover=(cn:ContinentName|null)=>{if(s.hover!==cn){s.hover=cn;s.dirty=true}};
    const setHoverCountry=(k:string|null)=>{if(s.hoverCountry!==k){s.hoverCountry=k;s.dirty=true}};
    const local=(e:PointerEvent):[number,number]=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
    const pick=(x:number,y:number)=>{
      if(!world)return null;
      if(s.view==="flat"&&s.lay)return pickContinent(world,flat,"flat",unwrapFlatX(s.lay,x),y);
      return pickContinent(world,proj(),s.view,x,y);
    };
    const pickCountry=(x:number,y:number)=>{
      const detail=peekLanding50();
      return detail&&s.lay?pickCountryFlat(detail,s.lay,x,y):null;
    };

    /* ---- pointer: hover, click, trackball drag, pinch zoom ---- */
    const pointers=new Map<number,[number,number]>();
    let drag:null|{pt:[number,number];moved:boolean;v0?:[number,number,number];q0?:ReturnType<typeof vq.fromEuler>;r0?:[number,number,number]}=null;
    /* the pointer to look under for hover: picking runs once per frame, not once per move event */
    let hoverEv:null|PointerEvent=null,hoverPt:[number,number]=[0,0];
    /* globe momentum: recent drag samples, and the fling left after letting go */
    let samples:Sample[]=[],fling:Fling|null=null,prevT=0;
    const twoFingers=()=>{const p=[...pointers.values()];return p.length>=2?[p[0],p[1]] as [[number,number],[number,number]]:null};
    /** a finger is down on the globe or the flat map: start following it (a drag pans / rotates from here) */
    const armDrag=(pt:[number,number],moved:boolean)=>{
      drag={pt,moved};
      if(s.view==="globe"){
        globe.rotate(s.rotate);
        const ll=globe.invert!(pt) as [number,number];
        drag.v0=vq.cart(ll);drag.q0=vq.fromEuler(s.rotate);drag.r0=[...s.rotate];
      }else{
        g.dragBegin(pt[0],pt[1]);
        if(moved)g.dragGo();
      }
      if(moved){s.dragging=true;setCursor("dragging")}
    };
    const onDown=(e:PointerEvent)=>{
      if(pr.current.paused)return;
      pr.current.onTouch();
      fling=null;samples=[];g.stop();hoverEv=null;
      const pt=local(e);
      pointers.set(e.pointerId,pt);
      canvas.setPointerCapture(e.pointerId);
      const two=twoFingers();
      if(two){
        drag=null;s.dragging=false;
        g.pinchBegin(two[0][0],two[0][1],two[1][0],two[1][1]);
        showLabel(null);return;
      }
      armDrag(pt,false);
    };
    const onMove=(e:PointerEvent)=>{
      if(pr.current.paused)return;
      const pt=local(e);
      if(pointers.has(e.pointerId))pointers.set(e.pointerId,pt);
      if(pointers.size>=2){
        const two=twoFingers();
        if(two&&g.pinching())g.pinchTo(two[0][0],two[0][1],two[1][0],two[1][1]);
        s.lastTouch=performance.now();showLabel(null);return;
      }
      if(drag&&s.view==="flat"){
        if(!drag.moved&&Math.hypot(pt[0]-drag.pt[0],pt[1]-drag.pt[1])>TAP_SLOP){drag.moved=true;s.dragging=true;setCursor("dragging");g.dragGo()}
        g.dragTo(pt[0],pt[1],performance.now());
        s.lastTouch=performance.now();showLabel(null);return;
      }
      if(drag&&s.view==="globe"){
        if(Math.hypot(pt[0]-drag.pt[0],pt[1]-drag.pt[1])>TAP_SLOP){drag.moved=true;s.dragging=true;setCursor("dragging")}
        if(drag.moved&&drag.r0&&drag.q0&&drag.v0){
          const ll=globe.rotate(drag.r0).invert!(pt) as [number,number];
          const q1=vq.mul(drag.q0,vq.delta(drag.v0,vq.cart(ll)));
          s.rotate=vq.toEuler(q1);globe.rotate(s.rotate);s.dirty=true;s.lastTouch=performance.now();
          pushSample(samples,{t:s.lastTouch,q:vq.fromEuler(s.rotate)});
        }
        showLabel(null);return;
      }
      hoverEv=e;hoverPt=pt;   // picked in the next frame
    };
    /** hover: the country (zoomed in) or continent under the pointer */
    const doHover=(e:PointerEvent,pt:[number,number])=>{
      if(countryMode()){
        // zoomed in: hover works on single countries
        const k=pickCountry(pt[0],pt[1]);
        setHover(null);setHoverCountry(k);showCountryLabel(k,e);
        if(k)pr.current.onTouch();
        setCursor(k?"pointer":"grab");
        return;
      }
      setHoverCountry(null);
      const cn=pick(pt[0],pt[1]);
      setHover(cn);showLabel(cn,e);
      if(cn)pr.current.onTouch();
      setCursor(cn?"pointer":"grab");
    };
    const onUp=(e:PointerEvent)=>{
      const wasClick=drag&&!drag.moved&&pointers.size<=1;
      pointers.delete(e.pointerId);
      if(pointers.size<2)g.pinchEnd();
      if(pointers.size===0){
        const pt=local(e);
        const wasDrag=!!drag?.moved;
        // a quick flick leaves the globe or the map coasting (not for people who asked for less motion)
        fling=wasDrag&&s.view==="globe"&&!reduced&&!pr.current.paused?flingFrom(samples,performance.now()):null;
        if(s.view==="flat")g.dragEnd(performance.now(),!reduced&&!pr.current.paused);
        samples=[];
        drag=null;s.dragging=false;s.lastTouch=performance.now();
        if(wasClick&&!pr.current.paused){
          // the hidden circle on Elephant Island (globe only) opens World
          if(s.view==="globe"&&!worldUnlocked()&&elephantHit(globe,pt[0],pt[1],isCoarsePointer()?22:12)){
            if(unlockWorld())toast("World unlocked",{description:"Open it from the continent list."});
            homeCursor();return;
          }
          if(countryMode())pr.current.onCountry(pickCountry(pt[0],pt[1]));
          else{const cn=pick(pt[0],pt[1]);if(cn)pr.current.onPick(cn)}
        }
        homeCursor();
      }else if(pointers.size===1){
        // one finger left after a pinch: it carries on as a pan, and lifting it later is not a tap
        samples=[];
        armDrag([...pointers.values()][0],true);
      }
    };
    const onCancel=(e:PointerEvent)=>{
      pointers.delete(e.pointerId);
      if(pointers.size<2)g.pinchEnd();
      if(pointers.size===0){g.dragEnd(performance.now(),false);drag=null;s.dragging=false;samples=[];homeCursor()}
    };
    const onLeave=()=>{hoverEv=null;if(!drag&&pointers.size===0){setHover(null);setHoverCountry(null);showLabel(null)}};
    const onWheel=(e:WheelEvent)=>{
      if(pr.current.paused)return;
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      // the globe zooms about its centre; the flat map about the pointer
      if(s.view==="flat")g.wheel(e,e.clientX-r.left,e.clientY-r.top);
      else g.wheel({deltaX:0,deltaY:e.deltaY,deltaMode:e.deltaMode,ctrlKey:e.ctrlKey},W/2,availH()/2);
      s.lastTouch=performance.now();
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
        fling=null;g.stop();hoverEv=null;
        s.view=v;s.hover=null;s.hoverCountry=null;label.hidden=true;
        if(v==="flat")s.ensureDetail();
        homeCursor();layout();draw();
        requestAnimationFrame(()=>canvas.classList.remove("fade"));
      },150);
    };
    s.reset=()=>{fling=null;g.stop();s.rotate=[...HOME];s.zoom=1;s.flat={...FLAT_HOME};layout()};
    s.zoomBy=(f)=>g.zoomBy(f,W/2,availH()/2);
    s.ensureDetail=()=>{loadLanding50().then(w=>ensureFlatGeo(w)).then(()=>{if(alive)s.dirty=true})};

    /* ---- frame loop ---- */
    const frame=(t:number)=>{
      if(!alive)return;
      const p=pr.current;
      const dt=Math.min(50,prevT?t-prevT:16);prevT=t;
      if(p.paused){fling=null;g.stop()}
      else if(g.tick(t)){
        // the map is moving: a hover or open country card would be stale
        s.lastTouch=performance.now();
        if(s.view==="flat"){
          s.hover=null;s.hoverCountry=null;label.hidden=true;
          if(!movingFlat){movingFlat=true;p.onCountry(null)}
        }
      }else movingFlat=false;
      if(hoverEv&&!p.paused&&!g.busy()){const e=hoverEv;hoverEv=null;doHover(e,hoverPt)}
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
        }else if(fling&&!s.dragging&&!p.paused){
          const r=stepFling(vq.fromEuler(s.rotate),fling,dt);
          s.rotate=vq.toEuler(r.q);fling=r.fling;s.dirty=true;s.lastTouch=performance.now();
        }else if(p.autoSpin&&!s.dragging&&!hv()&&!p.paused&&!document.hidden&&t-s.lastTouch>3000){
          s.rotate=[s.rotate[0]+.12,s.rotate[1],s.rotate[2]];s.dirty=true;
        }
      }
      if(intro)s.dirty=true;
      const h=hv();if(h!==s.lastHv){s.lastHv=h;s.dirty=true}
      if(s.view==="flat"&&s.lay&&labelsStale(labels,s.lay,performance.now()))s.dirty=true;   // the map moved: pick the names again
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
      {props.view==="flat"&&!props.paused&&props.inset===0&&(
        <div className="tools flat-tools">
          <button className="icon-btn" aria-label="Zoom in" title="Zoom in" onClick={()=>S.current.zoomBy(1.6)}>+</button>
          <button className="icon-btn" aria-label="Zoom out" title="Zoom out" onClick={()=>S.current.zoomBy(1/1.6)}>−</button>
          <button className="icon-btn" aria-label="Reset view" title="Reset view" onClick={()=>{S.current.reset();props.onCountry(null)}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2.3M8 12.2v2.3M1.5 8h2.3M12.2 8h2.3"/></svg>
          </button>
        </div>
      )}
    </>
  );
}
