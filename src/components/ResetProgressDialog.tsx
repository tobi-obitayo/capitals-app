import {useEffect,useId,useRef,useState} from "react";
import {toast} from "sonner";
import {resetProgress} from "../progress";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Label} from "./ui/label";
import {closedByFor,useDialogElement,useModalDialog} from "./useModalDialog";

const PHRASE="RESET";

interface Props{
  open:boolean;
  onOpenChange:(open:boolean)=>void;
}

/** Type-to-confirm wipe of mastery saved in this browser. */
export function ResetProgressDialog({open,onOpenChange}:Props){
  const [value,setValue]=useState("");
  const inputId=useId();
  const titleId=useId();
  const descId=useId();
  const cancelRef=useRef<HTMLButtonElement>(null);
  const {ref,setRef}=useDialogElement();
  const matched=value===PHRASE;

  useModalDialog(ref,{
    open,onClose:()=>onOpenChange(false),dismissible:true,
    // the safe action gets focus, not the destructive one
    initialFocus:()=>cancelRef.current,
  });

  useEffect(()=>{
    if(!open)setValue("");
  },[open]);

  const confirm=()=>{
    if(!matched)return;
    resetProgress();
    onOpenChange(false);
    toast("Progress reset");
  };

  return(
    <dialog ref={setRef} aria-labelledby={titleId} aria-describedby={descId}
      className="m-auto w-[calc(100%-2rem)] max-w-md gap-4 rounded-lg border bg-background p-6 text-foreground shadow-lg outline-none open:grid backdrop:bg-black/50"
      {...({closedby:closedByFor(true,false)} as object)}>
      {open&&(
        <>
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <h2 id={titleId} className="text-lg leading-none font-semibold">Reset all progress?</h2>
            <p id={descId} className="text-sm text-muted-foreground">
              This clears every country’s mastery in this browser. Type <span className="font-semibold text-foreground">{PHRASE}</span> to confirm.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>Confirmation</Label>
            <Input
              id={inputId}
              value={value}
              onChange={e=>setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={PHRASE}
              onKeyDown={e=>{
                if(e.key!=="Enter")return;
                e.preventDefault();
                if(e.nativeEvent.isComposing||e.keyCode===229)return;
                confirm();
              }}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={cancelRef} type="button" variant="outline" onClick={()=>onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={!matched} onClick={confirm}>
              Reset progress
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
