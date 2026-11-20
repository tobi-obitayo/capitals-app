import {CONT_NAMES,type ContinentName} from "../data";
import {overall,resetProgress,stats,useProgress} from "../progress";
import {CROSS,SET_INFO,updateSettings,useSettings,type CountrySet} from "../sets";
import {Info,Kbd,Switch} from "./ui";
import {useWorldUnlocked} from "../unlock";
import {InfoPopover} from "./InfoPopover";
import {ToggleGroup,ToggleGroupItem} from "./ui/toggle-group";

const SET_NOTE:Record<CountrySet,string>={
  un:"UN members only",
  obs:"UN members + Vatican City, Palestine",
  all:"Everyone above + 7 more states",
};

interface Props{
  onClose:()=>void;
  onOpen:(cn:ContinentName)=>void;
  onHover:(cn:ContinentName|null)=>void;
}

const Bar=({mastered,learning,total}:{mastered:number;learning:number;total:number})=>(
  <span className="bar">
    <i className="learn" style={{width:`${(mastered+learning)/total*100}%`}}/>
    <i style={{width:`${mastered/total*100}%`}}/>
  </span>
);

/** title, progress, shortcuts: opens from the (i) button */
export function Panel({onClose,onOpen,onHover}:Props){
  useProgress();
  const settings=useSettings();
  const worldOpen=useWorldUnlocked();
  const o=overall();
  return(
    <div className="panel" id="panel" role="dialog" aria-label="About and progress">
      <div className="p-head">
        <div><h1>Capitals</h1><p>{o.total} countries · {CONT_NAMES.length} continents</p></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>

      <div className="p-sec first">
        <div className="lbl">Your progress
          <Info align="right">Darker on the map means you know more of that continent. A country counts as mastered after you get it right twice; a miss steps it back. Progress is saved in this browser.</Info>
        </div>
        <div className="p-big">{o.mastered}<span> / {o.total} mastered</span></div>
        <Bar mastered={o.mastered} learning={o.learning} total={o.total}/>
        <div className="p-sub">{o.learning} learning</div>
      </div>

      <div className="p-sec">
        {CONT_NAMES.map(cn=>{
          const s=stats(cn);
          return(
            <button key={cn} className="p-row" onClick={()=>onOpen(cn)} onMouseEnter={()=>onHover(cn)} onMouseLeave={()=>onHover(null)}>
              <span className="nm">{cn}</span><span className="ct">{s.mastered} / {s.total}</span>
              <Bar mastered={s.mastered} learning={s.learning} total={s.total}/>
            </button>
          );
        })}
      </div>

      <div className="p-sec">
        <div className="lbl">Countries
          <InfoPopover label="About the country sets">
            <p>Applies to the map, the drills and every quiz. Progress is kept per country, so you can switch back and forth.</p>
            <p className="mt-2"><b className="text-foreground">195</b> adds the UN observers Vatican City and Palestine. <b className="text-foreground">202</b> also adds Kosovo, Taiwan, Western Sahara, Somaliland, Northern Cyprus, Cook Islands and Niue.</p>
            <p className="mt-2">Anyone left out is greyed on the map. Somaliland counts as Somalia and Northern Cyprus as Cyprus until all states are on.</p>
          </InfoPopover>
        </div>
        <ToggleGroup type="single" variant="outline" value={settings.set} aria-label="Which countries count"
          onValueChange={v=>{if(v)updateSettings({set:v as CountrySet})}} className="w-full">
          {(Object.keys(SET_INFO) as CountrySet[]).map(k=>(
            <ToggleGroupItem key={k} value={k} className="h-10 flex-1 font-semibold tabular-nums data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
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
      </div>

      <div className="p-sec kbd-only">
        <div className="lbl">Shortcuts</div>
        <div className="keys">
          <div><span>Open a continent</span><span><Kbd>1</Kbd>–<Kbd>6</Kbd></span></div>
          {worldOpen&&<div><span>World (all countries)</span><Kbd>7</Kbd></div>}
          <div><span>Continent list</span><Kbd>C</Kbd></div>
          <div><span>Flat / Globe</span><Kbd>F</Kbd></div>
          <div><span>This panel</span><Kbd>I</Kbd></div>
          <div><span>Close</span><Kbd>Esc</Kbd></div>
        </div>
        <div className="p-sub" style={{marginTop:10}}>Globe: drag to spin in any direction, scroll or pinch to zoom. Use the arrow at the bottom (or C) for the continent list.</div>
      </div>
      <div className="p-sec touch-only">
        <div className="p-sub">Tap a continent on the map or open the list with the arrow at the bottom. On the globe, drag to spin and pinch to zoom.</div>
      </div>

      <button className="link" onClick={()=>{if(confirm("Reset all saved progress?"))resetProgress()}}>Reset all progress</button>
    </div>
  );
}
