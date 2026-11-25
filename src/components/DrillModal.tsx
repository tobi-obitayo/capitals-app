import{useEffect,useRef,useState}from"react";
import{type Country,type Scope}from"../data";
import{countriesIn}from"../sets";
import{lvl,record,stats,useProgress}from"../progress";
import{AUTO_ADVANCE_MS,autoMatches,checkAnswer,shuffle}from"../util";
import{TIMER_PRESETS,type QuizCfg}from"../quiz";
import{lvlFill}from"../map/mini";
import type{Prefs}from"../prefs";
import{BottomDrawer}from"./Drawer";
import{DrillMap}from"./DrillMap";
import{ModalShell}from"./ModalShell";
import{Field,GearIcon,Kbd,Seg,Switch}from"./ui";

const MODE_NAMES=["Flashcards","Multiple choice","Type it"]as const;
const MODE_SHORT=["Cards","Choice","Type"]as const;
const MOBILE_MQ="(max-width:900px)";
const SETUP_CTA_PAD=88;

function useMobile(){
  const[m,setM]=useState(()=>typeof matchMedia==="function"&&matchMedia(MOBILE_MQ).matches);
  useEffect(()=>{
    const mq=matchMedia(MOBILE_MQ);
    const sync=()=>setM(mq.matches);
    sync();
    mq.addEventListener("change",sync);
    return()=>mq.removeEventListener("change",sync);
  },[]);
  return m;
}

function batchItems(cn:Scope,k:string):Country[]{
  const a=countriesIn(cn);
  if(k==="all")return a;
  if(k==="rand")return shuffle(a).slice(0,10);
  if(k==="weak")return[...a].sort((x,y)=>lvl(x.k)-lvl(y.k)||Math.random()-.5).slice(0,10);
  if(k.startsWith("r:"))return a.filter(d=>d.r===k.slice(2));
  const n=+k.slice(2);
  return a.slice(n*10,n*10+10);
}

interface Props{
  cn:Scope;
  prefs:Prefs;
  setPrefs:(p:Prefs)=>void;
  onClose:()=>void;
  onStartQuiz:(cfg:QuizCfg)=>void;
}

/** Learn drills (flashcards, multiple choice, type it) plus the entry point for quizzes. */
export function DrillModal({cn,prefs,setPrefs,onClose,onStartQuiz}:Props){
  useProgress();
  const mobile=useMobile();
  const{mi,dir,batch,tab,cfg}=prefs;
  const set=(p:Partial<Prefs>)=>setPrefs({...prefs,...p});
  const c2k=dir==="c2k";
  const effTab=tab;

  const[screen,setScreen]=useState<"setup"|"run"|"done">("setup");
  const[queue,setQueue]=useState<Country[]>([]);
  const[i,setI]=useState(0);
  const[res,setRes]=useState<{it:Country;ok:boolean}[]>([]);
  const[flipped,setFlipped]=useState(false);
  const[sel,setSel]=useState<string|null>(null);
  const[fb,setFb]=useState<{ok:boolean;close:boolean;auto?:boolean}|null>(null);
  const[opts,setOpts]=useState<string[]>([]);
  const[mapFocus,setMapFocus]=useState(false);
  const[settingsOpen,setSettingsOpen]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);

  const q=queue[i] as Country|undefined;
  const answerOf=(c:Country)=>c2k?c.c:c.k;
  const makeOpts=(c:Country)=>{
    const pool=shuffle(countriesIn("World").filter(d=>d!==c&&d.cn===c.cn)).slice(0,3);
    return shuffle([c,...pool]).map(d=>c2k?d.c:d.k);
  };
  const keepTyping=(clear:boolean)=>{
    const el=inputRef.current;if(!el)return;
    if(clear)el.value="";
    el.readOnly=false;el.focus({preventScroll:true});
  };
  const resetCard=(c?:Country)=>{setFlipped(false);setSel(null);setFb(null);setOpts(mi===1&&c?makeOpts(c):[])};
  const startRun=(items:Country[])=>{
    const sh=shuffle(items);
    setQueue(sh);setI(0);setRes([]);resetCard(sh[0]);setScreen("run");setMapFocus(false);setSettingsOpen(false);
  };
  const mark=(ok:boolean)=>{if(!q)return;setRes(r=>[...r,{it:q,ok}]);record(q.k,ok)};
  const next=()=>{
    if(i+1>=queue.length){setScreen("done");return}
    setI(i+1);resetCard(queue[i+1]);
    if(mi===2){keepTyping(true);requestAnimationFrame(()=>keepTyping(false))}
  };
  const flip=()=>{if(mi===0&&!flipped)setFlipped(true)};
  const gradeFlash=(ok:boolean)=>{mark(ok);next()};
  const choose=(o:string)=>{if(sel!==null||!q)return;setSel(o);mark(o===answerOf(q))};
  const accepted=q?(c2k?[q.c,...q.ac]:[q.k,...q.ak]):[];
  const gradeTyped=()=>{
    if(fb||!q)return;
    const r=checkAnswer(accepted,inputRef.current?.value??"",cfg.spell);
    if(r.empty)return;
    mark(r.ok);
    setFb({ok:r.ok,close:r.close});
  };
  const submitTyped=(e:React.FormEvent)=>{
    e.preventDefault();
    if(fb){next();return}
    gradeTyped();
  };
  /** spell check off: accept the moment the typed text is exactly right */
  const onTyping=(e:React.ChangeEvent<HTMLInputElement>)=>{
    if(!cfg.spell&&!fb&&autoMatches(accepted,e.target.value))gradeTyped();
  };

  // show the green "correct" state briefly, then move on while keeping the keyboard up
  const nextRef=useRef<()=>void>(()=>{});
  nextRef.current=next;
  useEffect(()=>{
    if(screen!=="run"||mi!==2||!fb?.ok)return;
    const t=setTimeout(()=>nextRef.current(),AUTO_ADVANCE_MS);
    return()=>clearTimeout(t);
  },[screen,mi,fb]);

  useEffect(()=>{
    if(screen==="run"&&mi===2&&!fb)keepTyping(false);
  },[screen,mi,i,fb]);

  /* keyboard inside a run */
  useEffect(()=>{
    if(screen!=="run"||!q)return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const tag=(e.target as HTMLElement).tagName;
      if(tag==="INPUT"||tag==="SELECT")return;
      if(mi===0){
        if(!flipped&&(e.key===" "||e.key==="Enter")){e.preventDefault();flip()}
        else if(flipped&&e.key==="ArrowLeft"){e.preventDefault();gradeFlash(false)}
        else if(flipped&&e.key==="ArrowRight"){e.preventDefault();gradeFlash(true)}
      }else if(mi===1){
        if(sel===null&&/^[1-4]$/.test(e.key)){const o=opts[+e.key-1];if(o)choose(o)}
        else if(sel!==null&&(e.key===" "||e.key==="Enter")){e.preventDefault();next()}
      }else if(fb&&(e.key===" "||e.key==="Enter")){e.preventDefault();next()}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  });

  const s=stats(cn);
  const dirName=c2k?"Country → Capital":"Capital → Country";
  const sub=screen==="setup"
    ?(effTab==="quiz"?`Quiz · ${s.total} countries`:`${s.total} countries · ${s.mastered} mastered · ${s.learning} learning`)
    :`${MODE_NAMES[mi]} · ${dirName}`;

  const revealed=flipped||sel!==null||!!fb;
  const hl=screen==="run"&&q?(c2k||revealed?q.k:null):null;
  const fill=(n:string)=>screen==="run"?"#FFFFFF":lvlFill(lvl(n));

  const learnCount=batchItems(cn,batch).length;
  const startLearn=()=>{const it=batchItems(cn,batch);if(it.length)startRun(it)};
  const startQuiz=()=>{setSettingsOpen(false);onStartQuiz(cfg)};

  const setupMap=mobile&&screen==="setup";
  const startLabel=effTab==="learn"
    ?`Start drill · ${learnCount} cards`
    :`Start quiz · ${countriesIn(cn).length} countries`;
  const onStart=effTab==="learn"?startLearn:startQuiz;

  const settingsBody=(
    <>
      <div className="field">
        <Seg full label="Learn or quiz" value={effTab} onChange={v=>{set({tab:v});setMapFocus(false)}}
          options={[
            {value:"learn",label:"Learn"},
            {value:"quiz",label:"Quiz"},
          ]}/>
      </div>
      {effTab==="learn"
        ?<LearnSetup cn={cn} prefs={prefs} set={set} onStart={startLearn}/>
        :<QuizSetup cn={cn} cfg={cfg} setCfg={c=>set({cfg:c})} onStart={startQuiz}/>}
    </>
  );

  const legend=screen!=="run"&&(
    <div className="mlegend">
      <span><i className="sw" style={{background:"#fff"}}/>Not started</span>
      <span><i className="sw" style={{background:"rgba(179,163,105,.55)"}}/>Learning</span>
      <span><i className="sw" style={{background:"rgba(0,48,87,.7)"}}/>Mastered</span>
    </div>
  );

  return(
    <>
      <ModalShell title={`${cn} Capitals`} sub={sub} onClose={onClose}
        hideMap={screen==="run"&&mi===2}
        compactMap={false}
        setupMap={setupMap}
        right={
          <DrillMap cn={cn} fill={fill} hl={hl} showLegend={screen!=="run"} bottomPad={setupMap?SETUP_CTA_PAD:0}
            onTap={!mobile&&screen==="setup"?()=>setMapFocus(true):undefined}>
            {legend}
            {setupMap&&(
              <div className="setup-cta">
                <button type="button" className="icon-btn setup-gear" aria-label="Settings" onClick={()=>setSettingsOpen(true)}>
                  <GearIcon/>
                </button>
                <button type="button" className="btn" autoFocus onClick={onStart}>{startLabel}</button>
              </div>
            )}
          </DrillMap>
        }>
        {screen==="setup"&&!mobile&&(
          mapFocus?(
            <div className="setup-compact">
              <p className="note">Tap Settings to change options.</p>
              <button type="button" className="btn ghost" onClick={()=>setMapFocus(false)}>Settings</button>
              <button className="btn" autoFocus onClick={onStart}>{startLabel}</button>
            </div>
          ):(
            <>
              {settingsBody}
              <p className="note map-tip">Tap the map to hide these settings.</p>
            </>
          )
        )}

        {screen==="run"&&q&&(
          <>
            <div className="run-top">
              <button className="btn plain" onClick={()=>setScreen("setup")}>← Exit</button>
              <div className="prog"><i style={{width:`${i/queue.length*100}%`}}/></div>
              <span className="count">{i+1} / {queue.length}</span>
            </div>
            <div className="q">
              {q.r&&q.cn==="Africa"&&<span className="tag">{q.r} Africa</span>}
              <div className="kind">{c2k?"Capital of":"Which country has the capital"}</div>
              <h3>{c2k?q.k:q.c}</h3>
            </div>

            {mi===0&&(
              <>
                <button key={i} className={"flip"+(flipped?" on":"")} autoFocus={!flipped} onClick={flip}>
                  {flipped?answerOf(q):"Tap to reveal"}
                </button>
                {flipped&&(
                  <div className="row2" style={{marginTop:12}}>
                    <button className="btn bad" onClick={()=>gradeFlash(false)}>Missed<span className="kbd-only"><kbd>←</kbd></span></button>
                    <button className="btn ok" autoFocus onClick={()=>gradeFlash(true)}>Got it<span className="kbd-only"><kbd>→</kbd></span></button>
                  </div>
                )}
              </>
            )}

            {mi===0&&<p className="kbd-hint"><Kbd>Space</Kbd> reveal · <Kbd>←</Kbd> missed · <Kbd>→</Kbd> got it</p>}
            {mi===1&&(
              <>
                <div className="opts">
                  {opts.map((o,n)=>{
                    const done=sel!==null,right=done&&o===answerOf(q),wrong=done&&sel===o&&o!==answerOf(q);
                    return(
                      <button key={o} className={"opt"+(right?" right":"")+(wrong?" wrong":"")} disabled={done} onClick={()=>choose(o)}>
                        <span className="n">{n+1}</span>{o}
                      </button>
                    );
                  })}
                </div>
                {sel!==null&&<button className="btn" autoFocus style={{marginTop:12}} onClick={next}>{i+1>=queue.length?"Finish":"Next"}<span className="kbd-only"><kbd>↵</kbd></span></button>}
              </>
            )}

            {mi===2&&(
              <form className="stack" onSubmit={submitTyped}>
                <input ref={inputRef} type="text" readOnly={!!fb&&!fb.ok} placeholder={c2k?"Type the capital…":"Type the country…"}
                  autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" inputMode="text" onChange={onTyping}
                  onKeyDown={e=>{if(fb&&e.key==="Enter"){e.preventDefault();if(e.nativeEvent.isComposing||e.keyCode===229)return;next()}}}/>
                {fb&&(
                  <div className={"fb "+(fb.ok?"ok":"bad")}>
                    {fb.ok
                      ?(fb.close?<>Close enough. It's spelled <b>{answerOf(q)}</b></>:"Correct!")
                      :<>The answer is <b>{answerOf(q)}</b></>}
                  </div>
                )}
                {fb
                  ?<button type="button" className="btn" onClick={next}>{i+1>=queue.length?"Finish":"Next"}<span className="kbd-only"><kbd>↵</kbd></span></button>
                  :cfg.spell&&<button type="submit" className="btn">Check<span className="kbd-only"><kbd>↵</kbd></span></button>}
              </form>
            )}
          </>
        )}

        {screen==="done"&&<LearnDone res={res} onMissed={bad=>startRun(bad)} onRetry={()=>startRun(queue)} onNew={()=>setScreen("setup")} onClose={onClose}/>}
      </ModalShell>

      {setupMap&&(
        <BottomDrawer open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings">
          {settingsBody}
        </BottomDrawer>
      )}
    </>
  );
}

function LearnSetup({cn,prefs,set,onStart}:{cn:Scope;prefs:Prefs;set:(p:Partial<Prefs>)=>void;onStart:()=>void}){
  const a=countriesIn(cn);
  const sets=Math.ceil(a.length/10);
  // sub-regions only exist for Africa, so they would be unlabelled on the world list
  const regions=cn=="World"?[]:[...new Set(a.map(d=>d.r).filter(Boolean))] as string[];
  const valid=prefs.batch==="all"||prefs.batch==="rand"||prefs.batch==="weak"||
    regions.some(r=>prefs.batch==="r:"+r)||(prefs.batch.startsWith("s:")&&+prefs.batch.slice(2)<sets);
  const batch=valid?prefs.batch:"all";
  const count=batchItems(cn,batch).length;
  return(
    <>
      <Field label="Study mode">
        <Seg full label="Study mode" value={prefs.mi} onChange={v=>set({mi:v})}
          options={MODE_NAMES.map((n,idx)=>({
            value:idx as 0|1|2,
            label:n,
            shortLabel:MODE_SHORT[idx],
          }))}/>
      </Field>
      {prefs.mi===2&&(
        <Field label="Spelling" note={prefs.cfg.spell?"Small typos and missing accents are forgiven. Press Enter to check.":"Needs the exact spelling (capitals and accents don't matter) and checks the moment you type it right."}>
          <div className="toggle-row">
            <Switch on={prefs.cfg.spell} onChange={v=>set({cfg:{...prefs.cfg,spell:v}})} label="Spell check"/>
            <span>{prefs.cfg.spell?"Spell check on":"Spell check off"}</span>
          </div>
        </Field>
      )}
      <Field label="Batch">
        <select value={batch} onChange={e=>set({batch:e.target.value})}>
          <option value="all">All {a.length} countries</option>
          <option value="rand">Random 10</option>
          <option value="weak">Weakest 10 (needs practice)</option>
          {regions.length>0&&(
            <optgroup label="By region">
              {regions.map(r=><option key={r} value={"r:"+r}>{r} ({a.filter(d=>d.r===r).length})</option>)}
            </optgroup>
          )}
          <optgroup label="Sets of 10">
            {Array.from({length:sets},(_,n)=><option key={n} value={"s:"+n}>Set {n+1} ({n*10+1}–{Math.min(a.length,n*10+10)})</option>)}
          </optgroup>
        </select>
      </Field>
      <Field label="Direction">
        <Seg full label="Direction" value={prefs.dir} onChange={v=>set({dir:v})}
          options={[{value:"c2k",label:"Country → Capital"},{value:"k2c",label:"Capital → Country"}]}/>
      </Field>
      <button className="btn" autoFocus onClick={onStart}>Start drill · {count} cards</button>
    </>
  );
}

function QuizSetup({cn,cfg,setCfg,onStart}:{cn:Scope;cfg:QuizCfg;setCfg:(c:QuizCfg)=>void;onStart:()=>void}){
  const up=(p:Partial<QuizCfg>)=>setCfg({...cfg,...p});
  const minutes=Math.round(cfg.seconds/60);
  const isPreset=TIMER_PRESETS.includes(cfg.seconds);
  return(
    <>
      <Field label="Quiz">
        <Seg full label="Quiz type" value={cfg.kind} onChange={v=>up({kind:v})}
          options={[{value:"find",label:"Find the country"},{value:"capital",label:"Name the capital"}]}/>
      </Field>

      <Field label="Timer">
        <div className="toggle-row">
          <Switch on={cfg.timerOn} onChange={v=>up({timerOn:v})} label="Time limit"/>
          <span>{cfg.timerOn?"Time limit on":"No time limit"}</span>
        </div>
        {cfg.timerOn&&(
          <div className="presets">
            {TIMER_PRESETS.map(sec=>(
              <button key={sec} type="button" className="preset" aria-pressed={cfg.seconds===sec} onClick={()=>up({seconds:sec})}>{sec/60} min</button>
            ))}
            <label className={"preset custom"+(isPreset?"":" on")}>
              <input type="number" min={1} max={180} value={minutes} aria-label="Custom minutes"
                onChange={e=>{const v=Math.max(1,Math.min(180,Math.round(+e.target.value||1)));up({seconds:v*60})}}/>
              <span>min</span>
            </label>
          </div>
        )}
      </Field>

      {cfg.kind==="find"?(
        <Field label="Mode" note={cfg.hard?"One try per country. A wrong tap marks it missed and moves on.":"Keep tapping until you find it. It only counts as correct if your first tap was right."}>
          <div className="toggle-row">
            <Switch on={cfg.hard} onChange={v=>up({hard:v})} label="Hard mode"/>
            <span>{cfg.hard?"Hard mode":"Normal"}</span>
          </div>
        </Field>
      ):(
        <Field label="Spelling" note={cfg.spell?"Small typos and missing accents are forgiven. Press Enter to check.":"Needs the exact spelling (capitals and accents don't matter) and checks the moment you type it right."}>
          <div className="toggle-row">
            <Switch on={cfg.spell} onChange={v=>up({spell:v})} label="Spell check"/>
            <span>{cfg.spell?"Spell check on":"Spell check off"}</span>
          </div>
        </Field>
      )}
      <button className="btn" autoFocus onClick={onStart}>Start quiz · {countriesIn(cn).length} countries</button>
    </>
  );
}

function LearnDone({res,onMissed,onRetry,onNew,onClose}:{
  res:{it:Country;ok:boolean}[];onMissed:(bad:Country[])=>void;onRetry:()=>void;onNew:()=>void;onClose:()=>void;
}){
  const ok=res.filter(r=>r.ok).length,bad=res.filter(r=>!r.ok);
  const pct=res.length?Math.round(ok/res.length*100):0;
  return(
    <>
      <div className="done">
        <div className="eyebrow">Round complete</div>
        <div className="pct">{pct}%</div>
        <div style={{color:"var(--muted)",fontSize:14}}>{ok} of {res.length} correct</div>
      </div>
      {bad.length>0&&(
        <div className="review">
          <h4>To review</h4>
          <ul>{bad.map(r=><li key={r.it.k}><b>{r.it.c}</b> · {r.it.k}</li>)}</ul>
        </div>
      )}
      <div className="stack">
        {bad.length>0&&<button className="btn" autoFocus onClick={()=>onMissed(bad.map(r=>r.it))}>Drill missed ({bad.length})</button>}
        <div className="row2">
          <button className="btn ghost" onClick={onRetry}>Retry batch</button>
          <button className="btn ghost" autoFocus={!bad.length} onClick={onNew}>New batch</button>
        </div>
        <button className="btn plain" onClick={onClose}>Back to map</button>
      </div>
    </>
  );
}
