#
# Pester tests for .claude/hooks/inject-agent-context.ps1
#
# Fires on SubagentStart. Emits JSON with hookSpecificOutput.additionalContext
# carrying workflow coordinates (Feature/Epic/Story/Phase/Spec + optional file
# paths). Silent exit 0 when state is missing, malformed, or inactive.
#
# NOTE on hermeticity: the hook resolves $projectRoot from $PSScriptRoot, so it
# always reads generated-docs/context/workflow-state.json from the REAL repo
# root (not from $PWD). Each test therefore backs up the real state file,
# writes a test-specific one, then restores in AfterEach.
#
BeforeAll {
    $script:RepoRoot     = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
    $script:Hook         = Join-Path $RepoRoot '.claude\hooks\inject-agent-context.ps1'
    $script:ContextDir   = Join-Path $RepoRoot 'generated-docs\context'
    $script:StateFile    = Join-Path $ContextDir 'workflow-state.json'
    $script:BackupPath   = Join-Path $env:TEMP ("agent-ctx-backup-" + [System.IO.Path]::GetRandomFileName() + ".json")
    $script:ContextDirCreatedByTest = $false
}

Describe 'inject-agent-context.ps1' {

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

    It 'PASS: emits JSON with workflow coordinates when state is active' {
        $state = @{
            featureName  = 'Team Task Manager'
            currentPhase = 'IMPLEMENT'
            currentEpic  = 1
            totalEpics   = 3
            currentStory = 2
            specPath     = 'generated-docs/specs/feature-requirements.md'
        } | ConvertTo-Json
        Set-Content -Path $StateFile -Value $state -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0
        $result       | Should -Not -BeNullOrEmpty

        $parsed = $result | ConvertFrom-Json
        $parsed.hookSpecificOutput.hookEventName     | Should -Be 'SubagentStart'
        $parsed.hookSpecificOutput.additionalContext | Should -Match 'Team Task Manager'
        $parsed.hookSpecificOutput.additionalContext | Should -Match 'IMPLEMENT'
        $parsed.hookSpecificOutput.additionalContext | Should -Match '1 of 3'
        $parsed.hookSpecificOutput.additionalContext | Should -Match 'feature-requirements\.md'
    }

    It 'PASS: shows N/A for epic/story during INTAKE' {
        $state = @{
            featureName  = 'Team Task Manager'
            currentPhase = 'INTAKE'
            specPath     = 'generated-docs/specs/feature-requirements.md'
        } | ConvertTo-Json
        Set-Content -Path $StateFile -Value $state -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0

        $parsed = $result | ConvertFrom-Json
        $parsed.hookSpecificOutput.additionalContext | Should -Match 'requirements gathering'
        $parsed.hookSpecificOutput.additionalContext | Should -Match 'INTAKE'
    }

    It 'FAIL: silent exit 0 when state file is missing' {
        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0
        $result       | Should -BeNullOrEmpty
    }

    It 'FAIL: silent exit 0 when JSON is malformed' {
        Set-Content -Path $StateFile -Value '{not valid json' -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0
        $result       | Should -BeNullOrEmpty
    }

    It 'FAIL: silent exit 0 when currentPhase = COMPLETE' {
        $state = @{ currentPhase = 'COMPLETE'; featureName = 'done' } | ConvertTo-Json
        Set-Content -Path $StateFile -Value $state -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0
        $result       | Should -BeNullOrEmpty
    }

    It 'FAIL: silent exit 0 when featureComplete = true' {
        $state = @{ currentPhase = 'QA'; featureComplete = $true } | ConvertTo-Json
        Set-Content -Path $StateFile -Value $state -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0
        $result       | Should -BeNullOrEmpty
    }

    It 'FAIL: silent exit 0 when currentPhase is absent' {
        $state = @{ featureName = 'stub' } | ConvertTo-Json
        Set-Content -Path $StateFile -Value $state -Encoding UTF8

        $result = & pwsh -NoProfile -ExecutionPolicy Bypass -File $Hook
        $LASTEXITCODE | Should -Be 0
        $result       | Should -BeNullOrEmpty
    }
}
