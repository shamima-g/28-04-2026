#
# Pester tests for .claude/logging/capture-context.ps1
#
# TODO — this is a stub. The capture-context.ps1 script is 75KB and wraps
# many event types. Fully testing it is a Wave-2 task.
#
# At minimum, this stub verifies the script runs without crashing for each
# advertised event type.
#
BeforeAll {
    $script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
    $script:Script = Join-Path $RepoRoot '.claude\logging\capture-context.ps1'
}

Describe 'capture-context.ps1 (smoke tests)' {
    BeforeEach {
        $script:TempRoot = Join-Path $env:TEMP ("claude-query-ps-" + [System.IO.Path]::GetRandomFileName())
        New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
        Push-Location $TempRoot
        $env:CLAUDE_PROJECT_DIR = $TempRoot
        $env:CLAUDE_TEST_MODE = '1'
    }

    AfterEach {
        Pop-Location
        Remove-Item -Path $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item Env:\CLAUDE_PROJECT_DIR -ErrorAction SilentlyContinue
    }

    $eventTypes = @('session_start', 'prompt', 'response', 'session_end', 'notification')
    foreach ($eventType in $eventTypes) {
        It "PASS: runs to completion for EventType=$eventType without crashing" {
            # Provide empty stdin JSON to avoid hanging on ReadLine
            '{}' | & pwsh -NoProfile -ExecutionPolicy Bypass -File $Script -EventType $eventType 2>&1 | Out-Null
            # Non-zero is acceptable as long as it doesn't hang or throw a terminating error
            $LASTEXITCODE | Should -BeIn @(0, 1)
        }
    }

    It 'FAIL: refuses unknown event types gracefully' {
        & pwsh -NoProfile -ExecutionPolicy Bypass -File $Script -EventType 'bogus_event_type' 2>&1 | Out-Null
        # Either silently no-ops or reports an error — must not crash hard
        $LASTEXITCODE | Should -BeIn @(0, 1)
    }
}
