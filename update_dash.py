import os

filepath = r"c:\Projects\ConnecT\frontend\dashboard.html"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace Welcome Banner
old_welcome = """      <!-- Welcome -->
      <div class="welcome-banner fade-in">
        <div>
          <div class="welcome-title">Welcome back… 👋</div>
          <div class="welcome-sub">Here's what's happening with your teammate search</div>
        </div>
        <div class="avatar avatar-56 av-purple">…</div>
      </div>"""
      
new_welcome = """      <!-- Welcome -->
      <div class="welcome-card fade-in" style="background:var(--bg-card);border:0.5px solid var(--border);border-radius:12px;padding:24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="welcome-title" id="welcome-title" style="font-size:1.5rem;font-weight:700;margin-bottom:4px">Welcome back… 👋</div>
          <div class="welcome-sub" style="font-size:0.9375rem;color:var(--text-secondary)">Here's what's happening with your teammate search</div>
        </div>
        <div class="avatar av-blue" id="welcome-avatar" style="width:44px;height:44px;font-size:1.1rem;display:flex;align-items:center;justify-content:center;border-radius:50%">…</div>
      </div>"""

if old_welcome in content:
    content = content.replace(old_welcome, new_welcome)
else:
    print("Welcome block not found")

# Replace Stats Row
old_stats = """      <!-- Stats -->
      <div class="stats-row stagger">
        <div class="stat-card slide-up">
          <div class="stat-icon" style="background:rgba(79, 127, 255,0.15)">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#4F7FFF" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          </div>
          <div>
            <div class="stat-value">—</div>
            <div class="stat-label">Active Ideas</div>
          </div>
        </div>

        <div class="stat-card slide-up">
          <div class="stat-icon" style="background:rgba(0,212,255,0.12)">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#00d4ff" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </div>
          <div>
            <div class="stat-value">—</div>
            <div class="stat-label">Requests Sent</div>
          </div>
        </div>

        <div class="stat-card slide-up">
          <div class="stat-icon" style="background:var(--green-bg)">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <div>
            <div class="stat-value">—</div>
            <div class="stat-label">Requests Received</div>
          </div>
        </div>

        <div class="stat-card slide-up">
          <div class="stat-icon" style="background:var(--yellow-bg)">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <div>
            <div class="stat-value">—</div>
            <div class="stat-label">Active Teams</div>
          </div>
        </div>
      </div>"""

new_stats = """      <!-- Stats -->
      <div class="stats-row stagger" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;margin-bottom:28px">
        <div class="stat-card slide-up" style="background:var(--bg-card);border:0.5px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px">
          <div class="stat-icon" style="width:32px;height:32px;border-radius:8px;background:rgba(79, 127, 255,0.15);display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#4F7FFF" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          </div>
          <div>
            <div class="stat-value" id="stat-ideas" style="font-size:22px;font-weight:700;line-height:1">—</div>
            <div class="stat-label" style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-top:4px">Active Ideas</div>
          </div>
        </div>

        <div class="stat-card slide-up" style="background:var(--bg-card);border:0.5px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px">
          <div class="stat-icon" style="width:32px;height:32px;border-radius:8px;background:rgba(0,212,255,0.12);display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#00d4ff" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          </div>
          <div>
            <div class="stat-value" id="stat-sent" style="font-size:22px;font-weight:700;line-height:1">—</div>
            <div class="stat-label" style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-top:4px">Requests Sent</div>
          </div>
        </div>

        <div class="stat-card slide-up" style="background:var(--bg-card);border:0.5px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px">
          <div class="stat-icon" style="width:32px;height:32px;border-radius:8px;background:var(--fill-green);display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--text-green)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <div>
            <div class="stat-value" id="stat-received" style="font-size:22px;font-weight:700;line-height:1">—</div>
            <div class="stat-label" style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-top:4px">Requests Received</div>
          </div>
        </div>

        <div class="stat-card slide-up" style="background:var(--bg-card);border:0.5px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px">
          <div class="stat-icon" style="width:32px;height:32px;border-radius:8px;background:var(--fill-amber);display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--text-amber)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <div>
            <div class="stat-value" id="stat-teams" style="font-size:22px;font-weight:700;line-height:1">—</div>
            <div class="stat-label" style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-top:4px">Active Teams</div>
          </div>
        </div>
      </div>"""

if old_stats in content:
    content = content.replace(old_stats, new_stats)
else:
    print("Stats block not found")


with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Finished updates to dashboard.html")
