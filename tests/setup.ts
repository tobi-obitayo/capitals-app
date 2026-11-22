import {Path2D as NodePath2D} from "@napi-rs/canvas";

/* jsdom and bare node have no Path2D; the map caches its outlines in them, and @napi-rs/canvas's contexts only accept its own */
if(typeof (globalThis as any).Path2D==="undefined")(globalThis as any).Path2D=NodePath2D;
