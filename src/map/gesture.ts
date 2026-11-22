/**
 * Shared pan / zoom input for the flat world map and the quiz maps.
 *
 * Pointer and wheel handlers only record what the user did; `tick()` (called once per animation frame)
 * applies it. So a 120 Hz touch screen costs one layout and one draw per frame, not one per event.
 * Feel, borrowed from MapLibre and Leaflet:
 *  - wheel notches ease toward a target zoom (and keep easing if more notches arrive), trackpad pinch follows directly
 *  - two fingers zoom and pan together, straight from the finger distance, with no thresholds and no snapping
 *  - zoom buttons use the same easing, so pressing them repeatedly is one smooth motion
 *  - a flick keeps panning and slows down smoothly
 */

/** what the controller moves. Zoom is a plain number (1 = home); (x, y) are canvas pixels. */
export interface Camera{
  zoom():number;
  range():[number,number];
  /** set the zoom, keeping the screen point (x, y) where it is */
  zoomAt(x:number,y:number,zoom:number):void;
  panBy(dx:number,dy:number):void;
}

/** wheel: ln(zoom) per pixel of scroll (a mouse notch is about 100 px) */
export const WHEEL_RATE=.0015;
/** trackpad pinch arrives as a wheel event with ctrlKey held, in much smaller steps */
export const PINCH_RATE=.01;
/** time constant (ms) of the zoom easing */
export const ZOOM_TAU=90;
/** no single wheel event may zoom by more than this (ln units) */
const MAX_STEP=.7;

export interface WheelLike{deltaY:number;deltaMode?:number;ctrlKey?:boolean}
/** how much one wheel event zooms, in ln(zoom): positive = zoom in */
export function wheelLogDelta(e:WheelLike):number{
  const px=e.deltaMode===1?e.deltaY*40:e.deltaMode===2?e.deltaY*800:e.deltaY;   // lines and pages to pixels
  const d=-px*(e.ctrlKey?PINCH_RATE:WHEEL_RATE);
  return Math.max(-MAX_STEP,Math.min(MAX_STEP,d));
}

/** pan momentum */
export const PAN_TAU=320;
/** px/ms: slower than this on release is just a drag (about 80 px/s) */
export const PAN_FLING_MIN=.08;
export const PAN_FLING_MAX=4;
export const PAN_STOP=.01;
/** only the last stretch of the drag decides how hard you flicked */
const PAN_WINDOW_MS=100;
/** a pause before letting go cancels the flick */
const PAN_STALE_MS=80;

interface PanSample{t:number;x:number;y:number}
/** velocity (px/ms) of a drag ending at `now`, or null for a slow or stale one */
export function panVelocity(list:PanSample[],now:number):{vx:number;vy:number}|null{
  if(list.length<2)return null;
  const a=list[0],b=list[list.length-1];
  if(now-b.t>PAN_STALE_MS)return null;
  const dt=b.t-a.t;
  if(dt<8)return null;
  let vx=(b.x-a.x)/dt,vy=(b.y-a.y)/dt;
  const sp=Math.hypot(vx,vy);
  if(sp<PAN_FLING_MIN)return null;
  if(sp>PAN_FLING_MAX){vx*=PAN_FLING_MAX/sp;vy*=PAN_FLING_MAX/sp}
  return{vx,vy};
}

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));

export class Gestures{
  /** ln(zoom) being eased toward (NaN = not zooming) */
  private target=NaN;
  private ax=0;private ay=0;
  /** apply the target at once instead of easing (trackpad pinch) */
  private direct=false;
  private panX=0;private panY=0;
  private drag:null|{on:boolean;x:number;y:number;lx:number;ly:number}=null;
  private samples:PanSample[]=[];
  private pinch:null|{z0:number;d0:number;mx:number;my:number;cur:null|{mx:number;my:number;dist:number}}=null;
  private vel:null|{vx:number;vy:number}=null;
  private last=0;
  /** performance.now() of the last frame in which something moved */
  moved=-1e9;

  constructor(private cam:Camera){}

  /** something is still in motion or waiting to be applied: keep ticking */
  busy():boolean{
    return !Number.isNaN(this.target)||!!this.vel||!!this.pinch||!!(this.drag&&this.drag.on)||this.panX!==0||this.panY!==0;
  }
  /** stop easing and coasting (a finger came down, the view was reset) */
  stop(){this.target=NaN;this.vel=null;this.panX=this.panY=0}

  private aim(ln:number,x:number,y:number,direct:boolean){
    const [lo,hi]=this.cam.range();
    const from=Number.isNaN(this.target)?Math.log(this.cam.zoom()):this.target;
    this.target=clamp(from+ln,Math.log(lo),Math.log(hi));
    this.ax=x;this.ay=y;this.direct=direct;this.vel=null;
  }
  /** a wheel event over (x, y); returns false when it is a sideways pan the caller should handle */
  wheel(e:WheelLike&{deltaX:number},x:number,y:number){
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&!e.ctrlKey){this.panX-=e.deltaX;this.vel=null;return}
    this.aim(wheelLogDelta(e),x,y,!!e.ctrlKey);
  }
  /** zoom by a factor (the +/- buttons and keys) about (x, y) */
  zoomBy(factor:number,x:number,y:number){this.aim(Math.log(factor),x,y,false)}

  dragBegin(x:number,y:number){this.vel=null;this.drag={on:false,x,y,lx:x,ly:y};this.samples=[]}
  /** the drag has gone past the tap slop: from now on it pans (from where the finger first came down) */
  dragGo(){if(this.drag)this.drag.on=true}
  dragTo(x:number,y:number,t:number){
    if(!this.drag)return;
    this.drag.x=x;this.drag.y=y;
    this.samples.push({t,x,y});
    while(this.samples.length>2&&t-this.samples[0].t>PAN_WINDOW_MS)this.samples.shift();
  }
  /** finger lifted: a quick flick leaves the map coasting (unless `fling` is false, e.g. reduced motion) */
  dragEnd(now:number,fling=true){
    const d=this.drag;
    this.dragFlush();   // the last bit of movement still waiting for a frame
    this.drag=null;
    if(d&&d.on&&fling)this.vel=panVelocity(this.samples,now);
    this.samples=[];
  }
  private dragFlush(){
    const d=this.drag;
    if(d&&d.on&&(d.x!==d.lx||d.y!==d.ly)){this.cam.panBy(d.x-d.lx,d.y-d.ly);d.lx=d.x;d.ly=d.y}
  }

  pinchBegin(ax:number,ay:number,bx:number,by:number){
    this.stop();this.drag=null;
    const d=Math.hypot(ax-bx,ay-by);
    this.pinch=d>0?{z0:this.cam.zoom(),d0:d,mx:(ax+bx)/2,my:(ay+by)/2,cur:null}:null;
  }
  pinchTo(ax:number,ay:number,bx:number,by:number){
    if(this.pinch)this.pinch.cur={mx:(ax+bx)/2,my:(ay+by)/2,dist:Math.hypot(ax-bx,ay-by)};
  }
  pinchEnd(){this.pinch=null}
  pinching(){return this.pinch!==null}

  /** apply everything recorded since the last frame; true if the camera moved */
  tick(now:number):boolean{
    const dt=clamp(this.last?now-this.last:16,1,50);
    this.last=now;
    let moved=false;
    const [lo,hi]=this.cam.range();

    if(this.panX||this.panY){this.cam.panBy(this.panX,this.panY);this.panX=this.panY=0;moved=true}

    const p=this.pinch;
    if(p&&p.cur){
      const c=p.cur;p.cur=null;
      if(c.mx!==p.mx||c.my!==p.my){this.cam.panBy(c.mx-p.mx,c.my-p.my);p.mx=c.mx;p.my=c.my}
      this.cam.zoomAt(c.mx,c.my,clamp(p.z0*c.dist/p.d0,lo,hi));
      moved=true;
    }

    const d=this.drag;
    if(d&&d.on&&(d.x!==d.lx||d.y!==d.ly)){this.dragFlush();moved=true}

    if(!Number.isNaN(this.target)){
      const cur=Math.log(this.cam.zoom()),diff=this.target-cur;
      if(this.direct||Math.abs(diff)<.0004){
        this.cam.zoomAt(this.ax,this.ay,Math.exp(this.target));this.target=NaN;
      }else{
        this.cam.zoomAt(this.ax,this.ay,Math.exp(cur+diff*(1-Math.exp(-dt/ZOOM_TAU))));
        // the camera refused to move (its limits changed): stop trying
        if(Math.abs(Math.log(this.cam.zoom())-cur)<1e-9)this.target=NaN;
      }
      moved=true;
    }

    const v=this.vel;
    if(v&&!this.drag&&!this.pinch){
      this.cam.panBy(v.vx*dt,v.vy*dt);
      const k=Math.exp(-dt/PAN_TAU);
      v.vx*=k;v.vy*=k;
      if(Math.hypot(v.vx,v.vy)<PAN_STOP)this.vel=null;
      moved=true;
    }
    if(moved)this.moved=now;
    return moved;
  }
}
