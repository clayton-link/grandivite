import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const ORG_ID = "a1b2c3d4-0000-0000-0000-000000000001";

export const adminDb = {
  // ── Organizations ───────────────────────────────────────────────────────────
  fetchOrg: async () => {
    const { data } = await supabase.from("organizations").select("*").eq("id", ORG_ID).single();
    return data;
  },
  updateOrg: async (fields) => {
    await supabase.from("organizations").update(fields).eq("id", ORG_ID);
  },

  // ── Org Settings ────────────────────────────────────────────────────────────
  fetchOrgSettings: async () => {
    const { data } = await supabase.from("org_settings").select("*").eq("org_id", ORG_ID).single();
    return data;
  },
  updateOrgSettings: async (fields) => {
    await supabase.from("org_settings").update({ ...fields, updated_at: new Date().toISOString() }).eq("org_id", ORG_ID);
  },

  // ── Groups ──────────────────────────────────────────────────────────────────
  fetchGroups: async () => {
    const { data } = await supabase.from("groups").select("*").eq("org_id", ORG_ID).order("sort_order");
    return data || [];
  },
  createGroup: async (fields) => {
    const { data } = await supabase.from("groups").insert({ ...fields, org_id: ORG_ID }).select().single();
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
  fetchRecipientGroups: async () => {
    const { data } = await supabase.from("recipient_groups").select("*").eq("org_id", ORG_ID).order("created_at");
    return data || [];
  },
  createRecipientGroup: async (label) => {
    const { data } = await supabase.from("recipient_groups").insert({ org_id: ORG_ID, label }).select().single();
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
  fetchOrgMembers: async () => {
    const { data } = await supabase.from("org_members").select("*").eq("org_id", ORG_ID).order("created_at");
    return data || [];
  },
  upsertOrgMember: async (email, role, displayName) => {
    const { data } = await supabase.from("org_members").upsert(
      { org_id: ORG_ID, email, role, display_name: displayName },
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

  // ── Audit Log ────────────────────────────────────────────────────────────────
  fetchAuditLog: async (limit = 50, offset = 0) => {
    const { data } = await supabase.from("audit_log").select("*").eq("org_id", ORG_ID)
      .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    return data || [];
  },
  writeAuditEntry: async (actorEmail, action, targetType, targetId, payload) => {
    await supabase.from("audit_log").insert({
      org_id: ORG_ID, actor_email: actorEmail, action,
      target_type: targetType || null, target_id: targetId ? String(targetId) : null,
      payload: payload || null,
    });
  },

  // ── App-facing helpers (used by main App.jsx) ────────────────────────────────
  fetchGroupsForApp: async () => {
    // Returns groups shaped like the hardcoded FAMILIES array
    const [{ data: groups }, { data: members }, { data: children }] = await Promise.all([
      supabase.from("groups").select("*").eq("org_id", ORG_ID).eq("active", true).order("sort_order"),
      supabase.from("group_members").select("*"),
      supabase.from("group_children").select("*").order("sort_order"),
    ]);
    if (!groups?.length) return null;
    return groups.map(g => ({
      id:       g.id,
      name:     g.name,
      color:    g.color,
      phone:    g.phone || "",
      emails:   (members || []).filter(m => m.group_id === g.id).map(m => m.email),
      children: (children || []).filter(c => c.group_id === g.id).map(c => c.name),
    }));
  },
  fetchCoordinatorEmails: async () => {
    const { data } = await supabase.from("org_members").select("email")
      .eq("org_id", ORG_ID).in("role", ["owner", "admin"]).eq("is_active", true);
    return data?.map(r => r.email) || null;
  },
  fetchDigestRecipients: async () => {
    const { data: rgs } = await supabase.from("recipient_groups").select("id").eq("org_id", ORG_ID).eq("receives_digest", true);
    if (!rgs?.length) return null;
    const { data: recs } = await supabase.from("recipients").select("email,phone").in("recipient_group_id", rgs.map(r => r.id));
    if (!recs?.length) return null;
    return {
      emails: recs.map(r => r.email).filter(Boolean),
      phones: recs.map(r => r.phone).filter(Boolean),
    };
  },

  // Expose supabase client for auth in AdminApp
  supabase,
};
