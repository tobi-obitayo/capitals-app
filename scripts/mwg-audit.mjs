#!/usr/bin/env node
/**
 * Broader modern-web-guidance audit beyond legacy-scan (~20% of the catalog).
 *
 *   npm run mwg:audit
 *   npm run mwg:audit -- --json
 *   npm run mwg:audit -- --path .              # include scripts/tests too
 *   npm run mwg:audit -- --path src/components
 *
 * What this does:
 *   1. Runs `legacy-scan` for deterministic pattern hits.
 *   2. Searches a curated set of topics that match this app (dialogs, drawers,
 *      forms, map panning, canvas a11y, motion, toasts, …).
 *   3. Greps the codebase for relevance signals and prints a triage report.
 *
 * What this cannot do:
 *   Judgment-based guides have no automatic pass/fail. "review" means: retrieve
 *   the guide and check those files — not that the code is wrong.
 */
import {spawnSync} from "node:child_process";
import {readdir,readFile,stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const asJson=args.includes("--json");
const pathIdx=args.indexOf("--path");
const scanPath=pathIdx>=0?args[pathIdx+1]:"src";
const skillVersion="2026_11_16-268fb9ea";
const selfName="mwg-audit.mjs";

/** Topics grounded in what this capitals app actually ships. */
const PROBES=[
  {
    id:"dialog-overlays",
    query:"light dismiss dialog",
    why:"Drill/quiz modals and ModalShell",
    signals:[/\bDialog\b/,/\bshowModal\b/,/\binert\b/,/ModalShell/,/DrillModal/,/role=["']dialog["']/],
  },
  {
    id:"platform-dismiss",
    query:"dismiss modal dialog escape",
    why:"Esc / back / outside-tap on overlays",
    signals:[/\bEscape\b/,/onOpenChange/,/onDismiss/,/ModalShell/,/DrillModal/],
  },
  {
    id:"scroll-lock",
    query:"prevent page scroll under modal",
    why:"Map should not scroll under open overlays",
    signals:[/overscroll-behavior/,/overflow:\s*hidden/,/ModalShell/,/Drawer/],
  },
  {
    id:"bottom-drawer",
    query:"navigation drawer",
    why:"Native bottom drawers (Drawer.tsx: Panel, drill Settings)",
    signals:[/\bBottomDrawer\b/,/dialog\.drawer/,/drawer-/],
  },
  {
    id:"popover-tooltips",
    query:"interest triggered tooltips",
    why:"InfoPopover / Radix popover",
    signals:[/\bPopover\b/,/InfoPopover/,/popover/],
  },
  {
    id:"toast-notifications",
    query:"persistent toast notifications",
    why:"Sonner toasts + quiz status toasts",
    signals:[/\bsonner\b/,/\bToaster\b/,/qtoast/,/role=["']status["']/],
  },
  {
    id:"enter-submit",
    query:"ime safe enter submit",
    why:"Quiz typed answers use Enter to advance",
    signals:[/onKeyDown/,/e\.key===["']Enter["']/,/isComposing/,/enterKeyHint/],
  },
  {
    id:"forms-inputs",
    query:"validate input after interaction",
    why:"Typed capital/country answer forms",
    signals:[/<form\b/,/type=["']text["']/,/autoComplete/,/spellCheck/,/enterKeyHint/],
  },
  {
    id:"map-panning",
    query:"2d panning",
    why:"World map + find-quiz canvas gestures",
    signals:[/touch-action/,/WorldMap/,/FindQuiz/,/\bzoomBy\b/,/\bpan\b/],
  },
  {
    id:"canvas-a11y",
    query:"expose canvas content to browser features",
    why:"Primary UI is <canvas> maps",
    signals:[/<canvas\b/,/getContext\(["']2d["']\)/,/aria-label=.*[Mm]ap/],
  },
  {
    id:"reduced-motion",
    query:"respect reduced motion preference",
    why:"Map intro / quiz animations",
    signals:[/prefers-reduced-motion/,/matchMedia.*reduce/],
  },
  {
    id:"safe-areas",
    query:"form factor adaptation",
    why:"Mobile safe-area insets on chrome",
    signals:[/safe-area-inset/,/env\(safe-area/,/dvh|svh|lvh/],
  },
  {
    id:"focus-management",
    query:"dialog focus management",
    why:"Modals should trap/restore focus",
    signals:[/\.focus\(/,/autoFocus/,/preventScroll/,/tabIndex/,/aria-modal/],
  },
  {
    id:"aria-live",
    query:"accessible error announcement",
    why:"Quiz feedback / live regions",
    signals:[/aria-live/,/aria-invalid/,/role=["']status["']/,/role=["']alert["']/],
  },
  {
    id:"untrusted-html",
    query:"sanitize untrusted html",
    why:"Map labels use innerHTML",
    signals:[/\.innerHTML\s*=/,/dangerouslySetInnerHTML/],
  },
  {
    id:"view-transitions",
    query:"same document transitions",
    why:"SPA screen changes (drill ↔ results) — skip if unused",
    signals:[/startViewTransition\s*\(/,/::view-transition/,/view-transition-name\s*:/],
  },
  {
    id:"animate-overlays",
    query:"animate to from top layer",
    why:"Dialog/popover enter-exit motion",
    signals:[/@starting-style/,/::backdrop/,/transition.*opacity/,/ModalShell/,/Drawer/],
  },
];

const CODE_EXT=new Set([".ts",".tsx",".js",".jsx",".css",".mjs"]);
const SKIP_DIRS=new Set(["node_modules",".git","dist","shots","coverage",".agents",".cursor"]);

function runMwg(mwgArgs){
  const r=spawnSync(
    "npx",
    ["-y","modern-web-guidance@latest",...mwgArgs],
    {
      cwd:root,
      encoding:"utf8",
      env:{...process.env,NPM_CONFIG_CACHE:process.env.NPM_CONFIG_CACHE||"/tmp/npm-cache"},
      maxBuffer:8*1024*1024,
    },
  );
  if(r.error)throw r.error;
  const out=(r.stdout||"").replace(/^npm [^\n]*\n/gm,"").trim();
  if(r.status!==0){
    const err=(r.stderr||out||`exit ${r.status}`).slice(0,800);
    throw new Error(`modern-web-guidance ${mwgArgs[0]} failed: ${err}`);
  }
  return out;
}

function parseJsonLoose(text){
  const start=text.indexOf("{")>=0&&(text.indexOf("[")<0||text.indexOf("{")<text.indexOf("["))
    ?text.indexOf("{")
    :text.indexOf("[");
  if(start<0)throw new Error(`No JSON in output:\n${text.slice(0,400)}`);
  return JSON.parse(text.slice(start));
}

async function collectFiles(dir,out=[]){
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true})}
  catch{return out}
  for(const e of entries){
    if(e.name.startsWith(".")&&e.name!==".env.example")continue;
    if(SKIP_DIRS.has(e.name))continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())await collectFiles(p,out);
    else if(e.name===selfName)continue;
    else if(CODE_EXT.has(path.extname(e.name)))out.push(p);
  }
  return out;
}

async function scanSignals(files,signals){
  const hits=[];
  for(const file of files){
    let text;
    try{text=await readFile(file,"utf8")}
    catch{continue}
    const lines=text.split("\n");
    const fileHits=[];
    for(let i=0;i<lines.length;i++){
      for(const re of signals){
        if(re.test(lines[i])){
          fileHits.push({line:i+1,snippet:lines[i].trim().slice(0,120)});
          break;
        }
      }
    }
    if(fileHits.length){
      hits.push({
        file:path.relative(root,file),
        matches:fileHits.slice(0,5),
        matchCount:fileHits.length,
      });
    }
  }
  hits.sort((a,b)=>b.matchCount-a.matchCount);
  return hits;
}

function printHuman(report){
  console.log(`\nmodern-web-guidance audit  (${report.scannedFiles} files under ${report.scanPath})`);
  console.log("─".repeat(64));

  console.log(`\n1) legacy-scan  (${report.legacy.totalFindings} finding(s); deterministic ~20% of catalog)`);
  if(!report.legacy.findings.length)console.log("   ✓ no deterministic legacy hits");
  for(const f of report.legacy.findings){
    console.log(`   • [${f.guideId}] ${f.file}:${f.line}`);
    console.log(`     ${f.message}`);
  }

  console.log(`\n2) topic triage  (${report.review.length} review / ${report.skip.length} skip)`);
  console.log("   (review ≠ failing — retrieve the guide and check the listed files)\n");
  for(const t of report.review){
    console.log(`   ▸ ${t.id}  →  ${t.guides.map(g=>g.id).join(", ")||"(no search hit)"}`);
    console.log(`     why: ${t.why}`);
    console.log(`     query: "${t.query}"`);
    for(const h of t.files.slice(0,6)){
      console.log(`     - ${h.file}  (${h.matchCount} hit${h.matchCount===1?"":"s"})`);
    }
    if(t.files.length>6)console.log(`     … +${t.files.length-6} more files`);
    console.log("");
  }

  if(report.skip.length){
    console.log("   skipped (no codebase signals):");
    for(const t of report.skip)console.log(`     · ${t.id} — ${t.why}`);
  }

  console.log("\nNext:");
  console.log('  npx -y modern-web-guidance@latest retrieve "<guide-id>"');
  console.log("  Then compare the guide against the files listed under that topic.\n");
}

async function main(){
  const target=path.resolve(root,scanPath);
  const st=await stat(target);
  const files=st.isDirectory()?await collectFiles(target):[target];

  process.stderr.write("Running legacy-scan…\n");
  const legacyRaw=runMwg(["legacy-scan",scanPath,"--json"]);
  const legacyJson=parseJsonLoose(legacyRaw);
  const legacyFindings=[];
  for(const g of legacyJson.guides||[]){
    for(const rule of g.rules||[]){
      for(const f of rule.findings||[]){
        legacyFindings.push({
          guideId:g.guideId,
          ruleId:rule.ruleId,
          file:f.file,
          line:f.line,
          message:f.message,
          lineContent:f.lineContent,
        });
      }
    }
  }

  const review=[];
  const skip=[];
  for(const probe of PROBES){
    process.stderr.write(`Searching "${probe.query}"…\n`);
    let guides=[];
    try{
      const raw=runMwg(["search",probe.query,"--skill-version",skillVersion]);
      const parsed=parseJsonLoose(raw);
      guides=(Array.isArray(parsed)?parsed:[]).slice(0,3).map(g=>({id:g.id,description:g.description}));
    }catch(err){
      guides=[{id:"(search-failed)",description:String(err.message||err)}];
    }
    const filesHits=await scanSignals(files,probe.signals);
    const row={
      id:probe.id,
      query:probe.query,
      why:probe.why,
      guides,
      files:filesHits,
    };
    if(filesHits.length)review.push(row);
    else skip.push(row);
  }

  const report={
    generatedAt:new Date().toISOString(),
    scanPath,
    scannedFiles:files.length,
    note:"legacy-scan is automated. Topic rows are relevance triage only — retrieve + review to verify modernity.",
    legacy:{
      totalFindings:legacyJson.totalFindings??legacyFindings.length,
      activeGuideCount:legacyJson.activeGuideCount,
      activeRuleCount:legacyJson.activeRuleCount,
      findings:legacyFindings,
    },
    review,
    skip:skip.map(({id,query,why,guides})=>({id,query,why,guides})),
  };

  if(asJson)console.log(JSON.stringify(report,null,2));
  else printHuman(report);
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
