import {describe,expect,it} from "vitest";
import {baseFactor,flatLayout,FLAT_HOME,FLAT_ZOOM_MAX,makeFlatProjection,zoomFlatAt} from "../src/map/flat";

const lay=(W:number,H:number,v=FLAT_HOME)=>flatLayout(makeFlatProjection(),W,H,v);

describe("flat map layout",()=>{
  it("shows the whole world across on landscape screens (desktop, phone held sideways)",()=>{
    for(const [W,H] of [[1440,900],[844,390],[1920,1080]]){
      const l=lay(W,H);
      expect(baseFactor(W,H),`${W}x${H}`).toBe(1);
      expect(l.ww).toBeCloseTo(W,0);
      expect(l.hh).toBeLessThanOrEqual(H+1);
    }
  });

  it("phone held upright: the world is drawn wider than the screen so it fills more of it",()=>{
    const l=lay(390,844);
    expect(l.ww).toBeGreaterThan(390*2);
    expect(l.ww).toBeLessThanOrEqual(390*2.41);
    expect(l.minZoom).toBeLessThan(1);          // you can still pinch out to see it all
  });

  it("wraps sideways and stays inside the map vertically",()=>{
    const l=lay(844,390,{zoom:4,px:1e6,py:-1e6});
    expect(Math.abs(l.view.px)).toBeLessThanOrEqual(l.ww/2);
    expect(Math.abs(l.view.py)).toBeLessThanOrEqual((l.hh-390)/2+1e-6);
  });

  it("zoom stays within the limits",()=>{
    expect(lay(1440,900,{zoom:999,px:0,py:0}).view.zoom).toBe(FLAT_ZOOM_MAX);
    expect(lay(1440,900,{zoom:.01,px:0,py:0}).view.zoom).toBe(1);
    expect(lay(390,844,{zoom:.01,px:0,py:0}).view.zoom).toBeCloseTo(lay(390,844).minZoom,6);
  });

  it("zooming keeps the point under the pointer where it is",()=>{
    const l=lay(1440,900);
    const at:[number,number]=[1000,300];
    const ll=l.proj.invert!(at)!;
    const v=zoomFlatAt(l,at[0],at[1],5);
    const l2=lay(1440,900,v);
    const p=l2.proj(ll)!;
    expect(p[0]).toBeCloseTo(at[0],0);
    expect(p[1]).toBeCloseTo(at[1],0);
  });
});
