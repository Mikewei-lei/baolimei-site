import asyncio, base64, json, subprocess, time, urllib.request, os
import websockets

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9338
BASE = "http://127.0.0.1:3000"
OUT = os.path.dirname(os.path.abspath(__file__)) + r"\..\.shots"


async def main():
    os.makedirs(OUT, exist_ok=True)
    proc = subprocess.Popen([
        EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", f"--remote-debugging-port={PORT}",
        "--user-data-dir=" + os.path.join(OUT, "edge-shots"), "--window-size=1440,1000", "about:blank"
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
        async with websockets.connect(pages[0]["webSocketDebuggerUrl"], max_size=100_000_000) as ws:
            mid = 0
            pending = {}
            async def recv_loop():
                async for raw in ws:
                    msg = json.loads(raw)
                    if "id" in msg and msg["id"] in pending:
                        pending[msg["id"]].set_result(msg)
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
            await send("Page.enable"); await send("Runtime.enable")

            async def viewport(w, h, mobile=False):
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": w, "height": h, "deviceScaleFactor": 1, "mobile": mobile
                })

            async def ready():
                await js("document.querySelectorAll('img[loading=\"lazy\"]').forEach(i=>i.loading='eager'); document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-in')); true")
                await asyncio.sleep(1.4)

            async def shot(name, path, full=False):
                await send("Page.navigate", {"url": BASE + path})
                await asyncio.sleep(2.4)
                await ready()
                params = {"format": "png", "fromSurface": True, "captureBeyondViewport": full}
                if full:
                    m = await send("Page.getLayoutMetrics")
                    cs = m["result"]["cssContentSize"]
                    params["clip"] = {"x": 0, "y": 0, "width": cs["width"], "height": cs["height"], "scale": 1}
                r = await send("Page.captureScreenshot", params)
                data = base64.b64decode(r["result"]["data"])
                with open(os.path.join(OUT, name), "wb") as f:
                    f.write(data)
                print(name, len(data) // 1024, "KB")

            await viewport(1440, 1000)
            await shot("home-desktop.png", "/", True)
            await shot("models-desktop.png", "/models", True)
            await shot("works-desktop.png", "/works", True)
            await shot("studio-desktop.png", "/studio", False)
            await shot("canvas-desktop.png", "/canvas", False)

            await viewport(1440, 1000)
            await send("Page.navigate", {"url": BASE + "/"})
            await asyncio.sleep(2)
            await js("document.querySelector('.header__signin')?.click(); true")
            await asyncio.sleep(0.6)
            r = await send("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(OUT, "auth-desktop.png"), "wb") as f:
                f.write(base64.b64decode(r["result"]["data"]))
            print("auth-desktop.png", len(base64.b64decode(r["result"]["data"])) // 1024, "KB")
            await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true")
            await asyncio.sleep(0.3)

            await viewport(390, 844, True)
            await shot("home-mobile.png", "/", True)
            await shot("models-mobile.png", "/models", True)

            task.cancel()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

asyncio.run(main())
