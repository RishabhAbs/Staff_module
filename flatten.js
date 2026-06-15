
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'test_frontend');
const oldJsDir = path.join(root, 'expo', 'static', 'js', 'web');
const newJsDir = path.join(root, 'appjs');

if (!fs.existsSync(newJsDir)) fs.mkdirSync(newJsDir);

// 1. Move all files
const files = fs.readdirSync(oldJsDir);
files.forEach(file => {
  if (file.endsWith('.js')) {
    fs.renameSync(path.join(oldJsDir, file), path.join(newJsDir, file));
  }
});

// 2. Update index.html
const indexHtml = path.join(root, 'index.html');
let htmlContent = fs.readFileSync(indexHtml, 'utf8');
htmlContent = htmlContent.replace(/\/expo\/static\/js\/web\//g, '/appjs/');
fs.writeFileSync(indexHtml, htmlContent);

// 3. Update all JS files in newJsDir
files.forEach(file => {
  if (file.endsWith('.js')) {
    const jsPath = path.join(newJsDir, file);
    let jsContent = fs.readFileSync(jsPath, 'utf8');
    jsContent = jsContent.replace(/\/expo\/static\/js\/web\//g, '/appjs/');
    fs.writeFileSync(jsPath, jsContent);
  }
});

console.log('Flattening complete.');

