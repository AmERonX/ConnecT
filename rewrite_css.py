import sys

with open('frontend/styles/main.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');",
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');"
)

# 2. Update :root variables
root_start = content.find(':root {')
root_end = content.find('--font-sans:', root_start)

dark_root = '''\
:root {
  color-scheme: dark;
  --bg-canvas: #09090b;
  --bg-muted: #18181b;
  --bg-surface: rgba(24, 24, 27, 0.6);
  --bg-surface-strong: #27272a;
  --bg-elevated: #3f3f46;
  --bg-contrast: #ffffff;
  --bg-contrast-soft: #f4f4f5;
  --bg-accent-soft: rgba(139, 92, 246, 0.15);
  --bg-accent-strong: #8b5cf6;
  --bg-accent-alt: #6366f1;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-inverse: #09090b;
  --text-accent: #a78bfa;
  --border: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.15);
  --border-contrast: rgba(0, 0, 0, 0.5);
  --border-focus: rgba(139, 92, 246, 0.5);
  --primary: #a855f7;
  --primary-strong: #c084fc;
  --secondary: #3f3f46;
  --accent: #6366f1;
  --accent-soft: rgba(99, 102, 241, 0.2);
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --success-bg: rgba(16, 185, 129, 0.15);
  --warning-bg: rgba(245, 158, 11, 0.15);
  --danger-bg: rgba(239, 68, 68, 0.15);
  --info-bg: rgba(99, 102, 241, 0.15);
  --hero-gradient:
    radial-gradient(circle at top left, rgba(168, 85, 247, 0.15), transparent 40%),
    radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.15), transparent 40%),
    linear-gradient(180deg, rgba(9, 9, 11, 0), rgba(9, 9, 11, 1));
  --card-gradient: linear-gradient(135deg, rgba(39, 39, 42, 0.4), rgba(24, 24, 27, 0.6));
  --accent-gradient: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
  --accent-gradient-soft: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.15));
  '''

content = content[:root_start] + dark_root + content[root_end:]

content = content.replace("--font-sans: 'Inter',", "--font-sans: 'Outfit', 'Inter',")

# Update standard elements
content = content.replace("linear-gradient(180deg, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0) 28%)", "linear-gradient(180deg, rgba(168, 85, 247, 0.05), rgba(9, 9, 11, 0) 28%)")
content = content.replace("background: rgba(255, 255, 255, 0.72);", "background: rgba(255, 255, 255, 0.05);") # eyebrow
content = content.replace("background: rgba(255, 255, 255, 0.76);", "background: rgba(255, 255, 255, 0.08);") # empty-icon
content = content.replace("background: rgba(255, 255, 255, 0.42);", "background: rgba(255, 255, 255, 0.02);") # empty-state
content = content.replace("background: rgba(255, 255, 255, 0.82);", "background: rgba(0, 0, 0, 0.2);") # form-input
content = content.replace("background: rgba(255, 255, 255, 1);", "background: rgba(0, 0, 0, 0.4);") # form-input focus
content = content.replace("background: rgba(255, 255, 255, 0.7);", "background: rgba(255, 255, 255, 0.05);") # btn-ghost
content = content.replace("background: rgba(255, 255, 255, 0.96);", "background: rgba(255, 255, 255, 0.1);") # btn-ghost
content = content.replace("linear-gradient(180deg, rgba(244, 241, 234, 0.92), rgba(244, 241, 234, 0.7))", "rgba(9, 9, 11, 0.8)") # navbar
content = content.replace("rgba(23, 24, 22, 0.08)", "var(--border)")
content = content.replace("rgba(23, 24, 22, 0.12)", "var(--border)")
content = content.replace("rgba(23, 24, 22, 0.1)", "var(--border)")

with open('frontend/styles/main.css', 'w', encoding='utf-8') as f:
    f.write(content)
print('Rewrite successful.')
