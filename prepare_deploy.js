const fs = require('fs');
const path = require('path');

const deployDir = path.join(__dirname, 'deploy_package');

// Helper to copy directory recursively
function copyDirSync(src, dest, exclude = []) {
  if (exclude.some(ex => src.endsWith(ex))) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (exclude.some(ex => entry.name === ex || srcPath.endsWith(ex))) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Clean and recreate deploy_package folder
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
fs.mkdirSync(deployDir);

// 2. Copy dist files (frontend)
copyDirSync(path.join(__dirname, 'dist', 'expo'), path.join(deployDir, 'expo'));
copyDirSync(path.join(__dirname, 'dist', 'assets'), path.join(deployDir, 'assets'));
fs.copyFileSync(path.join(__dirname, 'dist', 'index.html'), path.join(deployDir, 'index.html'));
fs.copyFileSync(path.join(__dirname, 'dist', 'metadata.json'), path.join(deployDir, 'metadata.json'));

// 3. Copy root .htaccess
fs.copyFileSync(path.join(__dirname, '.htaccess'), path.join(deployDir, '.htaccess'));

// 4. Copy backend folder (excluding node_modules)
copyDirSync(path.join(__dirname, 'backend'), path.join(deployDir, 'backend'), ['node_modules']);

console.log('Deployment package prepared in deploy_package/');
