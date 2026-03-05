/**
 * dedup.ts — Asset deduplication utilities.
 *
 * L2: Package fingerprint dedup (SHA256 hash of entire package file)
 * L3: Core file content similarity detection (Jaccard trigram similarity)
 */
import crypto from 'crypto';
import { getDb } from './db/connection';

// ════════════════════════════════════════════
// L2 — Package SHA256 fingerprint dedup
// ════════════════════════════════════════════

/**
 * Compute SHA256 hash of an entire package buffer.
 */
export function computePackageSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Find an existing asset with the same package SHA256 hash.
 * Excludes assets owned by the same author with the same asset name (self-update scenario).
 *
 * @param sha256 - SHA256 hash to check
 * @param excludeAuthorAssetId - If provided, excludes assets with this exact id (for update scenarios)
 * @returns Duplicate asset info or null
 */
export function findDuplicateByHash(
  sha256: string,
  excludeAuthorAssetId?: string,
): { assetId: string; assetName: string; authorName: string } | null {
  if (!sha256) return null;

  const db = getDb();
  let row: { id: string; name: string; author_name: string } | undefined;

  if (excludeAuthorAssetId) {
    row = db.prepare(
      `SELECT id, name, author_name FROM assets WHERE package_sha256 = ? AND id != ? LIMIT 1`
    ).get(sha256, excludeAuthorAssetId) as typeof row;
  } else {
    row = db.prepare(
      `SELECT id, name, author_name FROM assets WHERE package_sha256 = ? LIMIT 1`
    ).get(sha256) as typeof row;
  }

  if (!row) return null;
  return { assetId: row.id, assetName: row.name, authorName: row.author_name };
}

// ════════════════════════════════════════════
// L3 — Text similarity (Jaccard trigram)
// ════════════════════════════════════════════

/**
 * Generate trigram set from text.
 * Normalizes: lowercase, collapse whitespace.
 */
function trigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    grams.add(normalized.substring(i, i + 3));
  }
  return grams;
}

/**
 * Compute Jaccard similarity between two trigram sets.
 * Returns value in [0, 1] where 1 = identical.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersectionSize = 0;
  // Iterate over the smaller set for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const gram of smaller) {
    if (larger.has(gram)) intersectionSize++;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Compute text similarity between two strings using Jaccard trigram similarity.
 * @returns Similarity score in [0, 1]
 */
export function computeTextSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;
  const gramsA = trigrams(textA);
  const gramsB = trigrams(textB);
  return jaccardSimilarity(gramsA, gramsB);
}

/**
 * Find existing assets of the same type with similar readme content.
 * Uses length-difference pre-filtering for performance (skip if length diff > 50%).
 *
 * @param type - Asset type to filter by
 * @param readme - The readme text to compare against
 * @param excludeAssetId - Asset ID to exclude (for update scenarios)
 * @returns Array of similar assets with similarity > 0.8
 */
export function findSimilarAssets(
  type: string,
  readme: string,
  excludeAssetId?: string,
): Array<{ assetId: string; assetName: string; authorName: string; similarity: number }> {
  if (!readme || readme.trim().length < 10) return [];

  const db = getDb();

  // Only fetch id, name, author_name, readme for same-type assets with non-empty readme
  let rows: { id: string; name: string; author_name: string; readme: string }[];
  if (excludeAssetId) {
    rows = db.prepare(
      `SELECT id, name, author_name, readme FROM assets WHERE type = ? AND readme != '' AND id != ?`
    ).all(type, excludeAssetId) as typeof rows;
  } else {
    rows = db.prepare(
      `SELECT id, name, author_name, readme FROM assets WHERE type = ? AND readme != ''`
    ).all(type) as typeof rows;
  }

  const inputLen = readme.length;
  const inputTrigrams = trigrams(readme);
  const results: Array<{ assetId: string; assetName: string; authorName: string; similarity: number }> = [];

  for (const row of rows) {
    // Performance optimization: skip if text length difference > 50%
    const existingLen = row.readme.length;
    if (existingLen > 0) {
      const ratio = Math.min(inputLen, existingLen) / Math.max(inputLen, existingLen);
      if (ratio < 0.5) continue; // length diff too large, skip
    }

    const sim = jaccardSimilarity(inputTrigrams, trigrams(row.readme));
    if (sim > 0.8) {
      results.push({
        assetId: row.id,
        assetName: row.name,
        authorName: row.author_name,
        similarity: Math.round(sim * 1000) / 1000, // round to 3 decimal places
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  return results;
}
