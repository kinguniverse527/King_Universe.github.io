import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const destination = process.argv[2] || path.resolve(here, '../vendor/editor-vendor.js');
const result = await build({
  entryPoints: [path.join(here, 'vendor-entry.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome100', 'firefox100', 'safari15'],
  outfile: destination,
  minify: true,
  legalComments: 'linked',
  metafile: true,
});

// 与实际打包内容一起保留依赖的版本与完整许可证，方便日后维护。
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  let directory = path.dirname(path.resolve(input));
  while (directory !== path.dirname(directory)) {
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
      if (manifest.name) {
        if (directory.includes('node_modules')) packages.set(manifest.name, { directory, manifest });
        break;
      }
    } catch { /* 有些目录不包含包清单；继续向上查找。 */ }
    directory = path.dirname(directory);
  }
}
const licenseDirectory = path.join(path.dirname(destination), 'licenses');
await fs.mkdir(licenseDirectory, { recursive: true });
const rows = [];
for (const { directory, manifest } of [...packages.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))) {
  const names = (await fs.readdir(directory)).filter(name => /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(name));
  if (!names.length) throw new Error('Missing license text: ' + manifest.name);
  const filename = manifest.name.replace(/[@/]/g, '_') + '.txt';
  const contents = await Promise.all(names.map(name => fs.readFile(path.join(directory, name), 'utf8')));
  await fs.writeFile(path.join(licenseDirectory, filename), manifest.name + ' ' + manifest.version + '\n\n' + contents.join('\n\n'));
  rows.push('| ' + manifest.name + ' | ' + manifest.version + ' | [' + (manifest.license || '见原文') + '](licenses/' + filename + ') |');
}
await fs.writeFile(path.join(path.dirname(destination), 'THIRD_PARTY.md'), '# 第三方模块\n\n这些模块已经打包在 editor-vendor.js 中，不需要运行时下载。许可证原文保存在 licenses/。\n\n| 模块 | 版本 | 许可证 |\n| --- | --- | --- |\n' + rows.join('\n') + '\n');
console.log('Built browser modules:', destination);
