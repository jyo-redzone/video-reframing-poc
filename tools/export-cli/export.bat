@echo off
REM Activate the venv and run export.py with whatever args the user passed.
REM Assumes setup.bat has already been run successfully.
setlocal
set SCRIPT_DIR=%~dp0
set VENV_DIR=%SCRIPT_DIR%.venv

if not exist "%VENV_DIR%" (
    echo Virtualenv not found at %VENV_DIR%. Run setup.bat first. 1>&2
    endlocal
    exit /b 1
)

call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 (
    endlocal
    exit /b 1
)

python "%SCRIPT_DIR%export.py" %*
set RC=%ERRORLEVEL%
endlocal & exit /b %RC%
