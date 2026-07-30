/**
 * tests/image-upload-limit.test.ts
 * Unit Test: Validasi Ukuran File Upload Gambar Nota (Maksimal 5MB) dan MIME Type
 *
 * Dokumen acuan:
 *   05-risk-testing-checklist.md — Prioritas 5 (§87: Validasi ukuran file upload max 5MB)
 *   03-business-rules.md — §2 (BR-OCR-01: Format file JPG/PNG/WEBP, maksimal 5MB)
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB (5,242,880 bytes)
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Fungsi pembantu validasi file upload nota (Client-side & Storage Policy validator)
 */
export function validateReceiptImageFile(file: { size: number; type: string; name: string }): ValidationResult {
  // 1. Validasi Tipe File MIME
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Tipe file '${file.type}' tidak didukung. Harap upload gambar berformat JPG, PNG, atau WEBP.`,
    }
  }

  // 2. Validasi Ukuran File (Maksimal 5MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      error: `Ukuran file (${sizeInMB} MB) melebihi batas maksimal 5MB. Harap gunakan gambar yang lebih kecil.`,
    }
  }

  return { valid: true }
}

export async function runImageUploadLimitTests(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = []
  let passed = true

  try {
    // ── Test 1: File Gambar Valid 2.5MB JPEG ──
    const validFileJpeg = {
      name: 'nota_struk_2.5mb.jpg',
      size: 2.5 * 1024 * 1024, // 2.5MB
      type: 'image/jpeg',
    }

    const res1 = validateReceiptImageFile(validFileJpeg)
    if (res1.valid) {
      details.push('✅ [TEST 1 PASSED] File JPG 2.5MB (< 5MB) BERHASIL diterima oleh sistem.')
    } else {
      passed = false
      details.push(`❌ [TEST 1 FAILED] File valid 2.5MB ditolak: ${res1.error}`)
    }

    // ── Test 2: File Gambar Valid 4.9MB PNG ──
    const validFilePng = {
      name: 'nota_struk_4.9mb.png',
      size: 4.9 * 1024 * 1024, // 4.9MB
      type: 'image/png',
    }

    const res2 = validateReceiptImageFile(validFilePng)
    if (res2.valid) {
      details.push('✅ [TEST 2 PASSED] File PNG 4.9MB (< 5MB) BERHASIL diterima oleh sistem.')
    } else {
      passed = false
      details.push(`❌ [TEST 2 FAILED] File valid 4.9MB ditolak: ${res2.error}`)
    }

    // ── Test 3: File Terlalu Besar (6.5MB JPEG) — Harus Ditolak ──
    const oversizedFile = {
      name: 'nota_besar_6.5mb.jpg',
      size: 6.5 * 1024 * 1024, // 6.5MB
      type: 'image/jpeg',
    }

    const res3 = validateReceiptImageFile(oversizedFile)
    if (!res3.valid && res3.error?.includes('melebihi batas maksimal 5MB')) {
      details.push(`✅ [TEST 3 PASSED] FILE SIZE LIMIT ENFORCED: File 6.5MB (> 5MB) BERHASIL DITOLAK dengan pesan error yang jelas.`)
    } else {
      passed = false
      details.push('❌ [TEST 3 FAILED] Sistem kecolongan menerima file > 5MB!')
    }

    // ── Test 4: File Ekstensi/Tipe Terlarang (PDF 1.2MB) — Harus Ditolak ──
    const invalidTypeFile = {
      name: 'dokumen.pdf',
      size: 1.2 * 1024 * 1024,
      type: 'application/pdf',
    }

    const res4 = validateReceiptImageFile(invalidTypeFile)
    if (!res4.valid && res4.error?.includes('tidak didukung')) {
      details.push('✅ [TEST 4 PASSED] MIME TYPE FILTER ENFORCED: File PDF BERHASIL DITOLAK.')
    } else {
      passed = false
      details.push('❌ [TEST 4 FAILED] File non-image (PDF) tidak ditolak oleh validator!')
    }

  } catch (err: any) {
    passed = false
    details.push(`❌ [TEST EXCEPTION] Exception during Image Upload test: ${err.message}`)
  }

  return { passed, details }
}

// Runnable entry point for standalone node execution
if (typeof process !== 'undefined' && process.argv[1]?.includes('image-upload-limit')) {
  runImageUploadLimitTests().then((res) => {
    console.log('\n=== NOTABASE RISK TEST: IMAGE UPLOAD LIMIT (MAX 5MB) ===')
    res.details.forEach((d) => console.log(d))
    console.log(`\nFINAL STATUS: ${res.passed ? 'PASSED ✅' : 'FAILED ❌'}\n`)
    process.exit(res.passed ? 0 : 1)
  })
}
