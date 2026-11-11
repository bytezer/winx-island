#[derive(Clone, Copy)]
pub enum SampleEncoding {
    Float32,
    Pcm16,
    Pcm24,
    Pcm32,
}

impl SampleEncoding {
    pub fn bytes(self) -> usize {
        match self {
            Self::Pcm16 => 2,
            Self::Pcm24 => 3,
            _ => 4,
        }
    }

    pub fn decode(self, bytes: &[u8]) -> f32 {
        let sample = match self {
            Self::Float32 => f32::from_le_bytes(bytes[..4].try_into().unwrap()),
            Self::Pcm16 => i16::from_le_bytes(bytes[..2].try_into().unwrap()) as f32 / 32_768.0,
            Self::Pcm24 => {
                let value = i32::from_le_bytes([
                    bytes[0],
                    bytes[1],
                    bytes[2],
                    if bytes[2] & 0x80 != 0 { 0xff } else { 0 },
                ]);
                value as f32 / 8_388_608.0
            }
            Self::Pcm32 => {
                i32::from_le_bytes(bytes[..4].try_into().unwrap()) as f32 / 2_147_483_648.0
            }
        };
        if sample.is_finite() {
            sample.clamp(-1.0, 1.0)
        } else {
            0.0
        }
    }
}
