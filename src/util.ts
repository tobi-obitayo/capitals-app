export const shuffle=<T,>(a:readonly T[]):T[]=>{
  const r=[...a];
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}
  return r;
};

/** lower-case, strip accents and punctuation so "Chișinău" and "chisinau" compare equal */
export const norm=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");

export const lev=(a:string,b:string)=>{
  const m:number[][]=[...Array(a.length+1)].map((_,i)=>[i,...Array(b.length).fill(0)]);
  for(let j=1;j<=b.length;j++)m[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)
    m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return m[a.length][b.length];
};

export interface AnswerCheck{empty:boolean;ok:boolean;close:boolean}
/**
 * Compare a typed answer with the accepted answers.
 * With `spell` on, one wrong letter is forgiven for answers of 5+ letters; off means an exact match
 * (still ignoring case, accents and punctuation).
 */
export function checkAnswer(accepted:string[],typed:string,spell:boolean):AnswerCheck{
  const n=norm(typed);
  if(!n)return{empty:true,ok:false,close:false};
  const answers=accepted.map(norm);
  const exact=answers.includes(n);
  const close=!exact&&spell&&answers.some(a=>a.length>=5&&lev(a,n)<=1);
  return{empty:false,ok:exact||close,close};
}

/**
 * Auto-check (spell check off): is what's typed already exactly an accepted answer, with no longer
 * accepted answer it could still be turning into ("Washington" vs "Washington, D.C.")?
 */
export function autoMatches(accepted:string[],typed:string):boolean{
  const n=norm(typed);
  if(!n)return false;
  const answers=accepted.map(norm);
  return answers.includes(n)&&!answers.some(a=>a.length>n.length&&a.startsWith(n));
}

/** how long the green "correct" state shows after an auto-check before moving on */
export const AUTO_ADVANCE_MS=600;

export const fmtTime=(sec:number)=>{
  const s=Math.max(0,Math.ceil(sec));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
};
