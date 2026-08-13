//! The vector sidecar behind the engine's `Embedder` port. An absent module
//! degrades every call to empty vectors, so recommendations no-op rather than
//! break.

// An absent tv.kroma.vector sidecar degrades every call to empty vectors, so
// recommendations no-op rather than break.
pub struct EmbedderClient {
    resolve: kroma_module_host::Resolver,
    meta: std::sync::RwLock<Option<serde_json::Value>>,
}
impl EmbedderClient {
    pub fn new(resolve: kroma_module_host::Resolver) -> Self {
        Self { resolve, meta: std::sync::RwLock::new(None) }
    }
    fn meta(&self) -> serde_json::Value {
        if let Some(v) = self.meta.read().unwrap().clone() {
            return v;
        }
        let Some((base, token)) = (self.resolve)() else {
            return serde_json::Value::Null;
        };
        let v = kroma_http::Fetch::new()
            .header("authorization", format!("Bearer {token}"))
            .get_json::<serde_json::Value>(&format!("{base}/_port/embedder/meta"))
            .unwrap_or(serde_json::Value::Null);
        if !v.is_null() {
            *self.meta.write().unwrap() = Some(v.clone());
        }
        v
    }
}
impl kroma_engine::ports::Embedder for EmbedderClient {
    fn dim(&self) -> usize {
        self.meta().get("dim").and_then(serde_json::Value::as_u64).unwrap_or(0) as usize
    }
    fn embed(&self, text: &str) -> Vec<f32> {
        kroma_module_host::call_raw(&self.resolve, "embedder/embed", &serde_json::json!({ "text": text }))
            .unwrap_or_default()
    }
    fn embed_batch(&self, texts: &[String]) -> Vec<Vec<f32>> {
        kroma_module_host::call_raw(&self.resolve, "embedder/embed_batch", &serde_json::json!({ "texts": texts }))
            .unwrap_or_default()
    }
    fn relevance_floor(&self) -> f32 {
        self.meta().get("relevance_floor").and_then(serde_json::Value::as_f64).map(|f| f as f32).unwrap_or(1.0)
    }
}
