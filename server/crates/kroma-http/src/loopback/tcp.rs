//! The transport every KROMA process has today: pooled HTTP/1.1 over the
//! loopback interface.
//!
//! What it deliberately cannot do is as much of the contract as what it can.
//! There is no TLS stack, no proxy and no cookie jar, and a redirect is refused
//! rather than followed: a sidecar answering 302 is trying to move the core
//! somewhere, and the only correct destination is the one the supervisor named.
//! [`MAX_BODY_BYTES`] bounds the answer, because the peer is a separate program
//! that can be wrong.

use std::sync::OnceLock;

use anyhow::{bail, Context, Result};

use super::transport::{Method, Request, Transport};
use crate::response::Response;

/// Ceiling on a response body. Every payload on this seam is a control message
/// -- settings, an event, a point call's JSON -- and the largest real one is an
/// indexer search result page.
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
            .unwrap_or_default()
    })
}

// Its own runtime, on its own thread, so a blocking caller never drives a future
// on the runtime it is already blocking. `Handle::block_on` panics on a worker
// thread and `spawn_blocking` threads still carry the ambient handle, so the
// only shape safe from every caller is to hand the work to a runtime that is not
// the caller's and wait on a channel.
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

fn block_on<F>(future: F) -> F::Output
where
    F: std::future::Future + Send + 'static,
    F::Output: Send + 'static,
{
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    runtime().spawn(async move {
        let _ = tx.send(future.await);
    });
    rx.recv().expect("the loopback runtime dropped a response")
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
    // An IPv6 host keeps its brackets through `host_str`, and loopback is a
    // range rather than the one literal the supervisor happens to hand out, so
    // this parses rather than matching strings.
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    Ok(bare == "localhost"
        || bare
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback()))
}

/// The invariant this transport is allowed to assume: every peer on the internal
/// seam is a process on this machine, addressed by the loopback literal the
/// supervisor assigned it.
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
