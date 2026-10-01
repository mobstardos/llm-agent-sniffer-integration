@echo off
rem Universal Sniffer — запуск на Windows
rem Использование: run_windows.bat [аргументы sniffer.py]
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 sniffer.py %*
) else (
    python sniffer.py %*
)
if errorlevel 1 (
    echo.
    echo Произошла ошибка запуска. Нажмите любую клавишу для выхода.
    pause >nul
)
