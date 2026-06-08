@echo off
cd /d "%~dp0"
echo Switching to DEV and merging AI assist phase 1...
git checkout DEV
if errorlevel 1 (
    echo ERROR: Could not checkout DEV
    pause
    exit /b 1
)
git pull origin DEV
git merge claude/non-dev-signin-issue-Z3wc4 --no-ff -m "Merge AI assist phase 1 into DEV"
if errorlevel 1 (
    echo ERROR: Merge failed - check conflicts above
    pause
    exit /b 1
)
git push origin DEV
echo.
echo Done! DEV is now up to date with AI assist phase 1.
echo You can delete merge-to-dev.bat and push-ai-assist.bat now.
pause
