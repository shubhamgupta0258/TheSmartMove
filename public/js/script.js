/* ===================================================================
   THE SMART MOVE — interactions
   =================================================================== */
(function(){
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ---- Year ---- */
  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---- Navbar scroll state ---- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll(); window.addEventListener("scroll", onScroll, {passive:true});

  /* ---- Mobile drawer ---- */
  const burger = document.getElementById("burger");
  const drawer = document.getElementById("drawer");
  const toggleDrawer = (open) => {
    const isOpen = open ?? !drawer.classList.contains("open");
    drawer.classList.toggle("open", isOpen);
    burger.classList.toggle("open", isOpen);
    burger.setAttribute("aria-expanded", isOpen);
  };
  burger.addEventListener("click", () => toggleDrawer());
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", () => toggleDrawer(false)));

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    revealEls.forEach(el => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
    }, {threshold:.14, rootMargin:"0px 0px -8% 0px"});
    revealEls.forEach(el => io.observe(el));
  }

  /* ---- Counter animation ---- */
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || "";
    if (reduce){ el.textContent = target + suffix; return; }
    const dur = 1400, start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start)/dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window){
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting){ runCount(e.target); cio.unobserve(e.target); } });
    }, {threshold:.6});
    counters.forEach(c => cio.observe(c));
  } else counters.forEach(runCount);

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".faq-item").forEach(item => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q.addEventListener("click", () => {
      const open = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(i => {
        i.classList.remove("open");
        i.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!open){ item.classList.add("open"); a.style.maxHeight = a.scrollHeight + "px"; }
    });
  });

  /* ---- Testimonials carousel (homepage only) ---- */
  const track = document.getElementById("tTrack");
  const tNext = document.getElementById("tNext");
  const tPrev = document.getElementById("tPrev");
  if (track && tNext && tPrev) {
    const step = () => Math.min(track.querySelector(".tcard").offsetWidth + 20, track.clientWidth);
    tNext.addEventListener("click", () => track.scrollBy({left:step(), behavior:"smooth"}));
    tPrev.addEventListener("click", () => track.scrollBy({left:-step(), behavior:"smooth"}));
  }

  /* ---- Lead form (homepage only) ---- */
  const form = document.getElementById("leadForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.name.value.trim(), phone = form.phone.value.trim();
      if (!name || !phone){
        (!name ? form.name : form.phone).focus();
        return;
      }
      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, phone,
            email: form.email.value.trim(),
            exp: form.exp.value,
            time: form.time.value,
            goals: form.goals.value.trim(),
          }),
        });
        if (!res.ok) throw new Error("request failed");
        document.getElementById("formSuccess").classList.add("show");
        submitBtn.textContent = "Request Sent ✓";
        form.reset();
      } catch (err) {
        submitBtn.disabled = false;
        alert("Something went wrong sending your request. Please try again or WhatsApp us directly.");
      }
    });
  }

  /* ---- Exit-intent modal (once per session) ---- */
  const modal = document.getElementById("exitModal");
  const closeModal = () => modal.classList.remove("show");
  let shown = sessionStorage.getItem("sm_exit");
  const showModal = () => {
    if (shown) return;
    modal.classList.add("show");
    shown = true; sessionStorage.setItem("sm_exit","1");
  };
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalCta").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  // Desktop: mouse leaves toward top. Mobile: fallback timer.
  document.addEventListener("mouseout", (e) => { if (e.clientY <= 0 && !e.relatedTarget) showModal(); });
  if (window.matchMedia("(max-width:900px)").matches) setTimeout(showModal, 25000);

  /* ---- Market info modal (homepage only) ---- */
  const marketCards = document.querySelectorAll(".mcard[data-market]");
  const marketModal = document.getElementById("marketModal");
  if (marketCards.length && marketModal) {
    const MARKET_INFO = {
      stocks: {
        title: "Stocks",
        steps: [
          "A stock represents partial ownership in a company — when you buy a share, you own a small piece of that business.",
          "Prices move based on company performance, earnings, and overall market sentiment.",
          "Traders study price charts and company fundamentals to decide when to enter or exit a position.",
          "Risk management — like stop-losses and position sizing — protects your capital from large, unexpected moves.",
        ],
      },
      forex: {
        title: "Forex",
        steps: [
          "Forex (foreign exchange) is the market where currencies are bought and sold against each other, like USD/INR or EUR/USD.",
          "It's the world's largest and most liquid market, trading nearly 24 hours a day across global sessions.",
          "Prices move based on interest rates, economic data, and events between countries.",
          "Because of the high leverage available, disciplined risk management is essential before trading forex.",
        ],
      },
      crypto: {
        title: "Crypto",
        steps: [
          "Cryptocurrencies are digital assets, like Bitcoin and Ethereum, that trade on blockchain-based exchanges.",
          "Prices are driven by adoption, sentiment, regulation news, and broader market cycles.",
          "Crypto markets trade 24/7 and can be significantly more volatile than traditional markets.",
          "Structured risk management matters even more here — position sizing and having an exit plan are essential given the volatility.",
        ],
      },
      commodities: {
        title: "Commodities",
        steps: [
          "Commodities are physical goods, like gold, silver, and crude oil, that trade on regulated exchanges.",
          "Prices are driven by global supply and demand, geopolitical events, and currency movements.",
          "Many traders use commodities like gold as a hedge against inflation or market uncertainty.",
          "As with any market, technical analysis and disciplined risk management guide entries and exits.",
        ],
      },
      indices: {
        title: "Indices",
        steps: [
          "An index, like NIFTY 50 or SENSEX, tracks the combined performance of a basket of stocks — the broader market.",
          "Instead of picking individual stocks, traders can take a position on the overall direction of the market.",
          "Index movements reflect macroeconomic trends, earnings season, and global market sentiment.",
          "Index trading is often used to gauge broader market health before making other trading decisions.",
        ],
      },
    };

    const marketTitle = document.getElementById("marketModalTitle");
    const marketEyebrow = document.getElementById("marketModalEyebrow");
    const marketSteps = document.getElementById("marketModalSteps");

    const closeMarketModal = () => marketModal.classList.remove("show");
    const openMarketModal = (key) => {
      const info = MARKET_INFO[key];
      if (!info) return;
      marketEyebrow.textContent = "Markets We Teach";
      marketTitle.textContent = info.title;
      marketSteps.innerHTML = info.steps.map((s) => `<li>${s}</li>`).join("");
      marketModal.classList.add("show");
    };

    marketCards.forEach((card) => {
      card.addEventListener("click", () => openMarketModal(card.dataset.market));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMarketModal(card.dataset.market); }
      });
    });
    document.getElementById("marketModalClose").addEventListener("click", closeMarketModal);
    marketModal.addEventListener("click", (e) => { if (e.target === marketModal) closeMarketModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMarketModal(); });
  }

  /* ---- Live candlestick chart (canvas) ---- */
  const canvas = document.getElementById("chart");
  if (canvas && canvas.getContext){
    const ctx = canvas.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W, H;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR,0,0,DPR,0,0);
    };
    resize(); window.addEventListener("resize", resize);

    const COUNT = 34;
    let candles = [];
    let price = 100;
    const seed = () => {
      candles = [];
      price = 100;
      for (let i=0;i<COUNT;i++) candles.push(makeCandle());
    };
    function makeCandle(){
      const open = price;
      const drift = (Math.random() - 0.44) * 4.2;   // gentle bullish bias
      const close = Math.max(60, open + drift);
      const high = Math.max(open, close) + Math.random()*2.2;
      const low  = Math.min(open, close) - Math.random()*2.2;
      price = close;
      return {open, close, high, low};
    }

    function draw(){
      ctx.clearRect(0,0,W,H);
      const pad = 8;
      const cw = (W - pad*2) / COUNT;
      let min = Infinity, max = -Infinity;
      candles.forEach(c => { min = Math.min(min,c.low); max = Math.max(max,c.high); });
      const range = (max - min) || 1;
      const y = v => pad + (H - pad*2) * (1 - (v - min)/range);

      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let g=0; g<=3; g++){ const gy = pad + (H-pad*2)*g/3; ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

      // trend line (close prices) with gradient glow
      ctx.beginPath();
      candles.forEach((c,i) => { const cx = pad + cw*i + cw/2; const cy = y(c.close); i? ctx.lineTo(cx,cy):ctx.moveTo(cx,cy); });
      ctx.strokeStyle = "rgba(212,175,55,0.28)";
      ctx.lineWidth = 1.5; ctx.stroke();

      // candles
      candles.forEach((c,i) => {
        const cx = pad + cw*i + cw/2;
        const up = c.close >= c.open;
        const col = up ? "#00C853" : "#F44336";
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
        // wick
        ctx.beginPath(); ctx.moveTo(cx, y(c.high)); ctx.lineTo(cx, y(c.low)); ctx.stroke();
        // body
        const bw = Math.max(cw*0.55, 2);
        const yo = y(c.open), yc = y(c.close);
        const top = Math.min(yo,yc), bh = Math.max(Math.abs(yc-yo), 1.5);
        ctx.globalAlpha = up ? 0.95 : 0.9;
        ctx.fillRect(cx - bw/2, top, bw, bh);
        ctx.globalAlpha = 1;
      });

      // last price marker
      const last = candles[candles.length-1];
      const ly = y(last.close);
      ctx.fillStyle = "rgba(0,200,83,0.9)";
      ctx.beginPath(); ctx.arc(W - pad - 2, ly, 3, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(0,200,83,0.25)"; ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(W,ly); ctx.stroke(); ctx.setLineDash([]);
    }

    seed(); draw();
    if (!reduce){
      setInterval(() => { candles.push(makeCandle()); candles.shift(); draw(); }, 1400);
    }
  }

  /* ---- Smooth anchor offset for fixed nav ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({top, behavior: reduce ? "auto" : "smooth"});
    });
  });
})();
