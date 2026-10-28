import {SOLAR_PLANS,planName} from '../../services/solarPlans';
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Camera, ChevronRight, CircleCheck, Cloud, Infinity as InfinityIcon, Pencil, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { AppSettings } from "../../domain/types";
import { authClient } from "../../services/auth";
import { dayKey, readUsage, usageSnapshot, type SolarPlan } from "../../services/usage";
import { Button } from "./button";
import { Input } from "./input";
import {BillingAccountControls} from "./billing-controls";
import {beginCheckout,openStripePage,refreshBilling,BillingClientError,validateStripeUrl} from "../../services/billing";
import { AccountDialog } from "./account-dialog";
import { SetupModal } from "./setup-modal";

export function useUsage() {
  const [revision, setRevision] = useState(0);
  useEffect(() => { const update = () => setRevision(n => n + 1); const interval = window.setInterval(update, 30000); window.addEventListener("solar-usage-change", update); window.addEventListener("storage", update); return () => { clearInterval(interval); window.removeEventListener("solar-usage-change", update); window.removeEventListener("storage", update); }; }, []);
  let error = ""; let state;
  try { state = readUsage(); } catch (e) { error = e instanceof Error ? e.message : "Suivi indisponible"; }
  void revision;
  return { usage: state ? usageSnapshot(state) : undefined, error };
}
export function QuotaCards({ compact = false }: { compact?: boolean }) {
  const { usage, error } = useUsage();
  if (!usage) return <p className="form-error" role="alert">{error}</p>;
  return <div className={`quota-cards token-quotas ${compact ? "compact" : ""}`}>{[["Consommation mensuelle", usage.monthly], ...(usage.weekly ? [["Limite hebdomadaire", usage.weekly]] : [])].map(([label, value]) => {
    const q = value as typeof usage.monthly;
    return <article className="quota-card" key={String(label)}><div className="quota-heading"><span>{String(label).replace("Limite","Consommation")}</span><strong>{q.used.toLocaleString("fr-FR")} <small>tokens</small></strong></div></article>;
  })}</div>;
}

export function ActivityCalendar() {
 const {usage}=useUsage(),year=new Date().getFullYear();const root=useRef<HTMLDivElement>(null);
 const [tip,setTip]=useState<{text:string;left:number;top:number}>();
 const days=Array.from({length:Math.round((new Date(year+1,0,1,12).getTime()-new Date(year,0,1,12).getTime())/86400000)},(_,i)=>new Date(year,0,i+1,12));
 const maximum=Math.max(1,...Object.values(usage?.daily??{}).map(e=>e.tokens));
 const show=(target:HTMLElement,text:string)=>{const cell=target.getBoundingClientRect(),box=root.current!.getBoundingClientRect();setTip({text,left:Math.max(4,Math.min(box.width-220,cell.left-box.left-90)),top:cell.top-box.top-55});};
 return <section className="activity-calendar" aria-label={`Activité en tokens pour ${year}`}><div className="settings-subheading"><h3>Activité en tokens</h3><span>{year}</span></div><div ref={root} className="activity-chart"><div className="activity-scroll"><div className="activity-year">{Array.from({length:12},(_,month)=><div className="activity-month" key={month}><span>{new Intl.DateTimeFormat("fr",{month:"short"}).format(new Date(year,month,1))}</span><div className="activity-month-grid" style={{gridTemplateColumns:`repeat(5,minmax(8px,1fr))`}}>{days.filter(d=>d.getMonth()===month).map(day=>{const entry=usage?.daily[dayKey(day)],tokens=entry?.tokens??0,future=dayKey(day)>dayKey(new Date()),index=days.findIndex(d=>dayKey(d)===dayKey(day));const label=`${new Intl.DateTimeFormat("fr",{day:"numeric",month:"long",year:"numeric"}).format(day)} · ${future?"À venir":tokens?`${entry?.estimated?"≈ ":""}${new Intl.NumberFormat("fr").format(tokens)} tokens utilisés${entry?.estimated?" (estimation)":""}`:"Aucun token enregistré"}`;return <button type="button" key={dayKey(day)} className="activity-day" data-day={dayKey(day)} data-level={tokens?Math.max(1,Math.ceil(tokens/maximum*4)):0} data-future={future} aria-label={label} aria-describedby={tip?.text===label?"activity-tooltip":undefined} onPointerEnter={e=>show(e.currentTarget,label)} onPointerLeave={()=>setTip(undefined)} onFocus={e=>show(e.currentTarget,label)} onBlur={()=>setTip(undefined)} onKeyDown={e=>{const offset=({ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1} as Record<string,number>)[e.key];if(offset){e.preventDefault();root.current?.querySelectorAll<HTMLButtonElement>(".activity-day")[Math.max(0,Math.min(days.length-1,index+offset))]?.focus();}}}/>;})}</div></div>)}</div></div>{tip&&<div id="activity-tooltip" role="tooltip" className="activity-tooltip" style={{left:tip.left,top:tip.top}}>{tip.text}</div>}</div></section>;
}

export function ProfileOverview({ settings, save, onNavigate }: { settings: AppSettings; save: (next: AppSettings) => Promise<void>; onNavigate: (section: "subscription" | "usage" | "account") => void }) {
  const { usage } = useUsage();
  const [accountOpen,setAccountOpen]=useState(false);
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(settings.profile?.name ?? "");
  const [avatar, setAvatar] = useState(settings.profile?.avatar ?? "");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { void authClient?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "")); }, []);
  const upload = async (blob?: File) => {
    if (!blob) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type) || blob.size > 4 * 1024 * 1024) { setError("Choisis une image PNG, JPEG ou WebP de moins de 4 Mo."); return; }
    try {
      const bitmap = await createImageBitmap(blob); const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Conversion de l’image indisponible.");
      const size = Math.min(bitmap.width, bitmap.height); context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256); bitmap.close(); setAvatar(canvas.toDataURL("image/png")); setError("");
    } catch { setError("Cette image ne peut pas être ouverte."); }
  };
  const submit = async () => { setBusy(true); setError(""); try { await save({ ...settings, profile: { name: name.trim().slice(0, 60), avatar: avatar || undefined } }); setEditing(false); } catch { setError("Le profil n’a pas pu être enregistré."); } finally { setBusy(false); } };
  return <div className="profile-overview">
    <div className="section-title profile-page-heading"><div><h2>Profil</h2></div></div>
    <div className={`solar-banner profile-banner ${usage?.plan ?? "starter"}`} aria-label={`Bannière ${planName(usage?.plan)}`}><span className="banner-caption"><img src="/solar-icon.png" alt=""/>Solar / {planName(usage?.plan)}</span></div>
    <div className="profile-summary"><button className="profile-avatar" aria-label="Modifier l’avatar" onClick={() => setEditing(true)}><img src={settings.profile?.avatar || "/solar-icon.png"} alt="Avatar Solar"/><span><Camera size={14}/></span></button><div className="profile-identity"><h3>{settings.profile?.name || "Bienvenue sur Solar"}</h3><p>{email || "Profil local · Sur cet appareil"}</p><span className="plan-badge">{planName(usage?.plan)}</span><span className="profile-private"><ShieldCheck size={12}/> Données locales</span></div><Button variant="outline" className="small-button" onClick={() => { setName(settings.profile?.name ?? ""); setAvatar(settings.profile?.avatar ?? ""); setEditing(true); }}><Pencil size={13}/>Modifier le profil</Button></div>
    <section className="profile-usage"><ActivityCalendar/></section>
    <button className="profile-link-row" onClick={() => setAccountOpen(true)}><span><ShieldCheck size={17}/>{email ? "Gérer ma connexion" : "Connecter mon compte"}</span><ChevronRight size={15}/></button>
    <BillingAccountControls/><AccountDialog open={accountOpen} onClose={()=>setAccountOpen(false)}/>
    <SetupModal open={editing} onOpenChange={setEditing} title="Un profil qui te ressemble" description="Ton nom et ton avatar restent enregistrés sur cet appareil."><form onSubmit={e => { e.preventDefault(); void submit(); }} className="profile-edit-form"><div className="profile-edit-avatar"><img src={avatar || "/solar-icon.png"} alt="Aperçu de l’avatar"/><div><Button variant="outline" type="button" onClick={() => file.current?.click()}>Choisir une photo</Button><Button variant="ghost" type="button" onClick={() => setAvatar("")}>Réinitialiser</Button></div><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => void upload(e.target.files?.[0])}/></div><label>Ton nom<Input autoComplete="nickname" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Comment t’appelles-tu ?"/></label>{error && <p className="form-error" role="alert">{error}</p>}<Button className="setup-cta" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les modifications"}</Button></form></SetupModal>
  </div>;
}

export function PlanCards({onChoose,current,busy=false}:{cloudOnly?:boolean;onChoose:(plan:SolarPlan)=>void;current:SolarPlan;busy?:boolean}){
 const features={starter:['5 agents personnels','2 missions simultanées','Les 16 connexions directes','Mémoire personnelle, documents et Web','Cortex et GTS complets','Aucune limite journalière'],pro:['×10 l’usage de Starter','10 agents personnels','3 missions simultanées','Accès anticipé aux nouveautés'],max:['×50 l’usage de Starter','Création d’agents sans limite','6 missions simultanées','Accès anticipé aux nouveautés']};
 return <div className="plan-cards plan-cards-three">{(['starter','pro','max'] as const).map(plan=><article className={`plan-card ${plan}`} key={plan}><div className={`solar-banner plan-banner ${plan}`}><span>{SOLAR_PLANS[plan].name}</span></div><div className="plan-card-body"><div className="plan-card-title"><h3>{SOLAR_PLANS[plan].name}</h3><span>{plan==='starter'?'Gratuit':`${SOLAR_PLANS[plan].monthlyPrice} € / mois`}</span></div><p>{plan==='starter'?'Découvre ce qu’un véritable agent peut faire pour toi.':plan==='pro'?'Ton partenaire de travail, au quotidien.':'Pour les journées où tu délègues davantage.'}</p><h4>{plan==='starter'?'Inclus dans Starter':plan==='pro'?'Tout Starter, plus…':'Tout Pro, plus…'}</h4><ul>{features[plan].map(text=><li key={text}><CircleCheck/>{text}</li>)}</ul><Button variant={plan==='starter'?'outline':'default'} className="plan-cta" disabled={busy||current===plan} onClick={()=>onChoose(plan)}>{current===plan?<><Check size={14}/>Ton offre actuelle</>:<>{plan==='starter'?'Gérer mon abonnement':`S’abonner à ${SOLAR_PLANS[plan].name}`}<ArrowUpRight size={14}/></>}</Button></div></article>)}</div>;
}
export function SubscriptionPage({cloudOnly=false}:{cloudOnly?:boolean}={}) {
 const {usage}=useUsage(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[waiting,setWaiting]=useState(false),[paymentUrl,setPaymentUrl]=useState(''),[accountOpen,setAccountOpen]=useState(false);
 useEffect(()=>{void refreshBilling().catch(reason=>setError(reason instanceof Error?reason.message:'Vérification indisponible.'));},[]);
 useEffect(()=>{if(waiting&&usage?.plan!=='starter')setWaiting(false);},[usage?.plan,waiting]);
 const choose=async(plan:SolarPlan)=>{
   if(plan==='starter'){document.getElementById('solar-billing-management')?.scrollIntoView({block:'nearest'});return;}
   setBusy(true);setError('');setWaiting(false);setPaymentUrl('');
   try{const page=await beginCheckout(plan);setPaymentUrl(validateStripeUrl(page.url));await openStripePage(page.url);setWaiting(true);}
   catch(reason){if(reason instanceof BillingClientError&&reason.code==='sign_in')setAccountOpen(true);setError(reason instanceof Error?reason.message:'Impossible d’ouvrir le paiement.');}
   finally{setBusy(false);}
 };
 return <>{!cloudOnly&&<div className="section-title"><div><h2>À chacun son Solar.</h2><p>Un premier agent. Puis toute une équipe.</p></div></div>}<PlanCards current={usage?.plan??'starter'} busy={busy} onChoose={plan=>void choose(plan)}/>
 {busy&&<p role="status" className="billing-note">Préparation du paiement…</p>}
 {waiting&&<div className="billing-feedback" role="status"><p>Termine le paiement dans Stripe. Ton offre s’activera ici après confirmation.</p>{paymentUrl&&<a href={paymentUrl} target="_blank" rel="noopener noreferrer" onClick={event=>{if((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__){event.preventDefault();void openStripePage(paymentUrl).catch(reason=>setError(reason instanceof Error?reason.message:"Ouverture impossible."));}}}>Ouvrir la page Stripe</a>}<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await refreshBilling();setWaiting(false);}catch(reason){setError(reason instanceof Error?reason.message:'Vérification impossible.');}finally{setBusy(false);}}}>Vérifier mon abonnement</Button></div>}
 {error&&<p role="alert" className="form-error">{error}</p>}
 <p className="billing-note">Abonnements mensuels à renouvellement automatique. Résiliation dans Mon compte, avec accès jusqu’à la fin de la période payée.</p>
 <BillingAccountControls/><AccountDialog open={accountOpen} onClose={()=>setAccountOpen(false)}/></>;
}
export function UsagePage() {
  const { usage } = useUsage();
  return <><div className="section-title"><div><h2>Utilisation</h2><p>Un regard sur ce que tu crées avec Solar.</p></div><span className="plan-badge">{planName(usage?.plan)}</span></div><QuotaCards/><ActivityCalendar/></>;
}
