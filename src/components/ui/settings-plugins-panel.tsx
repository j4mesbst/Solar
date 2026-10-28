import { useState } from "react";
import { Button } from "./button";
import { PluginInstalledList } from "./plugin-installed-list";
import { PluginConnectionDialog } from "./plugin-connection-dialog";
import { McpConnectionDialog } from "./mcp-connection-dialog";
import { pluginCatalog } from "../../services/pluginCatalog";
export function SettingsPluginsPanel(){
 const [selected,setSelected]=useState<string>(),[adding,setAdding]=useState(false),[revision,setRevision]=useState(0);
 return <><div className="section-title"><div><h2>Plugins</h2><p>Comptes vérifiés, permissions et serveurs MCP. Les actions sensibles restent à approuver.</p></div><Button onClick={()=>setAdding(true)}>Ajouter un serveur MCP</Button></div><PluginInstalledList revision={revision}/><div className="settings-plugin-options">{pluginCatalog.map(plugin=><div className="preference-row" key={plugin.id}><div><h3>{plugin.name}</h3><p>{plugin.description}</p></div><Button variant="outline" onClick={()=>setSelected(plugin.id)}>Connecter</Button></div>)}</div>{selected&&<PluginConnectionDialog id={selected} onClose={()=>{setSelected(undefined);setRevision(value=>value+1);}} canImport={false} onImport={async()=>{}}/>}{adding&&<McpConnectionDialog onClose={()=>setAdding(false)} onConnected={()=>setRevision(value=>value+1)}/>}</>;
}
