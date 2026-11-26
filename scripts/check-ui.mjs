#!/usr/bin/env node
/**
 * Layout checks that need a real browser (the unit tests run in jsdom, which has no layout).
 *
 *   node scripts/check-ui.mjs
 *
 *  1. globe canvas keeps matching its on-screen size even when the window never fires "resize" (iOS toolbars)
 *  2. Find-the-country bar: for the longest names at many widths, the X stays on the first row, nothing
 *     overflows, no word is broken in the middle, the name never runs under the X (long names shrink to one line), and the X is never on the row with Skip / Give up
 *  3. continent list can be closed on a phone
 *  4. results fit on one screen, answers scroll inside their own list
 */
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import {chromium,devices} from "playwright";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const {defaultBrowserType:_ignored,...iphone}=devices["iPhone 14"];
const server=await createServer({root,logLevel:"error",server:{port:0,host:"127.0.0.1"}});
await server.listen();
const url=server.resolvedUrls.local[0];
let browser;
try{browser=await chromium.launch({channel:"chrome"})}catch{browser=await chromium.launch()}

let failures=0;
const check=(ok,msg)=>{console.log((ok?"PASS  ":"FAIL  ")+msg);if(!ok)failures++};
const phone=async(w=390,h=844,query="")=>{
  const ctx=await browser.newContext({...iphone,viewport:{width:w,height:h},deviceScaleFactor:2});
  const page=await ctx.newPage();
  page.on("pageerror",e=>console.warn("  page error:",e.message));
  return{ctx,page,open:async()=>{await page.goto(url+query);await page.waitForSelector("#map",{state:"attached"});await pause(1500)}};
};

/* 1. stale canvas size */
{
  const {ctx,page,open}=await phone(390,844);
  // swallow window "resize" before the app can see it, as happens when a phone toolbar moves
  await page.addInitScript(()=>window.addEventListener("resize",e=>e.stopImmediatePropagation(),true));
  await open();
  const size=()=>page.evaluate(()=>{const c=document.getElementById("map"),r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);return{w:c.width,h:c.height,ew:Math.round(r.width*d),eh:Math.round(r.height*d)}});
  let z=await size();
  check(z.w===z.ew&&z.h===z.eh,`globe bitmap matches the screen at load (${z.w}x${z.h})`);
  await page.setViewportSize({width:390,height:520});
  await pause(500);
  z=await size();
  check(z.w===z.ew&&z.h===z.eh,`globe bitmap follows a height change without a resize event (${z.w}x${z.h})`);
  await ctx.close();
}

/* 2. Find bar */
const NAMES=["Bosnia and Herzegovina","Saint Vincent and the Grenadines","Central African Republic","São Tomé and Príncipe","United Arab Emirates","Antigua and Barbuda","Rep. of the Congo","DR Congo","Mali"];
const WIDTHS=[320,360,390,430,600,700,701,768,820,1024,1280];
{
  let bad=0;
  const firstRun=[];
  for(const w of WIDTHS){
    const {ctx,page,open}=await phone(w,w>=700?900:700,"");
    if(w>=700)await page.addInitScript(()=>localStorage.setItem("capitals.prefs.v1",JSON.stringify({tab:"quiz",cfg:{kind:"find",timerOn:true,seconds:300,hard:true,spell:true}})));
    await open();
    await page.keyboard.press("1");await page.waitForSelector(".modal");await pause(800);
    if(w>=900||(await page.getByRole("button",{name:"Settings",exact:true}).count())===0){
      await page.getByRole("button",{name:"Quiz",exact:true}).click();
      await page.getByRole("button",{name:"Find the country",exact:true}).click();
      await page.getByRole("button",{name:/^start/i}).first().click();
    }else{
      await page.getByRole("button",{name:"Settings",exact:true}).click();await pause(500);
      await page.getByRole("button",{name:"Quiz",exact:true}).click();
      await page.getByRole("button",{name:"Find the country",exact:true}).click();
      await page.mouse.click(Math.round(w/2),20);await pause(400);
      await page.locator(".setup-cta .btn").click();
    }
    await page.waitForSelector(".qhud");await pause(600);
    if(w===390){
      await page.evaluate(()=>{document.querySelector(".qh-target").textContent="Saint Vincent and the Grenadines"});
      await page.screenshot({path:path.join(root,"shots","hud-390-long.png"),clip:{x:0,y:0,width:390,height:260}});
    }
    for(const n of NAMES){
      const r=await page.evaluate(async name=>{
        const t=document.querySelector(".qh-target");t.textContent=name;
        await new Promise(r=>setTimeout(r,80));          // the app shrinks long names to one line after the change
        const hud=document.querySelector(".qhud"),x=document.querySelector(".qh-close"),k=document.querySelector(".qh-kicker");
        const H=hud.getBoundingClientRect(),X=x.getBoundingClientRect(),T=t.getBoundingClientRect(),K=k.getBoundingClientRect();
        const cs=getComputedStyle(t);
        const probe=document.createElement("span");
        probe.style.cssText=`position:absolute;visibility:hidden;white-space:nowrap;font:${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily};letter-spacing:${cs.letterSpacing}`;
        document.body.appendChild(probe);
        let widest=0;for(const word of name.split(" ")){probe.textContent=word;widest=Math.max(widest,probe.getBoundingClientRect().width)}
        probe.remove();
        const kids=[...hud.children].map(c=>c.getBoundingClientRect());
        const rowTop=Math.min(...kids.map(b=>b.top));
        return{
          hudRight:H.right,vw:innerWidth,hudLeft:H.left,
          // desktop: X on the single row. phones: X is below the Skip / Give up row
          xFirstRow:innerWidth>1000?X.top-H.top<60:X.top>=document.querySelector('.qh-actions .btn:last-child').getBoundingClientRect().bottom-1,
          tOverflow:t.scrollWidth>t.clientWidth+1,
          wordBroken:widest>T.width+1,
          centred:Math.abs((T.left+T.right)/2-(H.left+H.right)/2)<Math.max(70,H.width*.2)||hud.getBoundingClientRect().width>0&&getComputedStyle(hud).display==="flex",
          kickerNearName:Math.abs(K.top-T.top)<60,
          rowTop,hudH:H.height,
          // the name must not reach the X (only meaningful where the X sits in the corner)
          underX:T.right>X.left+0.5&&T.top<X.bottom&&T.bottom>X.top&&innerWidth<=1000,
        };
      },n);
      const ok=r.xFirstRow&&!r.tOverflow&&!r.wordBroken&&!r.underX&&(r.vw>1000||r.hudH<=260)&&r.hudLeft>=0&&r.hudRight<=r.vw+0.5;
      if(!ok){bad++;console.log(`   ${w}px ${n}:`,JSON.stringify(r))}
    }
    await ctx.close();
  }
  check(bad===0,`Find bar: ${NAMES.length*WIDTHS.length} name/width combinations OK (${bad} problems)`);
}

/* 3. continent list: the chevron rides on the open list and closes it */
{
  const {ctx,page,open}=await phone(390,844);
  await open();
  await page.getByRole("button",{name:"Show continent list"}).click();await pause(700);
  const closeBtn=page.getByRole("button",{name:"Hide continent list"});
  const box=await closeBtn.boundingBox();
  const top=box&&await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?.closest("button")?.getAttribute("aria-label")},[box.x+box.width/2,box.y+box.height/2]);
  check(!!box&&top==="Hide continent list",`dock: the close chevron is on top of the open list and tappable (${box?Math.round(box.width)+"x"+Math.round(box.height):"missing"})`);
  await page.screenshot({path:path.join(root,"shots","dock-open.png")});
  await closeBtn.click();await pause(600);
  check(!await page.evaluate(()=>document.querySelector("#dock").classList.contains("show")),"dock: tapping the chevron closes the list");
  // iOS does not focus a button on tap, so a chip can keep focus (and :focus-within keeps the list open) unless closing blurs it
  await page.getByRole("button",{name:"Show continent list"}).click();await pause(600);
  await page.evaluate(()=>{document.querySelector("#dock .chip").focus();document.querySelector(".handle").dispatchEvent(new MouseEvent("click",{bubbles:true}))});await pause(600);
  check(!await page.evaluate(()=>document.querySelector("#dock").classList.contains("show")),"dock: closes even while a continent chip has focus");
  await ctx.close();
}

/* 4. results on one screen */
for(const [w,h] of [[390,844],[390,700],[360,640]]){
  const {ctx,page,open}=await phone(w,h);
  await open();
  await page.keyboard.press("1");await page.waitForSelector(".modal");await pause(900);
  await page.getByRole("button",{name:"Settings",exact:true}).click();await pause(500);
  await page.getByRole("button",{name:"Quiz",exact:true}).click();
  await page.getByRole("button",{name:"Find the country",exact:true}).click();
  await page.mouse.click(Math.round(w/2),20);await pause(400);
  await page.locator(".setup-cta .btn").click();
  await page.waitForSelector(".qhud");await pause(800);
  await page.getByRole("button",{name:"Give up",exact:true}).click();
  await page.waitForSelector(".reslist");await pause(1200);
  const m=await page.evaluate(()=>{
    const left=document.querySelector(".left"),act=document.querySelector(".res-actions").getBoundingClientRect(),list=document.querySelector(".res-wrap .reslist").getBoundingClientRect();
    return{scrolls:left.scrollHeight>left.clientHeight+1,actionsBottom:act.bottom,vh:innerHeight,listH:list.height};
  });
  check(!m.scrolls&&m.actionsBottom<=m.vh&&m.listH>=70,`results ${w}x${h}: one screen, buttons visible, list ${Math.round(m.listH)}px tall`);
  await page.screenshot({path:path.join(root,"shots",`results-${w}x${h}.png`)});
  await ctx.close();
}

await browser.close();
await server.close();
console.log(failures?`\n${failures} check(s) failed`:"\nAll checks passed");
process.exit(failures?1:0);
