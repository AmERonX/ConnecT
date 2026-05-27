import os
import re

filepath = r"c:\Projects\ConnecT\frontend\profile.html"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Define the old block
old_block_pattern = r'<div class="profile-body-grid stagger">.*?</div>\s*</main>'

# Define the new block
new_block = """<div class="profile-body-grid stagger">
        <!-- Left Column: Bio & Skills -->
        <div class="profile-column slide-up" style="display:flex;flex-direction:column;gap:16px">
          <div class="profile-section" id="bio-section" style="margin-bottom:0">
            <div class="ps-header">
              <div class="ps-title">👋 About Me</div>
            </div>
            <p style="font-size:0.9375rem;color:var(--text-secondary);margin:0;line-height:1.5">
              Passionate builder looking for teammates to collaborate on exciting projects. Actively learning new frameworks and exploring AI integration.
            </p>
          </div>

          <div class="profile-section" id="skills-section" style="margin-bottom:0">
            <div class="ps-header">
              <div class="ps-title">🏷️ Skills & Technologies</div>
              <button class="btn btn-ghost btn-sm" id="add-skill-btn">+ Add</button>
            </div>
            <div class="skills-grid"></div>
          </div>
        </div>

        <!-- Right Column: Links, Preferences, Danger Zone -->
        <div class="profile-column slide-up" style="display:flex;flex-direction:column;gap:16px">
          <div class="profile-section" id="links-section" style="margin-bottom:0">
            <div class="ps-header">
              <div class="ps-title">🔗 Social Links</div>
            </div>
            <div class="social-row">
              <span class="social-label">GitHub</span>
              <span class="social-value">—</span>
            </div>
          </div>

          <div class="profile-section" id="preferences-section" style="margin-bottom:0">
            <div class="ps-header">
              <div class="ps-title">⚙️ Working Preferences</div>
            </div>
            <div class="social-row">
              <span class="social-label">Team size</span>
              <span class="social-value">—</span>
            </div>
            <div class="social-row">
              <span class="social-label">Working style</span>
              <span class="social-value">—</span>
            </div>
            <div class="social-row">
              <span class="social-label">Existing team</span>
              <span class="social-value">—</span>
            </div>
          </div>

          <div class="profile-section danger-zone" style="margin-bottom:0">
            <div class="ps-header">
              <div class="ps-title danger-title">⚠️ Danger Zone</div>
            </div>
            <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:14px">
              Permanently delete your account, teams, and ideas. This cannot be undone.
            </p>
            <button class="btn btn-danger btn-sm" id="delete-account-btn">Delete Account</button>
          </div>
        </div>
      </div>
    </main>"""

new_content = re.sub(old_block_pattern, new_block, content, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated profile layout successfully.")
