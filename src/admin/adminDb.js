import { supabase } from "../supabaseClient.js";

// ── Multi-tenant helpers ───────────────────────────────────────────────────────
// All functions accept an explicit orgId — never rely on a hardcoded constant.

export const adminDb = {
  supabase,

  // Resolve orgId + role for a signed-in user email
  resolveUserOrg: async (email) => {
    const { data } = await supabase
      .from("org_members")
      .select("org_id, role, is_active, display_name")
      .eq("email", email.toLowerCase())
      .eq("is_active", true)
      .limit(1)
      .single();
    return data || null; // { org_id, role, is_active, display_name }
  },

  // ── Organizations ───────────────────────────────────────────────────────────
  fetchOrg: async (orgId) => {
    const { data } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    return data;
  },
  updateOrg: async (orgId, fields) => {
    await supabase.from("organizations").update(fields).eq("id", orgId);
  },

  // ── Org Settings ────────────────────────────────────────────────────────────
  fetchOrgSettings: async (orgId) => {
    const { data } = await supabase.from("org_settings").select("*").eq("org_id", orgId).single();
    return data;
  },
  updateOrgSettings: async (orgId, fields) => {
    await supabase.from("org_settings")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("org_id", orgId);
  },

  // ── Groups ──────────────────────────────────────────────────────────────────
  fetchGroups: async (orgId) => {
    const { data } = await supabase.from("groups").select("*").eq("org_id", orgId).order("sort_order");
    return data || [];
  },
  createGroup: async (orgId, fields) => {
    const { data } = await supabase.from("groups").insert({ ...fields, org_id: orgId }).select().single();
    return data;
  },
  updateGroup: async (id, fields) => {
    await supabase.from("groups").update(fields).eq("id", id);
  },
  deleteGroup: async (id) => {
    await supabase.from("groups").delete().eq("id", id);
  },

  // ── Group Members (emails) ──────────────────────────────────────────────────
  fetchGroupMembers: async (groupId) => {
    const { data } = await supabase.from("group_members").select("*").eq("group_id", groupId).order("created_at");
    return data || [];
  },
  addGroupMember: async (groupId, email, isPrimary = false) => {
    const { data } = await supabase.from("group_members").insert({ group_id: groupId, email, is_primary: isPrimary }).select().single();
    return data;
  },
  updateGroupMember: async (id, fields) => {
    await supabase.from("group_members").update(fields).eq("id", id);
  },
  removeGroupMember: async (id) => {
    await supabase.from("group_members").delete().eq("id", id);
  },

  // ── Group Children ───────────────────────────────────────────────────────────
  fetchGroupChildren: async (groupId) => {
    const { data } = await supabase.from("group_children").select("*").eq("group_id", groupId).order("sort_order");
    return data || [];
  },
  addChild: async (groupId, name, sortOrder = 0) => {
    const { data } = await supabase.from("group_children").insert({ group_id: groupId, name, sort_order: sortOrder }).select().single();
    return data;
  },
  updateChild: async (id, fields) => {
    await supabase.from("group_children").update(fields).eq("id", id);
  },
  removeChild: async (id) => {
    await supabase.from("group_children").delete().eq("id", id);
  },

  // ── Recipient Groups ─────────────────────────────────────────────────────────
  fetchRecipientGroups: async (orgId) => {
    const { data } = await supabase.from("recipient_groups").select("*").eq("org_id", orgId).order("created_at");
    return data || [];
  },
  createRecipientGroup: async (orgId, label) => {
    const { data } = await supabase.from("recipient_groups").insert({ org_id: orgId, label }).select().single();
    return data;
  },
  updateRecipientGroup: async (id, fields) => {
    await supabase.from("recipient_groups").update(fields).eq("id", id);
  },
  deleteRecipientGroup: async (id) => {
    await supabase.from("recipient_groups").delete().eq("id", id);
  },

  // ── Recipients ───────────────────────────────────────────────────────────────
  fetchRecipients: async (recipientGroupId) => {
    const { data } = await supabase.from("recipients").select("*").eq("recipient_group_id", recipientGroupId).order("created_at");
    return data || [];
  },
  createRecipient: async (fields) => {
    const { data } = await supabase.from("recipients").insert(fields).select().single();
    return data;
  },
  updateRecipient: async (id, fields) => {
    await supabase.from("recipients").update(fields).eq("id", id);
  },
  deleteRecipient: async (id) => {
    await supabase.from("recipients").delete().eq("id", id);
  },

  // ── Org Members (admin users) ─────────────────────────────────────────────
  fetchOrgMembers: async (orgId) => {
    const { data } = await supabase.from("org_members").select("*").eq("org_id", orgId).order("created_at");
    return data || [];
  },
  upsertOrgMember: async (orgId, email, role, displayName) => {
    const { data } = await supabase.from("org_members").upsert(
      { org_id: orgId, email, role, display_name: displayName, is_active: true },
      { onConflict: "org_id,email" }
    ).select().single();
    return data;
  },
  updateOrgMember: async (id, fields) => {
    await supabase.from("org_members").update(fields).eq("id", id);
  },
  removeOrgMember: async (id) => {
    await supabase.from("org_members").delete().eq("id", id);
  },

  // ── Cycles ───────────────────────────────────────────────────────────────────
  fetchCycles: async (orgId) => {
    const { data } = await supabase.from("cycles").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    return data || [];
  },
  fetchLatestCycle: async (orgId) => {
    const { data } = await supabase.from("cycles").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1).single();
    return data;
  },
  createCycle: async (orgId, monthLabel) => {
    const { data } = await supabase.from("cycles").insert({ org_id: orgId, month_label: monthLabel, locked: false, digest_sent: false }).select().single();
    return data;
  },
  updateCycle: async (id, fields) => {
    await supabase.from("cycles").update(fields).eq("id", id);
  },
  resetCycle: async (cycleId) => {
    await supabase.from("events").delete().eq("cycle_id", cycleId);
    await supabase.from("cycles").update({ locked: false, digest_sent: false }).eq("id", cycleId);
  },
  fetchFutureEvents: async (cycleId) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const { data } = await supabase.from("events").select("*").eq("cycle_id", cycleId).gte("date", todayStr);
    return data || [];
  },
  carryForwardEvents: async (fromCycleId, toCycleId) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const { data: evs } = await supabase.from("events").select("*").eq("cycle_id", fromCycleId).gte("date", todayStr);
    if (!evs?.length) return 0;
    const rows = evs.map(({ id: _id, cycle_id: _cid, created_at: _ca, ...rest }) => ({ ...rest, cycle_id: toCycleId }));
    await supabase.from("events").insert(rows);
    return rows.length;
  },

  // ── Audit Log ────────────────────────────────────────────────────────────────
  fetchAuditLog: async (orgId, limit = 50, offset = 0) => {
    const { data } = await supabase.from("audit_log").select("*").eq("org_id", orgId)
      .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    return data || [];
  },
  writeAuditEntry: async (orgId, actorEmail, action, targetType, targetId, payload) => {
    // Fire-and-forget — never throws, never blocks
    supabase.from("audit_log").insert({
      org_id:      orgId,
      actor_email: actorEmail,
      action,
      target_type: targetType || null,
      target_id:   targetId ? String(targetId) : null,
      payload:     payload || null,
    }).then(() => {}).catch(() => {});
  },

  // ── App-facing helpers (used by main App.jsx) ────────────────────────────────
  fetchGroupsForApp: async (orgId) => {
    const [{ data: groups }, { data: members }, { data: children }] = await Promise.all([
      supabase.from("groups").select("*").eq("org_id", orgId).eq("active", true).order("sort_order"),
      supabase.from("group_members").select("*"),
      supabase.from("group_children").select("*").order("sort_order"),
    ]);
    if (!groups?.length) return [];
    return groups.map(g => ({
      id:                 g.id,
      name:               g.name,
      color:              g.color,
      phone:              g.phone || "",
      emails:             (members || []).filter(m => m.group_id === g.id).map(m => m.email),
      children:           (children || []).filter(c => c.group_id === g.id).map(c => c.name),
      submission_cadence: g.submission_cadence || "monthly",
    }));
  },
  fetchCoordinatorEmails: async (orgId) => {
    const { data } = await supabase.from("org_members").select("email")
      .eq("org_id", orgId).in("role", ["owner", "admin"]).eq("is_active", true);
    return data?.map(r => r.email) || [];
  },
  fetchDigestRecipients: async (orgId) => {
    const { data: rgs } = await supabase.from("recipient_groups").select("id").eq("org_id", orgId).eq("receives_digest", true);
    if (!rgs?.length) return null;
    const { data: recs } = await supabase.from("recipients").select("email,phone").in("recipient_group_id", rgs.map(r => r.id));
    if (!recs?.length) return null;
    return {
      emails: recs.map(r => r.email).filter(Boolean),
      phones: recs.map(r => r.phone).filter(Boolean),
    };
  },
  fetchAllOrgMembers: async (orgId) => {
    // Returns all active members including family (group) emails — used to gate app access
    const { data } = await supabase.from("org_members").select("email, role").eq("org_id", orgId).eq("is_active", true);
    return data || [];
  },
};
