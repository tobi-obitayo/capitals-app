// @vitest-environment jsdom
import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import App from "../src/App";
import {CONT,dataByName} from "../src/data";
import {loadWorld50} from "../src/geo";
import {buildScene,hitTest,insetAt} from "../src/map/find";
import {sceneFor} from "../src/map/mini";
import {clickPointFor} from "./helpers";

beforeAll(()=>{
  const noop:any=new Proxy(function(){},{get:(_t,k)=>k==="canvas"?{}:noop,apply:()=>noop,set:()=>true});
  HTMLCanvasElement.prototype.getContext=(()=>noop) as any;
  HTMLCanvasElement.prototype.setPointerCapture=()=>{};
  Element.prototype.getBoundingClientRect=function(){
    return{x:0,y:0,left:0,top:0,right:1440,bottom:860,width:1440,height:860,toJSON(){}} as DOMRect;
  };
  (globalThis as any).ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  window.matchMedia=((q:string)=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent:()=>false})) as any;
  window.confirm=()=>true;
  Object.defineProperty(window,"innerWidth",{value:1440,configurable:true});
  Object.defineProperty(window,"innerHeight",{value:860,configurable:true});
  if(typeof (window as any).PointerEvent==="undefined"){
    (window as any).PointerEvent=class extends MouseEvent{pointerId:number;constructor(t:string,i:any={}){super(t,i);this.pointerId=i.pointerId??1}};
  }
});
beforeEach(()=>{localStorage.clear()});
afterEach(()=>{cleanup();vi.useRealTimers()});

const V1={k:1,tx:0,ty:0};
const click=(name:string|RegExp)=>fireEvent.click(screen.getByRole("button",{name}));

function openNorthAmericaQuiz(kind:"Find the country"|"Name the capital"){
  fireEvent.keyDown(window,{key:"4"});
  click("Quiz");
  click(kind);
}

describe("name the capital quiz",()=>{
  it("answering everything gives 100% and an all-green results screen",async()=>{
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click(/Start quiz/);
    for(let n=0;n<CONT["North America"].length;n++){
      const country=document.querySelector(".q h3")!.textContent!;
      const input=screen.getByPlaceholderText("Type the capital…") as HTMLInputElement;
      fireEvent.change(input,{target:{value:dataByName[country].c}});
      fireEvent.submit(input.closest("form")!);
      click(/Next|Finish/);
    }
    expect(await screen.findByText("100%")).toBeTruthy();
    expect(screen.getByText("Quiz complete")).toBeTruthy();
    expect(screen.getByText(/23 of 23 correct/)).toBeTruthy();
    expect(screen.queryByText(/^Missed \(/)).toBeNull();
  });

  it("giving up shows the percentage, misses and the correct answers",async()=>{
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click(/Start quiz/);
    const country=document.querySelector(".q h3")!.textContent!;
    const input=screen.getByPlaceholderText("Type the capital…") as HTMLInputElement;
    fireEvent.change(input,{target:{value:dataByName[country].c}});
    fireEvent.submit(input.closest("form")!);
    click(/Next/);
    click("Give up");
    expect(await screen.findByText("You gave up")).toBeTruthy();
    expect(screen.getByText("4%")).toBeTruthy();            // 1 of 23
    expect(screen.getByText(/1 of 23 correct/)).toBeTruthy();
    expect(screen.getByText("Missed (22)")).toBeTruthy();
    expect(screen.getAllByText("Not reached").length).toBe(22); // everything after the first answer, including the one on screen
  });

  it("a wrong answer is shown with the correct capital and counted as missed",async()=>{
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click(/Start quiz/);
    const country=document.querySelector(".q h3")!.textContent!;
    const input=screen.getByPlaceholderText("Type the capital…") as HTMLInputElement;
    fireEvent.change(input,{target:{value:"zzzzzz"}});
    fireEvent.submit(input.closest("form")!);
    expect(document.querySelector(".fb.bad")!.textContent).toContain(dataByName[country].c);
    click(/Next/);
    click("Give up");
    expect(await screen.findByText(`You typed “zzzzzz”`)).toBeTruthy();
  });
});

describe("auto-check (spell check off)",()=>{
  const fake=()=>vi.useFakeTimers({toFake:["setInterval","clearInterval","setTimeout","clearTimeout","performance","Date"]});
  const typeIn=(v:string)=>fireEvent.change(screen.getByPlaceholderText(/Type the/) as HTMLInputElement,{target:{value:v}});

  it("quiz: the right answer is accepted without Enter, then moves on by itself",()=>{
    fake();
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    fireEvent.click(screen.getByRole("switch",{name:"Spell check"}));
    click(/Start quiz/);
    const first=document.querySelector(".q h3")!.textContent!;
    typeIn(dataByName[first].c.slice(0,3));                // not there yet
    expect(document.querySelector(".fb")).toBeNull();
    typeIn(dataByName[first].c);                           // now exact
    expect(document.querySelector(".fb.ok")!.textContent).toContain("Correct");
    expect(screen.getByText("1 correct")).toBeTruthy();
    act(()=>{vi.advanceTimersByTime(700)});
    expect(screen.getByText("2 / 23")).toBeTruthy();
    expect(document.querySelector(".fb")).toBeNull();
  });

  it("quiz: a near miss does not auto-check, and spell check on never auto-checks",()=>{
    fake();
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click(/Start quiz/);                                    // spell check on (default)
    const first=document.querySelector(".q h3")!.textContent!;
    typeIn(dataByName[first].c);
    expect(document.querySelector(".fb")).toBeNull();      // waits for Enter
    act(()=>{vi.advanceTimersByTime(2000)});
    expect(screen.getByText("1 / 23")).toBeTruthy();
  });

  it("learn drill: Type it with spell check off checks as you type",()=>{
    fake();
    render(<App/>);
    fireEvent.keyDown(window,{key:"4"});
    click("Type it");
    fireEvent.click(screen.getByRole("switch",{name:"Spell check"}));
    click(/Start drill/);
    const country=document.querySelector(".q h3")!.textContent!;
    typeIn(dataByName[country].c);
    expect(document.querySelector(".fb.ok")).toBeTruthy();
    act(()=>{vi.advanceTimersByTime(700)});
    expect(screen.getByText("2 / 23")).toBeTruthy();
  });

  it("learn drill: the spelling switch only shows for Type it",()=>{
    render(<App/>);
    fireEvent.keyDown(window,{key:"4"});
    expect(screen.queryByRole("switch",{name:"Spell check"})).toBeNull();
    click("Type it");
    expect(screen.getByRole("switch",{name:"Spell check"})).toBeTruthy();
  });
});

describe("timer",()=>{
  it("stops the quiz when time runs out",()=>{
    vi.useFakeTimers({toFake:["setInterval","clearInterval","setTimeout","clearTimeout","performance","Date"]});
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click("1 min");
    click(/Start quiz/);
    expect(screen.getByText("1:00")).toBeTruthy();
    act(()=>{vi.advanceTimersByTime(30_000)});
    expect(screen.getByText("0:30")).toBeTruthy();
    act(()=>{vi.advanceTimersByTime(31_000)});
    expect(screen.getByText("Time's up")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("can be switched off during the quiz, which lifts the limit",()=>{
    vi.useFakeTimers({toFake:["setInterval","clearInterval","setTimeout","clearTimeout","performance","Date"]});
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click("1 min");
    click(/Start quiz/);
    click("Limit on");
    expect(screen.getByRole("button",{name:"No limit"})).toBeTruthy();
    act(()=>{vi.advanceTimersByTime(120_000)});
    expect(screen.queryByText("Time's up")).toBeNull();
    expect(screen.getByText("2:00")).toBeTruthy();         // counts up while the limit is off
    click("No limit");
    act(()=>{vi.advanceTimersByTime(61_000)});
    expect(screen.getByText("Time's up")).toBeTruthy();
  });

  it("with the timer off from the start there is no limit and no toggle",()=>{
    vi.useFakeTimers({toFake:["setInterval","clearInterval","setTimeout","clearTimeout","performance","Date"]});
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    fireEvent.click(screen.getByRole("switch",{name:"Time limit"}));
    click(/Start quiz/);
    expect(screen.queryByRole("button",{name:/limit/i})).toBeNull();
    act(()=>{vi.advanceTimersByTime(900_000)});
    expect(screen.queryByText("Time's up")).toBeNull();
  });
});

describe("no hidden tooltips in the drill and quiz modals",()=>{
  it("setup screens have no (i) icons; settings explain themselves in one line",()=>{
    render(<App/>);
    fireEvent.keyDown(window,{key:"4"});
    expect(document.querySelector(".modal .info")).toBeNull();
    click("Type it");
    expect(document.querySelector(".modal .info")).toBeNull();
    expect(screen.getByText(/Small typos and missing accents are forgiven/)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch",{name:"Spell check"}));
    expect(screen.getByText(/checks the moment you type it right/)).toBeTruthy();
    click("Quiz");
    expect(document.querySelector(".modal .info")).toBeNull();
    click("Find the country");
    expect(screen.getByText(/Keep tapping until you find it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch",{name:"Hard mode"}));
    expect(screen.getByText(/One try per country/)).toBeTruthy();
  });
});

describe("results: list and map highlight each other",()=>{
  async function giveUpResults(){
    render(<App/>);
    openNorthAmericaQuiz("Name the capital");
    click(/Start quiz/);
    click("Give up");
    await screen.findByText("You gave up");
  }
  it("hovering a row marks it, and leaving clears it",async()=>{
    await giveUpResults();
    const row=screen.getByText("Canada").closest("li")!;
    fireEvent.pointerEnter(row);
    expect(row.className).toContain("hot");
    fireEvent.pointerLeave(row);
    expect(row.className).not.toContain("hot");
  });
  it("hovering a country on the map marks its row (insets included)",async()=>{
    await giveUpResults();
    const world=await loadWorld50();
    const scene=sceneFor(world,1440,860,{cn:"North America",reserved:[{x:0,y:860-64,w:400,h:64}]});
    const map=document.querySelector(".right")!;
    for(const name of ["Canada","Barbados"]){
      const {p}=clickPointFor(world,scene,V1,name);
      fireEvent.pointerMove(map,{clientX:p[0],clientY:p[1]});
      const row=screen.getByText(name).closest("li")!;
      await waitFor(()=>expect(row.className,name).toContain("hot"));
    }
    fireEvent.pointerLeave(map);
    expect(document.querySelector(".reslist li.hot")).toBeNull();
  });
});

describe("quiz availability",()=>{
  it("every continent has an enabled Quiz tab",()=>{
    render(<App/>);
    for(const key of ["1","2","3","4","5","6"]){
      fireEvent.keyDown(window,{key});
      expect((screen.getByRole("button",{name:"Quiz"}) as HTMLButtonElement).disabled,`key ${key}`).toBe(false);
      fireEvent.keyDown(window,{key:"Escape"});
    }
  });
  it("hard mode and spell check toggles live in the quiz setup",()=>{
    render(<App/>);
    openNorthAmericaQuiz("Find the country");
    expect(screen.getByRole("switch",{name:"Hard mode"})).toBeTruthy();
    click("Name the capital");
    expect(screen.getByRole("switch",{name:"Spell check"})).toBeTruthy();
  });
  it("Africa can start a capital quiz and give up to results",async()=>{
    render(<App/>);
    fireEvent.keyDown(window,{key:"1"});
    click("Quiz");
    click("Name the capital");
    click(/Start quiz/);
    expect(document.querySelector(".q h3")).toBeTruthy();
    click("Give up");
    expect(await screen.findByText("You gave up")).toBeTruthy();
    expect(screen.getByText(/of 54 correct/)).toBeTruthy();
  });
});

/* ---------- find the country: click on the map ---------- */
async function sceneNow(){
  const world=await loadWorld50();
  return{world,scene:buildScene(world,"North America",1440,860,{top:84})};
}
async function pixelFor(name:string){
  const {world,scene}=await sceneNow();
  return clickPointFor(world,scene,V1,name).p;
}
const clickAt=(canvas:Element,p:[number,number])=>{
  act(()=>{
    fireEvent.pointerDown(canvas,{clientX:p[0],clientY:p[1],pointerId:1});
    fireEvent.pointerUp(canvas,{clientX:p[0],clientY:p[1],pointerId:1});
  });
};
const target=()=>document.querySelector(".qh-target")!.textContent!;

describe("find the country quiz",()=>{
  async function start(hard=false){
    render(<App/>);
    openNorthAmericaQuiz("Find the country");
    if(hard)fireEvent.click(screen.getByRole("switch",{name:"Hard mode"}));
    click(/Start quiz/);
    await waitFor(()=>expect(document.querySelector(".qloading")).toBeNull());
    // let the draw loop run once so small-island targets exist
    await act(async()=>{await new Promise(r=>setTimeout(r,60))});
    return document.querySelector(".qcanvas")!;
  }

  it("clicking the right country advances; a wrong first click makes it red even if found later",async()=>{
    const canvas=await start();
    expect(screen.getByText("1 / 23")).toBeTruthy();

    const first=target();
    clickAt(canvas,await pixelFor(first));
    expect(screen.getByText("2 / 23")).toBeTruthy();
    expect(screen.getByText("1 correct")).toBeTruthy();

    const second=target();
    const decoy=["Canada","Mexico","Cuba","Panama"].find(n=>n!==second&&n!==first)!;
    clickAt(canvas,await pixelFor(decoy));
    expect(screen.getByRole("status").textContent).toContain(`That's ${decoy}`);
    expect(target()).toBe(second);                       // normal mode: keep trying
    clickAt(canvas,await pixelFor(second));
    expect(screen.getByText("3 / 23")).toBeTruthy();
    expect(screen.getByText("1 correct")).toBeTruthy();    // found, but not on the first try

    click("Give up");
    expect(await screen.findByText("You gave up")).toBeTruthy();
    expect(screen.getByText("4%")).toBeTruthy();
    expect(screen.getByText(/1 wrong tap/)).toBeTruthy();
  });

  it("hard mode: one wrong tap marks the country missed and moves on",async()=>{
    const canvas=await start(true);
    const first=target();
    const decoy=["Canada","Mexico","Cuba"].find(n=>n!==first)!;
    clickAt(canvas,await pixelFor(decoy));
    expect(target()).not.toBe(first);
    expect(screen.getByText("0 correct")).toBeTruthy();
    expect(screen.getByText("Hard")).toBeTruthy();
    click("Give up");
    await screen.findByText("You gave up");
    expect(screen.getByText(/Hard mode/)).toBeTruthy();
  });

  it("skip counts as missed; clicking the ocean or another continent is ignored",async()=>{
    const canvas=await start();
    const first=target();
    const {world,scene}=await sceneNow();
    const ocean=([[6,430],[1434,430],[720,852],[6,200]] as [number,number][])
      .find(p=>!insetAt(scene,p[0],p[1])&&hitTest(world,scene,V1,p[0],p[1])===null)!;
    clickAt(canvas,ocean);                                  // open ocean, no penalty
    expect(target()).toBe(first);
    expect(screen.queryByRole("status")).toBeNull();
    click(/Skip/);
    expect(target()).not.toBe(first);
    click("Give up");
    await screen.findByText("You gave up");
    expect(screen.getAllByText("Skipped").length).toBe(1);
  });

  it("can click a tiny island (Barbados) inside the Lesser Antilles inset",async()=>{
    const canvas=await start();
    for(let guard=0;guard<30&&target()!=="Barbados";guard++)click(/Skip/);
    expect(target()).toBe("Barbados");
    const {world,scene}=await sceneNow();
    const hit=clickPointFor(world,scene,V1,"Barbados");
    expect(hit.panel).toBe("antilles");
    clickAt(canvas,[hit.p[0]+3,hit.p[1]+2]);
    // if Barbados was the last prompt the quiz has already finished on its own
    const giveUp=screen.queryByRole("button",{name:"Give up"});
    if(giveUp)fireEvent.click(giveUp);
    await screen.findByText(/You gave up|Quiz complete/);
    const row=screen.getAllByText("Barbados")[0].closest("li")!;
    expect(row.className).toBe("ok");
  });
});
