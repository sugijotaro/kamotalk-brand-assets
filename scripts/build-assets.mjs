#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { mkdtemp, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const svgDir = join(rootDir, "assets/logo/svg");
const pngDir = join(rootDir, "assets/logo/png");
const releaseDir = join(rootDir, "build/release");
const releaseAssetsDir = join(releaseDir, "kamotalk-brand-assets");

const pngExports = [
  {
    svg: "kamotalk-symbol.svg",
    png: "kamotalk-symbol.png",
    width: 475,
    height: 438,
  },
  {
    svg: "kamotalk-symbol-square.svg",
    png: "kamotalk-symbol-square.png",
    width: 1024,
    height: 1024,
  },
  {
    svg: "kamotalk-symbol-square.svg",
    png: "kamotalk-symbol-square-transparent.png",
    width: 1024,
    height: 1024,
    transparentBackground: true,
  },
  {
    svg: "kamotalk-logo-horizontal.svg",
    png: "kamotalk-logo-horizontal.png",
    width: 1116,
    height: 256,
  },
  {
    svg: "kamotalk-wordmark-stacked.svg",
    png: "kamotalk-wordmark-stacked.png",
    width: 494,
    height: 288,
  },
  {
    svg: "kamotalk-wordmark.svg",
    png: "kamotalk-wordmark.png",
    width: 845,
    height: 139,
  },
];

const releaseSvgFiles = [
  "kamotalk-logo-horizontal.svg",
  "kamotalk-symbol-square.svg",
  "kamotalk-symbol.svg",
  "kamotalk-wordmark-stacked.svg",
  "kamotalk-wordmark.svg",
];

const command = process.argv[2];

if (!["export-pngs", "release-package", "inline-svg"].includes(command)) {
  console.error("Usage: node scripts/build-assets.mjs <export-pngs|release-package|inline-svg>");
  process.exit(1);
}

if (command === "export-pngs") {
  await exportPngs();
}

if (command === "release-package") {
  await buildReleasePackage();
}

if (command === "inline-svg") {
  const input = process.argv[3];
  const output = process.argv[4];
  if (!input || !output) {
    console.error("Usage: node scripts/build-assets.mjs inline-svg <input.svg> <output.svg>");
    process.exit(1);
  }
  writeFileSync(resolve(output), inlineSvg(resolve(input)));
}

async function exportPngs() {
  mkdirSync(pngDir, { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "kamotalk-assets-"));

  try {
    for (const target of pngExports) {
      const tempSvg = join(tempDir, target.svg);
      let svg = inlineSvg(join(svgDir, target.svg));
      if (target.transparentBackground) {
        svg = removeSquareBackground(svg);
      }
      const tempPng = join(tempDir, target.png);
      const outputPng = join(pngDir, target.png);
      writeFileSync(tempSvg, svg);
      renderSvgToPng(tempSvg, tempPng, target.width, target.height);
      replacePngIfChanged(tempPng, outputPng);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function buildReleasePackage() {
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(join(releaseAssetsDir, "svg"), { recursive: true });
  mkdirSync(join(releaseAssetsDir, "png"), { recursive: true });

  for (const svgName of releaseSvgFiles) {
    writeFileSync(join(releaseAssetsDir, "svg", svgName), inlineSvg(join(svgDir, svgName)));
  }

  await exportPngs();

  for (const target of pngExports) {
    execFileSync("cp", [join(pngDir, target.png), join(releaseAssetsDir, "png", target.png)]);
  }

  writeFileSync(join(releaseAssetsDir, ".nojekyll"), "");
  writeFileSync(join(releaseAssetsDir, "index.html"), createIndexHtml(releaseSvgFiles));

  execFileSync("zip", ["-r", "kamotalk-brand-assets.zip", "kamotalk-brand-assets"], {
    cwd: releaseDir,
    stdio: "inherit",
  });
}

function createIndexHtml(svgFiles) {
  const pngFiles = pngExports.map((target) => target.png);
  const svgLinks = svgFiles.map((file) => assetLink("svg", file)).join("\n");
  const pngLinks = pngFiles.map((file) => assetLink("png", file)).join("\n");

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>KamoTalk Brand Assets</title>
    <style>
      body {
        margin: 40px;
        color: #14332c;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }

      main {
        max-width: 760px;
      }

      h1 {
        margin: 0 0 24px;
        font-size: 28px;
      }

      h2 {
        margin: 32px 0 12px;
        font-size: 18px;
      }

      ul {
        padding-left: 20px;
      }

      a {
        color: #1f7d69;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>KamoTalk Brand Assets</h1>
      <p>Release用に生成されたSVGとPNGです。SVG内の参照はすべてインライン展開済みです。</p>
      <h2>SVG</h2>
      <ul>
${svgLinks}
      </ul>
      <h2>PNG</h2>
      <ul>
${pngLinks}
      </ul>
    </main>
  </body>
</html>
`;
}

function assetLink(directory, file) {
  return `        <li><a href="${directory}/${file}">${file}</a></li>`;
}

async function listSvgFiles() {
  const files = await readdir(svgDir);
  return files.filter((file) => extname(file) === ".svg").sort();
}

function inlineSvg(file, seen = new Set()) {
  const absoluteFile = resolve(file);
  if (seen.has(absoluteFile)) {
    throw new Error(`Circular SVG reference detected: ${absoluteFile}`);
  }

  const nextSeen = new Set(seen).add(absoluteFile);
  let svg = readFileSync(absoluteFile, "utf8").replace(/<\?xml[^>]*>\s*/g, "");

  svg = svg.replace(/<image\b[^>]*\/?>(?:<\/image>)?/g, (imageTag) => {
    const imageAttrs = readAttrs(imageTag);
    const href = imageAttrs.href || imageAttrs["xlink:href"];

    if (!href || !href.endsWith(".svg")) {
      return imageTag;
    }

    const referencedFile = resolve(dirname(absoluteFile), href);
    const childSvg = inlineSvg(referencedFile, nextSeen);
    const childSvgTag = childSvg.match(/<svg\b[^>]*>/)?.[0];

    if (!childSvgTag) {
      throw new Error(`Referenced file is not an SVG: ${referencedFile}`);
    }

    const childAttrs = readAttrs(childSvgTag);
    const childBody = childSvg.replace(/^\s*<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const placement = createPlacement(imageAttrs, childAttrs, referencedFile);
    const attrs = [
      attr("id", imageAttrs.id),
      attr("data-name", imageAttrs["data-name"]),
      attr("transform", placement.transform),
    ].filter(Boolean);

    return `<g ${attrs.join(" ")}>${childBody}</g>`;
  });

  return svg;
}

function removeSquareBackground(svg) {
  return svg
    .replace(/\s*<g\b[^>]*id="base"[^>]*>[\s\S]*?<\/g>/, "")
    .replace(/\s*<rect\b[^>]*id="background"[^>]*\/>/, "");
}

function createPlacement(imageAttrs, childAttrs, referencedFile) {
  const viewBox = parseViewBox(childAttrs.viewBox, referencedFile);
  const x = parseNumber(imageAttrs.x, 0);
  const y = parseNumber(imageAttrs.y, 0);
  const width = parseNumber(imageAttrs.width, viewBox.width);
  const height = parseNumber(imageAttrs.height, viewBox.height);
  const scaleX = width / viewBox.width;
  const scaleY = height / viewBox.height;

  return {
    transform: [
      `translate(${formatNumber(x)} ${formatNumber(y)})`,
      `scale(${formatNumber(scaleX)} ${formatNumber(scaleY)})`,
      `translate(${formatNumber(-viewBox.x)} ${formatNumber(-viewBox.y)})`,
    ].join(" "),
  };
}

function parseViewBox(viewBox, referencedFile) {
  if (!viewBox) {
    throw new Error(`Referenced SVG has no viewBox: ${referencedFile}`);
  }

  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid viewBox in ${referencedFile}: ${viewBox}`);
  }

  const [x, y, width, height] = values;
  return { x, y, width, height };
}

function parseNumber(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  return Number.parseFloat(value.toFixed(8)).toString();
}

function readAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function attr(name, value) {
  return value == null || value === "" ? "" : `${name}="${escapeAttr(value)}"`;
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSvgToPng(svgFile, pngFile, width, height) {
  if (hasCommand("magick")) {
    execFileSync("magick", ["-background", "none", svgFile, "-resize", `${width}x${height}`, pngFile]);
    return;
  }

  if (hasCommand("convert")) {
    execFileSync("convert", ["-background", "none", svgFile, "-resize", `${width}x${height}`, pngFile]);
    return;
  }

  if (hasCommand("rsvg-convert")) {
    execFileSync("rsvg-convert", [
      "--format=png",
      `--width=${width}`,
      `--height=${height}`,
      "--keep-aspect-ratio",
      "--output",
      pngFile,
      svgFile,
    ]);
    return;
  }

  throw new Error("No SVG renderer found. Install librsvg2-bin or ImageMagick.");
}

function replacePngIfChanged(tempPng, outputPng) {
  if (existsSync(outputPng) && pngPixelsMatch(tempPng, outputPng)) {
    return;
  }

  renameSync(tempPng, outputPng);
}

function pngPixelsMatch(leftPng, rightPng) {
  if (hasCommand("compare")) {
    const result = spawnSync("compare", ["-metric", "AE", leftPng, rightPng, "null:"], {
      encoding: "utf8",
    });
    const metric = `${result.stdout || ""}${result.stderr || ""}`.trim();
    return result.status === 0 && (metric === "0" || metric === "0 (0)");
  }

  return readFileSync(leftPng).equals(readFileSync(rightPng));
}

function hasCommand(name) {
  try {
    execFileSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
