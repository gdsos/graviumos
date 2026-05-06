import fs from 'fs';
import path from 'path';

const ROOT = './src'; // change if needed

function fixFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);

    // Force re-encode as UTF-8
    const text = buffer.toString('latin1'); // read as broken encoding
    const fixed = Buffer.from(text, 'latin1').toString('utf8');

    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log('Fixed:', filePath);
  } catch (err) {
    console.log('Skipped:', filePath);
  }
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(js|ts|tsx|jsx|json|html|css)$/.test(full)) {
      fixFile(full);
    }
  });
}

walk(ROOT);
console.log('Done.');