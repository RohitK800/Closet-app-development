/*
  auth.js — sign-in for Closet (DEMO VERSION)

  IMPORTANT: this stores accounts in the browser only. It is fine for trying the
  app and showing it to people, but it is NOT real security: anyone with access to
  the device can read or clear the data, and accounts don't sync between devices.
  Before real users sign up, replace the bodies of signUp / signIn / signOut /
  resetPassword with a real auth service such as Firebase Authentication or
  Supabase Auth. The rest of the app only calls these functions, so nothing else
  needs to change.
*/
const Auth = (() => {
  const USERS_KEY = "closet-users";
  const SESSION_KEY = "closet-session";

  const read = (store, key, fallback) => {
    try { const v = JSON.parse(store.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
  };
  const write = (store, key, value) => {
    try { store.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  };

  async function hash(password, salt) {
    const text = salt + ":" + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return btoa(unescape(encodeURIComponent(text))); // fallback for very old browsers
  }

  const normalise = email => String(email || "").trim().toLowerCase();
  const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };

  function startSession(user, remember) {
    const session = { email: user.email, name: user.name, at: Date.now() };
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    write(remember ? localStorage : sessionStorage, SESSION_KEY, session);
    return session;
  }

  return {
    async signUp(name, email, password, remember = true) {
      email = normalise(email);
      const users = read(localStorage, USERS_KEY, {});
      if (users[email]) fail("exists", "An account with this email already exists. Try logging in.");
      const salt = Math.random().toString(36).slice(2, 12);
      users[email] = { name: String(name).trim(), email, salt, hash: await hash(password, salt), created: Date.now() };
      if (!write(localStorage, USERS_KEY, users)) fail("storage", "Couldn't save your account on this browser.");
      return startSession(users[email], remember);
    },

    async signIn(email, password, remember = true) {
      email = normalise(email);
      const user = read(localStorage, USERS_KEY, {})[email];
      if (!user || user.hash !== await hash(password, user.salt)) fail("bad_login", "That email and password don't match.");
      return startSession(user, remember);
    },

    signOut() {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    },

    async resetPassword(email) {
      // A real service emails a reset link. The demo can only say what would happen.
      fail("demo", "Password reset emails need a real sign-in service (like Firebase). In this demo, create a new account instead.");
    },

    current() {
      return read(sessionStorage, SESSION_KEY, null) || read(localStorage, SESSION_KEY, null);
    },

    // Call at the top of any page that should only be seen when logged in.
    requireLogin(loginPage = "login.html") {
      if (!this.current()) window.location.replace(loginPage);
    }
  };
})();
window.Auth = Auth; // make it reachable as window.Auth from other scripts
