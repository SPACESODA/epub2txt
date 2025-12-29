@echo off
set VENV_DIR=.venv

if not exist %VENV_DIR% (
    echo Creating virtual environment...
    python -m venv %VENV_DIR%
    
    call %VENV_DIR%\Scripts\activate.bat
    
    if exist requirements.txt (
        echo Installing requirements...
        pip install -r requirements.txt
    ) else (
        echo Warning: requirements.txt not found.
    )
) else (
    call %VENV_DIR%\Scripts\activate.bat
)

python epub2txt.py %*

call %VENV_DIR%\Scripts\deactivate.bat
