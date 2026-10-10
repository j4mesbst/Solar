import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./solar-composer-reference.css";
import "./solar-scene-integration.css";
import { authClient } from "./services/auth";
import { initializeAccountScope } from "./services/accountScope";
const App=lazy(()=>import("./ui/App").then(module=>({default:module.App})));
async function start(){
 if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery")sessionStorage.setItem("solar.auth.recovery","true");
 let id:string|undefined;
 if(authClient){const {data}=await authClient.auth.getSession();id=data.session?.user.id;}
 initializeAccountScope(id);
 authClient?.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY")sessionStorage.setItem("solar.auth.recovery","true");if((session?.user.id??undefined)!==id)window.location.reload();});
 createRoot(document.getElementById("root")!).render(<StrictMode><Suspense fallback={<div className="app-loading" role="status">Ouverture de Solar…</div>}><App/></Suspense></StrictMode>);
}
void start().catch(()=>{document.getElementById("root")!.textContent="Impossible d’ouvrir Solar. Recharge l’application pour réessayer.";});
