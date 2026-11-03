interface WaveformProps {
  playing: boolean;
  bars?: number;
}

export function Waveform({ playing, bars = 4 }: WaveformProps) {
  return (
    <div className={`waveform ${playing ? "is-playing" : ""}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, index) => (
        <span key={index} style={{ animationDelay: `${index * 110}ms` }} />
      ))}
    </div>
  );
}
