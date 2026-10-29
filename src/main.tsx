import {SolarLaunch} from "./components/ui/solar-launch";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./styles/atlas.css";
import "./styles/plugins.css";
import "./solar-composer-reference.css";
import "./solar-scene-integration.css";
import { authClient } from "./services/auth";
import {initializeBilling} from "./services/billing";
import { initializeAccountScope } from "./services/accountScope";
const App=lazy(()=>import.meta.env.VITE_SOLAR_EXPERIENCE==="classic"?import("./ui/App").then(module=>({default:module.App})):import("./ui/AgentApp").then(module=>({default:module.AgentApp})));
async function start(){
 if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery")sessionStorage.setItem("solar.auth.recovery","true");
 let id:string|undefined;
 if(authClient){const {data}=await authClient.auth.getSession();id=data.session?.user.id;}
 initializeAccountScope(id);
 initializeBilling();
 authClient?.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY")sessionStorage.setItem("solar.auth.recovery","true");if((session?.user.id??undefined)!==id)window.location.reload();});
 createRoot(document.getElementById("root")!).render(<StrictMode><SolarLaunch><Suspense fallback={<div className="app-loading" role="status">Ouverture de Solar…</div>}><App/></Suspense></SolarLaunch></StrictMode>);
}
void start().catch(()=>{document.getElementById("root")!.textContent="Impossible d’ouvrir Solar. Recharge l’application pour réessayer.";});
