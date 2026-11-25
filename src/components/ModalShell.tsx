import {useEffect,useId,type ReactNode} from "react";
import {DialogLayer,closedByFor,useDialogElement,useModalDialog} from "./useModalDialog";

interface Props{
  title:string;
  sub:ReactNode;
  onClose:()=>void;
  /** Esc, back and backdrop taps close it (off for quizzes so a stray tap can't end one) */
  dismissible?:boolean;
  /** narrow screens: keep the map as a short strip (~120px) while typing */
  compactMap?:boolean;
  /** typing quizzes: no map pane at all */
  hideMap?:boolean;
  /** mobile setup: map fills the body; left column is hidden */
  setupMap?:boolean;
  headExtra?:ReactNode;
  right:ReactNode;
  children:ReactNode;
}

/** large modal: controls on the left, map on the right */
export function ModalShell({title,sub,onClose,dismissible=true,compactMap=false,hideMap=false,setupMap=false,headExtra,right,children}:Props){
  const {ref,el,setRef}=useDialogElement();
  const titleId=useId();
  useModalDialog(ref,{open:true,onClose,dismissible,lightDismiss:true});

  useEffect(()=>{
    const vv=window.visualViewport;
    if(!vv)return;
    const sync=()=>{
      const root=document.documentElement.style;
      const kb=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
      root.setProperty("--kb",`${kb}px`);
      // phones: the window is exactly the visible area (above the keyboard), not 100dvh
      root.setProperty("--vvh",`${vv.height}px`);
      root.setProperty("--vvt",`${vv.offsetTop}px`);
    };
    vv.addEventListener("resize",sync);
    vv.addEventListener("scroll",sync);
    sync();
    return()=>{
      vv.removeEventListener("resize",sync);
      vv.removeEventListener("scroll",sync);
      const root=document.documentElement.style;
      root.removeProperty("--kb");root.removeProperty("--vvh");root.removeProperty("--vvt");
    };
  },[]);

  const bodyClass="mbody"
    +(compactMap&&!hideMap&&!setupMap?" compact-map":"")
    +(hideMap?" hide-map":"")
    +(setupMap&&!hideMap?" setup-map":"");

  return(
    <dialog ref={setRef} tabIndex={-1} aria-labelledby={titleId}
      className={"modal"+(hideMap?" no-map":"")+(compactMap&&!hideMap?" compact-map":"")+(setupMap?" setup-map":"")}
      {...({closedby:closedByFor(dismissible,true)} as object)}>
      <DialogLayer.Provider value={el}>
        <div className="m-head">
          <div style={{flex:1}}><h2 id={titleId}>{title}</h2><p>{sub}</p></div>
          {headExtra}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className={bodyClass}>
          {!(setupMap&&!hideMap)&&<div className="left">{children}</div>}
          {!hideMap&&right}
        </div>
      </DialogLayer.Provider>
    </dialog>
  );
}
