# E2E Test Infra: Remote C2 Assistant (Niwo Bot to Antigravity Bridge)

## Test Philosophy
- Opaque-box, requirement-driven. Derived strictly from `ORIGINAL_REQUEST.md` and user specifications, with no internal module dependencies.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Pass/Fail Semantics: Test runner executes with Node.js; exit code 0 indicates 100% tests pass.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|:------:|:------:|:------:|
| F1 | `.gravity on` Interactive Menu | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F2 | `.gravity on <mode>` Direct Mode | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F3 | `.gravity off` Bridge Disable | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F4 | `.gravity status` Status Reporting | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F5 | Group Routing: Reply-to-Bot Filter | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F6 | Group Routing: Keyword Trigger | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F7 | Group Routing: Unprompted Drop | ORIGINAL_REQUEST § R1 | 5 | 5 | ✓ |
| F8 | IPC Bridge: Inbound Queue Writer | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| F9 | IPC Bridge: Daemon Auto-Wake Stdout | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| F10 | IPC Bridge: Response Poller & Delivery | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| F11 | Fallback: Timeout Detector (>20s) | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| F12 | Fallback: Offline Notice & Buttons | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| F13 | Remote Exec: `.gravity open` Launcher | ORIGINAL_REQUEST § R2 | 5 | 5 | ✓ |
| F14 | Persona: Sawako Voice & Tone | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| F15 | Persona: Kaomoji Vocabulary | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| F16 | Persona: Zero Emoji Guard (Regex Filter) | ORIGINAL_REQUEST § R3 | 5 | 5 | ✓ |
| F17 | Sticker Bank: Action Parser | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| F18 | Sticker Bank: Emotion Mapping | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| F19 | Sticker Bank: WebP Dispatcher | ORIGINAL_REQUEST § R4 | 5 | 5 | ✓ |
| F20 | Remote C2: Desktop Screenshot Helper | ORIGINAL_REQUEST § Overview | 5 | 5 | ✓ |
| F21 | Remote C2: Guarded Shutdown & Abort | ORIGINAL_REQUEST § Overview | 5 | 5 | ✓ |
| F22 | Remote C2: Safe File Processing | ORIGINAL_REQUEST § Overview | 5 | 5 | ✓ |

## Test Architecture
- **Location**: `test/e2e/`
- **Invocation**: `node test/e2e/runner.js`
- **Output**: JSON & Markdown test result matrix. Exit code 0 on 100% pass, non-zero on failure.
- **Directory Layout**:
  ```
  test/e2e/
  ├── harness/
  │   ├── mockSocket.js         # Baileys mock socket (sendMessage, ev, reactions)
  │   └── mockIpc.js            # Isolated bridge queue runner & temporary directory
  ├── tier1_feature_tests.js     # Tier 1: Feature isolation tests
  ├── tier2_boundary_tests.js    # Tier 2: Boundary value & error injection tests
  ├── tier3_combination_tests.js # Tier 3: Pairwise cross-feature interactions
  ├── tier4_application_tests.js # Tier 4: Real-world application workload scenarios
  └── runner.js                  # Master test runner executing all tiers sequentially
  ```

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|---|---|---|
| S1 | Owner configures `.gravity on both` via interactive button, sends DM task, receives Sawako reply with Kaomoji and sticker | F1, F2, F8, F10, F14, F15, F17, F18, F19 | High |
| S2 | WhatsApp group conversation: random chatter dropped, keyword `sawako` triggers bridge, response delivered to group | F5, F6, F7, F8, F10, F14, F15 | High |
| S3 | Antigravity offline: message times out, Sawako apologetic notice received with "Open Antigravity" button, tapping button triggers Windows launcher | F8, F11, F12, F13 | High |
| S4 | Remote C2 Screenshot: Owner requests screenshot in DM, PowerShell tool executes, PNG verified, delivered with polite caption and sticker | F8, F10, F14, F18, F20 | High |
| S5 | Guarded Shutdown: Owner requests shutdown, bot schedules 60s shutdown with abort button, owner clicks abort, shutdown canceled safely | F8, F10, F14, F21 | High |
| S6 | Non-owner access attempt: Non-owner tries `.gravity on`, bot rejects strictly without modifying state | F1, F2, F3 | Medium |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥ 110 test cases (5 per feature × 22 features)
- **Tier 2 (Boundary & Corner Cases)**: ≥ 110 test cases (boundary limits, concurrency, corrupt JSON, non-owner, emoji stripping, empty folders)
- **Tier 3 (Cross-Feature Combinations)**: ≥ 22 pairwise interaction test cases
- **Tier 4 (Real-World Scenarios)**: ≥ 6 realistic end-to-end workload test cases
- **Total Suite**: ≥ 248 comprehensive test cases
