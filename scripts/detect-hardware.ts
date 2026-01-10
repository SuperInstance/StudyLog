#!/usr/bin/env npx tsx
/**
 * StudyLoG.AI - Hardware Detection CLI
 *
 * Usage: npx tsx scripts/detect-hardware.ts
 */

import { detectHardware, formatProfile } from '../packages/hardware';

async function main() {
  console.log('Detecting hardware...\n');

  try {
    const profile = await detectHardware();
    console.log(formatProfile(profile));

    // Output JSON if requested
    if (process.argv.includes('--json')) {
      console.log('\n--- JSON Output ---');
      console.log(JSON.stringify(profile, null, 2));
    }

    // Exit with appropriate code
    process.exit(profile.capabilities.canRunOllama ? 0 : 1);
  } catch (error) {
    console.error('Detection failed:', error);
    process.exit(2);
  }
}

main();
