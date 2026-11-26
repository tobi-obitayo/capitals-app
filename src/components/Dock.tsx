import {forwardRef,useRef,type PointerEvent as ReactPointerEvent} from "react";
import {CONT_NAMES,WORLD,type ContinentName,type Scope} from "../data";
import {LockIcon,XIcon} from "lucide-react";
import {stats,useProgress} from "../progress";
import {useWorldUnlocked,WORLD_UNLOCK_AT} from "../unlock";

interface Props{
  open:boolean;
  onOpen:(cn:Scope)=>void;
  onHover:(cn:ContinentName|null)=>void;
  onClose:()=>void;
  /** phones: 1 = grab bar + close button on the list, 2 = the chevron rides on the list's top edge */
  variant:1|2;
}

const SWIPE_CLOSE=40;   // px dragged down on the grab bar that closes the list

/** the six continent buttons plus World; slides up when opened (click only, never on hover) */
export const Dock=forwardRef<HTMLDivElement,Props>(function Dock({open,onOpen,onHover,onClose,variant},ref){
  useProgress();
  const worldOpen=useWorldUnlocked();
  const drag=useRef<{id:number;y:number}|null>(null);
  const down=(e:ReactPointerEvent)=>{if(e.button===0)drag.current={id:e.pointerId,y:e.clientY}};
  const move=(e:ReactPointerEvent)=>{
    const d=drag.current;
    if(d&&e.pointerId===d.id&&e.clientY-d.y>SWIPE_CLOSE){drag.current=null;onClose()}
  };
  const end=()=>{drag.current=null};
  return(
    <div ref={ref} className={"dock"+(open?" show":"")+(variant===1?" dock-v1":"")} id="dock" aria-label="Continents">
      {variant===1&&(
        <div className="dock-head" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <span className="dock-grip" aria-hidden="true"/>
          <span className="dock-title">Continents</span>
          <button type="button" className="icon-btn dock-x" aria-label="Close continent list" tabIndex={open?0:-1}
            onPointerDown={e=>e.stopPropagation()} onClick={onClose}><XIcon size={18} aria-hidden="true"/></button>
        </div>
      )}
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
