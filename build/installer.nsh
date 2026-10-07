!macro preInit
  ; OneDrive 경로 설치 차단 경고 — %LOCALAPPDATA% 외부 감지
  StrCpy $0 $INSTDIR
  ${If} $0 != ""
    StrCpy $1 $0 8
    ${If} $1 == "OneDrive"
      MessageBox MB_OK "OneDrive 폴더에는 설치할 수 없습니다. %LOCALAPPDATA%\SME-ERP를 권장합니다."
      Abort
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ; PRE_OP wal_checkpoint(TRUNCATE) — 기존 DB 백업 전 호출
  DetailPrint "PRE_OP wal_checkpoint(TRUNCATE) ..."
  nsExec::ExecToLog '"$INSTDIR\resources\app.asar.unpacked\scripts\pre-install-check.bat"'
  ; 데이터 경로 초기화 — %LOCALAPPDATA%\SME-ERP\data\mycompany.db (보존)
  CreateDirectory "$LOCALAPPDATA\SME-ERP\data"
  CreateDirectory "$LOCALAPPDATA\SME-ERP\backup"
  ; 자동시작 레지스트리 Fallback (app.setLoginItemSettings 우선)
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SME-ERP" '"$INSTDIR\SME-ERP.exe"'
!macroend

!macro customUnInstall
  ; 언인스톨 DB 보존 — deleteAppDataOnUninstall=false, 체크박스 기본 해제
  MessageBox MB_YESNO|MB_DEFBUTTON2 "데이터를 삭제하시겠습니까? (기본: 유지) $\n%LOCALAPPDATA%\SME-ERP\data\mycompany.db" IDYES del IDNO nodel
  del:
    RMDir /r "$LOCALAPPDATA\SME-ERP"
    Goto done
  nodel:
    DetailPrint "DB 보존: $LOCALAPPDATA\SME-ERP\data\mycompany.db 유지"
  done:
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SME-ERP"
!macroend
