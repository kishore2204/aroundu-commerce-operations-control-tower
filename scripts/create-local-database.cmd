@echo off
rem DEVELOPMENT ONLY. Creates the AroundU role + shared database on your local PostgreSQL 18.
rem Usage:  scripts\create-local-database.cmd [port]      (port defaults to 5432)
rem psql will ask for the password of the "postgres" superuser you chose when installing PostgreSQL.
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=5432"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p %PORT% -d postgres -f "%~dp0create-local-database.sql"
if errorlevel 1 (
    echo.
    echo [ERROR] psql failed - check the postgres password and the port ^(pgAdmin shows it under the server's Connection tab^).
    exit /b 1
)
echo.
echo Done. Now set the connection once, then open a NEW terminal and start the project:
echo   setx DB_URL "jdbc:postgresql://localhost:%PORT%/Commerce_Operations_Control_Tower_db"
endlocal
