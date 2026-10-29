import {Popover} from 'radix-ui';
import {Blocks,ChartNoAxesCombined,ChevronRight,ChevronsUpDown,Cpu,LogOut,UserRound} from 'lucide-react';
import {UserIcon} from '../ui/animated-account-icons';
import {useState} from 'react';
import type {AppSettings} from '../../domain/types';
export type AccountSection='plugins'|'models'|'usage'|'account'|'logout';
export const accountSections=[{id:'plugins',title:'Plugins',hint:'Tes applications',Icon:Blocks},{id:'models',title:'Modèles',hint:'Local et cloud',Icon:Cpu},{id:'usage',title:'Utilisation',hint:'Consommation de tokens',Icon:ChartNoAxesCombined},{id:'account',title:'Mon compte',hint:'Nom et photo',Icon:UserRound}] as const;
export function AccountPopover({settings,email,onSelect}:{settings:AppSettings;email:string;onSelect:(view:AccountSection)=>void}){
 const [open,setOpen]=useState(false),name=settings.profile?.name||email.split('@')[0]||'Mon compte';
 const avatar=<span className="team-account-avatar"><UserIcon size={21}/></span>;
 const choose=(section:AccountSection)=>{setOpen(false);onSelect(section);};
 return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><button className="team-account-trigger" aria-label="Menu du compte">{avatar}<span>{name.split(/\s+/)[0]}</span></button></Popover.Trigger><Popover.Portal container={document.querySelector<HTMLElement>('.team-app')??undefined}><Popover.Content side="top" align="start" sideOffset={10} collisionPadding={12} className="apple-account-panel" aria-label="Compte Solar"><nav aria-label="Pages du compte">{accountSections.map(({id,title,Icon})=><button key={id} onClick={()=>choose(id)}><Icon size={17}/><span>{title}</span><ChevronRight size={13}/></button>)}</nav><footer><button onClick={()=>choose('logout')}><LogOut size={16}/>{email?'Se déconnecter':'Connexion à Solar'}</button></footer></Popover.Content></Popover.Portal></Popover.Root>;
}
