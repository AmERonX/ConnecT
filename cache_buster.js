const fs = require('fs');
const path = require('path');

const dir = 'c:\\Projects\\ConnecT\\frontend';
const version = Date.now();

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html')) {
    let filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/styles\/main\.css[^"']*/g, 'styles/main.css?v=' + version);
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
console.log('Cache bust applied to CSS references.');
