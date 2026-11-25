import {Path2D as NodePath2D} from "@napi-rs/canvas";

/* jsdom and bare node have no Path2D; the map caches its outlines in them, and @napi-rs/canvas's contexts only accept its own */
if(typeof (globalThis as any).Path2D==="undefined")(globalThis as any).Path2D=NodePath2D;

/* jsdom has no <dialog> methods; open/close just toggle the attribute and fire `close` like a browser */
const Dialog=(globalThis as any).HTMLDialogElement;
if(Dialog&&typeof Dialog.prototype.showModal!=="function"){
  const P=Dialog.prototype;
  if(!("open" in P))Object.defineProperty(P,"open",{
    get(){return this.hasAttribute("open")},
    set(v:boolean){this.toggleAttribute("open",!!v)},
    configurable:true,
  });
  P.show=P.showModal=function(this:HTMLDialogElement){this.setAttribute("open","")};
  P.close=function(this:HTMLDialogElement){
    if(!this.hasAttribute("open"))return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
