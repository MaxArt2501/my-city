const { readdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const { version } = require('./package.json');
const files = readdirSync('src')
  .filter(filename => filename.endsWith('.js'))
  .map(filename => `src/${filename}`);
for (const file of files) {
  const filePath = resolve(__dirname, file);
  let source = readFileSync(filePath, 'utf-8');
  source = source.replace(/VERSION = '\d+\.\d+\.\d+'/, `VERSION = '${version}'`);
  writeFileSync(filePath, source);
}
