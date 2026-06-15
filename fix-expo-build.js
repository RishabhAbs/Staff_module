const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const oldExpoDir = path.join(distDir, '_expo');
const newExpoDir = path.join(distDir, 'expo');

// Helper to list all files/folders recursively
function getAllPaths(dirPath, list) {
  list = list || [];
  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    list.push(fullPath);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllPaths(fullPath, list);
    }
  });
  return list;
}

// 1. Rename _expo directory to expo
if (fs.existsSync(oldExpoDir)) {
  fs.renameSync(oldExpoDir, newExpoDir);
  console.log('Renamed _expo to expo');
}

// 2. Identify and rename restricted folders: node_modules -> appmodules, vendor -> appvendor
// We do this by traversing the dist directory and renaming matching directories.
function renameRestrictedDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (item === 'node_modules') {
        const newPath = path.join(dirPath, 'appmodules');
        fs.renameSync(fullPath, newPath);
        console.log(`Renamed directory: ${fullPath} -> ${newPath}`);
        renameRestrictedDirectories(newPath);
      } else if (item === 'vendor') {
        const newPath = path.join(dirPath, 'appvendor');
        fs.renameSync(fullPath, newPath);
        console.log(`Renamed directory: ${fullPath} -> ${newPath}`);
        renameRestrictedDirectories(newPath);
      } else {
        renameRestrictedDirectories(fullPath);
      }
    }
  });
}
renameRestrictedDirectories(distDir);

// 3. Rename any files starting with "__" to start with "ex_"
const renameMap = {}; // { originalBasename: newBasename }
const allPaths = getAllPaths(distDir);
const filesToRename = allPaths.filter(f => fs.existsSync(f) && !fs.statSync(f).isDirectory() && path.basename(f).startsWith('__'));

filesToRename.forEach(f => {
  const originalBasename = path.basename(f);
  const newBasename = originalBasename.replace(/^__/, 'ex_');
  const newPath = path.join(path.dirname(f), newBasename);
  
  fs.renameSync(f, newPath);
  renameMap[originalBasename] = newBasename;
  console.log(`Renamed file: ${originalBasename} -> ${newBasename}`);
});

// 4. Update all file references in all HTML, JS, JSON files
const allPathsUpdated = getAllPaths(distDir);
const textFiles = allPathsUpdated.filter(f => fs.existsSync(f) && !fs.statSync(f).isDirectory() && (f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.json')));

textFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replaces
  content = content.replace(/\/_expo\//g, '/expo/');
  content = content.replace(/\/node_modules\//g, '/appmodules/');
  content = content.replace(/\/vendor\//g, '/appvendor/');
  
  // Replace dynamic __ file names
  Object.keys(renameMap).forEach(orig => {
    const replacement = renameMap[orig];
    
    // Replace with extension
    const escapedOrigWithExt = orig.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexWithExt = new RegExp(escapedOrigWithExt, 'g');
    content = content.replace(regexWithExt, replacement);
    
    // Replace without extension (just in case they are imported as module paths)
    const origNoExt = orig.replace(/\.[^/.]+$/, "");
    const replNoExt = replacement.replace(/\.[^/.]+$/, "");
    const escapedOrigNoExt = origNoExt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexNoExt = new RegExp(escapedOrigNoExt, 'g');
    content = content.replace(regexNoExt, replNoExt);
  });
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated references in: ${path.relative(distDir, file)}`);
  }
});

console.log('cPanel build fix complete!');
