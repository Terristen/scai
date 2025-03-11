@echo off
REM Navigate to your project directory
REM cd /d "C:\Path\To\Your\Project"

REM Activate the virtual environment
call .\venv\Scripts\activate

REM Start the Uvicorn server
uvicorn app:app --reload

REM Pause to keep the command window open after the script runs
pause