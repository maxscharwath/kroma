//! The aria2 engine as a standalone process (its `.kmod` entrypoint).
//!
//! It answers the `download-client` point under the instance `aria2`, and
//! nothing else: no admin routes, no database, no lifecycle. Being installed and
//! enabled is what makes it available, because the download module resolves
//! whoever answers the point when a client row names this kind.

use kroma_module_runtime::RemoteHost;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    kroma_module_runtime::serve(
        |_host| kroma_aria2::port::routes(),
        vec![kroma_aria2::server_module::<RemoteHost>()],
    )
    .await
}
