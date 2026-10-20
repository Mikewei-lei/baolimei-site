import asyncio, json, subprocess, time, urllib.request, os
import websockets

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9351
OUT = os.path.dirname(os.path.abspath(__file__)) + r"\..\.shots"


async def main():
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", f"--remote-debugging-port={PORT}", "--user-data-dir=" + os.path.join(OUT, "edge-dragcheck"), "--window-size=1440,1000", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        async with websockets.connect(pages[0]["webSocketDebuggerUrl"]) as ws:
            mid = 0
            pending = {}
            events = []
            async def recv():
                async for raw in ws:
                    msg = json.loads(raw)
                    if msg.get("id") in pending:
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
                r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "userGesture": True})
                return r["result"]["result"].get("value")
            t = asyncio.create_task(recv())
            await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable")
            await send("Page.navigate", {"url": os.environ.get("CHECK_BASE", "http://localhost:3000") + "/canvas"})
            await asyncio.sleep(3)
            box = await js("(()=>{const n=document.querySelector('.react-flow__node');const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cls:n.className}})()")
            print("box", box)
            x = box["x"] + 30
            y = box["y"] + 18
            print("element", await js(f"(()=>{{const e=document.elementFromPoint({x},{y});return e?e.className+' / '+e.tagName:null}})()"))
            await send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1})
            for i in range(1, 11):
                await asyncio.sleep(0.05)
                await send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x + i * 15, "y": y + i * 10, "button": "left", "buttons": 1})
            await asyncio.sleep(0.2)
            await send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x + 150, "y": y + 100, "button": "left", "buttons": 0, "clickCount": 1})
            await asyncio.sleep(0.7)
            print("after", await js("(()=>{const n=document.querySelector('.react-flow__node');const r=n.getBoundingClientRect();return {x:r.x,y:r.y,transform:n.style.transform}})()"))
            print("viewport", await js("document.querySelector('.react-flow__viewport')?.style.transform"))
            errs = [e for e in events if e.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
            print("errors", json.dumps(errs, ensure_ascii=False)[:1000])
            t.cancel()
    finally:
        proc.terminate()


asyncio.run(main())
