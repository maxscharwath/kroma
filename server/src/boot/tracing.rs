//! Log wiring: stdout, a rolling daily file, and the in-memory ring the admin
//! console reads.

use kroma_engine::infra;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_tracing(log_dir: &std::path::Path) -> Option<tracing_appender::non_blocking::WorkerGuard> {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new(
            // The supervisor is included: module spawn/stop/hot-reload is
            // operator-visible behaviour, and it was silently filtered out.
            "kroma_server=info,kroma_module_supervisor=info,tower_http=info,axum=info,librqbit=info",
        )
    });

    let (file_layer, guard) = match std::fs::create_dir_all(log_dir) {
        Ok(()) => {
            let appender = tracing_appender::rolling::daily(log_dir, "kroma.log");
            let (writer, guard) = tracing_appender::non_blocking(appender);
            let layer = tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(writer);
            (Some(layer), Some(guard))
        }
        Err(e) => {
            // Tracing isn't initialised yet, so report to stderr directly.
            eprintln!(
                "warning: could not create log dir {} ({e}); file logging disabled",
                log_dir.display()
            );
            (None, None)
        }
    };

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .with(file_layer)
        .with(LogBufferLayer)
        .init();

    guard
}

struct LogBufferLayer;

impl<S: tracing::Subscriber> tracing_subscriber::Layer<S> for LogBufferLayer {
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        struct Fields {
            message: String,
            extra: String,
        }
        impl tracing::field::Visit for Fields {
            fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
                use std::fmt::Write;
                if field.name() == "message" {
                    let _ = write!(self.message, "{value:?}");
                } else {
                    let sep = if self.extra.is_empty() { "" } else { " " };
                    let _ = write!(self.extra, "{sep}{}={:?}", field.name(), value);
                }
            }
        }
        let mut fields = Fields { message: String::new(), extra: String::new() };
        event.record(&mut fields);
        if !fields.extra.is_empty() {
            if !fields.message.is_empty() {
                fields.message.push(' ');
            }
            fields.message.push_str(&fields.extra);
        }
        let meta = event.metadata();
        infra::logbuf::LOG_BUFFER.push_core(meta.level().as_str(), meta.target(), fields.message);
    }
}
