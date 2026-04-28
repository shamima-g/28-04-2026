#
# Pester tests for .claude/hooks/inject-phase-context.ps1
#
# Fires on SessionStart (compact matcher). Restores phase-specific instructions
# after auto-compaction by reading workflow-state.json and injecting the
# matching .claude/hooks/phase-context/<phase>.md content.
#
# NOTE on hermeticity: the hook resolves $projectRoot from $PSScriptRoot, so it
# always reads generated-docs/context/workflow-state.json from the REAL repo
# root (not from $PWD). Each test therefore backs up the real state file,
# writes a test-specific one, then restores in AfterEach.
#
BeforeAll {
    $script:RepoRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
    $script:Hook       = Join-Path $RepoRoot '.claude\hooks\inject-phase-context.ps1'
    $script:ContextDir = Join-Path $RepoRoot 'generated-docs\context'
    $script:StateFile  = Join-Path $ContextDir 'workflow-state.json'
    $script:BackupPath = Join-Path $env:TEMP ("phase-ctx-backup-" + [System.IO.Path]::GetRandomFileName() + ".json")
    $script:ContextDirCreatedByTest = $false
}

Describe 'inject-phase-context.ps1' {

    BeforeEach {
        $script:ContextDirCreatedByTest = $false
        if (Test-Path $StateFile) {
            Copy-Item -Path $StateFile -Destination $BackupPath -Force
            Remove-Item -Path $StateFile -Force
        }
        if (-not (Test-Path $ContextDir)) {
            New-Item -ItemType Directory -Path $ContextDir -Force | Out-Null
            $script:ContextDirCreatedByTest = $true
        }
    }

    AfterEach {
        if (Test-Path $StateFile) {
            Remove-Item -Path $StateFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $BackupPath) {
            Move-Item -Path $BackupPath -Destination $StateFile -Force
        } elseif ($ContextDirCreatedByTest -and (Test-Path $ContextDir)) {
            Remove-Item -Path $ContextDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It 'PASS: emits instructions matching the current phase' {
        $state = @{ currentPhase = 'DESIGN'; currentEpic = 1 } | ConvertTo-Json
        Set-Content -Path $StateFile -Value $state -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        ($result -join "`n") | Should -Match 'DESIGN'
    }

    It 'FAIL: does not crash when state file is missing' {
        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook 2>&1
        $LASTEXITCODE | Should -Be 0
    }
}
