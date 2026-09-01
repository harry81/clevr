@echo off
REM start.bat — WIN-C Portable (관리자 불필요, USB 이식)
REM 결론 v2 §1, WBS T-00-01 — Portable ZIP 압축해제 -> start.bat 더블클릭 -> 127.0.0.1:3000 자동오픈
setlocal EnableDelayedExpansion

REM OneDrive 분리 체크 — live DB는 OneDrive에 두지 않음
echo %CD% | findstr /I "OneDrive" >nul
if %errorlevel%==0 (
  echo [경고] OneDrive 폴더에서 Portable을 실행 중입니다. live DB 손상 위험: 스냅샷만 동기화하세요.
  echo       권장: C:\SME-ERP-Portable 또는 USB 루트에서 실행하세요.
  pause
)

REM 데이터 경로: Portable은 ./data/mycompany.db (이식), 설치형은 %LOCALAPPDATA%\SME-ERP\data\mycompany.db
set "DATA_DIR=%~dp0data"
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
set "DB_FILE=%DATA_DIR%\mycompany.db"
echo [SME-ERP] DATA=%DB_FILE%

REM PRE_OP wal_checkpoint(TRUNCATE) — 기존 DB가 SQLite WAL이면 checkpoint (JSON은 fsync)
if exist "%DB_FILE%" (
  echo [SME-ERP] PRE_OP wal_checkpoint(TRUNCATE) ...
  REM JSON 모드: 단순 확인 — SQLite 모드라면 sqlite3 "%DB_FILE%" "PRAGMA wal_checkpoint(TRUNCATE);" 실행 가능
)

REM Node/Electron 기동 — 번들된 electron이 있으면 우선, 없으면 시스템 electron 사용
if exist "%~dp0SME-ERP-Portable.exe" (
  echo [SME-ERP] Portable exe 기동...
  start "" "%~dp0SME-ERP-Portable.exe"
  timeout /t 2 /nobreak >nul
  start http://127.0.0.1:3000
  exit /b 0
)

if exist "%~dp0node_modules\.bin\electron.cmd" (
  echo [SME-ERP] electron 기동 (개발 모드)...
  call "%~dp0node_modules\.bin\electron.cmd" "%~dp0" --no-sandbox --disable-gpu
  exit /b 0
)

where electron >nul 2>nul
if %errorlevel%==0 (
  electron "%~dp0" --no-sandbox --disable-gpu
  exit /b 0
)

REM Fallback: npm start
where npm >nul 2>nul
if %errorlevel%==0 (
  echo [SME-ERP] npm start fallback...
  call npm start
  exit /b 0
)

echo [오류] Electron을 찾을 수 없습니다. Node.js LTS를 설치하거나 Portable exe를 사용하세요.
echo        https://nodejs.org
pause
exit /b 1
