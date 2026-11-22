import {describe,expect,it} from "vitest";
import {vq} from "../src/map/landing";
import {
  FLING_MAX,FLING_MIN,FLING_STALE_MS,FLING_STOP,FLING_WINDOW_MS,flingFrom,pushSample,stepFling,type Sample,
} from "../src/map/fling";

const start=vq.fromEuler([-15,-25,0]);
/** samples of a drag turning at `rate` rad/ms about the z axis, one every 16 ms */
const drag=(rate:number,n=8):Sample[]=>{
  const out:Sample[]=[];
  for(let i=0;i<n;i++)out.push({t:1000+i*16,q:vq.mul(start,vq.turn([0,0,1],rate*i*16))});
  return out;
};

describe("quaternion turn helpers",()=>{
  it("between() recovers the turn that was applied",()=>{
    const axis:[number,number,number]=[0,.6,.8];
    const b=vq.mul(start,vq.turn(axis,.7));
    const t=vq.between(start,b);
    expect(t.angle).toBeCloseTo(.7,6);
    t.axis.forEach((v,i)=>expect(v).toBeCloseTo(axis[i],6));
  });
  it("takes the short way round",()=>{
    const b=vq.mul(start,vq.turn([1,0,0],-.4));
    expect(vq.between(start,b).angle).toBeCloseTo(.4,6);
    const neg=b.map(v=>-v) as typeof b;   // same rotation, opposite sign
    expect(vq.between(start,neg).angle).toBeCloseTo(.4,6);
  });
  it("no turn gives zero angle",()=>{
    expect(vq.between(start,start).angle).toBe(0);
  });
});

describe("globe fling",()=>{
  it("a fast drag turns into a fling at the same speed and direction",()=>{
    const s=drag(.002);
    const f=flingFrom(s,s.at(-1)!.t+10)!;
    expect(f.speed).toBeCloseTo(.002,5);
    expect(f.axis[2]).toBeCloseTo(1,5);
  });

  it("a slow drag, a hesitant release and a lone sample leave no fling",()=>{
    const slow=drag(FLING_MIN/3);
    expect(flingFrom(slow,slow.at(-1)!.t+10)).toBeNull();
    const fast=drag(.002);
    expect(flingFrom(fast,fast.at(-1)!.t+FLING_STALE_MS+20)).toBeNull();
    expect(flingFrom(fast.slice(0,1),fast[0].t)).toBeNull();
  });

  it("caps the speed",()=>{
    const s=drag(.05,4);
    expect(flingFrom(s,s.at(-1)!.t)!.speed).toBe(FLING_MAX);
  });

  it("only the last stretch of the drag counts",()=>{
    const list:Sample[]=[];
    for(const s of drag(.002,40))pushSample(list,s);
    expect(list[list.length-1].t-list[0].t).toBeLessThanOrEqual(FLING_WINDOW_MS);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("slows down smoothly and stops by itself",()=>{
    let f:ReturnType<typeof stepFling>["fling"]=flingFrom(drag(.003),1120)!;
    let q=start,prev=f!.speed,turned=0,ms=0;
    while(f&&ms<20000){
      const r=stepFling(q,f,16);
      turned+=vq.between(q,r.q).angle;
      q=r.q;ms+=16;
      if(r.fling){expect(r.fling.speed).toBeLessThan(prev);prev=r.fling.speed}
      f=r.fling;
    }
    expect(f).toBeNull();
    expect(ms).toBeLessThan(5000);
    expect(turned).toBeGreaterThan(.5);          // it really did coast on
    expect(prev).toBeGreaterThan(FLING_STOP);
  });

  it("the distance coasted does not depend on the frame rate",()=>{
    const run=(dt:number)=>{
      let f:ReturnType<typeof stepFling>["fling"]=flingFrom(drag(.003),1120)!,q=start,turned=0;
      while(f){const r=stepFling(q,f,dt);turned+=vq.between(q,r.q).angle;q=r.q;f=r.fling}
      return turned;
    };
    expect(run(8)).toBeCloseTo(run(32),0);
  });
});
