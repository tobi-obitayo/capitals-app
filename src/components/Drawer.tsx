import {useId,useRef,useState,type MouseEvent as ReactMouseEvent,type PointerEvent as ReactPointerEvent,type ReactNode,type RefObject} from "react";
import {DialogLayer,useDialogElement,useModalDialog} from "./useModalDialog";

interface Props{
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  title:string;
  /** replaces the visible title (the title stays for screen readers) */
  header?:ReactNode;
  children:ReactNode;
}

const DRAG_START=6;        // px of downward travel before a press on the header becomes a drag
const CLOSE_RATIO=.25;     // dragged past a quarter of the sheet
const CLOSE_VELOCITY=.5;   // or flicked faster than this (px/ms)

/** Drag the sheet down from its handle/header; past the threshold (or a flick) it closes, otherwise it springs back. */
function useDragToDismiss(ref:RefObject<HTMLDialogElement|null>,close:()=>void){
  const s=useRef<{id:number;y0:number;y:number;t:number;v:number;dragging:boolean}|null>(null);
  const dragged=useRef(false);

  const onPointerDown=(e:ReactPointerEvent)=>{
    if(e.button!==0)return;
    dragged.current=false;
    s.current={id:e.pointerId,y0:e.clientY,y:e.clientY,t:e.timeStamp,v:0,dragging:false};
  };
  const onPointerMove=(e:ReactPointerEvent)=>{
    const st=s.current,d=ref.current;
    if(!st||!d||e.pointerId!==st.id)return;
    const dy=e.clientY-st.y0;
    if(!st.dragging){
      if(dy<DRAG_START)return;
      st.dragging=true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      d.style.transition="none";
    }
    const dt=e.timeStamp-st.t;
    if(dt>0)st.v=(e.clientY-st.y)/dt;
    st.y=e.clientY;st.t=e.timeStamp;
    d.style.translate=`0 ${Math.max(0,dy)}px`;
  };
  const onPointerUp=(e:ReactPointerEvent)=>{
    const st=s.current,d=ref.current;
    s.current=null;
    if(!st||!d||!st.dragging)return;
    dragged.current=true;
    d.style.transition="";
    if(e.clientY-st.y0>d.offsetHeight*CLOSE_RATIO||st.v>CLOSE_VELOCITY){
      d.style.translate="0 100%";
      close();
    }else d.style.translate="";
  };
  // a press that became a drag must not also click a tab in the header
  const onClickCapture=(e:ReactMouseEvent)=>{
    if(!dragged.current)return;
    dragged.current=false;
    e.stopPropagation();e.preventDefault();
  };
  return {onPointerDown,onPointerMove,onPointerUp,onPointerCancel:onPointerUp,onClickCapture};
}

/** Mobile bottom sheet: a native modal <dialog> that slides up, closes on drag-down, backdrop tap, Esc or back. */
export function BottomDrawer({open,onOpenChange,title,header,children}:Props){
  const {ref,el,setRef}=useDialogElement();
  const titleId=useId();
  const [mounted,setMounted]=useState(open);
  if(open&&!mounted)setMounted(true);
  const close=()=>onOpenChange(false);

  useModalDialog(ref,{
    open,onClose:close,dismissible:true,lightDismiss:true,animateClose:true,
    onClosed:()=>{
      setMounted(false);
      ref.current?.style.removeProperty("translate");
    },
  });
  const drag=useDragToDismiss(ref,close);

  return(
    <dialog ref={setRef} className="drawer" tabIndex={-1} aria-labelledby={titleId} {...({closedby:"any"} as object)}>
      {mounted&&(
        <DialogLayer.Provider value={el}>
          <div className="drawer-grip" {...drag}>
            <button type="button" className="drawer-handle" aria-label="Close" onClick={close}/>
            <div className="drawer-head">
              <h2 id={titleId} className={header?"sr-only":"drawer-title"}>{title}</h2>
              {header}
            </div>
          </div>
          <div className="drawer-body">{children}</div>
        </DialogLayer.Provider>
      )}
    </dialog>
  );
}
