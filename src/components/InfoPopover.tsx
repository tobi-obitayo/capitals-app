import type {ReactNode} from "react";
import {InfoIcon} from "./ui";
import {Button} from "./ui/button";
import {Popover,PopoverContent,PopoverTrigger} from "./ui/popover";

/** (i) button that shows its explanation only when tapped or clicked (keeps settings rows short) */
export function InfoPopover({children,label="More info"}:{children:ReactNode;label?:string}){
  return(
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={label}
          className="-my-1 size-7 rounded-full text-[var(--faint)] hover:bg-transparent hover:text-primary data-[state=open]:text-primary">
          <InfoIcon/>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 text-xs leading-relaxed text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  );
}
