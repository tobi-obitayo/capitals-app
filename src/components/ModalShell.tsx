import type {ReactNode} from "react";

interface Props{
  title:string;
  sub:ReactNode;
  onClose:()=>void;
  /** clicking the dimmed backdrop closes (off for quizzes so a stray click can't end one) */
  dismissOnBackdrop?:boolean;
  headExtra?:ReactNode;
  right:ReactNode;
  children:ReactNode;
}

/** large modal: controls on the left, map on the right */
export function ModalShell({title,sub,onClose,dismissOnBackdrop=true,headExtra,right,children}:Props){
  return(
    <div className="overlay" onPointerDown={e=>{if(dismissOnBackdrop&&e.target===e.currentTarget)onClose()}}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-head">
          <div style={{flex:1}}><h2>{title}</h2><p>{sub}</p></div>
          {headExtra}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="mbody">
          <div className="left">{children}</div>
          {right}
        </div>
      </div>
    </div>
  );
}
