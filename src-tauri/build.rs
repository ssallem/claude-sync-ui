fn main() {
    // Embed the GitHub OAuth App client_id at compile time via env!.
    // CI / release builds set GITHUB_CLIENT_ID to the real value; local debug
    // builds fall back to a placeholder so `cargo check` / `cargo test` still
    // compile without forcing every developer to register their own app.
    //
    // The placeholder deliberately does NOT use GitHub's real `Ov23li...`
    // prefix so it can't be mistaken for a working OAuth App ID — any runtime
    // device-flow call with this value will fail visibly at GitHub's side.
    let client_id = match std::env::var("GITHUB_CLIENT_ID") {
        Ok(v) => v,
        Err(_) => {
            println!(
                "cargo:warning=GITHUB_CLIENT_ID environment variable not set; OAuth flow will fail at runtime."
            );
            "MISSING_GITHUB_CLIENT_ID".to_string()
        }
    };
    println!("cargo:rustc-env=GITHUB_CLIENT_ID={}", client_id);
    println!("cargo:rerun-if-env-changed=GITHUB_CLIENT_ID");
    tauri_build::build();
}
