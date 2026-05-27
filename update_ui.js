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
  if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/<div class="welcome-avatar">…<\/div>/g, '<div class="avatar avatar-56 av-purple">…</div>');
    content = content.replace(/<div class="avatar" style="width:32px;height:32px;font-size:0.75rem">…<\/div>/g, '<div class="avatar avatar-36 av-purple">…</div>');
    
    // JS Avatar replacements
    content = content.replace(/<div class="avatar">\$\{isTeam \? ownerInitial : esc\(ownerInitial\)\}<\/div>/g, '<div class="avatar avatar-36 av-purple">${isTeam ? ownerInitial : esc(ownerInitial)}</div>');
    content = content.replace(/<div class="avatar">\$\{esc\(firstLetter\(member\.name\)\)\}<\/div>/g, '<div class="avatar avatar-36 av-blue">${esc(firstLetter(member.name))}</div>');
    content = content.replace(/<div class="avatar">\$\{esc\(firstLetter\(item\.sender\?\.name\)\)\}<\/div>/g, '<div class="avatar avatar-36 av-amber">${esc(firstLetter(item.sender?.name))}</div>');
    content = content.replace(/<div class="avatar">\$\{esc\(firstLetter\(item\.receiver\?\.name\)\)\}<\/div>/g, '<div class="avatar avatar-36 av-pink">${esc(firstLetter(item.receiver?.name))}</div>');

    // Badges to tags
    content = content.replace(/class="badge badge-/g, 'class="tag tag-');
    content = content.replace(/class="badge"/g, 'class="tag"');
    content = content.replace(/class="badge /g, 'class="tag ');
    content = content.replace(/badge-fresh/g, 'tag-fresh');
    content = content.replace(/badge-computing/g, 'tag-serious');
    content = content.replace(/badge-partial/g, 'tag-portfolio');
    content = content.replace(/badge-needs-input/g, 'tag-default');

    // Remove badge-dot HTML completely since we don't need it or use it. We can just keep tag-dot if it stays.
    content = content.replace(/<span class="badge-dot"><\/span>/g, '');

    content = content.replace(/<div class="avatar" style="background: linear-gradient\(135deg,#f093fb,#f5576c\)">A<\/div>/g, '<div class="avatar avatar-36 av-pink">A</div>');
    content = content.replace(/class="mock-tag"/g, 'class="tag tag-default"');

    // Sidebar separators
    // Let's add a nav-sep before Profile, or maybe after dashboard?
    // "For sidebar, if there are distinct sections, separate with .nav-sep"
    // Let's replace "teams.html" sidebar link closing tag with `</a><div class="nav-sep"></div>`
    // Actually this is in multiple HTML files.
    content = content.replace(/(<a href="teams.html" class="sidebar-link[^>]*>[\s\S]*?<\/a>)\s*<a href="profile.html"/g, '$1\n      <div class="nav-sep"></div>\n      <a href="profile.html"');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
console.log('Done');
