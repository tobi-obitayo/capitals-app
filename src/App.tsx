import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {CONT,CONT_NAMES,type ContinentName,type Country} from "./data";
import type {QuizCfg,QuizResult} from "./quiz";
import {loadPrefs,savePrefs,type Prefs} from "./prefs";
import {loadWorld50} from "./geo";
import {WorldMap,type View} from "./components/WorldMap";
import {Dock} from "./components/Dock";
import {Panel} from "./components/Panel";
import {DrillModal} from "./components/DrillModal";
import {FindQuiz} from "./components/FindQuiz";
import {CapitalQuiz} from "./components/CapitalQuiz";
import {QuizResults} from "./components/QuizResults";
import {InfoIcon,Seg} from "./components/ui";

type Overlay=
  |null
  |{t:"drill";cn:ContinentName}
  |{t:"find"|"capital";cn:ContinentName;cfg:QuizCfg;items:Country[];run:number}
  |{t:"results";cn:ContinentName;result:QuizResult};

export default function App(){
  const [view,setView]=useState<View>("globe");
  const [autoSpin,setAutoSpin]=useState(()=>!matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [resetKey,setResetKey]=useState(0);
  const [panelOpen,setPanelOpen]=useState(false);
  const [dockOpen,setDockOpen]=useState(false);
  const [dockH,setDockH]=useState(90);
  const [highlight,setHighlight]=useState<ContinentName|null>(null);
  const [overlay,setOverlay]=useState<Overlay>(null);
  const [touched,setTouched]=useState(false);
  const [prefs,setPrefsState]=useState<Prefs>(loadPrefs);
  const dockRef=useRef<HTMLDivElement>(null);
  const runCounter=useRef(0);

  const setPrefs=useCallback((p:Prefs)=>{setPrefsState(p);savePrefs(p)},[]);

  useEffect(()=>{document.body.classList.toggle("touched",touched)},[touched]);
  // warm up the detailed map so drills open instantly
  useEffect(()=>{const id=setTimeout(()=>{loadWorld50()},600);return()=>clearTimeout(id)},[]);

  /* continent list: the map gives up room at the bottom while it is open */
  useLayoutEffect(()=>{
    if(!dockOpen)return;
    const h=dockRef.current?.offsetHeight??90;
    setDockH(h);
    document.documentElement.style.setProperty("--dock-h",h+"px");
  },[dockOpen]);
  const inset=dockOpen?dockH+16+34:0;

  const closeAll=()=>{setPanelOpen(false);setDockOpen(false)};
  const openDrill=useCallback((cn:ContinentName)=>{
    closeAll();setHighlight(null);setTouched(true);
    setOverlay({t:"drill",cn});
  },[]);

  const startQuiz=useCallback((cn:ContinentName,cfg:QuizCfg,items?:Country[])=>{
    setPrefs({...prefs,tab:"quiz",cfg});
    setOverlay({t:cfg.kind==="find"?"find":"capital",cn,cfg,items:items??CONT[cn],run:++runCounter.current});
  },[prefs,setPrefs]);

  /* outside click closes the (i) panel */
  useEffect(()=>{
    if(!panelOpen)return;
    const onDown=(e:PointerEvent)=>{
      if(!(e.target as HTMLElement).closest("#panel,#info-btn"))setPanelOpen(false);
    };
    document.addEventListener("pointerdown",onDown);
    return()=>document.removeEventListener("pointerdown",onDown);
  },[panelOpen]);

  /* keyboard */
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const tag=(e.target as HTMLElement).tagName;
      const inField=tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA";
      if(e.key==="Escape"){
        if(overlay){
          // a running quiz is only ended with its own buttons
          if(overlay.t==="drill"||overlay.t==="results"){e.preventDefault();setOverlay(null)}
        }else if(panelOpen){e.preventDefault();setPanelOpen(false);document.getElementById("info-btn")?.focus()}
        else if(dockOpen){e.preventDefault();setDockOpen(false)}
        return;
      }
      if(overlay||inField)return;
      const k=e.key.toLowerCase();
      if(k==="f")setView(v=>v==="flat"?"globe":"flat");
      else if(k==="i")setPanelOpen(o=>!o);
      else if(k==="c")setDockOpen(o=>!o);
      else if(/^[1-6]$/.test(e.key))openDrill(CONT_NAMES[+e.key-1]);
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[overlay,panelOpen,dockOpen,openDrill]);

  const paused=overlay!==null;

  return(
    <>
      <WorldMap view={view} inset={inset} autoSpin={autoSpin} resetKey={resetKey} paused={paused}
        highlight={highlight} onPick={openDrill} onTouch={()=>setTouched(true)}/>

      <div className="float tl">
        <button id="info-btn" className="icon-btn" aria-label="About and progress" aria-expanded={panelOpen} aria-controls="panel"
          onClick={()=>setPanelOpen(o=>!o)}><InfoIcon size={18}/></button>
      </div>
      {panelOpen&&<Panel onClose={()=>setPanelOpen(false)} onOpen={cn=>openDrill(cn)} onHover={setHighlight}/>}

      <div className="float tr">
        <Seg label="Map view" value={view} onChange={setView}
          options={[{value:"flat",label:"Flat"},{value:"globe",label:"Globe"}]}/>
      </div>

      {view==="globe"&&!paused&&(
        <div className="tools">
          <button className="icon-btn" aria-label="Toggle auto-spin" title="Toggle auto-spin" aria-pressed={autoSpin} onClick={()=>setAutoSpin(a=>!a)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13 2.5v3h-3"/></svg>
          </button>
          <button className="icon-btn" aria-label="Reset view" title="Reset view" onClick={()=>setResetKey(k=>k+1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2.3M8 12.2v2.3M1.5 8h2.3M12.2 8h2.3"/></svg>
          </button>
        </div>
      )}

      <div className="hint">Click a continent to begin</div>
      {!paused&&(
        <button className="handle" aria-expanded={dockOpen} aria-label={dockOpen?"Hide continent list":"Show continent list"}
          onClick={()=>setDockOpen(o=>!o)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l5-5 5 5"/></svg>
        </button>
      )}
      <Dock ref={dockRef} open={dockOpen&&!paused} onOpen={openDrill} onHover={setHighlight}/>

      {overlay?.t==="drill"&&(
        <DrillModal key={overlay.cn} cn={overlay.cn} prefs={prefs} setPrefs={setPrefs} onClose={()=>setOverlay(null)}
          onStartQuiz={cfg=>startQuiz(overlay.cn,cfg)}/>
      )}
      {overlay?.t==="find"&&(
        <FindQuiz key={overlay.run} cn={overlay.cn} cfg={overlay.cfg} items={overlay.items}
          onFinish={result=>setOverlay({t:"results",cn:overlay.cn,result})}
          onExit={()=>setOverlay({t:"drill",cn:overlay.cn})}/>
      )}
      {overlay?.t==="capital"&&(
        <CapitalQuiz key={overlay.run} cn={overlay.cn} cfg={overlay.cfg} items={overlay.items}
          onFinish={result=>setOverlay({t:"results",cn:overlay.cn,result})}
          onExit={()=>setOverlay({t:"drill",cn:overlay.cn})}/>
      )}
      {overlay?.t==="results"&&(
        <QuizResults result={overlay.result}
          onRetry={()=>startQuiz(overlay.cn,overlay.result.cfg)}
          onReview={missed=>startQuiz(overlay.cn,overlay.result.cfg,missed)}
          onSetup={()=>{setPrefs({...prefs,tab:"quiz",cfg:overlay.result.cfg});setOverlay({t:"drill",cn:overlay.cn})}}
          onClose={()=>setOverlay(null)}/>
      )}
    </>
  );
}

