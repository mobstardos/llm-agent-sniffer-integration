@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0\.."

echo ============================================================
echo  Universal Sniffer 3.1 — сборка одиночного exe (PyInstaller)
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Python не найден в PATH.
  echo          Установите Python 3.9+ с https://python.org
  echo          и при установке отметьте галочку "Add python.exe to PATH".
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('python -c "import sys;print(sys.version_info[0])"') do set PYMAJ=%%i
if not "%PYMAJ%"=="3" (
  echo [ОШИБКА] Нужен Python 3, найдено: %PYMAJ%
  pause
  exit /b 1
)

if not exist ".venv-build" (
  echo Создаю изолированное окружение .venv-build ...
  python -m venv .venv-build
  if errorlevel 1 (
    echo [ОШИБКА] Не удалось создать venv.
    pause
    exit /b 1
  )
)

call .venv-build\Scripts\activate.bat
echo Ставлю зависимости ...
python -m pip install --upgrade pip -q
python -m pip install "pyinstaller>=6.0" -q

echo.
echo Сборка ...
python -m PyInstaller --noconfirm --clean builder\sniffer.spec
if errorlevel 1 (
  echo.
  echo [ОШИБКА] Сборка не удалась — прокрутите вывод выше.
  pause
  exit /b 1
)

call deactivate
echo.
echo ============================================================
echo  ГОТОВО: dist\UniversalSniffer.exe
echo  Одиночный файл — копируйте на любую Windows-машину.
echo  Рядом с exe появятся: config.json, capture\, plugins\
echo  Запуск: UniversalSniffer.exe [--ports 3003:3004 ...]
echo  Служба: UniversalSniffer.exe --service install  (от админа)
echo ============================================================
pause
endlocal
