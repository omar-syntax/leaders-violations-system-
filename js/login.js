// =============================================
//  LOGIN — We School Violations System
// =============================================

import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Elements ---
const form         = document.getElementById("login-form");
const emailInput   = document.getElementById("email");
const passwordInput= document.getElementById("password");
const loginBtn     = document.getElementById("login-btn");
const btnText      = loginBtn.querySelector(".btn-text");
const btnSpinner   = document.getElementById("btn-spinner");
const errorToast   = document.getElementById("error-toast");
const errorMsg     = document.getElementById("error-message");
const togglePwdBtn = document.getElementById("toggle-password");

// --- If already logged in, go to dashboard ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "dashboard.html";
  }
});

// --- Toggle password visibility ---
togglePwdBtn.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePwdBtn.querySelector("svg").innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
});

// --- Handle login ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will redirect automatically
  } catch (err) {
    setLoading(false);
    showError(getFriendlyError(err.code));
  }
});

// --- Helpers ---
function setLoading(loading) {
  loginBtn.disabled = loading;
  btnText.textContent  = loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول";
  btnSpinner.hidden    = !loading;
}

function showError(message) {
  errorMsg.textContent = message;
  errorToast.classList.add("visible");
}

function hideError() {
  errorToast.classList.remove("visible");
}

function getFriendlyError(code) {
  const errors = {
    "auth/invalid-email":           "البريد الإلكتروني غير صحيح.",
    "auth/user-not-found":          "لا يوجد حساب بهذا البريد الإلكتروني.",
    "auth/wrong-password":          "كلمة المرور غير صحيحة.",
    "auth/invalid-credential":      "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/too-many-requests":       "تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقاً.",
    "auth/network-request-failed":  "تحقق من اتصال الإنترنت.",
  };
  return errors[code] || "حدث خطأ غير متوقع، حاول مرة أخرى.";
}
