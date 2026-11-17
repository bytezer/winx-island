use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ThemeSettings {
    pub bar_style: String,
    pub gradient_direction: String,
    pub peak_enabled: bool,
    pub peak_hold_ms: i32,
    pub peak_gravity: i32,
    pub island_roundness: i32,
    pub bar_roundness: i32,
    pub background_color: String,
    pub raised_color: String,
    pub color_mode: String,
    pub solid_color: String,
    pub gradient_start: String,
    pub gradient_middle: String,
    pub gradient_end: String,
    pub glow: bool,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            bar_style: "smooth".into(),
            gradient_direction: "horizontal".into(),
            peak_enabled: false,
            peak_hold_ms: 240,
            peak_gravity: 180,
            island_roundness: 100,
            bar_roundness: 100,
            background_color: "#0b0b0e".into(),
            raised_color: "#16161b".into(),
            color_mode: "rgb".into(),
            solid_color: "#7dd3fc".into(),
            gradient_start: "#35e8c3".into(),
            gradient_middle: "#8b7bff".into(),
            gradient_end: "#f35ac7".into(),
            glow: true,
        }
    }
}

fn valid_color(color: &str) -> bool {
    color.len() == 7
        && color.starts_with('#')
        && color.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

impl ThemeSettings {
    pub fn normalized(&self) -> Self {
        let defaults = Self::default();
        let mut result = self.clone();
        result.island_roundness = result.island_roundness.clamp(0, 100);
        result.bar_roundness = result.bar_roundness.clamp(0, 100);
        result.peak_hold_ms = result.peak_hold_ms.clamp(0, 1_000);
        result.peak_gravity = result.peak_gravity.clamp(40, 400);
        if !["smooth", "segmented", "dots"].contains(&result.bar_style.as_str()) {
            result.bar_style = defaults.bar_style.clone();
        }
        if !["horizontal", "vertical"].contains(&result.gradient_direction.as_str()) {
            result.gradient_direction = defaults.gradient_direction.clone();
        }
        if !["rgb", "gradient", "solid"].contains(&result.color_mode.as_str()) {
            result.color_mode = defaults.color_mode.clone();
        }
        for (color, fallback) in [
            (&mut result.background_color, defaults.background_color),
            (&mut result.raised_color, defaults.raised_color),
            (&mut result.solid_color, defaults.solid_color),
            (&mut result.gradient_start, defaults.gradient_start),
            (&mut result.gradient_middle, defaults.gradient_middle),
            (&mut result.gradient_end, defaults.gradient_end),
        ] {
            *color = if valid_color(color) {
                color.to_ascii_lowercase()
            } else {
                fallback
            };
        }
        result
    }

    pub fn validate(&self) -> Result<(), String> {
        if !["smooth", "segmented", "dots"].contains(&self.bar_style.as_str()) {
            return Err("Selecciona un estilo de barras válido.".into());
        }
        if !["horizontal", "vertical"].contains(&self.gradient_direction.as_str()) {
            return Err("Selecciona una dirección de degradado válida.".into());
        }
        if !["rgb", "gradient", "solid"].contains(&self.color_mode.as_str()) {
            return Err("Selecciona un modo de color válido.".into());
        }
        if [
            &self.background_color,
            &self.raised_color,
            &self.solid_color,
            &self.gradient_start,
            &self.gradient_middle,
            &self.gradient_end,
        ]
        .iter()
        .any(|color| !valid_color(color))
        {
            return Err("Usa colores en formato #RRGGBB.".into());
        }
        Ok(())
    }
}
