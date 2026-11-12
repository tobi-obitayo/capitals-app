import {forwardRef} from "react";
import {CONT_NAMES,type ContinentName} from "../data";
import {stats,useProgress} from "../progress";

interface Props{
  open:boolean;
  onOpen:(cn:ContinentName)=>void;
  onHover:(cn:ContinentName|null)=>void;
}

/** the six continent buttons; slides up when opened (click only, never on hover) */
export const Dock=forwardRef<HTMLDivElement,Props>(function Dock({open,onOpen,onHover},ref){
  useProgress();
  return(
    <div ref={ref} className={"dock"+(open?" show":"")} id="dock" aria-label="Continents">
      {CONT_NAMES.map((cn,i)=>{
        const s=stats(cn);
        return(
          <button key={cn} className="chip" tabIndex={open?0:-1}
            onClick={()=>onOpen(cn)} onMouseEnter={()=>onHover(cn)} onMouseLeave={()=>onHover(null)}
            onFocus={()=>onHover(cn)} onBlur={()=>onHover(null)}>
            <span className="top"><span className="nm">{cn}</span><kbd>{i+1}</kbd></span>
            <span className="ct">{s.mastered} / {s.total} mastered</span>
            <span className="bar">
              <i className="learn" style={{width:`${(s.mastered+s.learning)/s.total*100}%`}}/>
              <i style={{width:`${s.mastered/s.total*100}%`}}/>
            </span>
          </button>
        );
      })}
    </div>
  );
});
