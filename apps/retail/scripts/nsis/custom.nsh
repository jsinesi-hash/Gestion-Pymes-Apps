; Macros personalizadas para el instalador NSIS de Ferretería

; Cierra la app antes de instalar (evita archivos bloqueados en actualización)
!macro customInit
  nsExec::ExecToLog 'taskkill /F /IM ferreteria.exe /T'
!macroend

; Cierra la app antes de desinstalar (evita archivos bloqueados)
!macro customUnInstall
  nsExec::ExecToLog 'taskkill /F /IM ferreteria.exe /T'
!macroend
