# Rebuild the bundled spoken scan instructions on Windows, without a cloud service.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$scanRoot = Split-Path -Parent $PSScriptRoot
$scanOutput = Join-Path $scanRoot 'public/audio/scan'
New-Item -ItemType Directory -Force -Path $scanOutput | Out-Null
$scanPrompts = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'scan-prompts.json') | ConvertFrom-Json
$scanSynth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    $scanSynth.SelectVoice('Microsoft Zira Desktop')
    $scanSynth.Rate = 0
    $scanSynth.Volume = 100
    $scanFormat = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    foreach ($scanPrompt in $scanPrompts.PSObject.Properties) {
        $scanSynth.SetOutputToWaveFile((Join-Path $scanOutput ($scanPrompt.Name + '.wav')), $scanFormat)
        $scanSynth.Speak([string]$scanPrompt.Value)
        $scanSynth.SetOutputToNull()
    }
} finally {
    $scanSynth.Dispose()
}
Write-Output "Built $($scanPrompts.PSObject.Properties.Name.Count) spoken scan prompts."
