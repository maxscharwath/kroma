# Rust patterns

Code examples for each rule in `SKILL.md`.

## Enums with data

```rust
// Don't. Four booleans of nonsense: ready with no stream, failed with no error.
struct Playback {
    ready: bool,
    stream: Option<Stream>,
    error: Option<PlaybackError>,
}

// Do. Three states, all of them real.
enum Playback {
    Idle,
    Ready(Stream),
    Failed(PlaybackError),
}
```

`match` on the enum and the payload comes with the arm. Adding a variant breaks
every `match` that forgot it, which is the whole point.

## Newtypes

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct UserId(Uuid);

#[derive(Debug, Clone, Copy)]
pub struct Seconds(pub u32);

pub fn seek(session: SessionId, to: Seconds) {}
```

Validate once, at construction, and let the type carry the proof:

```rust
impl TryFrom<&str> for UserId {
    type Error = ParseIdError;
    fn try_from(raw: &str) -> Result<Self, Self::Error> {
        Ok(Self(Uuid::parse_str(raw)?))
    }
}
```

## Errors by layer

```rust
// A library crate owns its failure vocabulary.
#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    #[error("media root {0} is not readable")]
    UnreadableRoot(PathBuf),
    #[error("probe failed")]
    Probe(#[from] ffprobe::Error),
}

// A binary composes them.
fn main() -> anyhow::Result<()> {
    let library = scan(&config.roots).context("scanning media roots")?;
    Ok(())
}
```

`#[from]` gives `?` the conversion. The `#[error(...)]` string is the message a
user sees, so it names the thing that failed, not the function it failed in.

## No unwrap in library code

```rust
// Don't.
let entry = index.get(&id).unwrap();

// Do.
let Some(entry) = index.get(&id) else {
    return Err(ScanError::UnknownId(id));
};

// Fine, an invariant the code just established.
let first = parts.first().expect("split always yields one element");
```

## Borrow in, own out

```rust
// Don't. Forces every caller to allocate.
pub fn label(title: String, tags: Vec<String>) -> String {}

// Do.
pub fn label(title: &str, tags: &[String]) -> String {}
```

When the borrow checker refuses, the fix is usually a smaller scope or a split
function, not a `clone()`:

```rust
// Don't. The clone exists only to end the borrow.
let name = entry.name.clone();
index.insert(id, entry);

// Do. Read what you need, then move.
let name = &entry.name;
tracing::info!(%name, "indexing");
index.insert(id, entry);
```

## Don't block the runtime

```rust
// Don't. SQLite is blocking; this stalls every task on the thread.
let rows = conn.prepare("select ...")?.query_map([], row_to_title)?;

// Do.
let rows = tokio::task::spawn_blocking(move || {
    pool.get()?.prepare("select ...")?.query_map([], row_to_title)
})
.await??;
```

A `std::sync::MutexGuard` held across `.await` deadlocks the runtime the day two
tasks land on one thread. Either take the lock inside a non-async block, or use
`tokio::sync::Mutex` and mean it.

## Cancellation safety

```rust
tokio::select! {
    _ = token.cancelled() => return Ok(()),
    result = probe(&path) => result?,
}
```

Everything in the losing branch is dropped mid-flight. Anything that must not be
interrupted halfway (a write, a two-step state change) goes in a `spawn`ed task
that owns its own completion, not in a `select!` arm.

## Secrets never in Debug

```rust
#[derive(Clone)]
pub struct ApiToken(String);

impl fmt::Debug for ApiToken {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("ApiToken(redacted)")
    }
}
```

A derived `Debug` reaches a log line the first time someone adds `?state` to a
tracing macro, and log lines outlive incidents.

## SAFETY on unsafe

```rust
// SAFETY: `buf` is `len` bytes long and was written by `read_exact` above, so
// every byte in the range is initialised.
let frame = unsafe { slice::from_raw_parts(buf.as_ptr(), len) };
```

The comment states the invariant a reader must check, not what the line does.
