import * as fs from 'fs';
import * as path from 'path';

const modelsDir = path.resolve(__dirname);
const files = fs.readdirSync(modelsDir).filter(file => file.endsWith('.ts') && file !== 'index.ts');

const exports__ = {};

files.forEach(file => {
  const module = require(path.join(modelsDir, file));
  Object.assign(exports__, module);
});

export default exports__;
