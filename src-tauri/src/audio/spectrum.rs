//! Spectrum analysis for the visualizer.
//!
//! A hand-written radix-2 FFT over a 2048-sample Hann window, folded into 24
//! log-spaced bands between 40 Hz and 16 kHz. Magnitudes are converted to dB and
//! mapped to 0..1 with a per-band attack/release smoother. No external FFT
//! dependency: the tables are built once when the analyser is created.

/// Number of bands pushed to the frontend; views aggregate it into 4, 12 or 24.
pub const BANDS: usize = 24;
pub const FFT_SIZE: usize = 2048;

const BINS: usize = FFT_SIZE / 2;
const MIN_HZ: f32 = 40.0;
const MAX_HZ: f32 = 16_000.0;

// Tunables: adjust by ear. The dB window sets when a band reaches the top of
// its bar, ATTACK/RELEASE are the per-frame smoothing coefficients (0..1).
const FLOOR_DB: f32 = -75.0;
const CEIL_DB: f32 = -15.0;
const ATTACK: f32 = 0.55;
const RELEASE: f32 = 0.14;

type BinRange = (usize, usize);

pub struct Analyzer {
    ranges: [BinRange; BANDS],
    window: [f32; FFT_SIZE],
    re: [f32; FFT_SIZE],
    im: [f32; FFT_SIZE],
    reversed: [u16; FFT_SIZE],
    twiddle: [(f32, f32); BINS],
    smooth: [f32; BANDS],
}

impl Analyzer {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            ranges: band_ranges(sample_rate),
            window: hann_window(),
            re: [0.0; FFT_SIZE],
            im: [0.0; FFT_SIZE],
            reversed: bit_reversal(),
            twiddle: twiddle_table(),
            smooth: [0.0; BANDS],
        }
    }

    /// Returns the smoothed band levels, 0..1, one per band.
    pub fn analyze(&mut self, samples: &[f32; FFT_SIZE]) -> &[f32; BANDS] {
        self.load(samples);
        fft(&mut self.re, &mut self.im, &self.reversed, &self.twiddle);

        for band in 0..BANDS {
            let raw = self.band_level(band);
            let current = self.smooth[band];
            let rate = if raw > current { ATTACK } else { RELEASE };
            self.smooth[band] = current + (raw - current) * rate;
        }

        &self.smooth
    }

    /// Applies the Hann window and clears the imaginary part.
    fn load(&mut self, samples: &[f32; FFT_SIZE]) {
        for index in 0..FFT_SIZE {
            self.re[index] = samples[index] * self.window[index];
            self.im[index] = 0.0;
        }
    }

    /// Peak bin magnitude of one band, mapped from dB to 0..1.
    fn band_level(&self, band: usize) -> f32 {
        let (low, high) = self.ranges[band];
        let mut peak = 0.0_f32;
        for bin in low..=high {
            let magnitude = self.magnitude(bin);
            if magnitude > peak {
                peak = magnitude;
            }
        }

        let db = 20.0 * (peak + 1e-9).log10();
        ((db - FLOOR_DB) / (CEIL_DB - FLOOR_DB)).clamp(0.0, 1.0)
    }

    fn magnitude(&self, bin: usize) -> f32 {
        let re = self.re[bin];
        let im = self.im[bin];
        2.0 * (re * re + im * im).sqrt() / FFT_SIZE as f32
    }
}

/// Log-spaced bin ranges, computed once per sample rate. The DC bin is skipped
/// and the top edge is clamped to the last usable bin.
fn band_ranges(sample_rate: u32) -> [BinRange; BANDS] {
    let hz_per_bin = sample_rate as f32 / FFT_SIZE as f32;
    let ratio = MAX_HZ / MIN_HZ;
    let mut ranges = [(1, 1); BANDS];

    for (index, range) in ranges.iter_mut().enumerate() {
        let low_hz = MIN_HZ * ratio.powf(index as f32 / BANDS as f32);
        let high_hz = MIN_HZ * ratio.powf((index + 1) as f32 / BANDS as f32);
        let low = ((low_hz / hz_per_bin).round() as usize).clamp(1, BINS - 1);
        let high = ((high_hz / hz_per_bin).round() as usize).clamp(low, BINS - 1);
        *range = (low, high);
    }

    ranges
}

fn hann_window() -> [f32; FFT_SIZE] {
    let mut window = [0.0_f32; FFT_SIZE];
    let step = 2.0 * std::f64::consts::PI / (FFT_SIZE - 1) as f64;
    for (index, slot) in window.iter_mut().enumerate() {
        *slot = (0.5 - 0.5 * (step * index as f64).cos()) as f32;
    }
    window
}

fn bit_reversal() -> [u16; FFT_SIZE] {
    let bits = FFT_SIZE.trailing_zeros();
    let shift = usize::BITS - bits;
    let mut table = [0_u16; FFT_SIZE];
    for (index, slot) in table.iter_mut().enumerate() {
        *slot = (index.reverse_bits() >> shift) as u16;
    }
    table
}

fn twiddle_table() -> [(f32, f32); BINS] {
    let mut table = [(0.0_f32, 0.0_f32); BINS];
    let step = -2.0 * std::f64::consts::PI / FFT_SIZE as f64;
    for (index, slot) in table.iter_mut().enumerate() {
        let angle = step * index as f64;
        *slot = (angle.cos() as f32, angle.sin() as f32);
    }
    table
}

/// Iterative in-place radix-2 FFT.
fn fft(
    re: &mut [f32; FFT_SIZE],
    im: &mut [f32; FFT_SIZE],
    reversed: &[u16; FFT_SIZE],
    twiddle: &[(f32, f32); BINS],
) {
    for index in 0..FFT_SIZE {
        let target = reversed[index] as usize;
        if index < target {
            re.swap(index, target);
            im.swap(index, target);
        }
    }

    let mut size = 2;
    while size <= FFT_SIZE {
        let half = size / 2;
        let stride = FFT_SIZE / size;

        for start in (0..FFT_SIZE).step_by(size) {
            for step in 0..half {
                let (wr, wi) = twiddle[step * stride];
                let a = start + step;
                let b = a + half;
                let tr = wr * re[b] - wi * im[b];
                let ti = wr * im[b] + wi * re[b];
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
            }
        }

        size <<= 1;
    }
}
