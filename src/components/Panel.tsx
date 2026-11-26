import {useEffect,useId,useRef,useState} from "react";
import {toast} from "sonner";
import {ArrowUpRightIcon,CoffeeIcon} from "lucide-react";
import {CONT_NAMES,type ContinentName} from "../data";
import {currentCode,restoreCode} from "../backup";
import {overall,stats,useProgress} from "../progress";
import {CROSS,SET_INFO,updateSettings,useSettings,type CountrySet} from "../sets";
import {useWorldUnlocked} from "../unlock";
import {BottomDrawer} from "./Drawer";
import {InfoPopover} from "./InfoPopover";
import {ResetProgressDialog} from "./ResetProgressDialog";
import {Kbd,Seg,Switch} from "./ui";
import {Button} from "./ui/button";
import {Textarea} from "./ui/textarea";
import {ToggleGroup,ToggleGroupItem} from "./ui/toggle-group";

const SET_NOTE:Record<CountrySet,string>={
  un:"UN members only",
  obs:"UN members + Vatican City, Palestine",
  all:"Everyone above + 7 more states",
};

type View="progress"|"settings";
const TABS:{value:View;label:string}[]=[{value:"progress",label:"Progress"},{value:"settings",label:"Settings"}];

interface SharedProps{
  onOpen:(cn:ContinentName)=>void;
  onHover:(cn:ContinentName|null)=>void;
}

interface AboutProps extends SharedProps{
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  mobile:boolean;
}

const Bar=({mastered,learning,total}:{mastered:number;learning:number;total:number})=>(
  <span className="bar">
    <i className="learn" style={{width:`${(mastered+learning)/total*100}%`}}/>
    <i style={{width:`${mastered/total*100}%`}}/>
  </span>
);

/** one number, one bar; the rules of mastery live in the (i) next to the title */
const ProgressInfo=()=>(
  <InfoPopover label="How progress works">
    <p>Darker continents on the map are ones you know better.</p>
    <p className="mt-2">Each correct answer moves a country up a step and each miss moves it back one. Two steps up and it is mastered. Progress is saved in this browser.</p>
  </InfoPopover>
);

function ProgressBody({onOpen,onHover}:SharedProps){
  const o=overall();
  return(
    <>
      <div className="p-hero">
        <div className="p-big">{o.mastered}<span> / {o.total} mastered</span><ProgressInfo/></div>
        <span className="p-learning"><i aria-hidden="true"/>{o.learning} learning</span>
      </div>
      <Bar mastered={o.mastered} learning={o.learning} total={o.total}/>
      <div className="p-sec" style={{marginTop:14,paddingTop:6}}>
        {CONT_NAMES.map(cn=>{
          const s=stats(cn);
          return(
            <button key={cn} type="button" className="p-row" onClick={()=>onOpen(cn)}
              onMouseEnter={()=>onHover(cn)} onMouseLeave={()=>onHover(null)}>
              <span className="nm">{cn}</span><span className="ct">{s.mastered} / {s.total}</span>
              <Bar mastered={s.mastered} learning={s.learning} total={s.total}/>
            </button>
          );
        })}
      </div>
      <SupportCreator/>
    </>
  );
}

const REPO_URL="https://github.com/tobi-obitayo/capitals-app";

const GitHubMark=()=>(
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
  </svg>
);

/** set to your Ko-fi page (e.g. "https://ko-fi.com/yourname"); the button only shows once this is filled in */
const KOFI_URL="https://ko-fi.com/tobiobitayo";

const supportLink="text-foreground no-underline hover:text-accent-foreground";

/** quiet footer of the Progress tab: one sentence, one or two links */
function SupportCreator(){
  return(
    <div className="p-sec">
      <div className="lbl">Support the creator</div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Learn Capitals is free, open source and has no ads. If it helped you learn, {KOFI_URL?"a star or a coffee":"a star on GitHub"} means a lot.
      </p>
      <div className={"mt-3 grid gap-2"+(KOFI_URL?" grid-cols-2":"")}>
        <Button asChild variant="outline" size="sm" className={supportLink}>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <GitHubMark/>{KOFI_URL?"GitHub":"Star on GitHub"}<ArrowUpRightIcon className="text-muted-foreground"/>
          </a>
        </Button>
        {KOFI_URL&&(
          <Button asChild variant="outline" size="sm" className={supportLink}>
            <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
              <CoffeeIcon/>Ko-fi<ArrowUpRightIcon className="text-muted-foreground"/>
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** copy code: back up progress as one pasteable line (see src/backup.ts for the format and the privacy notes) */
function BackupSection(){
  const [mode,setMode]=useState<"copy"|"restore"|null>(null);
  const [shown,setShown]=useState("");
  const [error,setError]=useState("");
  const areaRef=useRef<HTMLTextAreaElement>(null);
  const areaId=useId();

  const copy=async()=>{
    const code=currentCode();
    setError("");
    try{
      await navigator.clipboard.writeText(code);
      setMode(null);
      toast("Code copied. Keep it somewhere safe.");
    }catch{
      // clipboard blocked: show the code so it can be copied by hand
      setShown(code);setMode("copy");
      requestAnimationFrame(()=>areaRef.current?.select());
    }
  };
  const restore=()=>{
    const r=restoreCode(areaRef.current?.value??"");
    if(!r.ok){setError(r.error);return}
    setMode(null);setError("");
    toast(r.updated?`Restored ${r.updated} ${r.updated===1?"country":"countries"}`:"Already up to date");
  };

  return(
    <div className="p-sec">
      <div className="lbl">Back up progress
        <InfoPopover label="About backup codes">
          <p>Progress lives only in this browser. Copy a code, keep it in your notes, and paste it on another device or after clearing your data.</p>
          <p className="mt-2">Nothing is uploaded. The code holds only your level for each country, so keep it as private as you like.</p>
          <p className="mt-2">Restoring keeps the higher level for each country, so it never lowers your progress.</p>
        </InfoPopover>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>Copy code</Button>
        <Button type="button" variant="outline" size="sm" aria-expanded={mode==="restore"}
          onClick={()=>{setError("");setShown("");setMode(m=>m==="restore"?null:"restore")}}>Restore</Button>
      </div>
      {mode&&(
        <div className="mt-3 grid gap-2">
          <Textarea key={mode} ref={areaRef} id={areaId} rows={3} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"
            aria-label={mode==="copy"?"Your code":"Paste your code"} aria-invalid={!!error} aria-describedby={error?areaId+"-err":undefined}
            readOnly={mode==="copy"} defaultValue={shown} placeholder="CAP1-…" autoFocus={mode==="restore"}
            onChange={()=>setError("")}
            className="min-h-0 resize-none break-all font-mono text-base md:text-xs"/>
          {error&&<p id={areaId+"-err"} role="alert" className="text-xs text-destructive">{error}</p>}
          {mode==="restore"
            ?<Button type="button" size="sm" onClick={restore}>Restore progress</Button>
            :<p className="text-xs text-muted-foreground">This browser blocked copying. Select the code above and copy it.</p>}
        </div>
      )}
    </div>
  );
}

function SettingsBody({onReset}:{onReset:()=>void}){
  const settings=useSettings();
  const worldOpen=useWorldUnlocked();
  return(
    <>
      <div className="lbl">Countries
        <InfoPopover label="About the country sets">
          <p>Applies to the map, the drills and every quiz. Progress is kept per country, so you can switch back and forth.</p>
          <p className="mt-2"><b className="text-foreground">195</b> adds the UN observers Vatican City and Palestine. <b className="text-foreground">202</b> also adds Kosovo, Taiwan, Western Sahara, Somaliland, Northern Cyprus, Cook Islands and Niue.</p>
          <p className="mt-2">Anyone left out is greyed on the map. Somaliland counts as Somalia and Northern Cyprus as Cyprus until all states are on.</p>
        </InfoPopover>
      </div>
      <ToggleGroup type="single" spacing={1} value={settings.set} aria-label="Which countries count"
        onValueChange={v=>{if(v)updateSettings({set:v as CountrySet})}}
        className="w-full rounded-[10px] border border-border bg-muted p-[3px]">
        {(Object.keys(SET_INFO) as CountrySet[]).map(k=>(
          <ToggleGroupItem key={k} value={k}
            className="h-10 flex-1 rounded-[7px] font-semibold tabular-nums text-muted-foreground hover:bg-transparent hover:text-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            aria-label={`${SET_INFO[k].label}, ${SET_INFO[k].total} countries`}>
            {SET_INFO[k].short}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="p-sub">{SET_NOTE[settings.set]}</div>
      <div className="toggle-row p-toggle">
        <Switch on={settings.cross} onChange={v=>updateSettings({cross:v})} label="Transcontinental"/>
        <span>Transcontinental</span>
        <InfoPopover label="About transcontinental countries">
          <p>Also quizzed in the neighbouring continent: {Object.entries(CROSS).map(([k,cn])=>`${k} (${cn})`).join(", ")}.</p>
          <p className="mt-2">Off, each one stays in a single continent (Russia in Europe, Turkey in Asia).</p>
        </InfoPopover>
      </div>

      <div className="p-sec kbd-only">
        <div className="lbl">Shortcuts
          <InfoPopover label="Map gestures">
            <p>Globe: drag to spin in any direction, scroll or pinch to zoom.</p>
          </InfoPopover>
        </div>
        <div className="keys2">
          <div><span className="k"><Kbd>1</Kbd>–<Kbd>6</Kbd></span>Continent</div>
          {worldOpen&&<div><span className="k"><Kbd>7</Kbd></span>World</div>}
          <div><span className="k"><Kbd>C</Kbd></span>List</div>
          <div><span className="k"><Kbd>F</Kbd></span>Flat / Globe</div>
          <div><span className="k"><Kbd>I</Kbd></span>This panel</div>
          <div><span className="k"><Kbd>Esc</Kbd></span>Close</div>
        </div>
      </div>
      <div className="p-sec touch-only">
        <div className="p-sub" style={{marginTop:0}}>Tap a continent · drag to spin · pinch to zoom</div>
      </div>

      <BackupSection/>

      <button type="button" className="link reset-link" onClick={onReset}>Reset all progress</button>
    </>
  );
}

/** One surface, two tabs: Progress (default) and Settings. bottom drawer on mobile, left inspector on desktop. */
export function AboutPanel({open,onOpenChange,onOpen,onHover,mobile}:AboutProps){
  useProgress();
  const [view,setView]=useState<View>("progress");
  const [resetOpen,setResetOpen]=useState(false);

  // always reopens on Progress (after the sheet has slid away, so its content does not jump)
  useEffect(()=>{
    if(open)return;
    setResetOpen(false);
    const id=window.setTimeout(()=>setView("progress"),300);
    return()=>window.clearTimeout(id);
  },[open]);

  const tabs=(full:boolean)=><Seg full={full} label="Progress or settings" value={view} onChange={setView} options={TABS}/>;

  const body=view==="progress"
    ?<ProgressBody onOpen={onOpen} onHover={onHover}/>
    :<SettingsBody onReset={()=>setResetOpen(true)}/>;

  const dialog=<ResetProgressDialog open={resetOpen} onOpenChange={setResetOpen}/>;

  if(mobile){
    return(
      <BottomDrawer open={open} onOpenChange={onOpenChange} title="About and progress" header={tabs(true)}>
        {body}
        {/* inside the sheet, so opening it does not count as an outside interaction that closes the sheet */}
        {dialog}
      </BottomDrawer>
    );
  }

  if(!open)return null;

  return(
    <>
      <div className="panel" id="panel" role="dialog" aria-label="About and progress">
        <div className="p-head">
          {tabs(false)}
          <button type="button" className="icon-btn panel-x" aria-label="Close" onClick={()=>onOpenChange(false)}>✕</button>
        </div>
        {body}
      </div>
      {dialog}
    </>
  );
}
