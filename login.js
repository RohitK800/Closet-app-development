// login.js — behaviour for login.html
const $ = id => document.getElementById(id);
let mode = "login"; // or "signup"

function setMode(next) {
  mode = next;
  const signup = mode === "signup";
  $("tabLogin").setAttribute("aria-selected", String(!signup));
  $("tabSignup").setAttribute("aria-selected", String(signup));
  $("nameField").hidden = !signup;
  $("pwHint").hidden = !signup;
  $("forgot").hidden = signup;
  $("title").textContent = signup ? "Create your closet" : "Welcome back";
  $("subtitle").textContent = signup ? "It takes a minute. Then start adding clothes." : "Log in to see today's outfits.";
  $("submit").textContent = signup ? "Create account" : "Log in";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  clearErrors();
  moveAuthInk();
  // fade the form fields in when switching between Log in and Sign up
  const card = document.querySelector(".auth-card form");
  card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
}
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");

$("togglePw").onclick = () => {
  const pw = $("password"), show = pw.type === "password";
  pw.type = show ? "text" : "password";
  $("togglePw").textContent = show ? "Hide" : "Show";
  $("togglePw").setAttribute("aria-label", show ? "Hide password" : "Show password");
};

function clearErrors() {
  $("err").textContent = ""; $("err").className = "err";
  ["name", "email", "password"].forEach(id => $(id).removeAttribute("aria-invalid"));
}
function showError(msg, fieldId) {
  $("err").className = "err"; $("err").textContent = msg;
  if (fieldId) { $(fieldId).setAttribute("aria-invalid", "true"); $(fieldId).focus(); }
}
function showInfo(msg) { $("err").className = "err info"; $("err").textContent = msg; }

function validate() {
  const name = $("name").value.trim(), email = $("email").value.trim(), pw = $("password").value;
  if (mode === "signup" && !name) return showError("Tell us your name.", "name"), false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showError("Enter a valid email address.", "email"), false;
  if (!pw) return showError("Enter your password.", "password"), false;
  if (mode === "signup" && (pw.length < 8 || !/\d/.test(pw))) return showError("Password needs 8+ characters and at least one number.", "password"), false;
  return true;
}

// Smooth hand-off to the main screen: a quick "Welcome" on the button, then the page slides away
function leavePage() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const btn = $("submit");
  btn.classList.add("success");
  btn.textContent = "Welcome to Closet";
  return new Promise(res => setTimeout(() => {
    document.documentElement.classList.add("leaving");
    setTimeout(res, 420);
  }, 450));
}
setTimeout(() => document.documentElement.classList.remove("page-enter"), 1800);

// Tab highlight glides between Log in and Sign up
function moveAuthInk() {
  const b = document.querySelector('.auth-tabs button[aria-selected="true"]'), ink = $("authInk");
  if (b && ink) { ink.style.width = b.offsetWidth + "px"; ink.style.transform = `translateX(${b.offsetLeft}px)`; }
}
window.addEventListener("resize", moveAuthInk);

$("form").addEventListener("submit", async e => {
  e.preventDefault();
  clearErrors();
  if (!validate()) return;
  const btn = $("submit"); btn.disabled = true;
  const label = btn.textContent; btn.textContent = mode === "signup" ? "Creating…" : "Logging in…";
  let leaving = false;
  try {
    const remember = $("remember").checked;
    if (mode === "signup") await Auth.signUp($("name").value, $("email").value, $("password").value, remember);
    else await Auth.signIn($("email").value, $("password").value, remember);
    leaving = true;
    await leavePage();
    window.location.replace("index.html");
  } catch (err) {
    showError(err.message || "Something went wrong. Try again.", err.code === "exists" ? "email" : null);
    if (err.code === "exists") setTimeout(() => setMode("login"), 1400);
  } finally {
    if (!leaving) { btn.disabled = false; btn.textContent = label; }
  }
});

$("forgot").onclick = async () => {
  clearErrors();
  try { await Auth.resetPassword($("email").value); } catch (err) { showInfo(err.message); }
};
$("google").onclick = () => {
  clearErrors();
  showInfo("Google sign-in works once the app is connected to a service like Firebase. For now, use email and password.");
};

setMode(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "login");
requestAnimationFrame(() => { moveAuthInk(); requestAnimationFrame(() => $("authInk").classList.add("ready")); });
document.fonts?.ready.then(moveAuthInk);
