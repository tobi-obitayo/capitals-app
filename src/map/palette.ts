export const OK_FILL="rgba(22,163,74,.62)";
export const BAD_FILL="rgba(220,38,38,.55)";
export const NAVY="#003057";
export const GOLD="#B3A369";

/** map pane colours (the site's palette: soft ocean, white land, quiet neighbours) */
export const OCEAN="#E9EFF5";
export const LAND="#FFFFFF";
export const LAND_STROKE="#8896A8";
export const TERRITORY="#F3F6F9";
export const NEIGHBOUR="#D9E0E8";
export const NEIGHBOUR_STROKE="#C7D0DA";
export const INSET_BORDER="#94A3B8";

/** progress colouring: white (new), gold (learning), navy (mastered) */
export const lvlFill=(l:number)=>l>=3?"rgba(0,48,87,.85)":l===2?"rgba(0,48,87,.6)":l===1?"rgba(179,163,105,.55)":LAND;

/**
 * How a quiz/drill map is painted. Oceania gets a deeper sea, a darker coastline and bolder island dots:
 * most of its countries are specks, and white land on the usual pale sea is hard to see.
 */
export interface Look{
  ocean:string;neighbour:string;neighbourStroke:string;territory:string;landStroke:string;
  /** coastline width of a country on the main map */
  landW:number;
  /** islands drawn as dots get a white halo and a dark rim, and the main map draws dots for specks too */
  bold:boolean;
}
export const DEFAULT_LOOK:Look={
  ocean:OCEAN,neighbour:NEIGHBOUR,neighbourStroke:NEIGHBOUR_STROKE,territory:TERRITORY,landStroke:LAND_STROKE,landW:.8,bold:false,
};
export const OCEANIA_LOOK:Look={
  ocean:"#CFE0EE",neighbour:"#EBEFF4",neighbourStroke:"#B4C2D1",territory:"#F6F8FB",landStroke:"#475569",landW:1.1,bold:true,
};
