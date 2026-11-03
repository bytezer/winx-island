interface CoverArtProps {
  src: string | null;
  size: number;
  radius: number;
  className?: string;
}

export function CoverArt({ src, size, radius, className }: CoverArtProps) {
  if (src) {
    return (
      <img
        className={className ? `cover ${className}` : "cover"}
        src={src}
        alt=""
        draggable={false}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <div
      className={className ? `cover cover-empty ${className}` : "cover cover-empty"}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.42} height={size * 0.42} aria-hidden="true">
        <path
          d="M9 18.5a2.5 2.5 0 1 1-1.5-2.29V6.2l9.5-2v10.05a2.5 2.5 0 1 1-1.5-2.29V7.4L9 8.9z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
