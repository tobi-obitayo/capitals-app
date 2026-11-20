import {forwardRef} from "react";
import {CONT_NAMES,WORLD,type ContinentName,type Scope} from "../data";
import {LockIcon} from "lucide-react";
import {stats,useProgress} from "../progress";
import {useWorldUnlocked,WORLD_UNLOCK_AT} from "../unlock";

interface Props{
  open:boolean;
  onOpen:(cn:Scope)=>void;
  onHover:(cn:ContinentName|null)=>void;
}

/** the six continent buttons plus World; slides up when opened (click only, never on hover) */
export const Dock=forwardRef<HTMLDivElement,Props>(function Dock({open,onOpen,onHover},ref){
  useProgress();
  const worldOpen=useWorldUnlocked();
  return(
    <div ref={ref} className={"dock"+(open?" show":"")} id="dock" aria-label="Continents">
      {([...CONT_NAMES,WORLD] as Scope[]).map((cn,i)=>{
        const s=stats(cn);
        const hl=(cn===WORLD?null:cn) as ContinentName|null;
        const locked=cn===WORLD&&!worldOpen;
        return(
          <button key={cn} className={"chip"+(cn===WORLD?" world":"")+(locked?" locked":"")} tabIndex={open&&!locked?0:-1}
            disabled={locked} onClick={()=>onOpen(cn)} onMouseEnter={()=>onHover(hl)} onMouseLeave={()=>onHover(null)}
            onFocus={()=>onHover(hl)} onBlur={()=>onHover(null)}>
            <span className="top"><span className="nm">{cn}</span>{locked?<LockIcon size={13} aria-hidden="true"/>:<kbd className="kbd-only">{i+1}</kbd>}</span>
            <span className="ct">{locked?`Unlocks at ${Math.round(WORLD_UNLOCK_AT*100)}%`:`${s.mastered} / ${s.total} mastered`}</span>
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
