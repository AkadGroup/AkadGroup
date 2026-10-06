// version: 1.0.0
//
// SECURITY NOTICE — THIS IS A MOCK, NOT AUTHENTICATION.
// Accounts live in localStorage on the visitor's own machine, passwords are
// stored unhashed, and the "admin" check runs in client-side JavaScript that
// anyone can edit from the console. It is a UI prototype for demonstrating
// role-based screens. Before this ships, credentials must move to a server,
// passwords must be hashed (bcrypt/argon2), and every admin action must be
// authorised server-side. Never put real customer passwords through this.
//
(function (global) {
  "use strict";

  const USERS_KEY = "users";
  const SESSION_KEY = "session";

  const ADMIN_EMAIL = "admin@akadgroup.com";
  const ADMIN_PASSWORD = "AkadAdmin2026!";
  const ADMIN_USERNAME = "AKAD Admin";

  const MIN_USERNAME_LENGTH = 3;
  const MIN_PASSWORD_LENGTH = 8;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const ROLES = { ADMIN: "admin", USER: "customer", GUEST: "guest" };

  function normaliseEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function validateRegistration({ username, email, password }) {
    if (String(username || "").trim().length < MIN_USERNAME_LENGTH) {
      throw new Error("SHORT_USERNAME");
    }
    if (!EMAIL_PATTERN.test(normaliseEmail(email))) throw new Error("INVALID_EMAIL");
    if (String(password || "").length < MIN_PASSWORD_LENGTH) {
      throw new Error("WEAK_PASSWORD");
    }
  }

  function createAuth({ storage, emitterFactory }) {
    const emitter = emitterFactory();

    let users = storage.read(USERS_KEY, []);
    if (!Array.isArray(users)) users = [];

    let session = storage.read(SESSION_KEY, null);
    const supabase = global.AkadSupabase?.client;

    // Listen for Supabase session changes
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data && data.session) {
          syncSupabaseSession(data.session.user);
        }
      });

      supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (s && s.user) syncSupabaseSession(s.user);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
        }
      });
    }

    function syncSupabaseSession(user) {
      if (!user) return;
      const email = normaliseEmail(user.email);
      setSession({
        username: user.user_metadata?.username || email,
        email: email,
        role: email === ADMIN_EMAIL ? ROLES.ADMIN : ROLES.USER,
      });
    }

    function setSession(nextSession) {
      session = nextSession;
      if (nextSession) {
        storage.write(SESSION_KEY, nextSession);
      } else {
        storage.remove(SESSION_KEY);
      }
      emitter.emit(getSession());
    }

    function getSession() {
      return session ? { ...session } : null;
    }

    function findUser(email) {
      const target = normaliseEmail(email);
      return users.find((user) => user.email === target);
    }

    async function register({ username, email, password }) {
      validateRegistration({ username, email, password });
      const normalisedEmail = normaliseEmail(email);

      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: normalisedEmail,
          password,
          options: {
            data: { username: String(username).trim() }
          }
        });
        if (error) throw new Error(error.message);
        
        // Supabase might require email confirmation.
        // If auto-confirm is off, data.session is null.
        if (data.session) {
          syncSupabaseSession(data.user);
        } else {
          throw new Error("يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.");
        }
        return getSession();
      }

      // Local fallback
      if (normalisedEmail === ADMIN_EMAIL) throw new Error("EMAIL_RESERVED");
      if (findUser(normalisedEmail)) throw new Error("EMAIL_TAKEN");

      users = [
        ...users,
        { username: String(username).trim(), email: normalisedEmail, password },
      ];
      storage.write(USERS_KEY, users);

      setSession({
        username: String(username).trim(),
        email: normalisedEmail,
        role: ROLES.USER,
      });
      return getSession();
    }

    async function login({ email, password }) {
      const normalisedEmail = normaliseEmail(email);

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalisedEmail,
          password
        });
        
        // If Supabase login succeeds:
        if (!error && data.user) {
          syncSupabaseSession(data.user);
          return getSession();
        }
        
        // If Supabase fails, but it's the hardcoded admin, let them in locally 
        // (so you don't get locked out of your prototype)
        if (normalisedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          console.warn("Supabase auth failed. Falling back to local admin.");
          setSession({
            username: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            role: ROLES.ADMIN,
          });
          return getSession();
        }
        
        throw new Error(error ? error.message : "INVALID_CREDENTIALS");
      }

      // Local fallback
      if (normalisedEmail === ADMIN_EMAIL) {
        if (password !== ADMIN_PASSWORD) throw new Error("INVALID_CREDENTIALS");
        setSession({
          username: ADMIN_USERNAME,
          email: ADMIN_EMAIL,
          role: ROLES.ADMIN,
        });
        return getSession();
      }

      const user = findUser(normalisedEmail);
      if (!user || user.password !== password) throw new Error("INVALID_CREDENTIALS");

      setSession({ username: user.username, email: user.email, role: ROLES.USER });
      return getSession();
    }

    function continueAsGuest() {
      setSession({ username: "زائر", email: "", role: ROLES.GUEST });
      return getSession();
    }

    async function logout() {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setSession(null);
    }

    function isAdmin() {
      return session?.role === ROLES.ADMIN;
    }

    return {
      register,
      login,
      continueAsGuest,
      logout,
      getSession,
      isAdmin,
      subscribe: emitter.subscribe,
    };
  }

  global.AkadAuth = { createAuth, ROLES, ADMIN_EMAIL };
})(window);
