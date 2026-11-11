import assert from "node:assert/strict";

const targets = await (await fetch("http://127.0.0.1:9224/json/list")).json();
const target = targets.find(value => value.type === "page" && !value.url.startsWith("edge://"));
assert.ok(target, "Start an isolated Edge debugging session on port 9224");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
socket.onmessage = event => {
  const response = JSON.parse(event.data);
  const entry = pending.get(response.id);
  if (!entry) return;
  pending.delete(response.id);
  if (response.error) entry.reject(response.error);
  else entry.resolve(response.result);
};
function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function mouse(type, x, y, buttons = 0) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" && !buttons ? "none" : "left", buttons, clickCount: 1 });
}
try {
  await send("Page.navigate", { url: process.argv[2] ?? "file:///C:/Windows/Temp/winx-seek-fixture/index.html" });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate("Boolean(window.seekProbe && document.querySelector('.progress-rail'))")) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const bounds = await evaluate("(()=>{const r=document.querySelector('.progress-rail').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width}})()");
  const x = fraction => bounds.x + bounds.w * fraction;
  const y = bounds.y + 10;
  await mouse("mousePressed", x(0.195), y, 1);
  await mouse("mouseMoved", x(0.7), y, 1);
  assert.equal((await evaluate("seekProbe.seeks")).length, 0, "Seeking should commit only on release");
  await mouse("mouseReleased", x(0.7), y);
  let probe = await evaluate("seekProbe");
  assert.equal(probe.seeks.length, 1);
  assert.ok(Math.abs(probe.seeks[0] - 70_000) < 1);
  assert.equal(probe.parentClicks, 0, "Seek click must not toggle the containing view");
  await mouse("mousePressed", x(0.7), y, 1);
  await mouse("mouseMoved", x(-0.05), y, 1);
  await mouse("mouseReleased", x(-0.05), y);
  probe = await evaluate("seekProbe");
  assert.deepEqual(probe.seeks, [70_000, 0]);
  assert.equal(probe.parentClicks, 0);
  await mouse("mousePressed", x(0.3), y, 1);
  await evaluate("document.querySelector('.progress-rail').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1}))");
  await mouse("mouseReleased", x(0.3), y);
  assert.equal((await evaluate("seekProbe.seeks")).length, 2);
  console.log("SEEK-01 OK: knob drag commits once, release outside clamps, click stays isolated, cancellation skips seek");
} finally {
  socket.close();
}
