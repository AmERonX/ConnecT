import os

filepath = r"c:\Projects\ConnecT\frontend\js\pages\teams.js"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the team card HTML generation in teams.js
old_card_start = """      <div class="team-card slide-up">
        <div class="team-card-header">
          <div class="team-info">
            <div class="team-icon-wrap" style="background:rgba(79, 127, 255,0.12)">👥</div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                <div class="team-name" id="team-name-text-${team.id}">${esc(team.name || 'Unnamed Team')}</div>
                ${team.completed ? '<span class="tag-chip" style="background:var(--green, #10b981);color:#fff">Completed</span>' : `<button class="btn btn-ghost btn-sm" style="padding:0 6px;height:24px" data-action="edit-name" data-team-id="${team.id}">✏️ Edit Name</button>`}
              </div>
              <div class="team-idea">Formed ${new Date(team.formed_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="team-meta">
            <div class="meta-item">
              <span class="meta-value">${(team.members || []).length}</span>
              <span class="meta-label">Members</span>
            </div>
            ${!team.completed ? `
              <div class="team-actions" style="margin-left:16px">
                ${myPartComplete 
                  ? `<button class="btn btn-ghost btn-sm" data-action="unmark-complete" data-team-id="${team.id}">Reopen My Part</button>`
                  : `<button class="btn btn-ghost btn-sm" data-action="mark-complete" data-team-id="${team.id}">Mark My Part Complete</button>`
                }
                <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-action="leave-team" data-team-id="${team.id}">Leave</button>
              </div>
            ` : `
              <div class="team-actions" style="margin-left:16px">
                <button class="btn btn-ghost btn-sm" data-action="unmark-complete" data-team-id="${team.id}">Reopen Project</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-action="leave-team" data-team-id="${team.id}">Leave</button>
              </div>
            `}
          </div>
        </div>

        <div class="team-card-body">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
              <div class="detail-title">Team Idea</div>
              ${team.idea ? `<a href="/idea-editor.html?id=${team.idea.id}" class="btn btn-ghost btn-sm">Edit Idea</a>` : ''}
            </div>
            ${team.idea ? `
              <div style="margin-bottom:16px">
                <h4 style="font-size:0.9rem;margin-bottom:4px;font-weight:600">Problem</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.problem)}</p>
              </div>
              <div>
                <h4 style="font-size:0.9rem;margin-bottom:4px;font-weight:600">Solution Idea</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.solution_idea || 'No solution idea provided.')}</p>
              </div>
            ` : '<p style="font-size:0.875rem;color:var(--text-secondary)">No active idea found for this team.</p>'}
          </div>

          <div>
            <div class="detail-title" style="margin-bottom:16px">Members</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${(team.members || []).map(member => `
                <div class="member-row" style="padding:0;border:none;justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="avatar avatar-36 av-blue">${esc(firstLetter(member.name))}</div>
                    <div class="member-name" style="display:flex;align-items:center;gap:6px">
                      ${esc(member.name || 'Unknown member')}
                      ${member.marked_complete ? '<span style="color:var(--green,#10b981)" title="Ready">✓</span>' : ''}
                      ${member.is_leader ? '<span class="tag-chip" style="font-size:0.7rem;padding:0 4px;background:rgba(245,158,11,0.15);color:var(--orange,#f59e0b)">👑 Leader</span>' : ''}
                    </div>
                  </div>
                  ${team.completed && member.id !== session.user.id ? (
                    member.rated_by_me 
                    ? '<span style="font-size:0.8125rem;color:var(--green,#10b981)">✓ Rated</span>'
                    : `<button class="btn btn-primary btn-sm" data-action="rate-peer" data-team-id="${team.id}" data-user-id="${member.id}" data-user-name="${esc(member.name)}">Rate Peer</button>`
                  ) : (!team.completed && member.id !== session.user.id && myMember && myMember.is_leader ? (
                    `<button class="btn btn-ghost btn-sm" style="color:var(--red);padding:0 6px;height:24px" data-action="kick-member" data-team-id="${team.id}" data-user-id="${member.id}">Kick</button>`
                  ) : '')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>"""

new_card_layout = """      <div class="team-card slide-up">
        <div class="team-card-header">
          <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="team-name" id="team-name-text-${team.id}" style="font-size:1.1rem">${esc(team.name || 'Unnamed Team')}</div>
            <div style="color:var(--text-secondary);font-size:0.9rem">(${(team.members || []).length} Members)</div>
            ${team.completed ? '<span class="tag tag-fresh">Completed</span>' : `<button class="btn-ghost" style="padding:0;border:none;font-size:0.875rem;color:var(--brand)" data-action="edit-name" data-team-id="${team.id}">Edit Name</button>`}
            
            <div class="team-actions" style="margin-left:auto;display:flex;gap:8px">
              ${!team.completed ? (
                myPartComplete 
                  ? `<button class="btn btn-outline btn-sm" data-action="unmark-complete" data-team-id="${team.id}">Reopen My Part</button>`
                  : `<button class="btn btn-primary btn-sm" data-action="mark-complete" data-team-id="${team.id}">Mark My Part Complete</button>`
              ) : `<button class="btn btn-outline btn-sm" data-action="unmark-complete" data-team-id="${team.id}">Reopen Project</button>`}
              <button class="btn btn-danger btn-sm" data-action="leave-team" data-team-id="${team.id}">Leave</button>
            </div>
          </div>
        </div>

        <div class="team-card-body">
          <div style="display:flex;flex-direction:column;gap:16px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="detail-title">Idea Details</div>
              ${team.idea ? `<a href="/idea-editor.html?id=${team.idea.id}" class="btn btn-ghost btn-sm">Edit Idea</a>` : ''}
            </div>
            ${team.idea ? `
              <div>
                <h4 style="font-size:0.875rem;margin-bottom:4px;font-weight:600;color:var(--text-muted)">PROBLEM</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.problem)}</p>
              </div>
              <div>
                <h4 style="font-size:0.875rem;margin-bottom:4px;font-weight:600;color:var(--text-muted)">SOLUTION IDEA</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.solution_idea || 'No solution idea provided.')}</p>
              </div>
            ` : '<p style="font-size:0.875rem;color:var(--text-secondary)">No active idea found for this team.</p>'}
          </div>

          <div>
            <div class="detail-title" style="margin-bottom:16px">Members List</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${(team.members || []).map(member => `
                <div class="member-row" style="padding:8px 12px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg-card);justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="avatar avatar-36 av-blue">${esc(firstLetter(member.name))}</div>
                    <div class="member-name" style="display:flex;flex-direction:column;gap:2px">
                      <div style="display:flex;align-items:center;gap:6px">
                        ${esc(member.name || 'Unknown member')}
                        ${member.id === session.user.id ? '<span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">(You)</span>' : ''}
                      </div>
                      <div style="display:flex;gap:6px">
                        ${member.marked_complete ? '<span class="tag tag-fresh">Done</span>' : ''}
                        ${member.is_leader ? '<span class="tag tag-serious" style="background:var(--fill-amber);color:var(--text-amber)">👑 Leader</span>' : ''}
                      </div>
                    </div>
                  </div>
                  ${team.completed && member.id !== session.user.id ? (
                    member.rated_by_me 
                    ? '<span style="font-size:0.8125rem;color:var(--green,#10b981)">✓ Rated</span>'
                    : `<button class="btn btn-outline btn-sm" data-action="rate-peer" data-team-id="${team.id}" data-user-id="${member.id}" data-user-name="${esc(member.name)}">Rate Peer</button>`
                  ) : (!team.completed && member.id !== session.user.id && myMember && myMember.is_leader ? (
                    `<button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.875rem;text-decoration:underline" data-action="kick-member" data-team-id="${team.id}" data-user-id="${member.id}">Kick</button>`
                  ) : '')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>"""

if old_card_start in content:
    content = content.replace(old_card_start, new_card_layout)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully replaced layout in teams.js")
else:
    print("Could not find old layout chunk in teams.js")
