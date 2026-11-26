import {describe,expect,it} from "vitest";
import {geoOrthographic} from "d3";
import {vq} from "../src/map/landing";
import {slerp,spinRotation,turntableWeight} from "../src/map/spin";

const globe=()=>geoOrthographic().clipAngle(90).translate([200,300]).scale(180);

/** what the globe's drag handler does for a finger going from `a` to `b` */
function drag(r0:[number,number,number],a:[number,number],b:[number,number]){
  const g=globe();
  const l0=g.rotate(r0).invert!(a) as [number,number];
  const l1=g.rotate(r0).invert!(b) as [number,number];
  const track=vq.mul(vq.fromEuler(r0),vq.delta(vq.cart(l0),vq.cart(l1)));
  const q=spinRotation(track,r0,l0,l1,b[0]-a[0],b[1]-a[1]);
  return{q,track,l0,rot:vq.toEuler(q)};
}

describe("globe drag direction lock",()=>{
  it("weights: horizontal = turntable, diagonal and vertical = trackball, smooth in between",()=>{
    expect(turntableWeight(50,0)).toBe(1);
    expect(turntableWeight(-50,6)).toBe(1);          // about 7 degrees off horizontal
    expect(turntableWeight(0,50)).toBe(0);
    expect(turntableWeight(40,40)).toBe(0);          // 45 degrees
    expect(turntableWeight(0,0)).toBe(0);
    let last=1;
    for(let deg=0;deg<=60;deg+=3){
      const w=turntableWeight(Math.cos(deg*Math.PI/180),Math.sin(deg*Math.PI/180));
      expect(w).toBeLessThanOrEqual(last+1e-9);last=w;
    }
  });

  it("a horizontal drag keeps the grabbed point on its latitude, wherever it was grabbed",()=>{
    for(const r0 of [[-15,-25,0],[40,-50,12],[-120,20,-15]] as [number,number,number][]){
      for(const a of [[200,170],[260,240],[150,420]] as [number,number][]){
        const {rot,l0}=drag(r0,a,[a[0]+55,a[1]+4]);
        const b:[number,number]=[a[0]+55,a[1]+4];
        const before=globe().rotate(r0).invert!(b) as [number,number];
        const now=globe().rotate(rot).invert!(b) as [number,number];
        // the finger stays on the spot it grabbed (same longitude), and the latitudes never shift: only the longitude turned
        expect(Math.abs(((now[0]-l0[0]+540)%360)-180)).toBeLessThan(1e-6);
        expect(now[1]).toBeCloseTo(before[1],6);
        expect(rot[1]).toBeCloseTo(r0[1],6);expect(rot[2]).toBeCloseTo(r0[2],6);   // no tipping: pitch and roll unchanged
      }
    }
  });

  it("through the middle of the globe it matches a plain trackball turn",()=>{
    const {rot,track}=drag([0,0,0],[200,300],[240,300]);
    const t=vq.toEuler(track);
    for(let i=0;i<3;i++)expect(rot[i]).toBeCloseTo(t[i],5);
    expect(rot[0]).toBeGreaterThan(0);   // dragging right turns the globe to show what was west
  });

  it("diagonal and vertical drags are untouched trackball turns",()=>{
    const d=drag([-15,-25,0],[220,250],[260,330]);
    expect(d.q).toEqual(d.track);
  });

  it("slerp stays a unit rotation and hits both ends",()=>{
    const a=vq.fromEuler([10,20,0]),b=vq.fromEuler([60,-10,5]);
    slerp(a,b,0).forEach((v,i)=>expect(v).toBeCloseTo(a[i],9));
    slerp(a,b,1).forEach((v,i)=>expect(v).toBeCloseTo(b[i],6));
    expect(Math.hypot(...slerp(a,b,.4))).toBeCloseTo(1,9);
  });
});
