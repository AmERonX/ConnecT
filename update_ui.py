import os
import glob
import re

frontend_dir = r"c:\Projects\ConnecT\frontend"

# We need to replace inline avatar styles with .avatar-X .av-Y
avatar_colors = ['av-blue', 'av-purple', 'av-green', 'av-amber', 'av-pink']

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Update HTML Avatars
    # Dashboard: welcome-avatar
    content = content.replace('<div class="welcome-avatar">…</div>', '<div class="avatar avatar-56 av-purple">…</div>')
    # Topbar avatar
    content = content.replace('<div class="avatar" style="width:32px;height:32px;font-size:0.75rem">…</div>', '<div class="avatar avatar-36 av-purple">…</div>')
    
    # 2. Update JS Avatars
    # browse.js
    content = content.replace('<div class="avatar">${isTeam ? ownerInitial : esc(ownerInitial)}</div>', '<div class="avatar avatar-36 av-purple">${isTeam ? ownerInitial : esc(ownerInitial)}</div>')
    # teams.js
    content = content.replace('<div class="avatar">${esc(firstLetter(member.name))}</div>', '<div class="avatar avatar-36 av-blue">${esc(firstLetter(member.name))}</div>')
    content = content.replace('<div class="avatar">${esc(firstLetter(item.sender?.name))}</div>', '<div class="avatar avatar-36 av-amber">${esc(firstLetter(item.sender?.name))}</div>')
    content = content.replace('<div class="avatar">${esc(firstLetter(item.receiver?.name))}</div>', '<div class="avatar avatar-36 av-pink">${esc(firstLetter(item.receiver?.name))}</div>')

    # 3. Badges to Tags in JS
    # browse.js, ideas.js, teams.js
    content = content.replace('class="badge badge-', 'class="tag tag-')
    content = content.replace('class="badge"', 'class="tag"')
    content = content.replace('class="badge ', 'class="tag ')
    content = content.replace('badge-fresh', 'tag-fresh')
    content = content.replace('badge-computing', 'tag-serious')
    content = content.replace('badge-partial', 'tag-portfolio')
    content = content.replace('badge-needs-input', 'tag-default')
    content = content.replace('badge-dot', 'tag-dot') # Note: tag doesn't have dot in new CSS, but just to be safe.

    # 4. Activity Dot -> tag-dot (if any, although we might not need to touch it)
    
    # 5. Dashboard Topbar ID
    content = content.replace('id="topbar-avatar"', 'id="topbar-avatar" class="avatar avatar-36 av-purple"')

    # 6. Hero Avatar
    content = content.replace('<div class="avatar" style="background: linear-gradient(135deg,#f093fb,#f5576c)">A</div>', '<div class="avatar avatar-36 av-pink">A</div>')
    content = content.replace('class="mock-tag"', 'class="tag tag-default"')

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith('.html') or file.endswith('.js'):
            process_file(os.path.join(root, file))

print("Done")
