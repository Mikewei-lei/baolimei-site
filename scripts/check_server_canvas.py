import asyncio, json, subprocess, time, urllib.request, os
import websockets

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9352
BASE = os.environ.get("CHECK_BASE", "http://localhost:3001")
OUT = os.path.dirname(os.path.abspath(__file__)) + r"\..\.shots"


async def main():
    proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", f"--remote-debugging-port={PORT}", "--user-data-dir=" + os.path.join(OUT, "edge-servercanvas"), "--window-size=1440,1000", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            await send("Page.navigate", {"url": BASE + "/account"})
            await asyncio.sleep(2.5)
            await js("document.querySelector('.header__signin')?.click(); true")
            await asyncio.sleep(0.5)
            await js("document.querySelectorAll('.auth-methods button')[1]?.click(); true")
            await asyncio.sleep(0.3)
            await js(r"""
            (() => {
              const inputs = document.querySelectorAll('.auth-field input');
              const set = (el, v) => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v);
                el.dispatchEvent(new Event('input',{bubbles:true}));
              };
              set(inputs[0], '19943188815');
              set(inputs[1], 'Baolimei2026');
              document.querySelector('.auth-submit')?.click();
              return true;
            })()
            """)
            await asyncio.sleep(3)
            await send("Page.navigate", {"url": BASE + "/canvas"})
            await asyncio.sleep(4)
            info = await js("""(()=>({nodes:document.querySelectorAll('.react-flow__node').length,edges:document.querySelectorAll('.react-flow__edge').length,sync:document.querySelector('.flow-sync')?.textContent,flow:!!document.querySelector('.react-flow')}))()""")
            print("server canvas", info)
            if info.get("nodes"):
                box = await js("(()=>{const n=document.querySelector('.react-flow__node');const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
                x = box["x"] + 30
                y = box["y"] + 18
                await send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1})
                for i in range(1, 9):
                    await asyncio.sleep(0.05)
                    await send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x + i * 15, "y": y + i * 10, "button": "left", "buttons": 1})
                await send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x + 120, "y": y + 80, "button": "left", "buttons": 0, "clickCount": 1})
                await asyncio.sleep(0.7)
                after = await js("(()=>{const n=document.querySelector('.react-flow__node');const r=n.getBoundingClientRect();return {x:r.x,y:r.y,dx:Math.round(r.x-(" + str(box["x"]) + "))}})()")
                print("drag", after)
            await asyncio.sleep(1.2)
            print("sync after", await js("document.querySelector('.flow-sync')?.textContent"))
            errs = [e for e in events if e.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
            print("errors", json.dumps(errs, ensure_ascii=False)[:800])
            t.cancel()
    finally:
        proc.terminate()


asyncio.run(main())
