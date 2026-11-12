import {CONT_NAMES,type ContinentName} from "../data";
import {overall,resetProgress,stats,useProgress} from "../progress";
import {Info,Kbd} from "./ui";

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

      <div className="p-sec kbd-only">
        <div className="lbl">Shortcuts</div>
        <div className="keys">
          <div><span>Open a continent</span><span><Kbd>1</Kbd>–<Kbd>6</Kbd></span></div>
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
