import {describe,expect,it} from "vitest";
import {
  Gestures,PAN_FLING_MAX,PAN_FLING_MIN,PAN_STOP,panVelocity,PINCH_RATE,WHEEL_RATE,wheelLogDelta,ZOOM_TAU,type Camera,
} from "../src/map/gesture";

/** a camera like the map's: a point on screen = zoom * world + offset */
function makeCam(range:[number,number]=[1,14]){
  const c={z:1,ox:0,oy:0,pans:0,zooms:0};
  const cam:Camera={
    zoom:()=>c.z,
    range:()=>range,
    zoomAt(x,y,z){const k=z/c.z;c.ox=x-(x-c.ox)*k;c.oy=y-(y-c.oy)*k;c.z=Math.max(range[0],Math.min(range[1],z));c.zooms++},
    panBy(dx,dy){c.ox+=dx;c.oy+=dy;c.pans++},
  };
  return{c,cam};
}
/** run frames of `dt` ms from t0; returns the time after the last one */
const run=(g:Gestures,ms:number,t0=1000,dt=16)=>{let t=t0;for(;t<t0+ms;t+=dt)g.tick(t);return t};

describe("wheel normalisation",()=>{
  it("a mouse notch and a pixel-precise trackpad scroll zoom at the same rate per pixel",()=>{
    expect(wheelLogDelta({deltaY:-100})).toBeCloseTo(100*WHEEL_RATE,6);
    expect(wheelLogDelta({deltaY:-10})).toBeCloseTo(10*WHEEL_RATE,6);
  });
  it("converts line and page scrolling to pixels",()=>{
    expect(wheelLogDelta({deltaY:-3,deltaMode:1})).toBeCloseTo(wheelLogDelta({deltaY:-120}),6);
    expect(wheelLogDelta({deltaY:-1,deltaMode:2})).toBeCloseTo(wheelLogDelta({deltaY:-800}),6);
  });
  it("trackpad pinch (ctrl held) is much more sensitive, and the direction flips with the sign",()=>{
    expect(wheelLogDelta({deltaY:-5,ctrlKey:true})).toBeCloseTo(5*PINCH_RATE,6);
    expect(wheelLogDelta({deltaY:5})).toBeLessThan(0);
  });
  it("a huge delta is capped so one event cannot throw the map across the scale",()=>{
    expect(Math.abs(wheelLogDelta({deltaY:-1e6}))).toBeLessThan(1);
  });
});

describe("eased zoom",()=>{
  it("eases toward the target over several frames and lands exactly on it",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.wheel({deltaX:0,deltaY:-300},100,100);
    g.tick(1000);
    expect(c.z).toBeGreaterThan(1);
    const target=Math.exp(300*WHEEL_RATE);
    expect(c.z).toBeLessThan(target);       // not there yet: it eases, it does not jump
    run(g,1500,1016);
    expect(c.z).toBeCloseTo(target,3);
    expect(g.busy()).toBe(false);
  });
  it("keeps the point under the cursor fixed the whole way",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    const world=(300-c.ox)/c.z;
    g.wheel({deltaX:0,deltaY:-400},300,200);
    for(let t=1000;t<2500;t+=16){g.tick(t);expect(c.ox+c.z*world).toBeCloseTo(300,6)}
  });
  it("more notches while easing add to the same motion (no stutter, no lost input)",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.wheel({deltaX:0,deltaY:-200},0,0);g.tick(1000);g.tick(1016);
    g.wheel({deltaX:0,deltaY:-200},0,0);
    run(g,2000,1032);
    expect(c.z).toBeCloseTo(Math.exp(400*WHEEL_RATE),3);
  });
  it("is the same speed at 30, 60 and 144 fps",()=>{
    const at=(dt:number)=>{
      const {c,cam}=makeCam();const g=new Gestures(cam);
      g.wheel({deltaX:0,deltaY:-300},0,0);
      let t=1000;g.tick(t);
      for(;t<1000+ZOOM_TAU*2;t+=dt)g.tick(t+dt);
      return c.z;
    };
    expect(at(7)).toBeCloseTo(at(33),1);
  });
  it("stays inside the camera's zoom range, and a ctrl-pinch is applied at once",()=>{
    const {c,cam}=makeCam([1,4]);const g=new Gestures(cam);
    g.wheel({deltaX:0,deltaY:-9000},0,0);g.wheel({deltaX:0,deltaY:-9000},0,0);
    run(g,3000);
    expect(c.z).toBeCloseTo(4,3);
    g.wheel({deltaX:0,deltaY:30,ctrlKey:true},0,0);
    g.tick(5000);
    expect(c.z).toBeCloseTo(4*Math.exp(-30*PINCH_RATE),4);
  });
  it("zoom buttons are one smooth motion even when pressed repeatedly",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.zoomBy(1.6,50,50);g.tick(1000);g.zoomBy(1.6,50,50);
    const mid=c.z;
    run(g,1500,1016);
    expect(mid).toBeLessThan(1.6*1.6);
    expect(c.z).toBeCloseTo(1.6*1.6,3);
  });
  it("a sideways trackpad swipe pans instead of zooming",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.wheel({deltaX:40,deltaY:3},0,0);
    g.tick(1000);
    expect(c.ox).toBe(-40);expect(c.z).toBe(1);
  });
  it("applies a burst of events in a single frame (one layout per frame)",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    for(let i=0;i<20;i++)g.wheel({deltaX:0,deltaY:-20},0,0);
    expect(c.zooms).toBe(0);
    g.tick(1000);
    expect(c.zooms).toBe(1);
  });
});

describe("pinch",()=>{
  it("follows the finger distance directly, anchored on the midpoint, with no thresholds",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.pinchBegin(150,200,250,200);
    const world=(200-c.ox)/c.z;
    g.pinchTo(100,200,300,200);   // fingers twice as far apart
    g.tick(1000);
    expect(c.z).toBeCloseTo(2,6);
    expect(c.ox+c.z*world).toBeCloseTo(200,6);
  });
  it("two fingers sliding together pan the map as well as zoom it",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.pinchBegin(150,200,250,200);
    g.pinchTo(190,230,290,230);   // same spread, moved right 40 and down 30
    g.tick(1000);
    expect(c.z).toBeCloseTo(1,6);
    expect(c.ox).toBeCloseTo(40,6);expect(c.oy).toBeCloseTo(30,6);
  });
  it("many touch events between frames cost one update, and lifting a finger does not snap the zoom",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.pinchBegin(150,200,250,200);
    for(let i=1;i<=10;i++)g.pinchTo(150-i*3,200,250+i*3,200);
    g.tick(1000);
    expect(c.zooms).toBe(1);
    const z=c.z;
    g.pinchEnd();g.tick(1016);g.tick(1032);
    expect(c.z).toBe(z);
  });
  it("is clamped to the zoom range",()=>{
    const {c,cam}=makeCam([1,3]);const g=new Gestures(cam);
    g.pinchBegin(190,200,210,200);
    g.pinchTo(0,200,400,200);
    g.tick(1000);
    expect(c.z).toBe(3);
  });
});

describe("drag and momentum",()=>{
  it("pans from where the finger came down, even though it only starts after the tap slop",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.dragBegin(100,100);
    g.dragTo(104,100,1000);g.tick(1000);
    expect(c.pans).toBe(0);               // still inside the slop: nothing moves
    g.dragGo();g.dragTo(130,110,1016);g.tick(1016);
    expect(c.ox).toBeCloseTo(30,6);expect(c.oy).toBeCloseTo(10,6);
  });
  it("a fast flick coasts on and slows to a stop",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.dragBegin(0,0);g.dragGo();
    for(let i=1;i<=6;i++){g.dragTo(i*24,0,1000+i*16);g.tick(1000+i*16)}
    const at=c.ox;
    g.dragEnd(1000+6*16+5);
    expect(g.busy()).toBe(true);
    let prev=Infinity,t=1200,steps=0;
    while(g.busy()&&steps<2000){
      const before=c.ox;g.tick(t);t+=16;steps++;
      const moved=c.ox-before;
      expect(moved).toBeLessThanOrEqual(prev+1e-9);prev=moved;
    }
    expect(c.ox).toBeGreaterThan(at+50);
    expect(g.busy()).toBe(false);
    expect(steps*16).toBeLessThan(4000);
  });
  it("a slow drag, a pause before letting go, and reduced motion all leave no momentum",()=>{
    const slow=(()=>{const {cam}=makeCam();const g=new Gestures(cam);g.dragBegin(0,0);g.dragGo();for(let i=1;i<=6;i++){g.dragTo(i*.5,0,1000+i*16);g.tick(1000+i*16)}g.dragEnd(1100);return g.busy()})();
    const paused=(()=>{const {cam}=makeCam();const g=new Gestures(cam);g.dragBegin(0,0);g.dragGo();for(let i=1;i<=6;i++){g.dragTo(i*24,0,1000+i*16);g.tick(1000+i*16)}g.dragEnd(1500);return g.busy()})();
    const reduced=(()=>{const {cam}=makeCam();const g=new Gestures(cam);g.dragBegin(0,0);g.dragGo();for(let i=1;i<=6;i++){g.dragTo(i*24,0,1000+i*16);g.tick(1000+i*16)}g.dragEnd(1100,false);return g.busy()})();
    expect([slow,paused,reduced]).toEqual([false,false,false]);
  });
  it("touching the map again stops the coasting; so does a wheel zoom",()=>{
    const {c,cam}=makeCam();const g=new Gestures(cam);
    g.dragBegin(0,0);g.dragGo();
    for(let i=1;i<=6;i++){g.dragTo(i*24,0,1000+i*16);g.tick(1000+i*16)}
    g.dragEnd(1105);g.tick(1120);
    const x=c.ox;g.stop();g.tick(1136);g.tick(1152);
    expect(c.ox).toBe(x);
    g.dragBegin(0,0);g.dragGo();for(let i=1;i<=6;i++){g.dragTo(i*24,0,2000+i*16);g.tick(2000+i*16)}
    g.dragEnd(2105);
    g.wheel({deltaX:0,deltaY:-100},0,0);
    expect(g.busy()).toBe(true);run(g,2500,2120);
    expect(g.busy()).toBe(false);
  });
  it("velocity maths: speed limits and direction",()=>{
    const s=(vx:number)=>[{t:1000,x:0,y:0},{t:1050,x:vx*50,y:vx*25}];
    expect(panVelocity(s(PAN_FLING_MIN/2),1060)).toBeNull();
    const v=panVelocity(s(1),1060)!;
    expect(v.vx).toBeCloseTo(1,6);expect(v.vy).toBeCloseTo(.5,6);
    const fast=panVelocity(s(100),1060)!;
    expect(Math.hypot(fast.vx,fast.vy)).toBeCloseTo(PAN_FLING_MAX,6);
    expect(PAN_STOP).toBeLessThan(PAN_FLING_MIN);
  });
});
