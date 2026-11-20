import {ArrowRightIcon,XIcon} from "lucide-react";
import {dataByName,type ContinentName} from "../data";
import {Button} from "./ui/button";

interface Props{
  name:string;
  onOpen:(cn:ContinentName)=>void;
  onClose:()=>void;
}

/** what a tap on a country shows on the zoomed-in flat map: its name and capital, with one way into its continent */
export function CountryCard({name,onOpen,onClose}:Props){
  const d=dataByName[name];
  if(!d)return null;
  return(
    <div role="status" aria-live="polite" data-slot="country-card"
      className="fixed left-1/2 top-[max(16px,env(safe-area-inset-top))] z-[14] flex w-max max-w-[calc(100vw-150px)] -translate-x-1/2 items-center gap-1 rounded-xl border bg-background/97 py-2 pr-2 pl-4 shadow-lg animate-in fade-in zoom-in-95 max-[700px]:top-[calc(max(16px,env(safe-area-inset-top))+54px)] max-[700px]:w-[calc(100vw-24px)] max-[700px]:max-w-none">
      <div className="min-w-0 flex-1 pr-2 leading-tight">
        <div className="truncate text-base font-bold text-primary">{d.k}</div>
        <div className="truncate text-[13px] text-muted-foreground"><span className="sr-only">Capital: </span>{d.c}</div>
      </div>
      <Button type="button" variant="ghost" size="sm" className="shrink-0 text-primary" onClick={()=>onOpen(d.cn)} aria-label={`Open ${d.cn}`}>
        {d.cn}<ArrowRightIcon aria-hidden="true"/>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" aria-label="Close" onClick={onClose}>
        <XIcon aria-hidden="true"/>
      </Button>
    </div>
  );
}
