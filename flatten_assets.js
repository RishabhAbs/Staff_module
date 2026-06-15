
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const oldJsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
const newJsDir = path.join(distDir, 'appjs');
const newAssetsDir = path.join(distDir, 'appassets');

if (!fs.existsSync(newJsDir)) fs.mkdirSync(newJsDir);
if (!fs.existsSync(newAssetsDir)) fs.mkdirSync(newAssetsDir);

// 1. Move JS files to appjs
if (fs.existsSync(oldJsDir)) {
  const files = fs.readdirSync(oldJsDir);
  files.forEach(file => {
    if (file.endsWith('.js')) {
      fs.renameSync(path.join(oldJsDir, file), path.join(newJsDir, file));
    }
  });
}

// 2. Flatten all assets into appassets
function flattenDir(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      flattenDir(fullPath);
    } else {
      // Move file to flat appassets folder
      fs.renameSync(fullPath, path.join(newAssetsDir, item));
    }
  });
}
const oldAssetsDir = path.join(distDir, 'assets');
flattenDir(oldAssetsDir);

// 3. Update index.html
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  let htmlContent = fs.readFileSync(indexHtml, 'utf8');
  htmlContent = htmlContent.replace(/\/_expo\/static\/js\/web\//g, '/appjs/');
  // Wait, does index.html reference assets? Maybe favicon?
  htmlContent = htmlContent.replace(/\/assets\/([^/"']+)/g, '/appassets/$1');
  fs.writeFileSync(indexHtml, htmlContent);
}

// 4. Update references in all JS files
const jsFiles = fs.readdirSync(newJsDir);
jsFiles.forEach(file => {
  if (file.endsWith('.js')) {
    const jsPath = path.join(newJsDir, file);
    let jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Replace JS path
    jsContent = jsContent.replace(/\/_expo\/static\/js\/web\//g, '/appjs/');
    
    // Replace nested asset paths (like /assets/node_modules/.../filename.ext)
    // We regex match /assets/ ... /filename.ext and replace with /appassets/filename.ext
    jsContent = jsContent.replace(/\/assets\/(?:[^"']+\/)+([^/"']+\.[a-zA-Z0-9]+)/g, '/appassets/$1');
    
    // Replace shallow asset paths (like /assets/abs-logo.png)
    jsContent = jsContent.replace(/\/assets\/([^/"']+\.[a-zA-Z0-9]+)/g, '/appassets/$1');

    fs.writeFileSync(jsPath, jsContent);
  }
});

// 5. Cleanup
fs.rmSync(path.join(distDir, '_expo'), { recursive: true, force: true });
if (fs.existsSync(oldAssetsDir)) {
  fs.rmSync(oldAssetsDir, { recursive: true, force: true });
}

console.log('Flattening complete!');

