@echo off
SET PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0"

IF NOT EXIST "client\node_modules" (
  echo Instalando dependencias del cliente...
  cd client && npm install && cd ..
)
IF NOT EXIST "server\node_modules" (
  echo Instalando dependencias del servidor...
  cd server && npm install && cd ..
)

echo Arrancando No-Show Cero...
start "Servidor NSC" cmd /k "cd /d \"%~dp0server\" && node index.js"
timeout /t 8 /nobreak >nul
start http://localhost:5173
cd /d "%~dp0client" && npm run dev
