import sys

with open(r'c:\Projects\ConnecT\frontend\styles\main.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Update Root Tokens
old_root = """:root {
  /* Backgrounds */
  --bg-base:       #080d18;
  --bg-surface:    #0f1623;
  --bg-card:       #151e2d;
  --bg-card-hover: #1c2840;
  --bg-input:      #0f1623;

  /* Borders */
  --border:        rgba(255, 255, 255, 0.07);
  --border-focus:  rgba(108, 99, 255, 0.6);

  /* Brand */
  --primary:       #6c63ff;
  --primary-dark:  #5549e8;
  --primary-glow:  rgba(108, 99, 255, 0.25);
  --accent:        #00d4ff;
  --accent-glow:   rgba(0, 212, 255, 0.2);

  /* Gradient */
  --grad-primary: linear-gradient(135deg, #6c63ff 0%, #00d4ff 100%);
  --grad-text:    linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
  --grad-card:    linear-gradient(135deg, rgba(108,99,255,0.08) 0%, rgba(0,212,255,0.04) 100%);

  /* Text */
  --text-primary:   #e8edf5;
  --text-secondary: #7a8799;
  --text-muted:     #4a5568;

  /* Status */
  --green:         #10b981;
  --green-bg:      rgba(16, 185, 129, 0.12);
  --yellow:        #f59e0b;
  --yellow-bg:     rgba(245, 158, 11, 0.12);
  --red:           #ef4444;
  --red-bg:        rgba(239, 68, 68, 0.12);
  --blue:          #3b82f6;
  --blue-bg:       rgba(59, 130, 246, 0.12);

  /* Spacing */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  16px;
  --radius-xl:  24px;
  --radius-full: 9999px;"""

new_root = """:root {
  /* Backgrounds */
  --bg-base:       #080d18;
  --bg-surface:    #0f1623;
  --bg-card:       #151e2d;
  --bg-card-hover: #1c2840;
  --bg-input:      #0f1623;

  /* Borders */
  --border:        rgba(255, 255, 255, 0.07);
  --border-focus:  rgba(79, 127, 255, 0.6);

  /* Brand (UI Redesign) */
  --brand:        #4F7FFF;
  --brand-light:  #1A2B5E;
  --brand-border: rgba(79, 127, 255, 0.26);
  --primary:      var(--brand);
  --primary-dark: #3b6de8;
  --primary-glow: rgba(79, 127, 255, 0.25);
  --accent:       #00d4ff;
  --accent-glow:  rgba(0, 212, 255, 0.2);

  /* Gradient */
  --grad-primary: linear-gradient(135deg, #4F7FFF 0%, #00d4ff 100%);
  --grad-text:    linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%);
  --grad-card:    linear-gradient(135deg, rgba(79,127,255,0.08) 0%, rgba(0,212,255,0.04) 100%);

  /* Semantic fills (Dark Mode equivalents) */
  --fill-blue:    rgba(59, 130, 246, 0.15);  --text-blue:    #60a5fa;
  --fill-purple:  rgba(139, 92, 246, 0.15);  --text-purple:  #a78bfa;
  --fill-green:   rgba(16, 185, 129, 0.15);  --text-green:   #34d399;
  --fill-amber:   rgba(245, 158, 11, 0.15);  --text-amber:   #fbbf24;
  --fill-pink:    rgba(236, 72, 153, 0.15);  --text-pink:    #f472b6;
  --fill-red:     rgba(239, 68, 68, 0.15);   --text-red:     #f87171;
  --border-red:   rgba(239, 68, 68, 0.3);

  /* Score colors */
  --score-high:   #22c55e;
  --score-mid:    #f59e0b;
  --score-low:    #94a3b8;

  /* Old Text & Status (keeping for fallback) */
  --text-primary:   #e8edf5;
  --text-secondary: #7a8799;
  --text-muted:     #4a5568;
  --green:         var(--score-high);
  --green-bg:      var(--fill-green);
  --yellow:        var(--score-mid);
  --yellow-bg:     var(--fill-amber);
  --red:           var(--text-red);
  --red-bg:        var(--fill-red);
  --blue:          var(--text-blue);
  --blue-bg:       var(--fill-blue);

  /* Spacing */
  --radius-sm:  6px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-full: 9999px;"""
css = css.replace(old_root, new_root)

# 2. Typography
old_h1 = "h1, h2, h3, h4, h5 { font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }"
new_h1 = "h1, h2, h3, h4, h5 { font-weight: 500; line-height: 1.2; letter-spacing: -0.02em; }"
css = css.replace(old_h1, new_h1)

old_text = """.text-gradient {
  background: var(--grad-text);"""
new_text = """.text-gradient {
  background: var(--text-primary);"""
css = css.replace(old_text, new_text)

old_weight = """.weight-600 { font-weight: 600; }
.weight-700 { font-weight: 700; }"""
new_weight = """.weight-600 { font-weight: 500; }
.weight-700 { font-weight: 500; }"""
css = css.replace(old_weight, new_weight)

# 3. Sidebar padding
old_sidebar_link = """.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color var(--t-fast), background var(--t-fast);
  cursor: pointer;
}"""
new_sidebar_link = """.sidebar-link {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px;
  border-radius: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color var(--t-fast), background var(--t-fast);
  cursor: pointer;
  border-left: 2.5px solid transparent;
}"""
css = css.replace(old_sidebar_link, new_sidebar_link)

old_sidebar_active = """.sidebar-link.active {
  color: var(--primary);
  background: rgba(108, 99, 255, 0.1);
}

.sidebar-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  width: 3px;
  height: 24px;
  background: var(--primary);
  border-radius: 0 3px 3px 0;
}"""
new_sidebar_active = """.sidebar-link.active {
  color: var(--brand);
  background: var(--brand-light);
  border-left-color: var(--brand);
}"""
css = css.replace(old_sidebar_active, new_sidebar_active)

# 4. Buttons
old_btn = """.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  outline: none;
  transition: all var(--t-fast);
  white-space: nowrap;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary */
.btn-primary {
  background: var(--grad-primary);
  color: #fff;
  box-shadow: 0 4px 14px rgba(108, 99, 255, 0.35);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(108, 99, 255, 0.5);
}
.btn-primary:active { transform: translateY(0); }

/* Secondary / ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn-ghost:hover:not(:disabled) {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary);
  border-color: rgba(255,255,255,0.15);
}

/* Outline */
.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 1px solid rgba(108, 99, 255, 0.35);
}
.btn-outline:hover:not(:disabled) {
  background: var(--primary-glow);
  border-color: var(--primary);
}

/* Danger */
.btn-danger {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}"""

new_btn = """.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 5px 13px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  outline: none;
  transition: all var(--t-fast);
  white-space: nowrap;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary */
.btn-primary {
  background: var(--brand);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: #3b6de8;
}

/* Secondary / ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 0.5px solid var(--border);
  padding: 5px 11px;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--brand-light);
  color: var(--text-primary);
  border-color: var(--brand);
}

/* Outline */
.btn-outline {
  background: transparent;
  color: var(--brand);
  border: 0.5px solid var(--brand-border);
}
.btn-outline:hover:not(:disabled) {
  background: var(--brand-light);
}

/* Danger */
.btn-danger {
  background: transparent;
  color: #ef4444;
  border: 0.5px solid #fca5a5;
  padding: 5px 11px;
}
.btn-danger:hover:not(:disabled) {
  background: var(--fill-red);
}"""
css = css.replace(old_btn, new_btn)

# 5. Cards
old_card = """.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: border-color var(--t-normal), background var(--t-normal);
}

.card-hover:hover {
  background: var(--bg-card-hover);
  border-color: rgba(108, 99, 255, 0.25);
}

.card-glow {
  background: var(--grad-card);
  border-color: rgba(108, 99, 255, 0.2);
}"""
new_card = """.card {
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  transition: border-color var(--t-normal), background var(--t-normal);
}

.card-hover:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-focus);
}

.card-glow {
  background: var(--bg-card);
  border-color: var(--brand-border);
}"""
css = css.replace(old_card, new_card)

# 6. Add components (tags, avatars, nav-sep)
new_components = """
/* ── UI REDESIGN NEW COMPONENTS ──────────────────────────── */
.nav-sep {
  border-bottom: 0.5px solid var(--border);
  margin: 6px 12px;
}

.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}
.tag-fresh { background: var(--fill-green); color: var(--text-green); }
.tag-serious { background: var(--fill-blue); color: var(--text-blue); }
.tag-portfolio { background: var(--fill-purple); color: var(--text-purple); }
.tag-default { background: var(--bg-surface); color: var(--text-secondary); border: 0.5px solid var(--border); }

.avatar {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}
.avatar-28 { width: 28px; height: 28px; font-size: 10px; }
.avatar-36 { width: 36px; height: 36px; font-size: 12px; }
.avatar-44 { width: 44px; height: 44px; font-size: 14px; }
.avatar-56 { width: 56px; height: 56px; font-size: 17px; }

.av-blue { background: var(--fill-blue); color: var(--text-blue); }
.av-purple { background: var(--fill-purple); color: var(--text-purple); }
.av-green { background: var(--fill-green); color: var(--text-green); }
.av-amber { background: var(--fill-amber); color: var(--text-amber); }
.av-pink { background: var(--fill-pink); color: var(--text-pink); }

.topbar-right .avatar {
  background: var(--brand-light);
  color: var(--brand);
}
"""
css += new_components

with open(r'c:\Projects\ConnecT\frontend\styles\main.css', 'w', encoding='utf-8') as f:
    f.write(css)
print("Updated CSS successfully")
