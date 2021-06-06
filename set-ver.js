const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const { version } = require('./package.json');
const filePath = resolve(__dirname, 'src/my-city.js');
let source = readFileSync(filePath, 'utf-8');
source = source.replace(/VERSION = '\d+\.\d+\.\d+'/, `VERSION = '${version}'`);
writeFileSync(filePath, source);
