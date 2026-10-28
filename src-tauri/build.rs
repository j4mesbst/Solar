fn main() {
  println!("cargo:rerun-if-changed=../.env.local");
  // Google Desktop is a public client; its issued client parameter stays native.
  let config=std::fs::read_to_string("../.env.local").unwrap_or_default();
  for (source,target) in [("VITE_GOOGLE_DESKTOP_CLIENT_ID","SOLAR_GOOGLE_DESKTOP_CLIENT_ID"),("SOLAR_GOOGLE_DESKTOP_CLIENT_SECRET","SOLAR_GOOGLE_DESKTOP_CLIENT_SECRET")] {
    if let Some(value)=config.lines().find_map(|line|line.strip_prefix(&format!("{source}="))) {
      let value=value.trim().trim_matches('"').trim_matches('\'');
      if !value.is_empty() && value.bytes().all(|c|c.is_ascii_alphanumeric()||b"-_.".contains(&c)){println!("cargo:rustc-env={target}={value}");}
    }
  }
  if std::env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("macos") {
    println!("cargo:rerun-if-changed=src/window_header.m");
    println!("cargo:rerun-if-changed=src/voice_capture.m");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    cc::Build::new().file("src/voice_capture.m").flag("-fobjc-arc").compile("solar_voice_capture");
    cc::Build::new().file("src/window_header.m").flag("-fobjc-arc").compile("solar_window_header");
    println!("cargo:rustc-link-lib=framework=AppKit");
  }
  tauri_build::build()
}
