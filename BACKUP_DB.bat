@echo off
REM ---------------------------------------------------------------
REM QuickWash Smart Hub - Local DB backup script
REM Creates a timestamped mysqldump of quickwash_hub under .\backups\.
REM Schedule me (e.g. Windows Task Scheduler) to run daily.
REM ---------------------------------------------------------------
set "MYSQLDUMP=C:\xampp\mysql\bin\mysqldump.exe"
set "OUT=C:\xampp\htdocs\xampp\Capstone Project\QuickWash-Smart-Hub\backups"
set "STAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%"
set "STAMP=%STAMP: =0%"

if not exist "%OUT%" mkdir "%OUT%"

"%MYSQLDUMP%" -uroot --single-transaction --routines --triggers quickwash_hub > "%OUT%\quickwash_hub_%STAMP%.sql"

if %ERRORLEVEL% EQU 0 (
  echo [backup] OK -> %OUT%\quickwash_hub_%STAMP%.sql
) else (
  echo [backup] FAILED with code %ERRORLEVEL%
)