pub const FFT_SIZE: usize = 2048;
pub const BAND_COUNT: usize = 7;
const EDGES: [f32; BAND_COUNT + 1] = [
    45.0, 110.0, 240.0, 500.0, 1_100.0, 2_500.0, 5_500.0, 16_000.0,
];
const WEIGHTS: [f32; BAND_COUNT] = [0.85, 1.0, 1.15, 1.35, 1.6, 1.8, 2.0];

pub struct Spectrum {
    samples: [f32; FFT_SIZE],
    window: [f32; FFT_SIZE],
    cursor: usize,
    bands: [f32; BAND_COUNT],
    reference: f32,
}

impl Spectrum {
    pub fn new() -> Self {
        let window = std::array::from_fn(|index| {
            0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / (FFT_SIZE - 1) as f32).cos()
        });
        Self {
            samples: [0.0; FFT_SIZE],
            window,
            cursor: 0,
            bands: [0.0; BAND_COUNT],
            reference: 0.02,
        }
    }

    pub fn push(&mut self, sample: f32) {
        self.samples[self.cursor] = if sample.is_finite() {
            sample.clamp(-1.0, 1.0)
        } else {
            0.0
        };
        self.cursor = (self.cursor + 1) % FFT_SIZE;
    }

    pub fn analyze(&mut self, sample_rate: u32) -> [f32; BAND_COUNT] {
        let mut real = std::array::from_fn(|index| {
            self.samples[(self.cursor + index) % FFT_SIZE] * self.window[index]
        });
        let mut imaginary = [0.0; FFT_SIZE];
        fft(&mut real, &mut imaginary);
        let mut energy = [0.0_f32; BAND_COUNT];
        for bin in 1..FFT_SIZE / 2 {
            let frequency = bin as f32 * sample_rate as f32 / FFT_SIZE as f32;
            if let Some(band) = EDGES
                .windows(2)
                .position(|range| frequency >= range[0] && frequency < range[1])
            {
                let magnitude = real[bin].hypot(imaginary[bin]) * 4.0 / FFT_SIZE as f32;
                energy[band] = energy[band].max(magnitude * WEIGHTS[band]);
            }
        }
        let peak = energy.iter().copied().fold(0.0_f32, f32::max);
        self.reference = (self.reference * 0.98).max(peak * 1.5).max(0.003);
        for (band, magnitude) in self.bands.iter_mut().zip(energy) {
            let target = if magnitude < 0.00001 {
                0.0
            } else {
                (4.0 * magnitude / self.reference).ln_1p() / 5.0_f32.ln()
            }
            .clamp(0.0, 1.0);
            *band += (target - *band) * if target > *band { 0.85 } else { 0.5 };
            if *band < 0.005 {
                *band = 0.0;
            }
        }
        self.bands
    }
}

fn fft(real: &mut [f32; FFT_SIZE], imaginary: &mut [f32; FFT_SIZE]) {
    let mut reverse = 0;
    for index in 1..FFT_SIZE {
        let mut bit = FFT_SIZE >> 1;
        while reverse & bit != 0 {
            reverse ^= bit;
            bit >>= 1;
        }
        reverse ^= bit;
        if index < reverse {
            real.swap(index, reverse);
            imaginary.swap(index, reverse);
        }
    }
    let mut width = 2;
    while width <= FFT_SIZE {
        let angle = -std::f32::consts::TAU / width as f32;
        let (root_imaginary, root_real) = angle.sin_cos();
        for start in (0..FFT_SIZE).step_by(width) {
            let mut twiddle_real = 1.0;
            let mut twiddle_imaginary = 0.0;
            for index in 0..width / 2 {
                let even = start + index;
                let odd = even + width / 2;
                let odd_real = real[odd] * twiddle_real - imaginary[odd] * twiddle_imaginary;
                let odd_imaginary = real[odd] * twiddle_imaginary + imaginary[odd] * twiddle_real;
                real[odd] = real[even] - odd_real;
                imaginary[odd] = imaginary[even] - odd_imaginary;
                real[even] += odd_real;
                imaginary[even] += odd_imaginary;
                let next_real = twiddle_real * root_real - twiddle_imaginary * root_imaginary;
                twiddle_imaginary = twiddle_real * root_imaginary + twiddle_imaginary * root_real;
                twiddle_real = next_real;
            }
        }
        width *= 2;
    }
}
