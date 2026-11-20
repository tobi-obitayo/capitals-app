#!/usr/bin/env node
/**
 * Headless iPhone screenshots of the key mobile screens.
 *
 *   npm run shots                 -> shots/<timestamp>/ and shots/latest/
 *   npm run shots -- --baseline   -> also saves shots/baseline/ (the "before" to compare against)
 *
 * Every screen has a stable ID (01-landing, 02-drill-map-africa, ...) so you can say "shot 03".
 * shots/latest/index.html shows baseline and latest side by side.
 */
import {cp,mkdir,readdir,rm,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import {chromium,devices} from "playwright";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const outRoot=path.join(root,"shots");
const baseline=process.argv.includes("--baseline");
const stamp=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
const runDir=path.join(outRoot,stamp);
const latestDir=path.join(outRoot,"latest");
const baselineDir=path.join(outRoot,"baseline");

const {defaultBrowserType:_ignored,...iphone}=devices["iPhone 14"];
const VIEW={width:390,height:844};
const KEYBOARD_VIEW={width:390,height:430};   // roughly what is left above the iOS keyboard
const pause=ms=>new Promise(r=>setTimeout(r,ms));

const taken=[];
async function main(){
  await mkdir(runDir,{recursive:true});
  const server=await createServer({root,logLevel:"error",server:{port:0,host:"127.0.0.1"}});
  await server.listen();
  const url=server.resolvedUrls.local[0];

  let browser;
  try{browser=await chromium.launch({channel:"chrome"})}
  catch{browser=await chromium.launch()}

  const newPage=async()=>{
    const ctx=await browser.newContext({...iphone,viewport:VIEW,deviceScaleFactor:2});
    const page=await ctx.newPage();
    page.on("pageerror",e=>console.warn("  page error:",e.message));
    return{ctx,page};
  };
  const shot=async(page,id,note)=>{
    await page.screenshot({path:path.join(runDir,id+".png")});
    taken.push({id,note});
    console.log("  ✓",id);
  };
  const openAfricaDrill=async page=>{
    await page.goto(url);
    await page.waitForSelector("#map",{state:"attached"});
    await pause(1300);
  };

  // --- landing, drill map, settings drawer, find quiz, results ---
  {
    const {ctx,page}=await newPage();
    await openAfricaDrill(page);
    await shot(page,"01-landing","World map on open");

    await page.keyboard.press("1");           // Africa
    await page.waitForSelector(".modal");
    await pause(1500);
    await shot(page,"02-drill-map-africa","Continent map with Start + gear");

    await page.getByRole("button",{name:"Settings",exact:true}).click();
    await pause(700);
    await shot(page,"03-settings-drawer","Settings drawer (Learn / Quiz)");

    await page.getByRole("button",{name:"Quiz",exact:true}).click();
    await page.getByRole("button",{name:"Find the country",exact:true}).click();
    await page.locator(".drawer-overlay").click({position:{x:195,y:20}});   // close drawer (Escape would also close the drill)
    await pause(500);
    await page.locator(".setup-cta .btn").click();
    await page.waitForSelector(".qhud");
    await pause(1500);
    await shot(page,"04-find-quiz-africa","Find the country: top bar, insets, controls");

    const c=page.locator(".qcanvas");
    const box=await c.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.wheel(0,-700);
    await pause(500);
    await shot(page,"05-find-quiz-zoomed","Find the country after zooming in");

    await page.getByRole("button",{name:"Give up",exact:true}).click();
    await page.waitForSelector(".reslist");
    await pause(1500);
    await shot(page,"07-results","Results with map");
    await ctx.close();
  }

  // --- name the capital with the keyboard up ---
  {
    const {ctx,page}=await newPage();
    await openAfricaDrill(page);
    await page.keyboard.press("1");
    await page.waitForSelector(".modal");
    await pause(1200);
    await page.getByRole("button",{name:"Settings",exact:true}).click();
    await pause(700);
    await page.getByRole("button",{name:"Quiz",exact:true}).click();
    await page.getByRole("button",{name:"Name the capital",exact:true}).click();
    await page.locator(".drawer-overlay").click({position:{x:195,y:20}});
    await pause(500);
    await page.locator(".setup-cta .btn").click();
    await page.waitForSelector("input[type=text]");
    await page.setViewportSize(KEYBOARD_VIEW);
    await pause(600);
    await shot(page,"06-capital-quiz-keyboard","Name the capital, keyboard-sized viewport");
    await ctx.close();
  }

  await browser.close();
  await server.close();
}

async function publish(){
  await rm(latestDir,{recursive:true,force:true});
  await cp(runDir,latestDir,{recursive:true});
  if(baseline){
    await rm(baselineDir,{recursive:true,force:true});
    await cp(runDir,baselineDir,{recursive:true});
  }
  const hasBase=existsSync(baselineDir);
  const rows=taken.sort((a,b)=>a.id.localeCompare(b.id)).map(t=>`
    <section>
      <h2>${t.id} <small>${t.note}</small></h2>
      <div class="pair">
        ${hasBase&&existsSync(path.join(baselineDir,t.id+".png"))
          ?`<figure><figcaption>baseline</figcaption><img src="../baseline/${t.id}.png"></figure>`:""}
        <figure><figcaption>latest</figcaption><img src="${t.id}.png"></figure>
      </div>
    </section>`).join("");
  await writeFile(path.join(latestDir,"index.html"),`<!doctype html><meta charset="utf-8"><title>Mobile shots</title>
<style>
body{font:14px system-ui;margin:24px;background:#f4f6f9;color:#0f172a}
h2{margin:28px 0 8px;font-size:16px}h2 small{font-weight:400;color:#64748b;margin-left:8px}
.pair{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
figure{margin:0}figcaption{font-size:12px;color:#64748b;margin-bottom:4px}
img{width:260px;border:1px solid #cbd5e1;border-radius:14px;background:#fff}
</style><h1>Mobile shots ${stamp}</h1>${rows}`);
  const prev=(await readdir(outRoot)).filter(n=>/^\d{4}-/.test(n)).sort();
  for(const old of prev.slice(0,-5))await rm(path.join(outRoot,old),{recursive:true,force:true});
}

console.log(baseline?"Taking BASELINE shots…":"Taking shots…");
await main();
await publish();
console.log(`\nSaved to ${path.relative(root,latestDir)}/ (open index.html)${baseline?"\nBaseline updated.":""}`);
