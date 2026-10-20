import asyncio, base64, json, subprocess, time, urllib.request, os
import websockets

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9343
BASE = "http://localhost:3001"
OUT = os.path.dirname(os.path.abspath(__file__)) + r"\..\.shots"


async def main():
    os.makedirs(OUT, exist_ok=True)
    proc = subprocess.Popen([
        EDGE, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", f"--remote-debugging-port={PORT}",
        "--user-data-dir=" + os.path.join(OUT, "edge-account"), "--window-size=1440,1000", "about:blank"
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
        async with websockets.connect(pages[0]["webSocketDebuggerUrl"], max_size=80_000_000) as ws:
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

            async def js(expr, await_promise=False):
                r = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": await_promise, "userGesture": True})
                if "exceptionDetails" in r.get("result", {}):
                    return {"__error": r["result"]["exceptionDetails"].get("text")}
                return r["result"]["result"].get("value")

            task = asyncio.create_task(recv_loop())
            await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable")
            await send("Page.navigate", {"url": BASE + "/account"})
            await asyncio.sleep(2.5)
            print("[guest]", await js("document.body.innerText.slice(0,160)"))

            await js("document.querySelector('.header__signin')?.click(); true")
            await asyncio.sleep(0.5)
            await js(r"""
            (() => {
              const inputs = document.querySelectorAll('.auth-field input');
              const set = (el, v) => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v);
                el.dispatchEvent(new Event('input',{bubbles:true}));
              };
              set(inputs[0], '19943188815');
              set(inputs[1], 'Baolimei2026');
              document.querySelectorAll('.auth-methods button')[1]?.click();
              return true;
            })()
            """)
            await asyncio.sleep(0.4)
            # after switching to password method, inputs are phone/password
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
              return inputs.length;
            })()
            """)
            await asyncio.sleep(2.5)
            await send("Page.navigate", {"url": BASE + "/account"})
            await asyncio.sleep(2.5)
            info = await js(r"""
            (() => ({
              shell: !!document.querySelector('.account-shell'),
              name: document.querySelector('.account-hero__main h2')?.textContent,
              phone: document.querySelector('.account-hero__main p')?.textContent,
              stats: [...document.querySelectorAll('.account-stats > div')].map(e=>e.innerText.replace(/\n/g,' ')),
              tabs: [...document.querySelectorAll('.account-tabs button')].map(e=>e.textContent.trim()),
              sessionRows: document.querySelectorAll('.account-session').length,
              profileInputs: document.querySelectorAll('.account-card .auth-field input').length,
              overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            }))()
            """)
            print("[account]", json.dumps(info, ensure_ascii=False))
            await js("[...document.querySelectorAll('.account-tabs button')].find(b=>b.textContent.includes('安全'))?.click(); true")
            await asyncio.sleep(0.5)
            sec = await js(r"""
            (() => ({
              passwordForm: document.querySelectorAll('.account-card form, form.account-card').length,
              sessions: document.querySelectorAll('.account-session').length,
              currentBadge: document.querySelectorAll('.account-current').length,
            }))()
            """)
            print("[security]", json.dumps(sec, ensure_ascii=False))
            r = await send("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(OUT, "account-center.png"), "wb") as f:
                f.write(base64.b64decode(r["result"]["data"]))
            print("[screenshot] account-center.png")
            errs = [e for e in events if e.get("method") in ("Runtime.exceptionThrown", "Log.entryAdded")]
            print("[console errors]", json.dumps(errs, ensure_ascii=False)[:1500])
            task.cancel()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

asyncio.run(main())
