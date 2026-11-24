; -------------------------------------------------------------
; Script NSIS aggiuntivo per electron-builder
;
; I processi figli di Chromium (GPU, renderer) girano in sandbox con un
; token ristretto che può leggere i file solo tramite gruppi come
; "Users"/"Everyone". Se la cartella di installazione eredita permessi
; solo per l'utente (es. %LOCALAPPDATA%\Programs con ACL personalizzate),
; i processi in sandbox non riescono a caricare ffmpeg.dll e crashano con
; 0xC0000135 (STATUS_DLL_NOT_FOUND) ancora prima di avviarsi.
;
; Qui diamo lettura/esecuzione al gruppo Users (SID S-1-5-32-545, così
; funziona con Windows in qualunque lingua), come fa ad esempio VS Code.
; -------------------------------------------------------------
!macro customInstall
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant *S-1-5-32-545:(OI)(CI)RX /C /Q'
!macroend
