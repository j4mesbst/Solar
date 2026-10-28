import {useState} from 'react';
import {ATLAS_CONNECTORS,type AtlasActivity,type AtlasConnectorId} from './connectors';
/** Shared local brand assets; no approximate hand-drawn provider symbols. */
export const activityLogoFiles:Record<AtlasConnectorId,string>={
 'microsoft-calendar':'mscalendar-color.svg','microsoft-todo':'mstodo-color.svg','microsoft-contacts':'mscontacts-color.svg',
 todoist:'todoist.svg',onedrive:'onedrive.svg',onenote:'onenote.svg','google-tasks':'googletasks.svg','google-contacts':'googlecontacts-color.png',
 'google-sheets':'googlesheets-color.png','google-docs':'googledocs-color.png','google-drive':'googledrive-color.png','google-calendar':'googlecalendar-color.png',
 gmail:'gmail.svg',slack:'slack.svg',linear:'linear.svg',notion:'notion.svg',discord:'discord.svg',figma:'figma.svg',airtable:'airtable.svg',asana:'asana.svg',vercel:'vercel.svg',gitlab:'gitlab.svg',cloudflare:'cloudflare.svg',github:'github.svg',outlook:'microsoftoutlook.svg',
};
export function ConnectorLogo({id}:{id:AtlasActivity}){
 const [failed,setFailed]=useState(false);
 if(failed)return <span className="atlas-logo-fallback" aria-hidden="true">{ATLAS_CONNECTORS[id].name.slice(0,1)}</span>;
 return <img aria-hidden="true" alt="" width="20" height="20" src={`/plugin-icons/${activityLogoFiles[id]}`} onError={()=>setFailed(true)}/>;
}
