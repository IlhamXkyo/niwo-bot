/**
 * Unified Master E2E Test Suite Runner.
 * Executes all 4 test tiers sequentially:
 * - Tier 1: Feature Coverage (F1 to F22, 110 tests)
 * - Tier 2: Boundary & Corner Cases (110 tests)
 * - Tier 3: Cross-Feature Combinations (22 tests)
 * - Tier 4: Real-World Application Scenarios (6 tests)
 * Total: 248 comprehensive test cases.
 * Exits with code 0 on 100% pass, or code 1 on failure.
 */

const { runTier1Tests } = require('./tier1_feature_tests');
const { runTier2Tests } = require('./tier2_boundary_tests');
const { runTier3Tests } = require('./tier3_combination_tests');
const { runTier4Tests } = require('./tier4_application_tests');

async function main() {
  console.log('='.repeat(75));
  console.log('REMOTE C2 ASSISTANT: MASTER E2E TEST SUITE RUNNER');
  console.log('='.repeat(75));

  const suiteStartTime = Date.now();
  const allTiers = [];

  const tierRunners = [
    { name: 'Tier 1', run: runTier1Tests },
    { name: 'Tier 2', run: runTier2Tests },
    { name: 'Tier 3', run: runTier3Tests },
    { name: 'Tier 4', run: runTier4Tests }
  ];

  for (const { name, run } of tierRunners) {
    const tierStart = Date.now();
    try {
      const res = await run();
      res.durationMs = Date.now() - tierStart;
      allTiers.push(res);
      console.log(
        `[${res.tier}] Passed: ${res.passed}/${res.total} (${res.durationMs}ms)`
      );
      if (res.failed > 0) {
        console.error(`  FAILURES in ${res.tier}:`);
        for (const f of res.failures) {
          console.error(`    - ${f.name}: ${f.error}`);
        }
      }
    } catch (err) {
      allTiers.push({
        tier: name,
        total: 1,
        passed: 0,
        failed: 1,
        durationMs: Date.now() - tierStart,
        failures: [{ name: `${name} Runtime Error`, error: err.message }]
      });
      console.error(`[${name}] UNHANDLED ERROR:`, err.message);
    }
  }

  const suiteDurationMs = Date.now() - suiteStartTime;
  const totalTests = allTiers.reduce((acc, t) => acc + t.total, 0);
  const totalPassed = allTiers.reduce((acc, t) => acc + t.passed, 0);
  const totalFailed = allTiers.reduce((acc, t) => acc + t.failed, 0);
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0.00';

  console.log('-'.repeat(75));
  console.log('TEST EXECUTION SUMMARY:');
  console.log(`  Total Test Cases Executed : ${totalTests}`);
  console.log(`  Total Passed              : ${totalPassed}`);
  console.log(`  Total Failed              : ${totalFailed}`);
  console.log(`  Pass Rate                 : ${passRate}%`);
  console.log(`  Total Duration            : ${suiteDurationMs}ms`);
  console.log('-'.repeat(75));

  console.log('TIER BREAKDOWN:');
  for (const t of allTiers) {
    const tierStatus = t.failed === 0 ? 'PASSED' : 'FAILED';
    console.log(`  ${t.tier.padEnd(42)} : ${tierStatus} (${t.passed}/${t.total}) in ${t.durationMs}ms`);
  }
  console.log('='.repeat(75));

  if (totalFailed > 0) {
    console.error('TEST SUITE STATUS: FAILED (Exit Code: 1)');
    process.exit(1);
  } else {
    console.log('TEST SUITE STATUS: 100% PASSED (Exit Code: 0)');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal Runner Exception:', err);
    process.exit(1);
  });
}

module.exports = { main };
