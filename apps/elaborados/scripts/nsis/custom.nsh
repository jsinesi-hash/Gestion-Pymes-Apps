; Macros personalizadas para el instalador NSIS de Elaborados

; Cierra la app antes de instalar (evita archivos bloqueados en una reinstalación)
!macro customInit
  nsExec::ExecToLog 'taskkill /F /IM elaborados.exe /T'
!macroend

; Cierra la app antes de desinstalar (evita archivos bloqueados)
!macro customUnInstall
  nsExec::ExecToLog 'taskkill /F /IM elaborados.exe /T'
!macroend
