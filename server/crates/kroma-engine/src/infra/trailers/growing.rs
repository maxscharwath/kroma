use std::future::Future;
use std::path::Path;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::Duration;

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::Response;
use tokio::fs::File;
use tokio::io::{AsyncRead, ReadBuf};
use tokio::time::{sleep, Sleep};

use crate::infra::metrics::ByteSink;
use crate::infra::stream::metered_body;
use crate::json_error;

pub struct GrowingReader {
    file: File,
    finished: Arc<AtomicBool>,
    failed: Arc<Mutex<Option<String>>>,
    pause: Option<Pin<Box<Sleep>>>,
}

impl GrowingReader {
    pub fn new(file: File, finished: Arc<AtomicBool>, failed: Arc<Mutex<Option<String>>>) -> Self {
        Self {
            file,
            finished,
            failed,
            pause: None,
        }
    }
}

impl AsyncRead for GrowingReader {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        if let Some(msg) = self.failed.lock().ok().and_then(|g| g.clone()) {
            return Poll::Ready(Err(std::io::Error::other(msg)));
        }
        if let Some(pause) = self.pause.as_mut() {
            match pause.as_mut().poll(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(()) => self.pause = None,
            }
        }
        let before = buf.filled().len();
        match Pin::new(&mut self.file).poll_read(cx, buf) {
            Poll::Pending => Poll::Pending,
            Poll::Ready(Err(e)) => Poll::Ready(Err(e)),
            Poll::Ready(Ok(())) if buf.filled().len() > before => Poll::Ready(Ok(())),
            Poll::Ready(Ok(())) => {
                if self.finished.load(Ordering::SeqCst) {
                    return Poll::Ready(Ok(()));
                }
                let mut pause = Box::pin(sleep(Duration::from_millis(40)));
                match pause.as_mut().poll(cx) {
                    Poll::Ready(()) => {
                        cx.waker().wake_by_ref();
                        Poll::Pending
                    }
                    Poll::Pending => {
                        self.pause = Some(pause);
                        Poll::Pending
                    }
                }
            }
        }
    }
}

/// Serve a file that is still being written. No Content-Length: a Range against
/// the current size would tell the player the trailer is already over.
pub async fn stream_growing(
    path: &Path,
    finished: Arc<AtomicBool>,
    failed: Arc<Mutex<Option<String>>>,
    sink: ByteSink,
) -> Response {
    if let Some(msg) = failed.lock().ok().and_then(|g| g.clone()) {
        return json_error(StatusCode::BAD_GATEWAY, &msg);
    }
    let file = match File::open(path).await {
        Ok(f) => f,
        Err(_) => return json_error(StatusCode::NOT_FOUND, "trailer not prepared"),
    };
    let mut resp = Response::new(metered_body(
        GrowingReader::new(file, finished, failed),
        sink,
    ));
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("video/mp4"),
    );
    resp
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;

    #[tokio::test]
    async fn a_reader_sees_bytes_appended_after_it_caught_up() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("g.mp4");
        std::fs::write(&path, [1u8, 2, 3]).unwrap();
        let finished = Arc::new(AtomicBool::new(false));
        let failed = Arc::new(Mutex::new(None));
        let file = File::open(&path).await.unwrap();
        let mut reader = GrowingReader::new(file, finished.clone(), failed);
        let mut buf = [0u8; 8];

        let n = reader.read(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], &[1, 2, 3]);

        use std::io::Write;
        std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap()
            .write_all(&[4, 5])
            .unwrap();
        let n = tokio::time::timeout(Duration::from_secs(2), reader.read(&mut buf))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(&buf[..n], &[4, 5]);

        finished.store(true, Ordering::SeqCst);
        let n = reader.read(&mut buf).await.unwrap();
        assert_eq!(n, 0);
    }
}
