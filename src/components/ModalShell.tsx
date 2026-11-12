import {useEffect,type ReactNode} from "react";

interface Props{
  title:string;
  sub:ReactNode;
  onClose:()=>void;
  /** clicking the dimmed backdrop closes (off for quizzes so a stray click can't end one) */
  dismissOnBackdrop?:boolean;
  /** narrow screens: keep the map as a short strip (~120px) while typing */
  compactMap?:boolean;
  headExtra?:ReactNode;
  right:ReactNode;
  children:ReactNode;
}

/** large modal: controls on the left, map on the right */
export function ModalShell({title,sub,onClose,dismissOnBackdrop=true,compactMap=false,headExtra,right,children}:Props){
  useEffect(()=>{
    const vv=window.visualViewport;
    if(!vv)return;
    const sync=()=>{
      const kb=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
      document.documentElement.style.setProperty("--kb",`${kb}px`);
    };
    vv.addEventListener("resize",sync);
    vv.addEventListener("scroll",sync);
    sync();
    return()=>{
      vv.removeEventListener("resize",sync);
      vv.removeEventListener("scroll",sync);
      document.documentElement.style.removeProperty("--kb");
    };
  },[]);

  return(
    <div className="overlay" onPointerDown={e=>{if(dismissOnBackdrop&&e.target===e.currentTarget)onClose()}}>
      <div className={"modal"+(compactMap?" compact-map":"")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-head">
          <div style={{flex:1}}><h2>{title}</h2><p>{sub}</p></div>
          {headExtra}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className={"mbody"+(compactMap?" compact-map":"")}>
          <div className="left">{children}</div>
          {right}
        </div>
      </div>
    </div>
  );
}
