param(
  [Parameter(Mandatory=$true)][string]$Neuwave,
  [string]$Output = "docs\neuwave-rewrite\reports\generated"
)

$ErrorActionPreference = "Stop"
python .\docs\neuwave-rewrite\scripts\run_first_pass.py --repo . --neuwave $Neuwave --output $Output
