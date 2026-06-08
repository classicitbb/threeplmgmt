@echo off
cd /d "%~dp0"
echo Deleting stale git lock...
del /f /q .git\index.lock 2>nul
del /f /q .git\HEAD.lock 2>nul
echo Pushing branch...
git push origin claude/non-dev-signin-issue-Z3wc4
echo Done. You can delete this file.
pause
