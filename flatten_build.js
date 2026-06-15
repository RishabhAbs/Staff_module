
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const oldJsDir = path.join(distDir, '_expo', 'static', 'js', 'web'); // Expo outputs _expo
const newJsDir = path.join(distDir, 'appjs');

// 1. Move JS files to appjs
if (!fs.existsSync(newJsDir)) fs.mkdirSync(newJsDir);
if (fs.existsSync(oldJsDir)) {
  const files = fs.readdirSync(oldJsDir);
  files.forEach(file => {
    if (file.endsWith('.js')) {
      fs.renameSync(path.join(oldJsDir, file), path.join(newJsDir, file));
    }
  });
}

// 2. Update index.html
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  let htmlContent = fs.readFileSync(indexHtml, 'utf8');
  htmlContent = htmlContent.replace(/\/_expo\/static\/js\/web\//g, '/appjs/');
  fs.writeFileSync(indexHtml, htmlContent);
}

// 3. Rename forbidden directories recursively
function renameForbidden(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (item === 'node_modules') {
        const newPath = path.join(dir, 'appmodules');
        fs.renameSync(fullPath, newPath);
        renameForbidden(newPath);
      } else if (item === 'vendor') {
        const newPath = path.join(dir, 'appvendor');
        fs.renameSync(fullPath, newPath);
        renameForbidden(newPath);
      } else {
        renameForbidden(fullPath);
      }
    }
  });
}
renameForbidden(path.join(distDir, 'assets'));

// 4. Update references in all JS files
const jsFiles = fs.readdirSync(newJsDir);
jsFiles.forEach(file => {
  if (file.endsWith('.js')) {
    const jsPath = path.join(newJsDir, file);
    let jsContent = fs.readFileSync(jsPath, 'utf8');
    jsContent = jsContent.replace(/\/_expo\/static\/js\/web\//g, '/appjs/');
    jsContent = jsContent.replace(/\/node_modules\//g, '/appmodules/');
    jsContent = jsContent.replace(/\/vendor\//g, '/appvendor/');
    fs.writeFileSync(jsPath, jsContent);
  }
});

// Remove _expo folder
fs.rmSync(path.join(distDir, '_expo'), { recursive: true, force: true });

console.log('Build flattened successfully!');

