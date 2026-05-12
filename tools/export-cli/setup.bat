@echo off
REM Create a venv at tools\export-cli\.venv and install the pinned
REM dependencies. Run once after cloning. Re-run to refresh deps after a
REM requirements.txt bump.
setlocal
set SCRIPT_DIR=%~dp0
set VENV_DIR=%SCRIPT_DIR%.venv

if not exist "%VENV_DIR%" (
    python -m venv "%VENV_DIR%"
    if errorlevel 1 goto :fail
)

call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 goto :fail

python -m pip install --upgrade pip
if errorlevel 1 goto :fail

pip install -r "%SCRIPT_DIR%requirements.txt"
if errorlevel 1 goto :fail

echo Setup complete. Run export.bat ^<track.json^> to export a clip.
endlocal
exit /b 0

:fail
echo setup.bat failed.
endlocal
exit /b 1
