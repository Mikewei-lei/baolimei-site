@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/2] 启动本地服务 localhost:3000 ...
start "Baolimei Web" cmd /k "npm start"
timeout /t 5 /nobreak >nul
echo [2/2] 建立公网临时链接（保持本窗口开启，关闭即失效）...
if exist tools\cloudflared.exe (
  tools\cloudflared.exe tunnel --url http://localhost:3000
) else (
  echo 未找到 tools\cloudflared.exe，请先下载 cloudflared。
  pause
)
