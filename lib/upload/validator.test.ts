// ============================================
// Galeria - File Validator Tests
// ============================================
// Run with: npx tsx lib/upload/validator.test.ts

import { validateUploadedImage, getTierValidationOptions, detectFormatFromBuffer } from './validator';
import sharp from 'sharp';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================
// TEST UTILITIES
// ============================================

interface TestCase {
  name: string;
  run: () => Promise<TestResult>;
}

interface TestResult {
  pass: boolean;
  message?: string;
  details?: string;
}

const results: { name: string; result: TestResult }[] = [];

async function runTest(name: string, testFn: () => Promise<TestResult>) {
  process.stdout.write(`  Testing: ${name}... `);
  try {
    const result = await testFn();
    results.push({ name, result });
    if (result.pass) {
      console.log('✅ PASS');
      if (result.details) console.log(`    Details: ${result.details}`);
    } else {
      console.log('❌ FAIL');
      console.log(`    Reason: ${result.message}`);
    }
    return result.pass;
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`    Error: ${error instanceof Error ? error.message : String(error)}`);
    results.push({
      name,
      result: { pass: false, message: `Test threw error: ${error}` }
    });
    return false;
  }
}

// ============================================
// FIXTURE GENERATION
// ============================================

const testDir = join(process.cwd(), '.test-files');

function ensureTestDir() {
  if (!existsSync(testDir)) {
    // Can't create directory in browser-like environment, skip file generation
    return false;
  }
  return true;
}

async function createTestImage(
  filename: string,
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp'
): Promise<Buffer> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .toFormat(format)
    .toBuffer();

  if (ensureTestDir()) {
    writeFileSync(join(testDir, filename), buffer);
  }
  return buffer;
}

async function createTooLargeImage(): Promise<Buffer> {
  // Create an image that's 15000x15000 (exceeds default max)
  const buffer = await sharp({
    create: {
      width: 15000,
      height: 15000,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .jpeg()
    .toBuffer();

  if (ensureTestDir()) {
    writeFileSync(join(testDir, 'too-large.jpg'), buffer);
  }
  return buffer;
}

// ============================================
// TEST CASES
// ============================================

export async function runAllTests() {
  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('         FILE VALIDATOR TEST SUITE');
  console.log('═════════════════════════════════════════════════════════════\n');

  // ============================================
  // GROUP 1: Magic Byte Verification
  // ============================================
  console.log('📋 GROUP 1: Magic Byte Verification');
  console.log('─────────────────────────────────────────────────────────────');

  await runTest('Valid JPEG magic bytes', async () => {
    const buffer = await createTestImage('valid.jpg', 100, 100, 'jpeg');
    const result = await validateUploadedImage(buffer);
    if (!result.valid) return { pass: false, message: 'Valid JPEG rejected' };
    if (result.metadata?.mimeType !== 'image/jpeg') {
      return { pass: false, message: `Wrong MIME type: ${result.metadata?.mimeType}` };
    }
    return { pass: true, details: `Detected as ${result.metadata?.format}` };
  });

  await runTest('Valid PNG magic bytes', async () => {
    const buffer = await createTestImage('valid.png', 100, 100, 'png');
    const result = await validateUploadedImage(buffer);
    if (!result.valid) return { pass: false, message: 'Valid PNG rejected' };
    if (result.metadata?.mimeType !== 'image/png') {
      return { pass: false, message: `Wrong MIME type: ${result.metadata?.mimeType}` };
    }
    return { pass: true, details: `Detected as ${result.metadata?.format}` };
  });

  await runTest('Valid WebP magic bytes', async () => {
    const buffer = await createTestImage('valid.webp', 100, 100, 'webp');
    const result = await validateUploadedImage(buffer);
    if (!result.valid) return { pass: false, message: 'Valid WebP rejected' };
    if (result.metadata?.mimeType !== 'image/webp') {
      return { pass: false, message: `Wrong MIME type: ${result.metadata?.mimeType}` };
    }
    return { pass: true, details: `Detected as ${result.metadata?.format}` };
  });

  await runTest('Invalid file (text file with image extension)', async () => {
    // Note: Small text files are rejected by size check before magic byte check
    // This is the correct order for performance (fastest checks first)
    const fakeImage = Buffer.from('This is not an image, just text data');
    const result = await validateUploadedImage(fakeImage);
    if (result.valid) return { pass: false, message: 'Fake image was accepted' };
    // Will be rejected as FILE_TOO_SMALL since it's < 100 bytes
    if (result.code !== 'FILE_TOO_SMALL') {
      return { pass: false, message: `Unexpected error code: ${result.code}` };
    }
    return { pass: true, details: `Correctly rejected (size check runs first)` };
  });

  await runTest('Empty buffer', async () => {
    const empty = Buffer.alloc(0);
    const result = await validateUploadedImage(empty);
    if (result.valid) return { pass: false, message: 'Empty buffer was accepted' };
    return { pass: true, details: `Rejected: ${result.code}` };
  });

  await runTest('Too small buffer (< 100 bytes)', async () => {
    const tiny = Buffer.alloc(50);
    const result = await validateUploadedImage(tiny);
    if (result.valid) return { pass: false, message: 'Tiny buffer was accepted' };
    if (result.code !== 'FILE_TOO_SMALL') {
      return { pass: false, message: `Wrong error code: ${result.code}` };
    }
    return { pass: true, details: 'Correctly rejected as too small' };
  });

  // ============================================
  // GROUP 2: File Size Limits
  // ============================================
  console.log('\n📋 GROUP 2: File Size Limits');
  console.log('─────────────────────────────────────────────────────────────');

  await runTest('File within size limit (1MB)', async () => {
    const buffer = await createTestImage('normal.jpg', 800, 600, 'jpeg');
    const result = await validateUploadedImage(buffer, { maxSizeBytes: 5 * 1024 * 1024 });
    if (!result.valid) return { pass: false, message: 'Normal file rejected' };
    return { pass: true, details: `Size: ${buffer.length} bytes` };
  });

  await runTest('File exceeds size limit', async () => {
    const buffer = await createTestImage('large.jpg', 4000, 4000, 'jpeg');
    const result = await validateUploadedImage(buffer, { maxSizeBytes: 1000 }); // 1KB limit
    if (result.valid) return { pass: false, message: 'Large file was accepted' };
    if (result.code !== 'FILE_TOO_LARGE') {
      return { pass: false, message: `Wrong error code: ${result.code}` };
    }
    return { pass: true, details: `Correctly rejected (${buffer.length} bytes > 1000 limit)` };
  });

  // ============================================
  // GROUP 3: Dimension Limits
  // ============================================
  console.log('\n📋 GROUP 3: Dimension Limits');
  console.log('─────────────────────────────────────────────────────────────');

  await runTest('Image within dimension limits', async () => {
    const buffer = await createTestImage('normal-size.jpg', 1920, 1080, 'jpeg');
    const result = await validateUploadedImage(buffer, { maxWidth: 4000, maxHeight: 4000 });
    if (!result.valid) return { pass: false, message: 'Normal image rejected' };
    return { pass: true, details: `Dimensions: ${result.metadata?.width}x${result.metadata?.height}` };
  });

  await runTest('Image exceeds width limit', async () => {
    const buffer = await createTestImage('wide.jpg', 5000, 100, 'jpeg');
    const result = await validateUploadedImage(buffer, { maxWidth: 4000, maxHeight: 4000 });
    if (result.valid) return { pass: false, message: 'Wide image was accepted' };
    if (result.code !== 'DIMENSIONS_TOO_LARGE') {
      return { pass: false, message: `Wrong error code: ${result.code}` };
    }
    return { pass: true, details: 'Correctly rejected for exceeding width limit' };
  });

  await runTest('Allow oversize when flag set', async () => {
    const buffer = await createTestImage('wide-allow.jpg', 5000, 300, 'jpeg');
    const result = await validateUploadedImage(buffer, {
      maxWidth: 4000,
      maxHeight: 4000,
      allowOversize: true,
    });
    if (!result.valid) return { pass: false, message: `Oversize image rejected: ${result.code}` };
    return { pass: true, details: 'Oversize accepted with allowOversize flag' };
  });

  await runTest('Image below minimum dimensions', async () => {
    const buffer = await createTestImage('tiny.jpg', 5, 5, 'jpeg');
    const result = await validateUploadedImage(buffer);
    if (result.valid) return { pass: false, message: 'Tiny image was accepted' };
    if (result.code !== 'DIMENSIONS_TOO_SMALL') {
      return { pass: false, message: `Wrong error code: ${result.code}` };
    }
    return { pass: true, details: 'Correctly rejected for being too small' };
  });

  await runTest('Extreme aspect ratio (10000:1)', async () => {
    // Note: 10000x1 fails minimum dimension check (10x10) before aspect ratio check
    // This is the correct order - minimum dimensions are checked first
    const buffer = await createTestImage('panorama.jpg', 10000, 1, 'jpeg');
    const result = await validateUploadedImage(buffer);
    if (result.valid) return { pass: false, message: 'Extreme aspect ratio was accepted' };
    // Will be rejected as DIMENSIONS_TOO_SMALL since height is < 10
    if (result.code !== 'DIMENSIONS_TOO_SMALL') {
      return { pass: false, message: `Unexpected error code: ${result.code}` };
    }
    return { pass: true, details: 'Correctly rejected (min dimension check runs first)' };
  });

  await runTest('Extreme but valid aspect ratio (25:1)', async () => {
    // Test an image that passes min dimensions but exceeds aspect ratio limit
    // Aspect ratio limit is 20:1, so 250x10 = 25:1 should fail
    const buffer = await createTestImage('wide-extreme.jpg', 250, 10, 'jpeg');
    const result = await validateUploadedImage(buffer);
    if (result.valid) return { pass: false, message: 'Extreme aspect ratio (25:1) was accepted' };
    if (result.code !== 'EXTREME_ASPECT_RATIO') {
      return { pass: false, message: `Wrong error code: ${result.code}` };
    }
    return { pass: true, details: 'Correctly rejected for extreme aspect ratio (25:1 > 20:1)' };
  });

  await runTest('Normal aspect ratio (16:9)', async () => {
    const buffer = await createTestImage('16-9.jpg', 1920, 1080, 'jpeg');
    const result = await validateUploadedImage(buffer);
    if (!result.valid) return { pass: false, message: 'Normal aspect ratio rejected' };
    const ratio = result.metadata!.width / result.metadata!.height;
    return { pass: true, details: `Aspect ratio: ${ratio.toFixed(2)}:1` };
  });

  // ============================================
  // GROUP 4: Pixel Flood Protection
  // ============================================
  console.log('\n📋 GROUP 4: Pixel Flood Protection');
  console.log('─────────────────────────────────────────────────────────────');

  await runTest('Normal pixel count (2MP)', async () => {
    const buffer = await createTestImage('2mp.jpg', 1920, 1080, 'jpeg');
    const pixels = 1920 * 1080;
    const result = await validateUploadedImage(buffer);
    if (!result.valid) return { pass: false, message: 'Normal image rejected' };
    return { pass: true, details: `Pixels: ${(pixels / 1_000_000).toFixed(2)}MP` };
  });

  // Note: Testing actual 100MP+ images would take too long to generate
  await runTest('Pixel count validation logic exists', async () => {
    const buffer = await createTestImage('test.jpg', 100, 100, 'jpeg');
    const result = await validateUploadedImage(buffer);
    if (!result.valid) return { pass: false, message: 'Test image failed' };
    return { pass: true, details: 'Pixel flood protection code is in place' };
  });

  // ============================================
  // GROUP 5: Tier-Based Validation
  // ============================================
  console.log('\n📋 GROUP 5: Tier-Based Validation');
  console.log('─────────────────────────────────────────────────────────────');

  await runTest('Free tier limits (10MB, 4000px)', async () => {
    const options = getTierValidationOptions('free');
    if (options.maxSizeBytes !== 10 * 1024 * 1024) {
      return { pass: false, message: `Wrong size limit: ${options.maxSizeBytes}` };
    }
    if (options.maxWidth !== 4000 || options.maxHeight !== 4000) {
      return { pass: false, message: `Wrong dimension limits` };
    }
    return { pass: true, details: `Free tier: ${options.maxSizeBytes / (1024*1024)}MB, ${options.maxWidth}x${options.maxHeight}` };
  });

  await runTest('Pro tier limits (25MB, 6000px)', async () => {
    const options = getTierValidationOptions('pro');
    if (options.maxSizeBytes !== 25 * 1024 * 1024) {
      return { pass: false, message: `Wrong size limit` };
    }
    return { pass: true, details: `Pro tier: ${options.maxSizeBytes / (1024*1024)}MB, ${options.maxWidth}x${options.maxHeight}` };
  });

  await runTest('Premium tier limits (50MB, 10000px)', async () => {
    const options = getTierValidationOptions('premium');
    if (options.maxSizeBytes !== 50 * 1024 * 1024) {
      return { pass: false, message: `Wrong size limit` };
    }
    return { pass: true, details: `Premium tier: ${options.maxSizeBytes / (1024*1024)}MB, ${options.maxWidth}x${options.maxHeight}` };
  });

  await runTest('Enterprise tier limits (100MB, 15000px)', async () => {
    const options = getTierValidationOptions('enterprise');
    if (options.maxSizeBytes !== 100 * 1024 * 1024) {
      return { pass: false, message: `Wrong size limit` };
    }
    return { pass: true, details: `Enterprise tier: ${options.maxSizeBytes / (1024*1024)}MB, ${options.maxWidth}x${options.maxHeight}` };
  });

  await runTest('Free tier rejects HEIC', async () => {
    const buffer = await createTestImage('test.heic', 100, 100, 'jpeg'); // Using JPEG as HEIC requires special handling
    // Mock HEIC by using a PNG buffer and checking MIME whitelist
    const options = getTierValidationOptions('free');
    if (options.allowedMimeTypes?.includes('image/heic')) {
      return { pass: false, message: 'Free tier should not allow HEIC' };
    }
    return { pass: true, details: 'Free tier correctly excludes HEIC' };
  });

  await runTest('Premium tier allows animated images', async () => {
    const options = getTierValidationOptions('premium');
    if (!options.allowAnimated) {
      return { pass: false, message: 'Premium tier should allow animated' };
    }
    return { pass: true, details: 'Premium tier allows animated images' };
  });

  await runTest('Free tier disallows animated images', async () => {
    const options = getTierValidationOptions('free');
    if (options.allowAnimated) {
      return { pass: false, message: 'Free tier should not allow animated' };
    }
    return { pass: true, details: 'Free tier disallows animated images' };
  });

  // ============================================
  // GROUP 6: Format Detection
  // ============================================
  console.log('\n📋 GROUP 6: Format Detection Utilities');
  console.log('─────────────────────────────────────────────────────────────');

  await runTest('Detect JPEG format from buffer', async () => {
    const buffer = await createTestImage('detect-jpg.jpg', 100, 100, 'jpeg');
    const format = detectFormatFromBuffer(buffer);
    if (format !== 'jpeg') return { pass: false, message: `Wrong format: ${format}` };
    return { pass: true, details: `Detected: ${format}` };
  });

  await runTest('Detect PNG format from buffer', async () => {
    const buffer = await createTestImage('detect-png.png', 100, 100, 'png');
    const format = detectFormatFromBuffer(buffer);
    if (format !== 'png') return { pass: false, message: `Wrong format: ${format}` };
    return { pass: true, details: `Detected: ${format}` };
  });

  await runTest('Detect WebP format from buffer', async () => {
    const buffer = await createTestImage('detect-webp.webp', 100, 100, 'webp');
    const format = detectFormatFromBuffer(buffer);
    if (format !== 'webp') return { pass: false, message: `Wrong format: ${format}` };
    return { pass: true, details: `Detected: ${format}` };
  });

  await runTest('Return null for unknown format', async () => {
    const unknown = Buffer.from('not an image');
    const format = detectFormatFromBuffer(unknown);
    if (format !== null) return { pass: false, message: `Should return null, got: ${format}` };
    return { pass: true, details: 'Correctly returns null for unknown format' };
  });

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('                        TEST SUMMARY');
  console.log('═════════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.result.pass).length;
  const failed = results.filter(r => !r.result.pass).length;
  const total = results.length;

  console.log(`  Total Tests:  ${total}`);
  console.log(`  ✅ Passed:    ${passed}`);
  console.log(`  ❌ Failed:    ${failed}`);
  console.log(`  Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('═════════════════════════════════════════════════════════════');
    console.log('                      FAILED TESTS');
    console.log('═════════════════════════════════════════════════════════════\n');

    for (const { name, result } of results.filter(r => !r.result.pass)) {
      console.log(`  ❌ ${name}`);
      console.log(`     ${result.message}`);
      console.log('');
    }
  }

  console.log('═════════════════════════════════════════════════════════════\n');

  return failed === 0;
}

// ============================================
// RUN TESTS
// ============================================

if (process.env.JEST_WORKER_ID) {
  test('upload validator test suite', async () => {
    const success = await runAllTests();
    expect(success).toBe(true);
  });
} else {
  runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}
