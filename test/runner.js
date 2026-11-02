
'use strict';

const Mocha = require('mocha');
const fs = require('node:fs');
const path = require('node:path');

const mocha = new Mocha({
  bail: false,
  reporter: 'spec',
  timeout: 2000
});

const testFiles = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('Test.js'))
  .sort();

for (const file of testFiles) {
  mocha.addFile(path.join(__dirname, file));
}

mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});
