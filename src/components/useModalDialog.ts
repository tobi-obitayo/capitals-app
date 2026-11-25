import {createContext,useCallback,useContext,useLayoutEffect,useRef,useState,type RefObject} from "react";

/** The open <dialog> an element lives in, so portals (Radix popovers) can render inside the top layer. */
export const DialogLayer=createContext<HTMLDialogElement|null>(null);
export const useDialogLayer=()=>useContext(DialogLayer);

/** A ref for the <dialog> plus the element as state, for the DialogLayer provider value. */
export function useDialogElement(){
  const ref=useRef<HTMLDialogElement|null>(null);
  const [el,setEl]=useState<HTMLDialogElement|null>(null);
  const setRef=useCallback((n:HTMLDialogElement|null)=>{ref.current=n;setEl(n)},[]);
  return {ref,el,setRef};
}

interface Options{
  open:boolean;
  onClose:()=>void;
  /** Esc / back / outside-tap may close it (off for a running quiz) */
  dismissible?:boolean;
  /** tapping the backdrop closes it, not just Esc */
  lightDismiss?:boolean;
  /** keep it in the top layer until its exit transition has finished */
  animateClose?:boolean;
  /** element to focus on open; defaults to the dialog itself */
  initialFocus?:()=>HTMLElement|null;
  /** fires once the dialog has actually closed (after any exit transition) */
  onClosed?:()=>void;
}

const supportsClosedBy=typeof HTMLDialogElement!=="undefined"&&"closedBy" in HTMLDialogElement.prototype;

/**
 * When the current press began (-1 if none). A dialog opened from a pointerup (a map tap) would otherwise be
 * light-dismissed by that same press: Chrome runs closedby=any after pointerup and sees it started outside.
 */
let pressStartedAt=-1;
if(typeof document!=="undefined"){
  document.addEventListener("pointerdown",()=>{pressStartedAt=performance.now()},true);
  const end=()=>setTimeout(()=>{pressStartedAt=-1});
  document.addEventListener("pointerup",end,true);
  document.addEventListener("pointercancel",end,true);
}

/** Native top-layer popovers (the toast layer) shown before a modal sit under it; re-show them on top. */
function raiseToastLayers(){
  for(const el of document.querySelectorAll<HTMLElement>("[data-toast-layer]")){
    if(typeof el.showPopover!=="function")continue;
    try{if(el.matches(":popover-open"))el.hidePopover();el.showPopover()}catch{}
  }
}

async function waitForExit(d:HTMLDialogElement){
  d.setAttribute("data-closing","");
  const anims=d.getAnimations?.({subtree:true})??[];
  if(anims.length)await Promise.race([
    Promise.allSettled(anims.map(a=>a.finished)),
    new Promise(r=>setTimeout(r,600)),
  ]);
  d.removeAttribute("data-closing");
}

export function closedByFor(dismissible:boolean,lightDismiss:boolean){
  return !dismissible?"none":lightDismiss?"any":"closerequest";
}

/**
 * Drives a native modal <dialog> from React state: showModal()/close(), Esc and back via `cancel`,
 * outside taps via closedby (with a pointer fallback where closedby is unsupported), focus return on close.
 */
export function useModalDialog(ref:RefObject<HTMLDialogElement|null>,opts:Options){
  const latest=useRef(opts);
  latest.current=opts;
  const wantOpen=useRef(false);
  const closeRequested=useRef(false);
  const openedAt=useRef(0);

  useLayoutEffect(()=>{
    const d=ref.current;
    if(!d)return;
    const requestClose=()=>{
      if(closeRequested.current||!latest.current.dismissible)return;
      closeRequested.current=true;
      latest.current.onClose();
    };
    const fromOpeningPress=()=>pressStartedAt>=0&&pressStartedAt<openedAt.current;
    const onCancel=(e:Event)=>{
      e.preventDefault();
      if(!fromOpeningPress())requestClose();
    };
    const onCloseEvent=()=>{
      // `close` is queued, so it can arrive after a reopen (StrictMode re-runs effects); only act if still closed
      if(!wantOpen.current||d.open)return;
      // closed by the browser itself (repeated Esc without user activation, closedby light dismiss)
      if(latest.current.dismissible&&!fromOpeningPress())requestClose();
      else if(d.isConnected&&typeof d.showModal==="function")d.showModal();
    };
    let downOutside=false;
    const outside=(e:PointerEvent)=>{
      const r=d.getBoundingClientRect();
      return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;
    };
    const onDown=(e:PointerEvent)=>{downOutside=e.target===d&&outside(e)};
    const onUp=(e:PointerEvent)=>{
      if(downOutside&&e.target===d&&outside(e)&&latest.current.lightDismiss)requestClose();
      downOutside=false;
    };
    d.addEventListener("cancel",onCancel);
    d.addEventListener("close",onCloseEvent);
    if(!supportsClosedBy){
      d.addEventListener("pointerdown",onDown);
      d.addEventListener("pointerup",onUp);
    }
    return()=>{
      d.removeEventListener("cancel",onCancel);
      d.removeEventListener("close",onCloseEvent);
      d.removeEventListener("pointerdown",onDown);
      d.removeEventListener("pointerup",onUp);
      wantOpen.current=false;
      // runs before React detaches the node, so close() still hands focus back to the opener
      if(d.open)d.close();
    };
  },[ref]);

  useLayoutEffect(()=>{
    const d=ref.current;
    if(!d)return;
    wantOpen.current=opts.open;
    if(opts.open){
      closeRequested.current=false;
      if(d.open){d.removeAttribute("data-closing");return}
      openedAt.current=performance.now();
      if(typeof d.showModal==="function")d.showModal();
      else d.setAttribute("open","");
      raiseToastLayers();
      (latest.current.initialFocus?.()??d).focus({preventScroll:true});
      return;
    }
    if(!d.open)return;
    let cancelled=false;
    (async()=>{
      if(latest.current.animateClose)await waitForExit(d);
      if(cancelled||wantOpen.current)return;
      d.close();
      latest.current.onClosed?.();
    })();
    return()=>{cancelled=true};
  },[ref,opts.open]);
}
