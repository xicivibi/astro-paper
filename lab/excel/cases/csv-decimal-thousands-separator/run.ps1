param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "csv-decimal-thousands-separator" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
