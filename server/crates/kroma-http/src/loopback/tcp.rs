//! A redirect is refused rather than followed: a sidecar answering 302 is trying
//! to move the core somewhere, and the only correct destination is the one the
//! supervisor named.

use std::sync::OnceLock;

use anyhow::{bail, Context, Result};

use super::transport::{Method, Request, Transport};
use crate::response::Response;

/// Memory guard on a response body: what one wrong peer may make this process
/// allocate, not a size any real payload on the seam approaches.
pub const MAX_BODY_BYTES: usize = 64 * 1024 * 1024;

/// Pooled HTTP/1.1 to another process on this machine.
#[derive(Debug, Default)]
pub struct Tcp;

impl Transport for Tcp {
    fn name(&self) -> &'static str {
        "tcp"
    }

    fn accepts(&self, url: &str) -> bool {
        is_loopback(url).unwrap_or(false)
    }

    fn send(&self, request: &Request<'_>) -> Result<Response> {
        ensure_loopback(request.url)?;
        let method = match request.method {
            Method::Get => reqwest::Method::GET,
            Method::Post => reqwest::Method::POST,
        };
        let mut prepared = client()
            .request(method, request.url)
            .timeout(request.timeout);
        for (name, value) in request.headers {
            prepared = prepared.header(name, value);
        }
        if let Some((content_type, bytes)) = request.body {
            prepared = prepared
                .header("content-type", content_type)
                .body(bytes.to_vec());
        }
        block_on(async move {
            let response = prepared.send().await.context("send the loopback request")?;
            let status = response.status().as_u16();
            let headers = response
                .headers()
                .iter()
                .map(|(name, value)| {
                    (
                        name.as_str().to_string(),
                        String::from_utf8_lossy(value.as_bytes()).into_owned(),
                    )
                })
                .collect();
            Ok(Response {
                status,
                headers,
                body: read_bounded(response).await?,
            })
        })
    }
}

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("build the loopback client")
    })
}

// `Handle::block_on` panics on a worker thread and `spawn_blocking` threads still
// carry the ambient handle, so the work goes to a runtime that is not the
// caller's.
fn runtime() -> &'static tokio::runtime::Runtime {
    static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(1)
            .thread_name("kroma-loopback")
            .enable_all()
            .build()
            .expect("build the loopback runtime")
    })
}

// A sidecar builds with `panic = "abort"`, so a panic here would take the whole
// module process down where the caller expects a recoverable error.
fn block_on<T>(future: impl std::future::Future<Output = Result<T>> + Send + 'static) -> Result<T>
where
    T: Send + 'static,
{
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    runtime().spawn(async move {
        let _ = tx.send(future.await);
    });
    match rx.recv() {
        Ok(outcome) => outcome,
        Err(_) => bail!("the loopback exchange ended without a response"),
    }
}

async fn read_bounded(mut response: reqwest::Response) -> Result<Vec<u8>> {
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .context("read the loopback response body")?
    {
        if body.len() + chunk.len() > MAX_BODY_BYTES {
            bail!("loopback response is larger than {MAX_BODY_BYTES} bytes");
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

fn is_loopback(url: &str) -> Result<bool> {
    let parsed = reqwest::Url::parse(url).with_context(|| format!("parse the URL: {url}"))?;
    if parsed.scheme() != "http" {
        return Ok(false);
    }
    let host = parsed.host_str().unwrap_or_default();
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    Ok(bare == "localhost"
        || bare
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback()))
}

fn ensure_loopback(url: &str) -> Result<()> {
    if !is_loopback(url)? {
        bail!("the tcp transport refuses {url}: not plain http on this machine");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_host_that_is_not_loopback_is_refused() {
        let err = ensure_loopback("http://example.com/_port/x")
            .unwrap_err()
            .to_string();
        assert!(err.contains("example.com"), "{err}");
    }

    #[test]
    fn every_spelling_of_this_machine_is_accepted() {
        assert!(Tcp.accepts("http://127.0.0.1:9/_port/x"));
        assert!(Tcp.accepts("http://localhost:9/_port/x"));
        assert!(Tcp.accepts("http://[::1]:9/_port/x"));
        assert!(Tcp.accepts("http://127.0.0.2:9/_port/x"));
    }

    #[test]
    fn an_address_outside_the_loopback_range_is_refused() {
        assert!(!Tcp.accepts("http://10.0.0.5:9/_port/x"));
        assert!(!Tcp.accepts("http://169.254.169.254/latest/meta-data"));
    }

    #[test]
    fn a_tls_url_is_refused_because_this_seam_has_no_tls_stack() {
        assert!(!Tcp.accepts("https://127.0.0.1:9/_port/x"));
    }

    #[test]
    fn an_unparseable_url_is_refused_rather_than_panicking() {
        assert!(!Tcp.accepts("not a url"));
        assert!(ensure_loopback("not a url").is_err());
    }
}
