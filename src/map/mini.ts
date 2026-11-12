import type {ContinentName} from "../data";
import type {World} from "../geo";
import {buildScene,drawScene,hitScene,type Rect,type Scene} from "./scene";

export {OK_FILL,BAD_FILL,NAVY,GOLD,lvlFill} from "./palette";

export interface MiniOpts{
  cn:ContinentName;
  /** fill for a country in this continent, by data name */
  fill:(name:string)=>string;
  /** country to highlight (navy), or null */
  hl:string|null;
  /** country lifted out of the map (hover link with a list), or null */
  emph?:string|null;
  /** areas insets must stay clear of (the legend) */
  reserved?:Rect[];
}

/** the map for the drill, quiz and results panes: the continent plus boxed insets for tiny islands */
export function sceneFor(world:World,w:number,h:number,o:Pick<MiniOpts,"cn"|"reserved">):Scene{
  return buildScene(world,o.cn,w,h,{reserved:o.reserved});
}

/** draw one continent. Pure: only needs a 2D context. Returns the scene (for hit testing). */
export function drawMini(c:CanvasRenderingContext2D,w:number,h:number,world:World,o:MiniOpts,scene?:Scene):Scene{
  const sc=scene??sceneFor(world,w,h,o);
  drawScene(c,sc,world,{fill:o.fill,hl:o.hl,emph:o.emph});
  return sc;
}

export const hitMini=(world:World,scene:Scene,x:number,y:number)=>hitScene(world,scene,{k:1,tx:0,ty:0},x,y);
