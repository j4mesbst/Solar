import {useEffect,useState} from 'react';
import {authClient} from '../../services/auth';
import {billingSnapshot,cancelSubscription,customerPortal,openStripePage,refreshBilling,billingConfigured} from '../../services/billing';
import {planName} from '../../services/solarPlans';
import {Button} from './button';
import {SetupModal} from './setup-modal';
import {AccountDialog} from './account-dialog';
export function BillingAccountControls(){
 const [state,setState]=useState(billingSnapshot),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(false),[accountOpen,setAccountOpen]=useState(false);
 useEffect(()=>{
   const update=()=>setState(billingSnapshot());window.addEventListener('solar-billing-change',update);
   void authClient?.auth.getSession().then(({data})=>setSignedIn(Boolean(data.session)));
   void refreshBilling().catch(reason=>setError(reason instanceof Error?reason.message:'Vérification impossible.'));
   return()=>window.removeEventListener('solar-billing-change',update);
 },[]);
 const end=state.currentPeriodEnd?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(state.currentPeriodEnd):undefined;
 const action=async(operation:()=>Promise<void>)=>{setBusy(true);setError('');try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:'Opération impossible.');}finally{setBusy(false);}};
 return <section id="solar-billing-management" className="billing-account" aria-label="Gestion de l’abonnement"><div><strong>{planName(state.plan)}{state.plan==='starter'?' · gratuit':''}</strong><p className="billing-note">{state.cancelAtPeriodEnd?`Résiliation programmée${end?` · accès jusqu’au ${end}`:''}.`:state.plan!=='starter'?`Renouvellement mensuel${end?` · prochaine échéance le ${end}`:''}.`:signedIn?'Ton offre est liée à ton compte Solar.':'Connecte-toi pour retrouver ton abonnement.'}</p></div>
 {signedIn?<div className="billing-actions"><Button variant="outline" disabled={busy||!billingConfigured()} onClick={()=>void action(async()=>{await refreshBilling();})}>Actualiser mon offre</Button>{state.subscriptionId&&<><Button variant="outline" disabled={busy} onClick={()=>void action(async()=>{await openStripePage((await customerPortal()).url);})}>Gérer la facturation</Button><Button variant="ghost" disabled={busy||state.cancelAtPeriodEnd} onClick={()=>setConfirm(true)}>{state.cancelAtPeriodEnd?'Abonnement résilié':'Résilier l’abonnement'}</Button></>}</div>:<Button variant="outline" onClick={()=>setAccountOpen(true)}>Se connecter à Solar</Button>}
 {error&&<p role="alert" className="form-error">{error}</p>}
 <SetupModal open={confirm} onOpenChange={value=>{if(!busy)setConfirm(value);}} title="Résilier ton abonnement ?" description={`Le renouvellement automatique sera arrêté. ${end?`Tu conserves ${planName(state.plan)} jusqu’au ${end}.`:'Ton accès est conservé jusqu’à la fin de la période déjà payée.'} Ensuite, ton compte revient à Starter ; tes agents et conversations sont conservés.`} tone={state.plan}><div className="billing-actions"><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Garder mon abonnement</Button><Button disabled={busy} onClick={()=>void action(async()=>{await cancelSubscription();setConfirm(false);})}>{busy?'Résiliation…':'Confirmer la résiliation'}</Button></div>{error&&<p role="alert" className="form-error">{error}</p>}</SetupModal>
 <AccountDialog open={accountOpen} onClose={()=>setAccountOpen(false)}/></section>;
}
