import fs from 'node:fs/promises';
import path from 'node:path';

import { transcodeSpz } from '@sparkjsdev/spark';

function printUsage() {
  console.log(`Usage: npm run splat:compress -- <input.ply> [options]

Options:
  --output <path>            Output .spz path. Defaults to next to the input file.
  --max-sh <0-3>             Maximum spherical harmonics degree. Default: auto.
  --fractional-bits <6-24>   Position precision. Default: 12.
  --filter-opacity <0-1>     Remove splats with opacity <= threshold.

Examples:
  npm run splat:compress -- ./assets/Intrabeam_GS.ply
  npm run splat:compress -- ./assets/Intrabeam_GS.ply --output ./assets/Intrabeam_GS.spz
  npm run splat:compress -- ./assets/Intrabeam_GS.ply --max-sh 1 --filter-opacity 0.01
`);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let inputPath = null;
  let outputPath = null;
  let maxSh = undefined;
  let fractionalBits = 12;
  let opacityThreshold = undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--') && inputPath === null) {
      inputPath = arg;
      continue;
    }

    if (arg === '--output') {
      outputPath = argv[++index];
      continue;
    }

    if (arg === '--max-sh') {
      const value = Number(argv[++index]);
      if (Number.isNaN(value) || value < 0 || value > 3) {
        throw new Error('Invalid value for --max-sh. Expected 0, 1, 2, or 3.');
      }
      maxSh = value;
      continue;
    }

    if (arg === '--fractional-bits') {
      const value = Number(argv[++index]);
      if (Number.isNaN(value) || value < 6 || value > 24) {
        throw new Error('Invalid value for --fractional-bits. Expected a number from 6 to 24.');
      }
      fractionalBits = value;
      continue;
    }

    if (arg === '--filter-opacity') {
      const value = Number(argv[++index]);
      if (Number.isNaN(value) || value < 0 || value > 1) {
        throw new Error('Invalid value for --filter-opacity. Expected a number from 0 to 1.');
      }
      opacityThreshold = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!inputPath) {
    throw new Error('No input file provided.');
  }

  return {
    inputPath,
    outputPath,
    maxSh,
    fractionalBits,
    opacityThreshold
  };
}

function defaultOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.spz`);
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function main() {
  const {
    inputPath,
    outputPath,
    maxSh,
    fractionalBits,
    opacityThreshold
  } = parseArgs(process.argv.slice(2));

  const resolvedInputPath = path.resolve(inputPath);
  const resolvedOutputPath = path.resolve(outputPath || defaultOutputPath(resolvedInputPath));

  const inputBytes = await fs.readFile(resolvedInputPath);
  console.log(`Reading ${resolvedInputPath} (${formatBytes(inputBytes.byteLength)})`);

  const transcode = await transcodeSpz({
    inputs: [
      {
        fileBytes: new Uint8Array(inputBytes),
        pathOrUrl: resolvedInputPath,
        transform: {
          translate: [0, 0, 0],
          quaternion: [0, 0, 0, 1],
          scale: 1
        }
      }
    ],
    maxSh,
    fractionalBits,
    opacityThreshold
  });

  await fs.writeFile(resolvedOutputPath, transcode.fileBytes);

  console.log(`Wrote ${resolvedOutputPath} (${formatBytes(transcode.fileBytes.byteLength)})`);

  if (transcode.clippedCount && transcode.clippedCount > 0) {
    console.log(`Clipped ${transcode.clippedCount} splats during compression.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});