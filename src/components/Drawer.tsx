import type{ReactNode}from"react";
import{Drawer as Vaul}from"vaul";

interface Props{
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  title:string;
  children:ReactNode;
}

/** Mobile settings sheet (Vaul), styled with app tokens. */
export function BottomDrawer({open,onOpenChange,title,children}:Props){
  return(
    <Vaul.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} modal>
      <Vaul.Portal>
        <Vaul.Overlay className="drawer-overlay"/>
        <Vaul.Content className="drawer-content" aria-describedby={undefined}>
          <Vaul.Handle className="drawer-handle"/>
          <div className="drawer-head">
            <Vaul.Title className="drawer-title">{title}</Vaul.Title>
          </div>
          <div className="drawer-body">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
