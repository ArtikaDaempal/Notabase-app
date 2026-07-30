/**
 * tests/index.ts
 * Main Test Runner for Notabase Technical Risk Verification.
 *
 * Runs:
 * 1. RLS Multi-Tenant Isolation Test
 * 2. Offline Resilience (Airplane Mode) Test
 * 3. Image Upload Max 5MB & MIME Type Validation Test
 */

import { runRlsIsolationTests } from './rls-isolation.test'
import { runOfflineResilienceTests } from './offline-resilience.test'
import { runImageUploadLimitTests } from './image-upload-limit.test'

export async function runAllRiskTests() {
  console.log('===========================================================')
  console.log('🧪 RUNNING NOTABASE TECHNICAL RISK & ISOLATION SUITE')
  console.log('===========================================================')

  const rlsResult = await runRlsIsolationTests()
  console.log('\n--- 1. RLS MULTI-TENANT ISOLATION ---')
  rlsResult.details.forEach((d) => console.log(d))

  const offlineResult = await runOfflineResilienceTests()
  console.log('\n--- 2. OFFLINE RESILIENCE (AIRPLANE MODE) ---')
  offlineResult.details.forEach((d) => console.log(d))

  const uploadResult = await runImageUploadLimitTests()
  console.log('\n--- 3. IMAGE UPLOAD LIMIT (MAX 5MB & MIME TYPE) ---')
  uploadResult.details.forEach((d) => console.log(d))

  const allPassed = rlsResult.passed && offlineResult.passed && uploadResult.passed

  console.log('\n===========================================================')
  console.log(`OVERALL TEST STATUS: ${allPassed ? 'ALL PASSED ✅' : 'SOME TESTS FAILED ❌'}`)
  console.log('===========================================================')

  return allPassed
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('tests')) {
  runAllRiskTests().then((passed) => {
    process.exit(passed ? 0 : 1)
  })
}
