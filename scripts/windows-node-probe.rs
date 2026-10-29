use std::{process::Command,path::PathBuf};
fn main(){
 let path=std::env::var_os("PATH").unwrap();let node=std::env::split_paths(&path).map(|p|p.join("node.exe")).find(|p|p.is_file()).unwrap();let parent=node.parent().unwrap();let cli=parent.join("node_modules/npm/bin/npm-cli.js");let temp=std::env::temp_dir().join("solar-node-probe");std::fs::create_dir_all(&temp).unwrap();
 std::fs::write(temp.join("package.json"),r#"{"scripts":{"probe":"echo PATH=%PATH% & where node & node --version"}}"#).unwrap();
 println!("Node={:?} parent={:?} npm={} cwd={:?}",node,parent,cli.is_file(),temp);
 let mut paths=vec![parent.to_path_buf()];paths.extend(std::env::split_paths(&path));
 let mut cmd=Command::new(&node);cmd.arg(&cli).args(["run","probe"]).current_dir(&temp).env_remove("PATH").env_remove("Path").env("Path",std::env::join_paths(paths).unwrap()).env("PATHEXT",".COM;.EXE;.BAT;.CMD");
 let out=cmd.output().unwrap();println!("{}\n{}",String::from_utf8_lossy(&out.stdout),String::from_utf8_lossy(&out.stderr));
 assert!(out.status.success());
 let _=std::fs::remove_dir_all(&temp);
}
