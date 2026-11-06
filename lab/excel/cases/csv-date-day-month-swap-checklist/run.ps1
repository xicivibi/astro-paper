param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "csv-date-day-month-swap-checklist" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
