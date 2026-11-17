#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct Screen {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale: f64,
}

pub fn nearest_monitor(point: Point, screens: &[Screen]) -> Option<usize> {
    screens
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| {
            let distance = |s: &Screen| {
                (point.x - point.x.clamp(s.x, s.x + s.width)).powi(2)
                    + (point.y - point.y.clamp(s.y, s.y + s.height)).powi(2)
            };
            distance(a).total_cmp(&distance(b))
        })
        .map(|(index, _)| index)
}

pub fn clamp_origin(origin: Point, rect: Bounds, scale: f64, screen: Screen) -> Point {
    let left = screen.x - rect.x * scale;
    let top = screen.y - rect.y * scale;
    let right = (screen.x + screen.width - (rect.x + rect.w) * scale).max(left);
    let bottom = (screen.y + screen.height - (rect.y + rect.h) * scale).max(top);
    Point {
        x: origin.x.clamp(left, right),
        y: origin.y.clamp(top, bottom),
    }
}

pub fn anchor_from_offsets(primary: Screen, x: i32, y: i32) -> Point {
    Point {
        x: primary.x + primary.width / 2.0 + x as f64 * primary.scale,
        y: primary.y + y as f64 * primary.scale,
    }
}

pub fn offsets_from_origin(origin: Point, scale: f64, primary: Screen) -> (i32, i32) {
    (
        ((origin.x + 280.0 * scale - primary.x - primary.width / 2.0) / primary.scale).round()
            as i32,
        ((origin.y - primary.y) / primary.scale).round() as i32,
    )
}

pub fn origin_for_anchor(anchor: Point, rect: Bounds, screen: Screen) -> Point {
    clamp_origin(
        Point {
            x: anchor.x - 280.0 * screen.scale,
            y: anchor.y,
        },
        rect,
        screen.scale,
        screen,
    )
}

pub fn monitor_for_anchor(anchor: Point, screens: &[Screen]) -> Option<usize> {
    screens
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| {
            let distance = |s: &Screen| {
                let point = Point {
                    x: anchor.x,
                    y: anchor.y + 30.0 * s.scale,
                };
                (point.x - point.x.clamp(s.x, s.x + s.width)).powi(2)
                    + (point.y - point.y.clamp(s.y, s.y + s.height)).powi(2)
            };
            distance(a).total_cmp(&distance(b))
        })
        .map(|(index, _)| index)
}
