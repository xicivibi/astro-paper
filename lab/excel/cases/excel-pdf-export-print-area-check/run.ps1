param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "excel-pdf-export-print-area-check" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
