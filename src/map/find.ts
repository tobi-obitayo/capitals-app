import type {World} from "../geo";
import {BAD_FILL,LAND,OK_FILL} from "./palette";
import {drawScene,hitScene,type Scene,type View} from "./scene";
import type {Status} from "../quiz";

export {buildScene,zoomView,MAX_ZOOM,insetAt,panelProjection,type Scene,type View} from "./scene";

/** the quiz map. Wrong-click flashes and answer colours are laid over the country fills. */
export function drawFind(
  ctx:CanvasRenderingContext2D,world:World,scene:Scene,view:View,
  status:Record<string,Status|undefined>,flash:{name:string;alpha:number}|null,
){
  drawScene(ctx,scene,world,{
    view,
    fill:()=>LAND,
    overlay:n=>{
      if(flash&&flash.name===n)return `rgba(220,38,38,${.75*flash.alpha})`;
      const st=status[n];
      return st?(st==="ok"?OK_FILL:BAD_FILL):null;
    },
  });
}

export const hitTest=(world:World,scene:Scene,view:View,x:number,y:number)=>hitScene(world,scene,view,x,y);
