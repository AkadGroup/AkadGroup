// version: 1.0.0
// Login / sign-up / guest modal. Translates auth error codes into Arabic
// messages; the auth store itself stays free of UI copy.
(function (global) {
  "use strict";

  const { el, button, field, setFieldError, notice } = global.AkadDom;
  const { ROLES } = global.AkadAuth;

  const TEXT = {
    titleSignedOut: "حسابي",
    titleSignedIn: "حسابي",
    tabLogin: "تسجيل الدخول",
    tabRegister: "حساب جديد",
    username: "اسم المستخدم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submitLogin: "تسجيل الدخول",
    submitRegister: "إنشاء الحساب",
    guest: "المتابعة كزائر",
    guestHint: "يمكنك الشراء دون إنشاء حساب.",
    logout: "تسجيل الخروج",
    signedInAs: "مسجّل الدخول باسم",
    roleAdmin: "مدير النظام",
    roleUser: "زبون",
    roleGuest: "زائر",
  };

  const ERROR_MESSAGES = {
    SHORT_USERNAME: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل.",
    INVALID_EMAIL: "أدخل بريدًا إلكترونيًا صحيحًا.",
    WEAK_PASSWORD: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    EMAIL_TAKEN: "هذا البريد مسجّل مسبقًا.",
    EMAIL_RESERVED: "هذا البريد محجوز.",
    INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  };

  const ROLE_LABELS = {
    [ROLES.ADMIN]: TEXT.roleAdmin,
    [ROLES.USER]: TEXT.roleUser,
    [ROLES.GUEST]: TEXT.roleGuest,
  };

  function messageFor(error) {
    console.error("[Auth Error]:", error);
    return ERROR_MESSAGES[error.message] || error.message || "تعذر إتمام العملية. حاول مرة أخرى.";
  }

  function init({ auth }) {
    const dialog = document.getElementById("auth-dialog");
    const title = document.getElementById("auth-title");
    const bodyElement = document.getElementById("auth-body");
    const closeButton = document.getElementById("auth-close");

    if (!dialog || !title || !bodyElement || !closeButton) {
      throw new Error("Auth markup is incomplete; cannot initialise the account modal.");
    }

    let mode = "login";
    let lastFocusedElement = null;

    function renderSignedIn(session) {
      title.textContent = TEXT.titleSignedIn;

      const panel = el("div", "account");
      panel.append(
        el("p", "account__label", TEXT.signedInAs),
        el("p", "account__name", session.username),
        el("p", "account__role", ROLE_LABELS[session.role] || session.role)
      );
      if (session.email) panel.appendChild(el("p", "account__email", session.email));

      panel.appendChild(
        button(TEXT.logout, "button button--ghost account__logout", () => {
          auth.logout();
          dialog.close();
        })
      );

      bodyElement.replaceChildren(panel);
    }

    function renderTabs() {
      const tabs = el("div", "tabs");
      tabs.setAttribute("role", "tablist");

      [
        { id: "login", label: TEXT.tabLogin },
        { id: "register", label: TEXT.tabRegister },
      ].forEach((tab) => {
        const tabButton = button(tab.label, "tab", () => {
          mode = tab.id;
          render();
        });
        tabButton.setAttribute("role", "tab");
        tabButton.setAttribute("aria-selected", String(mode === tab.id));
        if (mode === tab.id) tabButton.classList.add("tab--active");
        tabs.appendChild(tabButton);
      });

      return tabs;
    }

    function renderSignedOut() {
      title.textContent = TEXT.titleSignedOut;

      const form = el("form", "form");
      form.noValidate = true;

      const fields = {};
      if (mode === "register") {
        fields.username = field({
          id: "auth-username",
          label: TEXT.username,
          autocomplete: "username",
        });
      }
      fields.email = field({
        id: "auth-email",
        label: TEXT.email,
        type: "email",
        autocomplete: "email",
      });
      fields.password = field({
        id: "auth-password",
        label: TEXT.password,
        type: "password",
        autocomplete: mode === "register" ? "new-password" : "current-password",
      });

      Object.values(fields).forEach((part) => form.appendChild(part.wrapper));

      const submit = button(
        mode === "register" ? TEXT.submitRegister : TEXT.submitLogin,
        "button button--primary form__submit",
        async () => {
          Object.values(fields).forEach((part) => setFieldError(part, ""));
          form.querySelector(".notice")?.remove();

          const payload = {
            username: fields.username?.input.value,
            email: fields.email.input.value,
            password: fields.password.input.value,
          };

          try {
            if (mode === "register") {
              await auth.register(payload);
            } else {
              await auth.login(payload);
            }
            dialog.close();
          } catch (error) {
            form.appendChild(notice(messageFor(error), "error"));
          }
        }
      );
      form.appendChild(submit);

      const guestSection = el("div", "guest");
      guestSection.append(
        el("p", "guest__hint", TEXT.guestHint),
        button(TEXT.guest, "button button--accent guest__button", () => {
          auth.continueAsGuest();
          dialog.close();
        })
      );

      bodyElement.replaceChildren(renderTabs(), form, guestSection);
    }

    function render() {
      const session = auth.getSession();
      if (session) {
        renderSignedIn(session);
        return;
      }
      renderSignedOut();
    }

    function open(trigger) {
      lastFocusedElement = trigger instanceof HTMLElement ? trigger : document.activeElement;
      mode = "login";
      render();
      dialog.showModal();
    }

    closeButton.addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", () => {
      if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    });

    return { open };
  }

  global.AkadAuthUi = { init };
})(window);
