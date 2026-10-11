// test/unit/system_tools_test.js
import assert from 'node:assert';
import {
  pingInternet,
  getSystemSpecs,
  executeTerminalCommand
} from '../../bridge/tools/systemOps.js';
import {
  isNetworkOrPingRequest,
  isSystemStatsRequest,
  parseTerminalCommandRequest
} from '../../bridge/daemon.js';

async function runTests() {
  console.log('============================================================');
  console.log('  SYSTEM TOOLS & INTENT ENGINE TEST SUITE');
  console.log('============================================================\n');

  console.log('Suite 1: Intent Recognition');
  assert.strictEqual(isNetworkOrPingRequest('ping'), true);
  assert.strictEqual(isNetworkOrPingRequest('ping internet'), true);
  assert.strictEqual(isNetworkOrPingRequest('Aku bilang ping kamu ga tau ping internet?'), true);
  assert.strictEqual(isNetworkOrPingRequest('cek latency google'), true);
  assert.strictEqual(isNetworkOrPingRequest('koneksi internet lancar ga'), true);
  assert.strictEqual(isNetworkOrPingRequest('halo apa kabar'), false);
  console.log('  [PASS] 1.1: isNetworkOrPingRequest accurately captures all network & ping variations');

  assert.strictEqual(isSystemStatsRequest('cek spek laptop'), true);
  assert.strictEqual(isSystemStatsRequest('Berapa sisa RAM dan baterai laptop?'), true);
  assert.strictEqual(isSystemStatsRequest('cek cpu load'), true);
  assert.strictEqual(isSystemStatsRequest('sisa disk drive c'), true);
  assert.strictEqual(isSystemStatsRequest('status laptop'), true);
  assert.strictEqual(isSystemStatsRequest('lagi apa kamu'), false);
  console.log('  [PASS] 1.2: isSystemStatsRequest identifies hardware & telemetry inquiries');

  assert.strictEqual(parseTerminalCommandRequest('whoami'), 'whoami');
  assert.strictEqual(parseTerminalCommandRequest('ipconfig'), 'ipconfig');
  assert.strictEqual(parseTerminalCommandRequest('jalankan whoami'), 'whoami');
  assert.strictEqual(parseTerminalCommandRequest('.cmd dir'), 'dir');
  assert.strictEqual(parseTerminalCommandRequest('powershell: Get-Date'), 'Get-Date');
  assert.strictEqual(parseTerminalCommandRequest('kamu siapa'), null);
  console.log('  [PASS] 1.3: parseTerminalCommandRequest accurately extracts terminal commands');

  console.log('\nSuite 2: Real System Ops Execution');
  const ping = await pingInternet('8.8.8.8', 2);
  assert.ok(ping.Sent >= 2);
  assert.ok(ping.Received >= 0);
  assert.ok(typeof ping.formatted === 'string' && ping.formatted.includes('Sasaran Ping'));
  console.log('  [PASS] 2.1: pingInternet returns real network metrics and persona text');

  const specs = await getSystemSpecs();
  assert.ok(specs.TotalRamGB > 0);
  assert.ok(specs.UsedRamGB > 0);
  assert.ok(specs.Cpu.length > 0);
  assert.ok(specs.DiskTotalGB > 0);
  assert.ok(typeof specs.formatted === 'string' && specs.formatted.includes('Prosesor (CPU)'));
  console.log('  [PASS] 2.2: getSystemSpecs returns ground-truth hardware specs and telemetry');

  const cmd = await executeTerminalCommand('Write-Output "SAWAKO_C2_ACTIVE"');
  assert.strictEqual(cmd.exitCode, 0);
  assert.ok(cmd.output.includes('SAWAKO_C2_ACTIVE'));
  assert.ok(cmd.formatted.includes('SAWAKO_C2_ACTIVE'));
  console.log('  [PASS] 2.3: executeTerminalCommand reliably executes commands and captures output');

  console.log('\n============================================================');
  console.log('  ALL SYSTEM TOOLS TESTS PASSED WITH 100% SUCCESS RATE');
  console.log('============================================================');
}

runTests().catch((err) => {
  console.error('\n[TEST_FAILURE]', err);
  process.exit(1);
});
