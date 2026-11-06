param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "csv-quoted-newline-row-break" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
