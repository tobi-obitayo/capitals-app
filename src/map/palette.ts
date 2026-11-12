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
export const INSET_BORDER="#64748B";

/** progress colouring: white (new), gold (learning), navy (mastered) */
export const lvlFill=(l:number)=>l>=3?"rgba(0,48,87,.85)":l===2?"rgba(0,48,87,.6)":l===1?"rgba(179,163,105,.55)":LAND;
