import {vq} from "./landing";

type Q=[number,number,number,number];
const R=Math.PI/180;

/** drags within this many degrees of horizontal turn the globe like a turntable (same latitudes) */
export const LOCK_FULL_DEG=15;
/** past this angle the drag is a free trackball turn again; in between the two blend */
export const LOCK_NONE_DEG=35;

/** how much of a drag is a pure left/right spin: 1 for a (nearly) horizontal drag, 0 for a diagonal or vertical one */
export function turntableWeight(dx:number,dy:number):number{
  if(!dx&&!dy)return 0;
  const deg=Math.atan2(Math.abs(dy),Math.abs(dx))/R;
  const t=Math.max(0,Math.min(1,(LOCK_NONE_DEG-deg)/(LOCK_NONE_DEG-LOCK_FULL_DEG)));
  return t*t*(3-2*t);
}

const wrap180=(d:number)=>((d+540)%360)-180;

/** shortest-path interpolation between two rotations */
export function slerp(a:Q,b:Q,t:number):Q{
  let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
  const s=d<0?-1:1;
  d*=s;
  const bb:Q=[b[0]*s,b[1]*s,b[2]*s,b[3]*s];
  let k0:number,k1:number;
  if(d>.9995){k0=1-t;k1=t}
  else{
    const th=Math.acos(d),sn=Math.sin(th);
    k0=Math.sin((1-t)*th)/sn;k1=Math.sin(t*th)/sn;
  }
  const q:Q=[k0*a[0]+k1*bb[0],k0*a[1]+k1*bb[1],k0*a[2]+k1*bb[2],k0*a[3]+k1*bb[3]];
  const l=Math.hypot(...q)||1;
  return[q[0]/l,q[1]/l,q[2]/l,q[3]/l];
}

/**
 * The rotation after a drag. `trackball` is the free turn that keeps the grabbed point under the finger. For a
 * mostly horizontal drag it is blended into a turntable turn: only the longitude moves, so what you grabbed
 * stays on its own latitude instead of the globe tipping. `start`/`now` are the lon/lat under the finger
 * (both read with the globe still at its drag-start rotation `r0`) and `dx`,`dy` the finger's travel in px.
 */
export function spinRotation(trackball:Q,r0:[number,number,number],start:[number,number],now:[number,number],dx:number,dy:number):Q{
  const w=turntableWeight(dx,dy);
  if(w<=0)return trackball;
  const turntable=vq.fromEuler([r0[0]+wrap180(now[0]-start[0]),r0[1],r0[2]]);
  return w>=1?turntable:slerp(trackball,turntable,w);
}
