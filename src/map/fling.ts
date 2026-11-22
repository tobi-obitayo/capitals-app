import {vq} from "./landing";

/** globe momentum: let go of a fast drag and the globe keeps turning, then eases out */

type Q=[number,number,number,number];
type V3=[number,number,number];
export interface Sample{t:number;q:Q}
export interface Fling{axis:V3;/** radians per ms */speed:number}

/** only the last stretch of the drag decides how hard you flicked */
export const FLING_WINDOW_MS=100;
/** a pause before letting go cancels the fling */
export const FLING_STALE_MS=80;
/** slower than this (rad/ms, about 17 deg/s) is a plain drag, not a flick */
export const FLING_MIN=0.0003;
export const FLING_MAX=0.006;
/** time for the speed to fall to 1/e (ms) */
export const FLING_TAU=450;
/** below this the globe is considered stopped (rad/ms, about 1.7 deg/s) */
export const FLING_STOP=0.00003;

/** add a sample, dropping the ones older than the window */
export function pushSample(list:Sample[],s:Sample){
  list.push(s);
  while(list.length>2&&s.t-list[0].t>FLING_WINDOW_MS)list.shift();
}

/** the fling a drag ending at time `now` leaves behind, or null for a slow or stale one */
export function flingFrom(list:Sample[],now:number):Fling|null{
  if(list.length<2)return null;
  const a=list[0],b=list[list.length-1];
  if(now-b.t>FLING_STALE_MS)return null;
  const dt=b.t-a.t;
  if(dt<8)return null;
  const {axis,angle}=vq.between(a.q,b.q);
  const speed=Math.min(FLING_MAX,angle/dt);
  return speed>=FLING_MIN?{axis,speed}:null;
}

/** advance a fling by `dt` ms: the new rotation and what is left of the fling (null once it has stopped) */
export function stepFling(q:Q,f:Fling,dt:number):{q:Q;fling:Fling|null}{
  const nq=vq.mul(q,vq.turn(f.axis,f.speed*dt));
  const speed=f.speed*Math.exp(-dt/FLING_TAU);
  return{q:nq,fling:speed<FLING_STOP?null:{axis:f.axis,speed}};
}
