(() => {
  "use strict";

  const LEGACY_STORAGE_KEY = "kakeibo-data";

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  }

  let data = { categories: [], transactions: [] };

  async function loadHouseholdFromServer() {
    const res = await fetch("/api/household");
    if (!res.ok) throw new Error("failed to load household data");
    data = await res.json();
  }

  async function saveData() {
    try {
      const res = await fetch("/api/household", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        alert("保存に失敗しました。通信環境を確認してください。");
      }
    } catch (e) {
      alert("保存に失敗しました。通信環境を確認してください。");
    }
  }

  function mergeHouseholdData(oldData) {
    oldData.categories.forEach((oldCat) => {
      const existing = data.categories.find((c) => c.id === oldCat.id);
      if (existing) {
        oldCat.subcategories.forEach((oldSub) => {
          if (!existing.subcategories.find((s) => s.id === oldSub.id)) {
            existing.subcategories.push(oldSub);
          }
        });
      } else {
        data.categories.push(oldCat);
      }
    });
    data.transactions = data.transactions.concat(oldData.transactions);
  }

  function findCategory(categoryId) {
    return data.categories.find((c) => c.id === categoryId) || null;
  }

  function findSubcategory(categoryId, subcategoryId) {
    const cat = findCategory(categoryId);
    if (!cat) return null;
    return cat.subcategories.find((s) => s.id === subcategoryId) || null;
  }

  function categoryName(categoryId) {
    const c = findCategory(categoryId);
    return c ? c.name : "(削除済み)";
  }

  function subcategoryName(categoryId, subcategoryId) {
    const s = findSubcategory(categoryId, subcategoryId);
    return s ? s.name : "(削除済み)";
  }

  function yen(n) {
    const sign = n < 0 ? "-" : "";
    return sign + "¥" + Math.round(Math.abs(n)).toLocaleString("ja-JP");
  }

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function currentYearMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function renderAll() {
    renderCategoryChips();
    renderSubcategoryChips();
    renderRecent();
    renderHistory();
    renderCategoriesView();
  }

  // ---------------------------------------------------------------------
  // 認証画面
  // ---------------------------------------------------------------------

  const authScreenEl = document.getElementById("auth-screen");
  const appRootEl = document.getElementById("app-root");
  const authModeToggleEl = document.getElementById("auth-mode-toggle");
  const authFormEl = document.getElementById("auth-form");
  const authEmailInput = document.getElementById("auth-email");
  const authPasswordInput = document.getElementById("auth-password");
  const authErrorEl = document.getElementById("auth-error");
  const authSubmitBtn = document.getElementById("auth-submit");
  const accountEmailEl = document.getElementById("account-email");

  let authMode = "login";

  authModeToggleEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    authMode = btn.dataset.mode;
    authModeToggleEl.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    authSubmitBtn.textContent = authMode === "signup" ? "アカウントを作成" : "ログイン";
    authPasswordInput.autocomplete = authMode === "signup" ? "new-password" : "current-password";
    authErrorEl.hidden = true;
  });

  authFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    authErrorEl.hidden = true;
    authSubmitBtn.disabled = true;
    try {
      const res = await fetch(authMode === "signup" ? "/api/signup" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmailInput.value, password: authPasswordInput.value }),
      });
      const body = await res.json();
      if (!res.ok) {
        authErrorEl.textContent = body.error || "エラーが発生しました";
        authErrorEl.hidden = false;
        return;
      }
      authPasswordInput.value = "";
      await enterApp(body.email);
    } catch (err) {
      authErrorEl.textContent = "通信エラーが発生しました";
      authErrorEl.hidden = false;
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  async function enterApp(email) {
    accountEmailEl.textContent = email;
    await loadHouseholdFromServer();

    if (data.transactions.length === 0) {
      let legacy = null;
      try {
        legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
      } catch (e) {
        legacy = null;
      }
      if (legacy && Array.isArray(legacy.transactions) && legacy.transactions.length > 0) {
        if (confirm(`この端末に以前入力した家計簿データ(${legacy.transactions.length}件)があります。取り込みますか?`)) {
          mergeHouseholdData(legacy);
          await saveData();
        }
      }
    }

    authScreenEl.hidden = true;
    appRootEl.hidden = false;
    entryDateInput.value = todayISO();
    renderAll();
  }

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
  });

  // ---------------------------------------------------------------------
  // 招待(共有)
  // ---------------------------------------------------------------------

  const inviteCreateBtn = document.getElementById("invite-create-btn");
  const inviteCodeDisplayEl = document.getElementById("invite-code-display");
  const inviteRedeemForm = document.getElementById("invite-redeem-form");
  const inviteCodeInput = document.getElementById("invite-code-input");

  inviteCreateBtn.addEventListener("click", async () => {
    inviteCreateBtn.disabled = true;
    try {
      const res = await fetch("/api/invite-create", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error || "招待コードの発行に失敗しました");
        return;
      }
      inviteCodeDisplayEl.textContent = body.code;
      inviteCodeDisplayEl.hidden = false;
    } finally {
      inviteCreateBtn.disabled = false;
    }
  });

  inviteRedeemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = inviteCodeInput.value.trim();
    if (!code) return;

    const previousData = JSON.parse(JSON.stringify(data));

    const res = await fetch("/api/invite-redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error || "参加に失敗しました");
      return;
    }

    await loadHouseholdFromServer();

    if (previousData.transactions.length > 0) {
      if (confirm(`参加しました。これまでのあなたのデータ(${previousData.transactions.length}件)を、この共有の家計簿に取り込みますか?`)) {
        mergeHouseholdData(previousData);
        await saveData();
      }
    } else {
      alert("参加しました。");
    }

    inviteCodeInput.value = "";
    renderAll();
  });

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------

  const navItems = document.querySelectorAll(".nav-item");
  const views = document.querySelectorAll(".view");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      navItems.forEach((b) => b.classList.toggle("active", b === btn));
      views.forEach((v) => v.classList.toggle("active", v.id === `view-${target}`));
      if (target === "entry") { renderCategoryChips(); renderSubcategoryChips(); }
      if (target === "history") renderHistory();
      if (target === "categories") renderCategoriesView();
    });
  });

  // ---------------------------------------------------------------------
  // 入力画面
  // ---------------------------------------------------------------------

  const entryForm = document.getElementById("entry-form");
  const entryDateInput = document.getElementById("entry-date");
  const entryAmountInput = document.getElementById("entry-amount");
  const entryMemoInput = document.getElementById("entry-memo");
  const categoryChipsEl = document.getElementById("category-chips");
  const subcategoryChipsEl = document.getElementById("subcategory-chips");
  const recentRowsEl = document.getElementById("recent-rows");
  const typeToggleEl = document.getElementById("type-toggle");

  const entryState = {
    type: "expense",
    categoryId: null,
    subcategoryId: null,
  };

  typeToggleEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    entryState.type = btn.dataset.type;
    typeToggleEl.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
  });

  function renderCategoryChips() {
    categoryChipsEl.innerHTML = "";
    if (data.categories.length === 0) {
      categoryChipsEl.innerHTML = '<span class="empty-note">カテゴリ設定画面で大項目を追加してください</span>';
      return;
    }
    if (!findCategory(entryState.categoryId)) {
      entryState.categoryId = data.categories[0].id;
    }
    data.categories.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (cat.id === entryState.categoryId ? " selected" : "");
      chip.textContent = cat.name;
      chip.addEventListener("click", () => {
        entryState.categoryId = cat.id;
        entryState.subcategoryId = null;
        renderCategoryChips();
        renderSubcategoryChips();
      });
      categoryChipsEl.appendChild(chip);
    });
  }

  function renderSubcategoryChips() {
    subcategoryChipsEl.innerHTML = "";
    const cat = findCategory(entryState.categoryId);
    if (!cat || cat.subcategories.length === 0) {
      subcategoryChipsEl.innerHTML = '<span class="empty-note">この大項目には小項目がありません</span>';
      entryState.subcategoryId = null;
      return;
    }
    if (!findSubcategory(entryState.categoryId, entryState.subcategoryId)) {
      entryState.subcategoryId = cat.subcategories[0].id;
    }
    cat.subcategories.forEach((sub) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip sub" + (sub.id === entryState.subcategoryId ? " selected" : "");
      chip.textContent = sub.name;
      chip.addEventListener("click", () => {
        entryState.subcategoryId = sub.id;
        renderSubcategoryChips();
      });
      subcategoryChipsEl.appendChild(chip);
    });
  }

  function renderRecent() {
    const rows = [...data.transactions]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 8);
    recentRowsEl.innerHTML = "";
    if (rows.length === 0) {
      recentRowsEl.innerHTML = '<div class="empty-note">まだ入力がありません</div>';
      return;
    }
    rows.forEach((t) => recentRowsEl.appendChild(buildTxRow(t, { showAction: true })));
  }

  function buildTxRow(t, { showAction }) {
    const row = document.createElement("div");
    row.className = "tx-row";

    const dateEl = document.createElement("div");
    dateEl.className = "tx-date";
    const [, m, d] = t.date.split("-");
    dateEl.textContent = `${Number(m)}/${Number(d)}`;
    row.appendChild(dateEl);

    const catEl = document.createElement("div");
    catEl.className = "tx-cat";
    catEl.innerHTML = `${categoryName(t.categoryId)} &gt; ${subcategoryName(t.categoryId, t.subcategoryId)}` +
      (t.memo ? `<span class="tx-memo">${escapeHtml(t.memo)}</span>` : "");
    row.appendChild(catEl);

    const amountEl = document.createElement("div");
    amountEl.className = "tx-amount " + t.type;
    amountEl.textContent = (t.type === "expense" ? "-" : "+") + yen(t.amount);
    row.appendChild(amountEl);

    if (showAction) {
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.title = "削除";
      delBtn.innerHTML = trashIcon();
      delBtn.addEventListener("click", () => {
        data.transactions = data.transactions.filter((x) => x.id !== t.id);
        saveData();
        renderRecent();
        renderHistory();
      });
      row.appendChild(delBtn);
    }
    return row;
  }

  function trashIcon() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>';
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!entryState.categoryId) return;
    const amount = Number(entryAmountInput.value);
    if (!amount || amount <= 0) return;
    data.transactions.push({
      id: uid(),
      date: entryDateInput.value || todayISO(),
      type: entryState.type,
      categoryId: entryState.categoryId,
      subcategoryId: entryState.subcategoryId,
      amount,
      memo: entryMemoInput.value.trim(),
    });
    saveData();
    entryAmountInput.value = "";
    entryMemoInput.value = "";
    renderRecent();
  });

  // ---------------------------------------------------------------------
  // 履歴・集計画面
  // ---------------------------------------------------------------------

  const monthSelect = document.getElementById("month-select");
  const statIncomeEl = document.getElementById("stat-income");
  const statExpenseEl = document.getElementById("stat-expense");
  const statBalanceEl = document.getElementById("stat-balance");
  const breakdownRowsEl = document.getElementById("breakdown-rows");
  const breakdownEmptyEl = document.getElementById("breakdown-empty");
  const txRowsEl = document.getElementById("tx-rows");
  const txEmptyEl = document.getElementById("tx-empty");

  monthSelect.value = currentYearMonth();

  document.getElementById("month-prev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("month-next").addEventListener("click", () => shiftMonth(1));
  monthSelect.addEventListener("change", renderHistory);

  function shiftMonth(delta) {
    const [y, m] = monthSelect.value.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    monthSelect.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    renderHistory();
  }

  function renderHistory() {
    const ym = monthSelect.value || currentYearMonth();
    const monthTx = data.transactions.filter((t) => t.date.startsWith(ym));

    const totalIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    statIncomeEl.textContent = yen(totalIncome);
    statExpenseEl.textContent = yen(totalExpense);
    statBalanceEl.textContent = (totalIncome - totalExpense >= 0 ? "+" : "") + yen(totalIncome - totalExpense);

    const byCategory = new Map();
    monthTx.filter((t) => t.type === "expense").forEach((t) => {
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) || 0) + t.amount);
    });
    const breakdown = [...byCategory.entries()]
      .map(([categoryId, total]) => ({ categoryId, total, name: categoryName(categoryId) }))
      .sort((a, b) => b.total - a.total);

    breakdownRowsEl.innerHTML = "";
    breakdownEmptyEl.hidden = breakdown.length > 0;
    const maxTotal = breakdown.length ? breakdown[0].total : 0;
    breakdown.forEach((row) => {
      const wrap = document.createElement("div");
      wrap.className = "breakdown-row";
      const pct = maxTotal ? Math.round((row.total / maxTotal) * 100) : 0;
      wrap.innerHTML = `
        <div class="breakdown-top"><span>${escapeHtml(row.name)}</span><span>${yen(row.total)}</span></div>
        <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:${pct}%"></div></div>
      `;
      breakdownRowsEl.appendChild(wrap);
    });

    const sortedTx = [...monthTx].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    txRowsEl.innerHTML = "";
    txEmptyEl.hidden = sortedTx.length > 0;
    sortedTx.forEach((t) => txRowsEl.appendChild(buildTxRow(t, { showAction: true })));
  }

  // ---------------------------------------------------------------------
  // カテゴリ設定画面
  // ---------------------------------------------------------------------

  const categoryListEl = document.getElementById("category-list");
  const subcategoryListEl = document.getElementById("subcategory-list");
  const subcategoryTitleEl = document.getElementById("subcategory-title");
  const subcategorySubtitleEl = document.getElementById("subcategory-subtitle");
  const addCategoryForm = document.getElementById("add-category-form");
  const newCategoryNameInput = document.getElementById("new-category-name");
  const addSubcategoryForm = document.getElementById("add-subcategory-form");
  const newSubcategoryNameInput = document.getElementById("new-subcategory-name");

  let selectedCategoryIdForSettings = null;

  function renderCategoriesView() {
    categoryListEl.innerHTML = "";
    if (!findCategory(selectedCategoryIdForSettings) && data.categories.length) {
      selectedCategoryIdForSettings = data.categories[0].id;
    }
    data.categories.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "list-row" + (cat.id === selectedCategoryIdForSettings ? " selected" : "");
      row.innerHTML = `<span>${escapeHtml(cat.name)}</span>`;
      row.addEventListener("click", () => {
        selectedCategoryIdForSettings = cat.id;
        renderCategoriesView();
      });
      const delBtn = document.createElement("button");
      delBtn.className = "list-row-remove";
      delBtn.innerHTML = closeIcon();
      delBtn.title = "この大項目を削除";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`「${cat.name}」を削除しますか?この大項目の取引の紐付けは解除されます。`)) return;
        data.categories = data.categories.filter((c) => c.id !== cat.id);
        saveData();
        renderCategoriesView();
        renderCategoryChips();
        renderSubcategoryChips();
        renderHistory();
        renderRecent();
      });
      row.appendChild(delBtn);
      categoryListEl.appendChild(row);
    });

    const selectedCat = findCategory(selectedCategoryIdForSettings);
    subcategoryListEl.innerHTML = "";
    if (!selectedCat) {
      subcategoryTitleEl.textContent = "小項目";
      subcategorySubtitleEl.textContent = "左の大項目を選ぶと、その小項目がここに表示されます";
      return;
    }
    subcategoryTitleEl.textContent = `「${selectedCat.name}」の小項目`;
    subcategorySubtitleEl.textContent = "左の大項目を選ぶと、その小項目がここに表示されます";

    if (selectedCat.subcategories.length === 0) {
      subcategoryListEl.innerHTML = '<div class="empty-note">まだ小項目がありません</div>';
    }
    selectedCat.subcategories.forEach((sub) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `<span>${escapeHtml(sub.name)}</span>`;
      const delBtn = document.createElement("button");
      delBtn.className = "list-row-remove";
      delBtn.innerHTML = closeIcon();
      delBtn.title = "この小項目を削除";
      delBtn.addEventListener("click", () => {
        if (!confirm(`「${sub.name}」を削除しますか?`)) return;
        selectedCat.subcategories = selectedCat.subcategories.filter((s) => s.id !== sub.id);
        saveData();
        renderCategoriesView();
        renderSubcategoryChips();
        renderHistory();
        renderRecent();
      });
      row.appendChild(delBtn);
      subcategoryListEl.appendChild(row);
    });
  }

  function closeIcon() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  }

  addCategoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newCategoryNameInput.value.trim();
    if (!name) return;
    const cat = { id: uid(), name, subcategories: [] };
    data.categories.push(cat);
    selectedCategoryIdForSettings = cat.id;
    saveData();
    newCategoryNameInput.value = "";
    renderCategoriesView();
    renderCategoryChips();
  });

  addSubcategoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newSubcategoryNameInput.value.trim();
    const cat = findCategory(selectedCategoryIdForSettings);
    if (!name || !cat) return;
    cat.subcategories.push({ id: uid(), name });
    saveData();
    newSubcategoryNameInput.value = "";
    renderCategoriesView();
    renderSubcategoryChips();
  });

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------

  (async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const body = await res.json();
        await enterApp(body.email);
      }
    } catch (e) {
      // stay on the auth screen if the check fails
    }
  })();
})();
