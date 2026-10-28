import {useEffect,useState} from 'react';
import {Folder,FolderPlus,FileText} from 'lucide-react';
import {openProject} from '../../services/workProject';
import {solarAgentStore,type TeamProfile} from '../../services/solarAgentStore';
export function AgentLibrary({agentId,folders}:{agentId:string;folders:NonNullable<TeamProfile['libraryFolders']>}){
 const[items,setItems]=useState(folders),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setItems(folders),[folders]);
 const add=async()=>{if(busy)return;setBusy(true);setError('');try{const project=await openProject();if(!project)return;const next=await solarAgentStore.addLibraryFolder(agentId,{id:project.workspaceId??crypto.randomUUID(),name:project.name,files:project.files});setItems(next.team?.profiles.find(p=>p.agentId===agentId)?.libraryFolders??[]);}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('Impossible d’ajouter ce dossier. Réessaie.');}finally{setBusy(false);}};
 return <div className="agent-library"><button className="agent-library-add" disabled={busy} onClick={()=>void add()}><FolderPlus size={17}/>{busy?'Ajout…':'Ajouter un dossier'}</button>{items.map(folder=><details key={folder.id} className="agent-library-folder"><summary><Folder size={19}/><span>{folder.name}</span><small>{folder.files.length}</small></summary><ul>{folder.files.map(file=><li key={file}><FileText size={13}/><span>{file}</span></li>)}</ul></details>)}{error&&<p role="alert" className="team-error">{error}</p>}</div>;
}
