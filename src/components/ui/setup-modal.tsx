import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useContext,useLayoutEffect,useRef, type ReactNode } from "react";
import {NestedSettingsDialog} from './nested-settings-dialog';
import { Button } from "./button";

export function SetupModal({ open, onOpenChange, title, description, children, tone = "starter", icon }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode; tone?: "starter" | "pro" | "max"; icon?: ReactNode }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const register=useContext(NestedSettingsDialog);
  useLayoutEffect(()=>{if(open&&register)return register(()=>onOpenChange(false));},[open,register,onOpenChange]);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal container={document.querySelector<HTMLElement>(".apple-settings-window") ?? document.querySelector<HTMLElement>(".shell") ?? undefined}><Dialog.Overlay className="setup-overlay"/><Dialog.Content className="setup-modal" onEscapeKeyDown={event=>{event.preventDefault();event.stopPropagation();onOpenChange(false);}} onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
    <div className={`solar-banner setup-banner ${tone}`}><span className="setup-banner-icon">{icon ?? <img src="/solar-icon.png" alt=""/>}</span><Dialog.Close asChild><Button variant="ghost" size="icon" className="setup-close" aria-label="Fermer la configuration"><X size={17}/></Button></Dialog.Close></div>
    <div className="setup-modal-body"><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description>{children}</div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
