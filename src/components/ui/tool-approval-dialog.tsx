import { useRef, useSyncExternalStore } from "react";
import { Dialog } from "radix-ui";
import { toolApprovals } from "../../services/toolApprovals";
import { Button } from "./button";

export function ToolApprovalDialog() {
  const pending = useSyncExternalStore(toolApprovals.subscribe, toolApprovals.snapshot);
  const request = pending[0];
  const returnFocus = useRef<HTMLElement | null>(null);
  if (!request) return null;
  return <Dialog.Root open onOpenChange={open => { if (!open) toolApprovals.decide(request.id, false); }}><Dialog.Portal container={document.querySelector(".shell")}><Dialog.Overlay className="tool-approval-overlay"/><Dialog.Content className="tool-approval-dialog" onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
    <Dialog.Title>{request.risk === "read" ? "Autoriser cette lecture ?" : "Approuver cette action ?"}</Dialog.Title>
    <Dialog.Description>{request.description}</Dialog.Description>
    <dl><dt>Application</dt><dd>{request.plugin}</dd><dt>Compte</dt><dd>{request.account}</dd><dt>Outil</dt><dd>{request.tool}</dd></dl>
    <pre>{JSON.stringify(request.input, null, 2)}</pre>
    {request.cloudProvider && <p>Le résultat sera transmis à {request.cloudProvider}, le fournisseur du modèle choisi.</p>}
    <p>Cette autorisation concerne uniquement cet appel.</p>
    <div><Button variant="outline" onClick={() => toolApprovals.decide(request.id, false)}>Annuler</Button><Button onClick={() => toolApprovals.decide(request.id, true)}>Approuver</Button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
