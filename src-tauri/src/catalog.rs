//! Embedded copies of the interface catalogs.
//!
//! The tray menu is drawn by the OS, not by a webview, so on that one surface
//! Rust has to produce the final text instead of a key. Both catalog files are
//! embedded at compile time from the same source the frontend imports, so there
//! is a single source of truth and no second catalog to keep in sync.
//!
//! The walk mirrors `src/i18n/translate.ts` without its plural and
//! interpolation machinery: the tray needs neither.

use std::sync::OnceLock;

use serde_json::Value;

const EN: &str = include_str!("../../locales/en.json");
const ES: &str = include_str!("../../locales/es.json");

static EN_CATALOG: OnceLock<Value> = OnceLock::new();
static ES_CATALOG: OnceLock<Value> = OnceLock::new();

/// Resolves a dotted key in one locale's catalog. A missing key returns the
/// key itself, matching the frontend `translate` fallback, so an unknown key
/// stays visible instead of rendering empty.
pub fn text(locale: &str, key: &str) -> String {
    let mut node = catalog(locale);
    for segment in key.split('.') {
        let Some(child) = node.get(segment) else {
            return key.to_string();
        };
        node = child;
    }
    match node {
        Value::String(value) => value.clone(),
        // A non-string leaf (a plural object, a nested table) is not tray text;
        // returning the key keeps the miss visible.
        _ => key.to_string(),
    }
}

/// Parsed catalog for one locale, parsed on first use. An unknown locale falls
/// back to the English catalog, like the frontend `normalizeLocale`.
fn catalog(locale: &str) -> &'static Value {
    match locale {
        "es" => ES_CATALOG.get_or_init(|| parse(ES)),
        _ => EN_CATALOG.get_or_init(|| parse(EN)),
    }
}

/// A parse failure would be a build-time bug: the files ship with the binary
/// and the i18n test suite validates them. An empty object keeps `text`
/// returning the key instead of panicking on a menu thread.
fn parse(raw: &str) -> Value {
    serde_json::from_str(raw).unwrap_or_else(|_| Value::Object(Default::default()))
}
