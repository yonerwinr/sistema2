@echo off
title XAMPP MySQL Launcher
echo ===================================================
echo Iniciando MySQL de XAMPP en segundo plano...
echo ===================================================
if exist "C:\xampp\mysql\bin\mysqld.exe" (
    start "" "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
    echo MySQL se esta iniciando. Por favor espera unos segundos...
    timeout /t 3 /nobreak > nul
    echo Validando conexion...
    "C:\xampp\mysql\bin\mysqladmin.exe" -u root ping >nul 2>&1
    if errorlevel 1 (
        echo MySQL no se inicio correctamente. Comprueba si hay otra instancia corriendo o el puerto esta ocupado.
    ) else (
        echo MySQL esta activo y listo.
    )
) else (
    echo [ERROR] No se encontro MySQL de XAMPP en C:\xampp\mysql\bin\mysqld.exe.
    echo Asegurate de que XAMPP este instalado o inicia tu servidor MySQL manualmente.
    pause
)
