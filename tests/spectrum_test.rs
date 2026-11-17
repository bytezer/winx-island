#[path = "../src-tauri/src/spectrum.rs"]
mod spectrum;
use spectrum::{Spectrum, FFT_SIZE};

fn tone(analyzer: &mut Spectrum, frequency: f32, amplitude: f32, phase: usize) {
    for index in 0..FFT_SIZE {
        let sample = ((index + phase) as f32 * std::f32::consts::TAU * frequency / 48_000.0).sin()
            * amplitude;
        analyzer.push(sample);
    }
}

fn strongest(bands: &[f32]) -> usize {
    bands
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.total_cmp(b))
        .unwrap()
        .0
}

#[test]
fn fft_01_bass_and_treble_drive_different_bars() {
    let mut bass = Spectrum::new();
    let mut treble = Spectrum::new();
    tone(&mut bass, 80.0, 0.1, 0);
    tone(&mut treble, 8_000.0, 0.1, 0);
    let low = bass.analyze(48_000);
    let high = treble.analyze(48_000);
    assert_eq!(strongest(&low), 0);
    assert_eq!(strongest(&high), 6);
    assert!(low[0] > low[6] + 0.3);
    assert!(high[6] > high[0] + 0.3);
}

#[test]
fn fft_02_quiet_audio_stays_visible_without_saturating() {
    let mut analyzer = Spectrum::new();
    for index in 0..20 {
        tone(&mut analyzer, 750.0, 0.003, index * FFT_SIZE);
        analyzer.analyze(48_000);
    }
    let bands = analyzer.analyze(48_000);
    assert!(bands[3] > 0.2);
    assert!(bands[3] < 0.95);
    assert!(bands
        .iter()
        .all(|value| value.is_finite() && *value >= 0.0 && *value <= 1.0));
}

#[test]
fn fft_03_silence_returns_every_bar_to_zero() {
    let mut analyzer = Spectrum::new();
    tone(&mut analyzer, 400.0, 0.5, 0);
    analyzer.analyze(48_000);
    for _ in 0..70 {
        for _ in 0..FFT_SIZE {
            analyzer.push(0.0);
        }
        analyzer.analyze(48_000);
    }
    assert!(analyzer.analyze(48_000).iter().all(|value| *value == 0.0));
}

#[test]
fn fft_04_changed_frequency_replaces_the_old_shape() {
    let mut analyzer = Spectrum::new();
    for _ in 0..10 {
        tone(&mut analyzer, 180.0, 0.1, 0);
        analyzer.analyze(48_000);
    }
    let before = analyzer.analyze(48_000);
    for _ in 0..30 {
        tone(&mut analyzer, 3_000.0, 0.1, 0);
        analyzer.analyze(48_000);
    }
    let after = analyzer.analyze(48_000);
    assert_eq!(strongest(&before), 1);
    assert_eq!(strongest(&after), 5);
    assert!(after[1] < before[1] * 0.1);
}

#[test]
fn fft_05_invalid_samples_never_escape_as_nan() {
    let mut analyzer = Spectrum::new();
    for value in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
        for _ in 0..FFT_SIZE {
            analyzer.push(value);
        }
        assert!(analyzer.analyze(48_000).iter().all(|value| *value == 0.0));
    }
}

#[path = "../src-tauri/src/audio_samples.rs"]
mod audio_samples;

#[test]
fn fft_06_native_pcm_formats_decode_sign_and_amplitude() {
    use audio_samples::SampleEncoding;
    assert_eq!(SampleEncoding::Pcm16.decode(&[0, 0x80]), -1.0);
    assert_eq!(SampleEncoding::Pcm24.decode(&[0, 0, 0x80]), -1.0);
    assert_eq!(SampleEncoding::Pcm32.decode(&[0, 0, 0, 0x80]), -1.0);
    assert_eq!(SampleEncoding::Float32.decode(&0.5_f32.to_le_bytes()), 0.5);
    assert_eq!(SampleEncoding::Float32.decode(&f32::NAN.to_le_bytes()), 0.0);
    assert_eq!(SampleEncoding::Pcm24.bytes(), 3);
}

#[test]
fn impact_fft_01_audio_envelope_does_not_add_a_second_slow_animation() {
    let mut steady = Spectrum::new();
    for _ in 0..20 {
        tone(&mut steady, 750.0, 0.05, 0);
        steady.analyze(48_000);
    }
    let reference = steady.analyze(48_000)[3];
    let mut attack = Spectrum::new();
    tone(&mut attack, 750.0, 0.05, 0);
    assert!(attack.analyze(48_000)[3] > reference * 0.75);
    for _ in 0..2 {
        for _ in 0..FFT_SIZE { steady.push(0.0); }
        steady.analyze(48_000);
    }
    assert!(steady.analyze(48_000)[3] < reference * 0.3);
}
