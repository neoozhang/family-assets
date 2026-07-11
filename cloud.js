class WealthCloud {
  constructor(config) {
    if (!window.supabase?.createClient || !config?.url || !config?.publishableKey) {
      throw new Error("云端配置不可用");
    }
    this.client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    this.household = null;
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(callback) {
    return this.client.auth.onAuthStateChange((event, session) => callback(event, session));
  }

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  async signUp(email, password) {
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    this.household = null;
  }

  async ensureHousehold(user) {
    if (this.household) return this.household;
    const { data: memberships, error: membershipError } = await this.client
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", user.id)
      .limit(1);
    if (membershipError) throw membershipError;

    if (memberships?.length) {
      const { data, error } = await this.client
        .from("households")
        .select("id, name")
        .eq("id", memberships[0].household_id)
        .single();
      if (error) throw error;
      this.household = { ...data, role: memberships[0].role };
      return this.household;
    }

    const { data, error } = await this.client.rpc("create_household", { household_name: "我的家庭" });
    if (error) throw error;
    this.household = { id: data.id, name: data.name, role: "owner" };
    return this.household;
  }

  async loadState(user) {
    const household = await this.ensureHousehold(user);
    const [accountsResult, snapshotsResult, settingsResult] = await Promise.all([
      this.client.from("accounts").select("id, name, type, institution, currency").eq("household_id", household.id).order("created_at"),
      this.client.from("snapshots").select("id, account_id, snapshot_date, balance").eq("household_id", household.id).order("snapshot_date"),
      this.client.from("household_settings").select("selected_year").eq("household_id", household.id).maybeSingle(),
    ]);
    const error = accountsResult.error || snapshotsResult.error || settingsResult.error;
    if (error) throw error;
    const accounts = accountsResult.data || [];
    const snapshots = (snapshotsResult.data || []).map((item) => ({
      id: item.id,
      accountId: item.account_id,
      date: item.snapshot_date,
      balance: Number(item.balance),
    }));
    return {
      state: {
        accounts,
        snapshots,
        settings: { year: String(settingsResult.data?.selected_year || new Date().getFullYear()) },
      },
      isEmpty: accounts.length === 0 && snapshots.length === 0,
      household,
    };
  }

  async syncState(state) {
    if (!this.household) throw new Error("尚未建立家庭空间");
    const householdId = this.household.id;
    const accountRows = state.accounts.map((item) => ({
      household_id: householdId,
      id: item.id,
      name: item.name || "",
      type: item.type,
      institution: item.institution || "",
      currency: item.currency || "CNY",
    }));

    const { data: existingAccounts, error: existingAccountError } = await this.client
      .from("accounts")
      .select("id")
      .eq("household_id", householdId);
    if (existingAccountError) throw existingAccountError;
    const accountIds = new Set(accountRows.map((item) => item.id));
    const staleAccountIds = (existingAccounts || []).map((item) => item.id).filter((id) => !accountIds.has(id));
    if (staleAccountIds.length) {
      const { error } = await this.client.from("accounts").delete().eq("household_id", householdId).in("id", staleAccountIds);
      if (error) throw error;
    }
    if (accountRows.length) {
      const { error } = await this.client.from("accounts").upsert(accountRows, { onConflict: "household_id,id" });
      if (error) throw error;
    }

    const snapshotRows = state.snapshots.map((item) => ({
      household_id: householdId,
      id: item.id,
      account_id: item.accountId,
      snapshot_date: item.date,
      balance: Number(item.balance),
    }));
    const { data: existingSnapshots, error: existingSnapshotError } = await this.client
      .from("snapshots")
      .select("id")
      .eq("household_id", householdId);
    if (existingSnapshotError) throw existingSnapshotError;
    const snapshotIds = new Set(snapshotRows.map((item) => item.id));
    const staleSnapshotIds = (existingSnapshots || []).map((item) => item.id).filter((id) => !snapshotIds.has(id));
    if (staleSnapshotIds.length) {
      const { error } = await this.client.from("snapshots").delete().eq("household_id", householdId).in("id", staleSnapshotIds);
      if (error) throw error;
    }
    if (snapshotRows.length) {
      const { error } = await this.client.from("snapshots").upsert(snapshotRows, { onConflict: "household_id,id" });
      if (error) throw error;
    }

    const selectedYear = Number(state.settings?.year) || new Date().getFullYear();
    const { error: settingsError } = await this.client
      .from("household_settings")
      .upsert({ household_id: householdId, selected_year: selectedYear }, { onConflict: "household_id" });
    if (settingsError) throw settingsError;
  }
}

window.WealthCloud = WealthCloud;
