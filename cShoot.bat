@echo off
setlocal enabledelayedexpansion

rem Get current folder name
for %%I in (.) do set "folderName=%%~nxI"

echo This script will backup all files and directories in the current folder.
echo Backup file will be named: %folderName%_date_time.zip
echo Backup will be saved to: ..\_backup
echo.

    echo.
    echo Creating backup...
    
    rem Create a timestamp for the backup
    set "timestamp=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "timestamp=!timestamp: =0!"
    
    rem Create _backup folder in parent directory if it doesn't exist
    if not exist "..\_backup" mkdir "..\_backup"
    
    rem Path for the zip file
    set "zipfile=..\_backup\%folderName%_%timestamp%.zip"
    
    rem Create a PowerShell script to perform the backup with complete directory structure preservation
    echo $ErrorActionPreference = 'Stop' > "%TEMP%\backup_script.ps1"
    echo $sourceDir = (Get-Item -Path ".").FullName >> "%TEMP%\backup_script.ps1"
    echo $destinationZip = "%zipfile%" >> "%TEMP%\backup_script.ps1"
    echo $foldersToExclude = @("_backup") >> "%TEMP%\backup_script.ps1"
    echo Add-Type -AssemblyName System.IO.Compression.FileSystem >> "%TEMP%\backup_script.ps1"
    echo if (Test-Path $destinationZip) { Remove-Item $destinationZip -Force } >> "%TEMP%\backup_script.ps1"
    echo $zipArchive = [System.IO.Compression.ZipFile]::Open($destinationZip, 'Create') >> "%TEMP%\backup_script.ps1"
    echo try { >> "%TEMP%\backup_script.ps1"
    echo     Get-ChildItem -Path $sourceDir -Recurse -Force ^| >> "%TEMP%\backup_script.ps1"
    echo     Where-Object { >> "%TEMP%\backup_script.ps1"
    echo         $shouldInclude = $true >> "%TEMP%\backup_script.ps1"
    echo         foreach ($folder in $foldersToExclude) { >> "%TEMP%\backup_script.ps1"
    echo             if ($_.FullName -like "*\$folder\*" -or $_.Name -eq $folder) { >> "%TEMP%\backup_script.ps1"
    echo                 $shouldInclude = $false >> "%TEMP%\backup_script.ps1"
    echo                 break >> "%TEMP%\backup_script.ps1"
    echo             } >> "%TEMP%\backup_script.ps1"
    echo         } >> "%TEMP%\backup_script.ps1"
    echo         $shouldInclude >> "%TEMP%\backup_script.ps1"
    echo     } ^| >> "%TEMP%\backup_script.ps1"
    echo     ForEach-Object { >> "%TEMP%\backup_script.ps1"
    echo         $entryName = $_.FullName.Substring($sourceDir.Length + 1) >> "%TEMP%\backup_script.ps1"
    echo         if (-not $_.PSIsContainer) { >> "%TEMP%\backup_script.ps1"
    echo             [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $_.FullName, $entryName, 'Optimal') ^| Out-Null >> "%TEMP%\backup_script.ps1"
    echo             Write-Host "Added: $entryName" -ForegroundColor Green >> "%TEMP%\backup_script.ps1"
    echo         } >> "%TEMP%\backup_script.ps1"
    echo     } >> "%TEMP%\backup_script.ps1"
    echo } finally { >> "%TEMP%\backup_script.ps1"
    echo     $zipArchive.Dispose() >> "%TEMP%\backup_script.ps1"
    echo } >> "%TEMP%\backup_script.ps1"
    
    rem Execute the PowerShell script
    powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\backup_script.ps1"
    del "%TEMP%\backup_script.ps1" > nul 2>&1
    
    if !errorlevel! == 0 (
        echo.
        echo Backup created successfully: %zipfile%
        echo All directories and files have been included in the backup with their exact folder structure.
    ) else (
        echo.
        echo Error: Backup creation failed.
    )

echo.
echo Press any key to exit...
pause > nul

endlocal