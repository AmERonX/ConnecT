const fs = require('fs');
const path = require('path');

const dir = 'c:\\Projects\\ConnecT\\frontend';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) walk(dirPath, callback);
    else callback(path.join(dir, f));
  });
}

walk(dir, function(filePath) {
  if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace old RGB with new RGB
    content = content.replace(/108,99,255/g, '79, 127, 255');
    content = content.replace(/108,\s*99,\s*255/g, '79, 127, 255');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed RGB in', filePath);
    }
  }
});
console.log('Done');
