import type { Algorithm, HashResult } from './hasher.js';
import type { VerifyResult } from './verifier.js';
import type { BatchEntry } from './batch.js';

// ANSI color codes
const C = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

export function formatHashResults(results: HashResult[], source: string, json: boolean): string {
  if (json) {
    return JSON.stringify({ source, hashes: results }, null, 2);
  }

  const lines = [`${C.bold}${C.cyan}Hashes for:${C.reset} ${source}`, ''];
  for (const r of results) {
    lines.push(`  ${C.bold}${r.algorithm.toUpperCase().padEnd(6)}${C.reset} ${r.hash}`);
  }
  return lines.join('\n');
}

export function formatSingleHash(algo: Algorithm, hash: string, source: string, json: boolean): string {
  if (json) {
    return JSON.stringify({ source, algorithm: algo, hash }, null, 2);
  }
  return `${C.bold}${C.cyan}${algo.toUpperCase()}${C.reset} ${hash}  ${C.dim}${source}${C.reset}`;
}

export function formatVerifyResult(result: VerifyResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const icon = result.match ? `${C.green}MATCH` : `${C.red}MISMATCH`;
  const lines = [
    `${C.bold}${icon}${C.reset}  ${result.file}`,
    `  ${C.dim}Algorithm: ${result.algorithm.toUpperCase()}${C.reset}`,
    `  ${C.dim}Expected:  ${result.expected}${C.reset}`,
    `  ${C.dim}Actual:    ${result.actual}${C.reset}`,
  ];
  return lines.join('\n');
}

export function formatCompareResult(
  file1: string, file2: string,
  hash1: string, hash2: string,
  match: boolean, algo: Algorithm,
  json: boolean
): string {
  if (json) {
    return JSON.stringify({ file1, file2, algorithm: algo, file1Hash: hash1, file2Hash: hash2, match }, null, 2);
  }

  const icon = match ? `${C.green}IDENTICAL` : `${C.red}DIFFERENT`;
  const lines = [
    `${C.bold}${icon}${C.reset}  ${C.dim}(${algo.toUpperCase()})${C.reset}`,
    `  ${file1}  ${C.dim}${hash1}${C.reset}`,
    `  ${file2}  ${C.dim}${hash2}${C.reset}`,
  ];
  return lines.join('\n');
}

export function formatBatchResults(entries: BatchEntry[], json: boolean): string {
  if (json) {
    return JSON.stringify({ files: entries }, null, 2);
  }

  const lines = [`${C.bold}${C.cyan}Batch hashes (${entries[0]?.algorithm.toUpperCase() ?? ''})${C.reset}`, ''];
  for (const e of entries) {
    lines.push(`  ${e.hash}  ${e.file}`);
  }
  lines.push('', `${C.dim}${entries.length} file(s) processed${C.reset}`);
  return lines.join('\n');
}

export function formatCheckResults(results: VerifyResult[], json: boolean): string {
  if (json) {
    return JSON.stringify({ results, summary: { total: results.length, passed: results.filter(r => r.match).length, failed: results.filter(r => !r.match).length } }, null, 2);
  }

  const lines: string[] = [];
  for (const r of results) {
    const icon = r.match ? `${C.green}OK${C.reset}` : `${C.red}FAIL${C.reset}`;
    lines.push(`  ${icon}  ${r.file}`);
  }

  const passed = results.filter(r => r.match).length;
  const failed = results.length - passed;
  lines.push('');
  if (failed === 0) {
    lines.push(`${C.green}${C.bold}All ${passed} file(s) verified successfully.${C.reset}`);
  } else {
    lines.push(`${C.red}${C.bold}${failed} of ${results.length} file(s) FAILED verification.${C.reset}`);
  }

  return lines.join('\n');
}

export function formatProgress(percent: number): void {
  const width = 30;
  const filled = Math.round(width * percent / 100);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  process.stderr.write(`\r  ${C.dim}[${bar}] ${percent}%${C.reset}`);
  if (percent >= 100) process.stderr.write('\n');
}
