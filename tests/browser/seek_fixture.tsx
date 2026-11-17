import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProgressBar } from "../../src/island/ProgressBar";

const probe = { seeks: [] as number[], parentClicks: 0 };
Object.assign(window, { seekProbe: probe });

function SeekFixture() {
  const [position, setPosition] = useState(20_000);
  return <div onClick={() => { probe.parentClicks++; }}>
    <ProgressBar positionMs={position} durationMs={100_000} enabled showTimes onSeek={value => {
      probe.seeks.push(value);
      setPosition(value);
    }} />
  </div>;
}

createRoot(document.getElementById("root")!).render(<SeekFixture />);
