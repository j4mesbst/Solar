//! Opt-in QA driver for the exact native public HTTP transport, not a new app
//! command. Public GET only; no credential, cookie or private account handling.
#[path = "../src/integration_network.rs"]
mod integration_network;
use std::collections::HashMap;
use std::io::Read;
fn main(){
 let mut input=String::new();std::io::stdin().take(5000).read_to_string(&mut input).unwrap();
 let url:String=serde_json::from_str(&input).expect("Public URL JSON required");
 let result=tauri::async_runtime::block_on(integration_network::perform_request("public-web-qa".into(),url,"GET".into(),HashMap::from([("accept".into(),"text/html, text/plain, application/rss+xml, application/xml".into())]),None,false,&integration_network::IntegrationRequests::default()));
 match result{Ok(response)=>println!("{}",serde_json::to_string(&response).unwrap()),Err(error)=>{eprintln!("{error}");std::process::exit(1);}}
}
