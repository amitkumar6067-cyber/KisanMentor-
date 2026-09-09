(function () {
  "use strict";
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("mobile-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.hasAttribute("hidden");
      if (open) nav.removeAttribute("hidden");
      else nav.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !nav.hasAttribute("hidden")) {
        nav.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  var bar = document.querySelector(".reading-progress");
  if (bar) {
    window.addEventListener("scroll", function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min((window.scrollY / h) * 100, 100) : 0) + "%";
    }, { passive: true });
  }

  var topBtn = document.querySelector(".back-top");
  if (topBtn) {
    window.addEventListener("scroll", function () {
      topBtn.classList.toggle("show", window.scrollY > 500);
    }, { passive: true });
    topBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 72, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-share=copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = btn.getAttribute("data-url") || location.href;
      function done() {
        var p = btn.textContent;
        btn.textContent = "कॉपी हो गया";
        setTimeout(function () { btn.textContent = p; }, 1800);
      }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(function () {});
      else done();
    });
  });

  document.querySelectorAll("[data-share=native]").forEach(function (btn) {
    if (!navigator.share) { btn.hidden = true; return; }
    btn.addEventListener("click", function () {
      navigator.share({
        title: btn.getAttribute("data-title") || document.title,
        url: btn.getAttribute("data-url") || location.href,
      }).catch(function () {});
    });
  });
})();
