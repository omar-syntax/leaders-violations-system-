// =============================================
//  DASHBOARD — We School Violations System
// =============================================

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Config ----
// !! IMPORTANT: Replace this with your Google Apps Script Web App URL !!
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgkjdNxkmfeWLbr5lwr_xlA_A_izcn_Xvy2TRU-iLk-E27IdvT5EW-Ytuy6wSD8LOEQw/exec";

// ---- Elements ----
const userDisplayName = document.getElementById("user-display-name");
const userAvatar      = document.getElementById("user-avatar");
const logoutBtn       = document.getElementById("logout-btn");
const form            = document.getElementById("violation-form");
const submitBtn       = document.getElementById("submit-btn");
const submitSpinner   = document.getElementById("submit-spinner");
const clearBtn        = document.getElementById("clear-btn");
const successToast    = document.getElementById("success-toast");
const errorToast      = document.getElementById("error-toast");
const errorToastMsg   = document.getElementById("error-toast-msg");
const violationsCount = document.getElementById("violations-count");
const loadingState    = document.getElementById("loading-state");
const emptyState      = document.getElementById("empty-state");
const tableScroll     = document.getElementById("table-scroll");
const tbody           = document.getElementById("violations-tbody");

// Number input controls (Old - kept for reference or removal)
const repeatInput = document.getElementById("repeat-count");

// Searchable Dropdown elements
const categorySearch = document.getElementById("category-search");
const categoryHidden = document.getElementById("violation-category");
const categoryOptions = document.getElementById("category-options");

const VIOLATION_CATEGORIES = [
  "تعطيل الحصص الدراسية للمعلم أثناء", "عدم إحضار الأدوات", "الهروب من المدرسة", "عدم تهذيب الشعر",
  "مخالفة الزي المدرسي", "الإضرار بالبيئة المدرسية", "إتلاف وسائل ومصادر التعليم", "إحضار مواد خطرة أو أسلحة",
  "حيازة مخدرات أو تعاطيها", "إحضار مواد مخلة", "الغش في الامتحان", "حالات الفصل من المدرسة",
  "استخدام الموبايل أثناء الحصة", "التعصب الديني أو القبلي", "المشاجرات البسيطة", "استخدام ألفاظ غير لائقة",
  "التطاول على المدرس", "المشاجرات مع وقوع ضرر", "التنمر", "التحرش", "مشكلات عاطفية مع الجنس الآخر",
  "السرقة", "عدم ارتداء أدوات السيفني أو الإجراءات", "عدم نظافة الأظافر وطول الأظافر", "التدخين داخل المدرسة",
  "إحضار ألعاب نارية داخل المدرسة", "عدم الالتزام بمواعيد الحصص", "عدم الانضباط أثناء الطابور",
  "سوء سلوك في الحصة", "وضع مكياج للطالبات", "استخدام تابلت في الحصة", "ارتداء اكسسوار",
  "النوم في الحصة", "تناول الطعام في الحصة", "الردود غير المناسبة على المعلم", "عدم القيام بالواجبات المدرسية"
];

// ---- Current user ----
let currentUser = null;

// =============================================
//  AUTH GUARD
// =============================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  // Display name: use displayName or extract from email
  const name = user.displayName || user.email.split("@")[0];
  userDisplayName.textContent = name;
  userAvatar.textContent = name.charAt(0).toUpperCase();

  // Start listening to violations
  listenToViolations(user.uid);
});

// =============================================
//  LOGOUT
// =============================================
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout error:", err);
  }
});

// =============================================
//  SEARCHABLE DROPDOWN LOGIC
// =============================================
function setupSearchableDropdown() {
  const renderOptions = (filter = "") => {
    categoryOptions.innerHTML = "";
    const filtered = VIOLATION_CATEGORIES.filter(c => c.includes(filter));

    if (filtered.length === 0) {
      categoryOptions.innerHTML = `<div class="search-option no-results">لا توجد نتائج</div>`;
    } else {
      filtered.forEach(cat => {
        const div = document.createElement("div");
        div.className = "search-option";
        div.textContent = cat;
        div.addEventListener("click", () => {
          categorySearch.value = cat;
          categoryHidden.value = cat;
          categoryOptions.hidden = true;
          categorySearch.classList.remove("invalid");
        });
        categoryOptions.appendChild(div);
      });
    }
  };

  categorySearch.addEventListener("focus", () => {
    renderOptions(categorySearch.value);
    categoryOptions.hidden = false;
  });

  categorySearch.addEventListener("input", () => {
    renderOptions(categorySearch.value);
    categoryOptions.hidden = false;
    // Clear hidden value if it doesn't match exactly
    if (!VIOLATION_CATEGORIES.includes(categorySearch.value)) {
      categoryHidden.value = "";
    } else {
      categoryHidden.value = categorySearch.value;
    }
  });

  // Hide when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".searchable-wrapper")) {
      categoryOptions.hidden = true;
    }
  });
}

setupSearchableDropdown();

// =============================================
//  SUBMIT FORM
// =============================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  // Gather values
  const studentName = document.getElementById("student-name").value.trim();
  const className   = document.getElementById("class-name").value.trim();
  const violationDesc = document.getElementById("violation-desc").value.trim();
  const category    = categoryHidden.value;
  const repeatCount = repeatInput.value;
  const notes       = document.getElementById("notes").value.trim();

  // Basic validation
  let valid = true;
  [
    { id: "student-name",        val: studentName },
    { id: "class-name",          val: className },
    { id: "violation-desc",      val: violationDesc },
    { id: "category-search",     val: category }, // Check hidden category value
  ].forEach(({ id, val }) => {
    const el = document.getElementById(id);
    if (!val) { el.classList.add("invalid"); valid = false; }
    else       { el.classList.remove("invalid"); }
  });

  if (!valid) {
    showToast("error", "يرجى ملء جميع الحقول المطلوبة.");
    return;
  }

  setLoading(true);

  try {
    const docData = {
      studentName,
      className,
      violationDesc,
      category,
      repeatCount,
      notes,
      leaderName:  currentUser.displayName || currentUser.email.split("@")[0],
      leaderUid:   currentUser.uid,
      leaderEmail: currentUser.email,
      timestamp:   serverTimestamp(),
    };

    await addDoc(collection(db, "violations"), docData);

    // ---- Sync to Google Sheets via Apps Script ----
    if (APPS_SCRIPT_URL !== "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
      syncToSheets(docData);
    }

    showToast("success");
    clearForm();
  } catch (err) {
    console.error("Submit error:", err);
    showToast("error", "فشل تسجيل المخالفة، حاول مرة أخرى.");
  } finally {
    setLoading(false);
  }
});

// =============================================
//  SYNC TO SHEETS (Apps Script)
// =============================================
async function syncToSheets(data) {
  try {
    // Filter out unwanted fields (Firestore objects and internal IDs)
    // We remove timestamp because Apps Script generates its own,
    // and leaderUid/leaderEmail are not needed in the spreadsheet.
    const { timestamp, leaderUid, leaderEmail, ...filteredData } = data;

    // Using URLSearchParams (Form Data) is more reliable for no-cors with Apps Script
    const formData = new URLSearchParams();
    for (const key in filteredData) {
      formData.append(key, filteredData[key]);
    }

    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      cache: "no-cache",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    console.log("✅ Sync request sent to Apps Script");
  } catch (err) {
    console.error("❌ Sync error:", err);
  }
}

// =============================================
//  CLEAR FORM
// =============================================
clearBtn.addEventListener("click", clearForm);

function clearForm() {
  form.reset();
  categorySearch.value = "";
  categoryHidden.value = "";
  repeatInput.value = "غير متكرر";
  form.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
}

// =============================================
//  REAL-TIME VIOLATIONS LISTENER
// =============================================
function listenToViolations(uid) {
  const q = query(
    collection(db, "violations"),
    where("leaderUid", "==", uid),
    orderBy("timestamp", "desc")
  );

  onSnapshot(q, (snapshot) => {
    loadingState.hidden = true;

    if (snapshot.empty) {
      emptyState.hidden  = false;
      tableScroll.hidden = true;
      violationsCount.textContent = "0";
      return;
    }

    emptyState.hidden  = true;
    tableScroll.hidden = false;
    violationsCount.textContent = snapshot.size;

    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
      const d = doc.data();
      const ts = d.timestamp?.toDate();
      const dateStr = ts
        ? ts.toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" })
        : "—";

      const tr = document.createElement("tr");
      const repeatClass = d.repeatCount === "متكرر جداً" ? "high" : (d.repeatCount === "متكرر" ? "med" : "");
      tr.innerHTML = `
        <td>${escapeHtml(d.studentName)}</td>
        <td><span class="badge">${escapeHtml(d.className)}</span></td>
        <td>${escapeHtml(d.category)}</td>
        <td><span class="repeat-pill ${repeatClass}">${escapeHtml(d.repeatCount)}</span></td>
        <td class="date-cell">${dateStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }, (err) => {
    console.error("Firestore snapshot error:", err);
    loadingState.hidden = true;
    emptyState.hidden   = false;
    tableScroll.hidden  = true;
  });
}

// =============================================
//  HELPERS
// =============================================
let toastTimeout;
function showToast(type, message) {
  clearTimeout(toastTimeout);
  if (type === "error") {
    errorToastMsg.textContent = message || "حدث خطأ";
    errorToast.classList.add("show");
    successToast.classList.remove("show");
    toastTimeout = setTimeout(() => errorToast.classList.remove("show"), 4000);
  } else {
    successToast.classList.add("show");
    errorToast.classList.remove("show");
    toastTimeout = setTimeout(() => successToast.classList.remove("show"), 3500);
  }
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.querySelector(".btn-text").textContent = loading ? "جارٍ التسجيل..." : "تسجيل المخالفة";
  submitSpinner.hidden = !loading;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
