import {useEffect,useState} from "react";
import {CONT_NAMES,type ContinentName} from "../data";
import {overall,stats,useProgress} from "../progress";
import {CROSS,SET_INFO,updateSettings,useSettings,type CountrySet} from "../sets";
import {useWorldUnlocked} from "../unlock";
import {BottomDrawer} from "./Drawer";
import {InfoPopover} from "./InfoPopover";
import {ResetProgressDialog} from "./ResetProgressDialog";
import {Kbd,Seg,Switch} from "./ui";
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
    <p className="mt-2">A country is mastered after two correct answers in a row; a miss steps it back. Progress is saved in this browser.</p>
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
    </>
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
