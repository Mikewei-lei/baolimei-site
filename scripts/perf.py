import asyncio, json, subprocess, time, urllib.request, os
import websockets

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9336
BASE = "http://127.0.0.1:3000"
OUT = os.path.dirname(os.path.abspath(__file__)) + r"\..\.shots"


async def run(url, mobile=False):
    proc = subprocess.Popen([
        EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", f"--remote-debugging-port={PORT}",
        "--user-data-dir=" + os.path.join(OUT, "edge-perf-" + ("m" if mobile else "d")),
        "--window-size=1440,1100", "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                data = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list"))
                pages = [x for x in data if x.get("type") == "page"]
                if pages:
                    break
            except Exception:
                pass
            time.sleep(0.2)

        async with websockets.connect(pages[0]["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
            mid = 0
            pending = {}
            events = []

            async def recv_loop():
                async for raw in ws:
                    msg = json.loads(raw)
                    if "id" in msg and msg["id"] in pending:
                        pending[msg["id"]].set_result(msg)
                    else:
                        events.append(msg)

            async def send(method, params=None):
                nonlocal mid
                mid += 1
                fut = asyncio.get_event_loop().create_future()
                pending[mid] = fut
                await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
                return await fut

            async def js(expr):
                r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
                return r["result"]["result"].get("value")

            task = asyncio.create_task(recv_loop())
            await send("Page.enable")
            await send("Runtime.enable")
            await send("Network.enable")
            if mobile:
                await send("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
            await send("Page.addScriptToEvaluateOnNewDocument", {"source": r"""
              window.__perf = { lcp: 0, lcpEl: '', cls: 0, shifts: [], long: [] };
              try {
                new PerformanceObserver((l) => {
                  const e = l.getEntries().at(-1);
                  if (e) { window.__perf.lcp = Math.round(e.startTime); window.__perf.lcpEl = (e.element && (e.element.tagName + '.' + (e.element.className||''))) || e.url || ''; }
                }).observe({ type: 'largest-contentful-paint', buffered: true });
                new PerformanceObserver((l) => {
                  for (const e of l.getEntries()) {
                    if (!e.hadRecentInput) window.__perf.cls += e.value;
                  }
                }).observe({ type: 'layout-shift', buffered: true });
                new PerformanceObserver((l) => {
                  for (const e of l.getEntries()) window.__perf.long.push(Math.round(e.duration));
                }).observe({ type: 'longtask', buffered: true });
              } catch (e) {}
            """})
            await send("Page.navigate", {"url": BASE + url})
            await asyncio.sleep(5)
            perf = await js(r"""
            (() => {
              const nav = performance.getEntriesByType('navigation')[0] || {};
              const res = performance.getEntriesByType('resource').map(r => ({n:r.name.split('/').pop(), t:r.transferSize, d:Math.round(r.duration)}));
              const imgs = performance.getEntriesByType('resource').filter(r=>/\.(webp|png|jpg|mp4)/.test(r.name));
              return {
                perf: window.__perf,
                dom: {ready: Math.round(nav.domContentLoadedEventEnd||0), load: Math.round(nav.loadEventEnd||0), response: Math.round(nav.responseStart||0)},
                transferKB: Math.round(res.reduce((a,r)=>a+(r.t||0),0)/1024),
                images: imgs.map(i=>({n:i.name.split('/').pop(), kb:Math.round((i.transferSize||0)/1024), ms:Math.round(i.duration)})),
                paint: performance.getEntriesByType('paint').map(p=>({n:p.name, t:Math.round(p.startTime)})),
                heapMB: performance.memory ? +(performance.memory.usedJSHeapSize/1048576).toFixed(1) : null,
              };
            })()
            """)
            print(url, "mobile" if mobile else "desktop", json.dumps(perf, ensure_ascii=False, indent=1))
            task.cancel()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


async def main():
    await run("/", False)
    await run("/", True)

asyncio.run(main())
