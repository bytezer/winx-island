//! Interface language selection.
//!
//! Every user-facing string lives in `locales/*.json` and is resolved by the
//! frontend. The native side only decides *which* locale is active: an explicit
//! override in `settings.yaml` wins over the Windows display language.

use windows::Win32::Globalization::GetUserDefaultLocaleName;

/// Locales shipped in `locales/`.
///
/// `tests/i18n_catalog_test.rs` asserts this list matches the JSON files, so
/// adding a language means adding the catalog and this array together.
pub const LOCALES: [&str; 2] = ["en", "es"];

/// Used when neither the override nor the system locale is supported.
pub const DEFAULT_LOCALE: &str = "en";

/// Language subtag of the Windows display language, mapped onto [`LOCALES`].
///
/// `GetUserDefaultLocaleName` returns names such as `es-ES` or `en-US`; only the
/// leading subtag matters here, so every Spanish region lands on `es`.
pub fn system_locale() -> &'static str {
    let mut buffer = [0_u16; 85];
    let length = unsafe { GetUserDefaultLocaleName(&mut buffer) };
    if length <= 1 {
        return DEFAULT_LOCALE;
    }

    let name = String::from_utf16_lossy(&buffer[..(length as usize - 1)]);
    let language = name
        .split(['-', '_'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    supported(&language).unwrap_or(DEFAULT_LOCALE)
}

/// Explicit override when valid, otherwise the system locale.
pub fn resolve(override_locale: Option<&str>) -> &'static str {
    override_locale
        .and_then(supported)
        .unwrap_or_else(system_locale)
}

/// Locale a user-facing native surface (the tray) should render right now.
/// Reads the persisted override, falling back to the Windows display language.
pub fn active(settings: &crate::settings::Settings) -> &'static str {
    resolve(settings.language_override().as_deref())
}

fn supported(candidate: &str) -> Option<&'static str> {
    LOCALES.iter().copied().find(|locale| *locale == candidate)
}
