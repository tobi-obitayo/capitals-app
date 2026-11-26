#!/usr/bin/env node
/**
 * Map zoom / pan smoothness benchmark.
 *
 *   npm run perf                 -> all scenarios, prints a table, saves shots/perf/latest.json
 *   npm run perf -- --label foo  -> saves shots/perf/foo.json instead (e.g. "baseline")
 *   npm run perf -- --only phone-flat,desktop-quiz   -> a subset of scenarios
 *
 * Each scenario throttles the CPU (4x desktop, 6x phone), runs a gesture and records the time between
 * animation frames. The headless frame clock is coarse (16 / 33 / 50 ms ...), so read p95 and "slow frames"
 * rather than single numbers. Targets: desktop p95 <= 17 ms, phone p95 <= 25 ms, no frame over 50 ms.
 */
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "vite";
import {chromium,devices} from "playwright";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf("--"+n);return i>=0?args[i+1]:d};
const label=opt("label","latest");
const only=opt("only","")?opt("only","").split(","):null;
const pause=ms=>new Promise(r=>setTimeout(r,ms));

const TARGET={desktop:{p95:17,over50:0},phone:{p95:25,over50:0}};
const {defaultBrowserType:_ignored,...iphone}=devices["iPhone 14"];

const server=await createServer({root,logLevel:"error",server:{port:0,host:"127.0.0.1"}});
await server.listen();
const url=server.resolvedUrls.local[0];
let browser;
try{browser=await chromium.launch({channel:"chrome"})}catch{browser=await chromium.launch()}

const results=[];

async function open(kind){
  const ctx=await browser.newContext(kind==="phone"?{...iphone,viewport:{width:390,height:844},deviceScaleFactor:2}:{viewport:{width:1440,height:900}});
  const page=await ctx.newPage();
  page.on("pageerror",e=>console.warn("  page error:",e.message));
  await page.goto(url);
  await page.waitForSelector("#map",{state:"attached"});
  await pause(2500);
  const cdp=await ctx.newCDPSession(page);
  return{ctx,page,cdp};
}
async function toFlat(page){
  await page.getByText("Flat",{exact:true}).first().click();
  await pause(3500);   // let the detailed world load and build
}
async function toFindQuiz(page,kind){
  await page.keyboard.press("1");
  await page.waitForSelector(".modal");
  await pause(1200);
  if(kind==="phone"){
    await page.getByRole("button",{name:"Settings",exact:true}).click();
    await pause(600);
    await page.getByRole("button",{name:"Quiz",exact:true}).click();
    await page.getByRole("button",{name:"Find the country",exact:true}).click();
    await page.mouse.click(195,20);
    await pause(500);
    await page.locator(".setup-cta .btn").click();
  }else{
    await page.getByRole("button",{name:"Quiz",exact:true}).click();
    await page.getByRole("button",{name:"Find the country",exact:true}).click();
    await page.getByRole("button",{name:/^start/i}).first().click();
  }
  await page.waitForSelector(".qhud");
  await pause(2500);
}

async function measure(page,name,kind,gesture){
  await page.evaluate(()=>{
    window.__f=[];window.__lt=0;
    let last=performance.now();
    const tick=t=>{window.__f.push(t-last);last=t;requestAnimationFrame(tick)};
    requestAnimationFrame(tick);
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt+=e.duration}).observe({entryTypes:["longtask"]})}catch{}
  });
  await page.evaluate(()=>{window.__f.length=0});
  await gesture();
  await pause(500);
  const {f,lt}=await page.evaluate(()=>({f:window.__f.slice(),lt:window.__lt}));
  // drop the idle frames at the end (after the gesture finished)
  const s=f.toSorted((a,b)=>a-b);
  const q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))];
  const r={name,kind,frames:f.length,p50:q(.5),p95:q(.95),max:s.at(-1),over50:f.filter(x=>x>50).length,longTaskMs:Math.round(lt)};
  const t=TARGET[kind];
  r.pass=r.p95<=t.p95&&r.over50<=t.over50;
  results.push(r);
  console.log(`${r.pass?"PASS":"FAIL"}  ${name.padEnd(22)} frames=${String(r.frames).padStart(3)} p50=${r.p50.toFixed(0)} p95=${r.p95.toFixed(0)} max=${r.max.toFixed(0)} >50ms=${r.over50} longtask=${r.longTaskMs}ms`);
}

const wheel=async(page,steps,dy,x,y)=>{
  await page.mouse.move(x,y);
  for(let i=0;i<steps;i++){await page.mouse.wheel(0,dy);await pause(16)}
};
const dragMouse=async(page,x0,y0,x1,y1,steps=40)=>{
  await page.mouse.move(x0,y0);await page.mouse.down();
  for(let i=1;i<=steps;i++){await page.mouse.move(x0+(x1-x0)*i/steps,y0+(y1-y0)*i/steps);await pause(16)}
  await page.mouse.up();
};
/** touch gestures dispatched as raw touch events (steady 60 Hz), so they behave the same every run */
const touch=(cdp,type,pts)=>cdp.send("Input.dispatchTouchEvent",{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
async function pinch(cdp,cx,cy,scale,steps=36){
  const d0=scale>1?70:260,d1=d0*scale;
  const at=d=>[[cx-d/2,cy],[cx+d/2,cy]];
  await touch(cdp,"touchStart",at(d0));
  for(let i=1;i<=steps;i++){await touch(cdp,"touchMove",at(d0+(d1-d0)*i/steps));await pause(16)}
  await touch(cdp,"touchEnd",[]);
}
async function swipe(cdp,x,y,dx,dy,steps=30){
  await touch(cdp,"touchStart",[[x,y]]);
  for(let i=1;i<=steps;i++){await touch(cdp,"touchMove",[[x+dx*i/steps,y+dy*i/steps]]);await pause(16)}
  await touch(cdp,"touchEnd",[]);
}
const want=n=>!only||only.includes(n);

try{
  if(want("desktop-flat")){
    const {ctx,page,cdp}=await open("desktop");
    await page.keyboard.press("f");await pause(3500);
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
    await measure(page,"desktop-flat wheel in","desktop",()=>wheel(page,40,-80,980,380));
    await measure(page,"desktop-flat wheel out","desktop",()=>wheel(page,40,80,980,380));
    await measure(page,"desktop-flat wheel burst","desktop",async()=>{await wheel(page,60,-120,700,420);await wheel(page,60,120,700,420)});
    await wheel(page,20,-80,700,420);await pause(600);
    await measure(page,"desktop-flat drag pan","desktop",()=>dragMouse(page,900,450,300,300));
    await ctx.close();
  }
  if(want("phone-flat")){
    const {ctx,page,cdp}=await open("phone");
    await toFlat(page);
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
    await measure(page,"phone-flat pinch in","phone",()=>pinch(cdp,195,420,4));
    await measure(page,"phone-flat pinch out","phone",()=>pinch(cdp,195,420,.35));
    await measure(page,"phone-flat pinch deep","phone",async()=>{await pinch(cdp,195,420,2);await pinch(cdp,195,420,2)});
    await measure(page,"phone-flat pan","phone",()=>swipe(cdp,300,420,-220,60));
    await ctx.close();
  }
  if(want("phone-globe")){
    const {ctx,page,cdp}=await open("phone");
    await pause(1500);
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
    await measure(page,"phone-globe pinch in","phone",()=>pinch(cdp,195,420,5));
    await measure(page,"phone-globe zoomed spin","phone",()=>swipe(cdp,300,420,-220,30));
    await measure(page,"phone-globe pinch out","phone",()=>pinch(cdp,195,420,.2));
    await ctx.close();
  }
  if(want("desktop-globe")){
    const {ctx,page,cdp}=await open("desktop");
    await pause(1500);
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
    await measure(page,"desktop-globe wheel in","desktop",()=>wheel(page,60,-80,720,450));
    await measure(page,"desktop-globe zoomed drag","desktop",()=>dragMouse(page,900,450,400,430));
    await ctx.close();
  }
  if(want("desktop-quiz")){
    const {ctx,page,cdp}=await open("desktop");
    await toFindQuiz(page,"desktop");
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
    await measure(page,"desktop-quiz wheel in","desktop",()=>wheel(page,40,-80,700,450));
    await measure(page,"desktop-quiz wheel out","desktop",()=>wheel(page,40,80,700,450));
    await wheel(page,20,-80,700,450);await pause(600);
    await measure(page,"desktop-quiz drag pan","desktop",()=>dragMouse(page,900,500,400,350));
    await ctx.close();
  }
  if(want("phone-quiz")){
    const {ctx,page,cdp}=await open("phone");
    await toFindQuiz(page,"phone");
    await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
    await measure(page,"phone-quiz pinch in","phone",()=>pinch(cdp,195,450,3));
    await measure(page,"phone-quiz pinch out","phone",()=>pinch(cdp,195,450,.35));
    await measure(page,"phone-quiz pan","phone",async()=>{await pinch(cdp,195,450,2.5);await swipe(cdp,300,450,-200,60)});
    await ctx.close();
  }
}finally{
  await browser.close();
  await server.close();
}

await mkdir(path.join(root,"shots","perf"),{recursive:true});
await writeFile(path.join(root,"shots","perf",label+".json"),JSON.stringify(results,null,1));
const failed=results.filter(r=>!r.pass).length;
console.log(`\n${results.length-failed}/${results.length} scenarios meet the targets. Saved shots/perf/${label}.json`);
