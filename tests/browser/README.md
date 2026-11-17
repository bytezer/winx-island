# Seek interaction regression

`seek_fixture.tsx` mounts the real `ProgressBar` inside a clickable parent.
`seek.test.mjs` uses CDP mouse input to test capture from the knob, release
outside the rail, click isolation, and cancellation. Run it with Node 22+ and
an isolated Edge session exposing port 9224.

Build the fixture into a temporary directory:

```bash
mkdir -p /tmp/winx-seek-fixture
npx --no-install esbuild tests/browser/seek_fixture.tsx --bundle --platform=browser --jsx=automatic --outfile=/tmp/winx-seek-fixture/fixture.js
cp tests/browser/seek.html /tmp/winx-seek-fixture/index.html
```

Serve that directory or copy it to the Windows machine. Launch an isolated Edge
profile with `--headless=new --remote-debugging-port=9224 --user-data-dir=<temporary-profile>`.
Run the test where that debugging port is reachable, passing the fixture URL:

```bash
node tests/browser/seek.test.mjs http://localhost:5280/index.html
```

On WSL with Edge on Windows, use `node.exe` and a Windows-accessible fixture URL.
Close the isolated browser after testing. Generated fixture bundles stay outside
the repository.

`motion_fixture.tsx` mounts the real spectrum hook in all three styles, feeds
bands at 33 ms intervals, and exposes `window.motionProbe.samples` with actual
Canvas peak positions and timestamps. Bundle it in place of `seek_fixture.tsx`
to inspect frame cadence and continuous subpixel motion without native audio.
