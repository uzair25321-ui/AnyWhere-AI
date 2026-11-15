const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.classList.add("js-ready");

/* Navigation, scroll progress */

const nav = document.getElementById("site-nav");
const navToggle = document.getElementById("nav-toggle");
const scrollProgress = document.getElementById("scroll-progress");

function updateScrollState() {
  const scrolled = window.scrollY > 12;
  nav.classList.toggle("is-scrolled", scrolled);
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  scrollProgress.style.width = `${Math.min(progress, 100)}%`;
}

updateScrollState();
window.addEventListener("scroll", updateScrollState, { passive: true });
window.addEventListener("resize", updateScrollState);

navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});

document.querySelectorAll("#nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("click", (event) => {
  if (!nav.contains(event.target) && nav.classList.contains("is-open")) {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const target = targetId && targetId !== "#" ? document.querySelector(targetId) : null;
    if (!target) return;
    event.preventDefault();
    history.pushState(null, "", targetId);
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
});

/* Reveal on scroll */

const revealItems = Array.from(document.querySelectorAll(".reveal"));
revealItems.forEach((element) => {
  const siblings = Array.from(element.parentElement.children).filter((node) => node.classList.contains("reveal"));
  const index = Math.min(siblings.indexOf(element), 5);
  element.style.setProperty("--delay", `${Math.max(index, 0) * 70}ms`);
});

if ("IntersectionObserver" in window && !reduceMotion) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -50px 0px" }
  );
  revealItems.forEach((element) => revealObserver.observe(element));
} else {
  revealItems.forEach((element) => element.classList.add("is-visible"));
}

/* Hero typewriter */

const typedInstruction = document.getElementById("typed-instruction");
const instructions = [
  "Improve the writing while keeping my tone.",
  "Fix grammar and punctuation.",
  "Translate to Urdu.",
  "Make this reply more polite."
];

if (typedInstruction) {
  if (reduceMotion) {
    typedInstruction.textContent = instructions[0];
  } else {
    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;

    const tick = () => {
      const phrase = instructions[phraseIndex];
      typedInstruction.textContent = phrase.slice(0, characterIndex);

      if (!deleting && characterIndex < phrase.length) {
        characterIndex += 1;
        setTimeout(tick, 38 + Math.random() * 42);
        return;
      }

      if (!deleting && characterIndex === phrase.length) {
        deleting = true;
        setTimeout(tick, 1900);
        return;
      }

      if (deleting && characterIndex > 0) {
        characterIndex -= 1;
        setTimeout(tick, 18);
        return;
      }

      deleting = false;
      phraseIndex = (phraseIndex + 1) % instructions.length;
      setTimeout(tick, 320);
    };

    characterIndex = 0;
    setTimeout(tick, 900);
  }
}

/* Subtle tilt on the hero mockup */

const heroVisual = document.getElementById("hero-visual");
const appTilt = document.getElementById("app-tilt");

if (heroVisual && appTilt && !reduceMotion && window.matchMedia("(min-width: 961px)").matches) {
  heroVisual.addEventListener("pointermove", (event) => {
    const rect = heroVisual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    appTilt.style.transform = `rotateX(${(-y * 4.5).toFixed(2)}deg) rotateY(${(x * 5.5).toFixed(2)}deg)`;
  });

  heroVisual.addEventListener("pointerleave", () => {
    appTilt.style.transform = "";
  });
}

/* Markdown renderer for the interactive demo */

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderInline(raw) {
  const codeSpans = [];
  let text = escapeHtml(raw).replace(/`([^`\n]+)`/g, (_match, code) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });
  text = text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
      return /^https?:\/\//i.test(url) ? `<span class="md-link" title="${url}">${label}</span>` : label;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => codeSpans[Number(index)]);
}

function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let paragraph = [];
  let list = null;
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    output.push(`<${list.type}>${list.items.join("")}</${list.type}>`);
    list = null;
  };

  const flushBlocks = () => {
    flushParagraph();
    closeList();
  };

  while (index < lines.length) {
    const line = lines[index];

    if (/^\s*```/.test(line)) {
      flushBlocks();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(`<pre class="md-code"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushBlocks();
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushBlocks();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushBlocks();
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushBlocks();
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${quote.map(renderInline).join("<br>")}</blockquote>`);
      continue;
    }

    const orderedItem = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const bulletItem = line.match(/^\s*[-*+]\s+(.*)$/);
    if (orderedItem || bulletItem) {
      const type = orderedItem ? "ol" : "ul";
      if (list && list.type !== type) closeList();
      if (!list) list = { type, items: [] };
      const content = orderedItem ? orderedItem[2] : bulletItem[1];
      if (type === "ul") {
        const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === "x";
          list.items.push(
            `<li class="md-task"><span class="md-check${checked ? " is-checked" : ""}" aria-hidden="true">${checked ? "✓" : ""}</span><span>${renderInline(task[2])}</span></li>`
          );
          index += 1;
          continue;
        }
      }
      list.items.push(`<li>${renderInline(content)}</li>`);
      index += 1;
      continue;
    }

    closeList();
    paragraph.push(line);
    index += 1;
  }

  flushBlocks();
  return output.join("");
}

/* Demo data */

const samples = {
  email: {
    instruction: "Polish this launch update for my team.",
    markdown: [
      "Here is a cleaner version with **one clear ask**:",
      "",
      "Hi team,",
      "",
      "The v1.0 launch is **on track** for *Friday, November 21*. We closed the last two QA issues this morning. 🎉",
      "",
      "What changed:",
      "- Clearer onboarding copy",
      "- Faster first-run setup",
      "- A new **rich formatting** preview",
      "",
      "Please review the notes before Thursday and flag anything that feels off.",
      "",
      "Thanks!"
    ].join("\n")
  },
  checklist: {
    instruction: "Turn these launch notes into a checklist.",
    markdown: [
      "# Launch checklist",
      "",
      "- [x] Finalize the Windows installer",
      "- [x] Test the global shortcut",
      "- [ ] Publish the landing page",
      "- [ ] Record the 40-second demo",
      "- [ ] Send the announcement email",
      "",
      "**Reminder:** review AI responses before replacing your text. ✅",
      "",
      "> Ship the *important* 80% first, then iterate."
    ].join("\n")
  },
  code: {
    instruction: "Explain what this helper does.",
    markdown: [
      "This helper finds the first provider that is not busy:",
      "",
      "```js",
      "function nextProvider(providers) {",
      "  return providers.find((p) => !p.busy) ?? null;",
      "}",
      "```",
      "",
      "1. `find` stops at the first match.",
      "2. `?? null` keeps the return value predictable.",
      "3. The original list is **not mutated**.",
      "",
      "Use it when you only need one available provider at a time. 🧩"
    ].join("\n")
  }
};

const demoRendered = document.getElementById("demo-rendered");
const demoRaw = document.getElementById("demo-raw");
const demoInstruction = document.getElementById("demo-instruction");
const sampleChips = Array.from(document.querySelectorAll(".sample-chip"));
const modeButtons = Array.from(document.querySelectorAll(".demo-toggle button"));

function setDemoSample(key) {
  const sample = samples[key];
  if (!sample) return;
  demoInstruction.textContent = sample.instruction;
  demoRendered.innerHTML = renderMarkdown(sample.markdown);
  demoRaw.textContent = sample.markdown;
  sampleChips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.sample === key));
  if (!reduceMotion) {
    demoRendered.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 260, easing: "ease-out" }
    );
  }
}

function setDemoMode(mode) {
  const raw = mode === "raw";
  demoRendered.hidden = raw;
  demoRaw.hidden = !raw;
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
}

sampleChips.forEach((chip) => {
  chip.addEventListener("click", () => setDemoSample(chip.dataset.sample));
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setDemoMode(button.dataset.mode));
});

setDemoSample("email");
setDemoMode("formatted");

/* FAQ accordion */

document.querySelectorAll(".faq-item").forEach((item) => {
  const question = item.querySelector(".faq-question");
  question.addEventListener("click", () => {
    const isOpen = item.classList.contains("is-open");
    document.querySelectorAll(".faq-item.is-open").forEach((openItem) => {
      openItem.classList.remove("is-open");
      openItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
    });
    if (!isOpen) {
      item.classList.add("is-open");
      question.setAttribute("aria-expanded", "true");
    }
  });
});

/* Checksum copy */

const checksumCopy = document.getElementById("checksum-copy");
const checksumValue = document.getElementById("checksum-value");

if (checksumCopy && checksumValue) {
  checksumCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(checksumValue.textContent.trim());
      checksumCopy.classList.add("is-copied");
      setTimeout(() => checksumCopy.classList.remove("is-copied"), 1600);
    } catch {
      /* Clipboard access can be blocked; the checksum stays selectable. */
    }
  });
}

/* Download link and counter */

const downloadLink = document.getElementById("download-link");
const downloadCount = document.getElementById("download-count");
const downloadCountWrap = document.getElementById("download-count-wrap");
const siteConfig = window.ANYWHERE_CONFIG || {};
const githubRepo = String(siteConfig.githubRepo || "").trim();
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
let downloadTotal = 0;
let hasLoadedCount = false;

function animateCount(target) {
  const start = downloadTotal;
  downloadTotal = target;
  if (reduceMotion) {
    downloadCount.textContent = target.toLocaleString();
    return;
  }
  const startedAt = performance.now();
  const duration = 700;

  const frame = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + (target - start) * eased);
    downloadCount.textContent = value.toLocaleString();
    if (progress < 1) requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

function showCountUnavailable(message) {
  if (hasLoadedCount) return;
  downloadCount.textContent = "—";
  downloadCountWrap.classList.add("is-offline");
  downloadCountWrap.title = message;
}

async function loadLocalCount() {
  try {
    const response = await fetch("/api/downloads", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Counter unavailable");
    const data = await response.json();
    downloadCountWrap.classList.remove("is-offline");
    downloadCountWrap.removeAttribute("title");
    hasLoadedCount = true;
    animateCount(Number(data.count) || 0);
  } catch {
    showCountUnavailable("Start the download server to show the live count.");
  }
}

function showExactCount(count) {
  downloadCountWrap.classList.remove("is-offline");
  downloadCountWrap.removeAttribute("title");
  hasLoadedCount = true;
  animateCount(count);
}

function setReleaseText(id, value) {
  const element = document.getElementById(id);
  if (element && value) element.textContent = value;
}

function updateReleaseDetails(release, asset) {
  const version = String(release.tag_name || "").replace(/^v/i, "");
  const versionLabel = version ? `v${version}` : "";
  setReleaseText("release-version-chip", versionLabel);
  setReleaseText("download-facts-version", version);
  setReleaseText("download-version", versionLabel);
  setReleaseText("install-meta-version", version);
  setReleaseText("install-file-name", asset.name);

  const megabytes = Math.round((Number(asset.size) || 0) / (1024 * 1024));
  if (megabytes > 0) {
    const sizeLabel = `${megabytes} MB`;
    setReleaseText("download-facts-size", sizeLabel);
    setReleaseText("install-meta-size", sizeLabel);
    setReleaseText("install-file-size", sizeLabel);
  }

  if (asset.name) {
    setReleaseText("install-powershell-command", `Get-FileHash ".\\${asset.name}" -Algorithm SHA256`);
  }

  if (/^sha256:/i.test(asset.digest || "")) {
    const hash = asset.digest.slice(7).toUpperCase();
    if (checksumValue) checksumValue.textContent = hash;
    const installChecksum = document.getElementById("install-checksum-value");
    if (installChecksum) installChecksum.textContent = hash;
  }
}

async function loadGithubStats() {
  const configDownloadUrl = String(siteConfig.downloadUrl || "").trim();
  // A hard-coded release asset can point at an old tag; GitHub's latest release wins.
  const fallbackUrl = configDownloadUrl && !/\/releases\/download\//i.test(configDownloadUrl)
    ? configDownloadUrl
    : `https://github.com/${githubRepo}/releases/latest`;
  try {
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) throw new Error("Release unavailable");
    const release = await response.json();
    const asset = (release.assets || []).find((item) => /\.exe$/i.test(item.name));
    if (!asset) throw new Error("Installer asset missing");
    downloadLink.href = asset.browser_download_url || fallbackUrl;
    updateReleaseDetails(release, asset);
    showExactCount(Number(asset.download_count) || 0);
  } catch {
    downloadLink.href = fallbackUrl;
    if (checksumValue) checksumValue.textContent = "Unavailable — see the release notes";
    const installChecksum = document.getElementById("install-checksum-value");
    if (installChecksum) installChecksum.textContent = "Unavailable — see the release notes";
    loadShieldsCount();
  }
}

async function loadShieldsCount() {
  try {
    const bucket = Math.floor(Date.now() / 120000);
    const response = await fetch(`https://img.shields.io/github/downloads/${githubRepo}/total.json?b=${bucket}`);
    if (!response.ok) throw new Error("Count unavailable");
    const data = await response.json();
    const raw = String(data.message || "").trim();
    const message = /^no downloads$/i.test(raw) ? "0" : raw;
    const numeric = Number(message.replace(/,/g, ""));
    if (/^[\d.,]+$/.test(message) && Number.isFinite(numeric)) {
      showExactCount(numeric);
    } else {
      downloadCountWrap.classList.remove("is-offline");
      downloadCountWrap.removeAttribute("title");
      downloadCount.textContent = message;
      hasLoadedCount = true;
    }
  } catch {
    showCountUnavailable("Download count is unavailable right now.");
  }
}

if (window.location.protocol === "file:") {
  downloadLink.href = encodeURI("../release/Anywhere AI-Setup-1.0.2.exe");
} else if (isLocalHost) {
  loadLocalCount();
} else if (githubRepo) {
  loadGithubStats();
} else if (siteConfig.downloadUrl) {
  downloadLink.href = siteConfig.downloadUrl;
  showCountUnavailable("Live count ke liye config.js mein githubRepo set karein.");
} else {
  downloadLink.href = "#download";
  showCountUnavailable("Deploy se pehle config.js mein githubRepo ya downloadUrl set karein.");
}

if (downloadLink && isLocalHost && window.location.protocol !== "file:") {
  downloadLink.addEventListener("click", () => {
    setTimeout(loadLocalCount, 2200);
  });
}

/* Install guide dialog */

const installDialog = document.getElementById("install-dialog");
const installGuideOpen = document.getElementById("install-guide-open");
const installClose = document.getElementById("install-close");
const installAction = document.getElementById("install-action");
const installDownloadLink = document.getElementById("install-download-link");
const installChecksumValue = document.getElementById("install-checksum-value");

if (installDialog && installGuideOpen && installAction) {
  if (installChecksumValue && checksumValue) {
    installChecksumValue.textContent = checksumValue.textContent.trim();
  }

  const setActionMode = (mode) => {
    installAction.dataset.mode = mode;
    installAction.textContent = mode === "close" ? "Got it" : "Download installer";
  };

  const openInstallGuide = (downloadStarted) => {
    installDownloadLink.href = downloadLink.href;
    setActionMode(downloadStarted ? "close" : "download");
    if (installDialog.open) return;
    installDialog.querySelector(".install-body").scrollTop = 0;
    installDialog.showModal();
    document.documentElement.classList.add("modal-open");
  };

  installGuideOpen.addEventListener("click", () => openInstallGuide(false));

  installDownloadLink.addEventListener("click", (event) => {
    event.preventDefault();
    downloadLink.click();
    installDownloadLink.href = downloadLink.href;
    setActionMode("close");
  });

  installAction.addEventListener("click", () => {
    if (installAction.dataset.mode === "download") {
      downloadLink.click();
      setActionMode("close");
      return;
    }
    installDialog.close();
  });

  installClose.addEventListener("click", () => installDialog.close());

  installDialog.addEventListener("click", (event) => {
    if (event.target === installDialog) installDialog.close();
  });

  installDialog.addEventListener("close", () => {
    document.documentElement.classList.remove("modal-open");
  });

  downloadLink.addEventListener("click", () => openInstallGuide(true));
}

/* Feedback form */

const supabaseHeaders = (key) => {
  const headers = { apikey: key };
  // Legacy anon keys are JWTs; new publishable keys must not go in Authorization.
  if (/^eyJ[A-Za-z0-9_-]+\./.test(key)) headers.Authorization = `Bearer ${key}`;
  return headers;
};

const feedbackForm = document.getElementById("feedback-form");

if (feedbackForm) {
  const nameField = feedbackForm.elements.namedItem("name");
  const emailField = feedbackForm.elements.namedItem("email");
  const categoryField = feedbackForm.elements.namedItem("category");
  const ratingField = feedbackForm.elements.namedItem("rating");
  const sourceField = feedbackForm.elements.namedItem("source");
  const versionField = feedbackForm.elements.namedItem("app_version");
  const honeyField = feedbackForm.elements.namedItem("company");
  const showPublicField = feedbackForm.elements.namedItem("show_public");
  const feedbackMessage = document.getElementById("feedback-message");
  const feedbackMeter = document.getElementById("feedback-meter");
  const feedbackStatus = document.getElementById("feedback-status");
  const feedbackSubmit = document.getElementById("feedback-submit");
  const feedbackSuccess = document.getElementById("feedback-success");
  const feedbackAgain = document.getElementById("feedback-again");
  const submitLabel = feedbackSubmit.querySelector("span");

  const supabaseUrl = String(siteConfig.supabaseUrl || "").trim().replace(/\/+$/, "");
  const supabaseKey = String(siteConfig.supabaseAnonKey || "").trim();
  const feedbackTable = String(siteConfig.feedbackTable || "feedback").trim();
  const feedbackReady =
    /^https:\/\/[a-z0-9.-]+/i.test(supabaseUrl) &&
    supabaseKey.length > 20 &&
    /^[a-z_][a-z0-9_]*$/i.test(feedbackTable);

  const params = new URLSearchParams(window.location.search);
  const fromApp = params.get("from") === "app";
  const appVersion = String(params.get("v") || "").trim().slice(0, 24);

  sourceField.value = fromApp ? "app" : "website";
  versionField.value = appVersion;

  const restoreSavedDetails = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("anywhere-ai-feedback") || "null");
      if (!saved) return;
      if (saved.name) nameField.value = String(saved.name).slice(0, 80);
      if (saved.email) emailField.value = String(saved.email).slice(0, 160);
    } catch {
      /* A blocked storage API should not stop the form. */
    }
  };

  restoreSavedDetails();

  const updateMeter = () => {
    const length = feedbackMessage.value.length;
    feedbackMeter.textContent = `${length} / 1500`;
    feedbackMeter.classList.toggle("is-near", length > 1350);
  };

  const setStatus = (message, ok = false) => {
    feedbackStatus.textContent = message;
    feedbackStatus.classList.toggle("is-ok", ok);
  };

  const showSuccess = () => {
    feedbackForm.hidden = true;
    feedbackSuccess.hidden = false;
    setStatus("");
    feedbackSuccess.focus();
  };

  feedbackMessage.addEventListener("input", updateMeter);
  updateMeter();

  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (honeyField.value) {
      showSuccess();
      return;
    }

    const category = categoryField.value;
    const name = nameField.value.trim().replace(/\s+/g, " ");
    const message = feedbackMessage.value.trim();
    const email = emailField.value.trim();
    const rating = ratingField.value ? Number(ratingField.value) : null;

    if (name.length < 2) {
      setStatus("Please enter your name (at least 2 characters).");
      nameField.focus();
      return;
    }

    if (!category) {
      setStatus("Choose a feedback type first.");
      return;
    }

    if (message.length < 3) {
      setStatus("Write a short message so I know what to look at.");
      feedbackMessage.focus();
      return;
    }

    if (message.length > 1500) {
      setStatus("Please keep the message under 1500 characters.");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus("That email looks incomplete — fix it or leave it empty.");
      emailField.focus();
      return;
    }

    if (!feedbackReady) {
      setStatus("Feedback is not connected yet. Please try again later.");
      console.warn("Add supabaseUrl and supabaseAnonKey to site/config.js to receive feedback.");
      return;
    }

    feedbackSubmit.disabled = true;
    if (submitLabel) submitLabel.textContent = "Sending…";

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(feedbackTable)}`, {
        method: "POST",
        headers: {
          ...supabaseHeaders(supabaseKey),
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify([
          {
            name: name.slice(0, 80),
            email: email || null,
            category,
            rating,
            message,
            show_public: Boolean(showPublicField && showPublicField.checked),
            app_version: appVersion || null,
            source: fromApp ? "app" : "website",
            page_url: `${window.location.origin}${window.location.pathname}`.slice(0, 500)
          }
        ])
      });

      if (!response.ok) throw new Error(`Feedback endpoint returned ${response.status}`);

      try {
        localStorage.setItem("anywhere-ai-feedback", JSON.stringify({ name: name.slice(0, 80), email }));
      } catch {
        /* Saving the name and email is optional. */
      }

      showSuccess();
    } catch (error) {
      console.error("Feedback could not be sent:", error);
      setStatus("Feedback could not be sent. Check your connection and try again.");
    } finally {
      feedbackSubmit.disabled = false;
      if (submitLabel) submitLabel.textContent = "Send feedback";
    }
  });

  feedbackAgain.addEventListener("click", () => {
    feedbackForm.reset();
    sourceField.value = fromApp ? "app" : "website";
    versionField.value = appVersion;
    restoreSavedDetails();
    updateMeter();
    feedbackSuccess.hidden = true;
    feedbackForm.hidden = false;
    setStatus("");
    feedbackMessage.focus();
  });
}

/* Public reviews */

const reviewsSection = document.getElementById("reviews");
const reviewsGrid = document.getElementById("reviews-grid");

if (reviewsSection && reviewsGrid) {
  const reviewsUrl = String(siteConfig.supabaseUrl || "").trim().replace(/\/+$/, "");
  const reviewsKey = String(siteConfig.supabaseAnonKey || "").trim();
  const reviewsView = String(siteConfig.reviewsView || "feedback_public").trim();
  const reviewsReady =
    /^https:\/\/[a-z0-9.-]+/i.test(reviewsUrl) &&
    reviewsKey.length > 20 &&
    /^[a-z_][a-z0-9_]*$/i.test(reviewsView);

  const categoryLabels = {
    bug: "Bug report",
    idea: "Feature idea",
    praise: "Praise",
    other: "Feedback"
  };

  const initialsFor = (name) => {
    const parts = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0)).join("").toUpperCase() || "A";
  };

  const monthYear = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const buildReviewCard = (review, index) => {
    const name = String(review.name || "").trim().slice(0, 80);
    const message = String(review.message || "").trim().slice(0, 1500);
    if (!name || !message) return null;

    const rating = Number(review.rating);
    const card = document.createElement("article");
    card.className = "review-card";
    card.style.setProperty("--review-index", String(Math.min(index, 8)));

    const head = document.createElement("div");
    head.className = "review-head";

    const avatar = document.createElement("span");
    avatar.className = "review-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initialsFor(name);

    const meta = document.createElement("div");
    meta.className = "review-meta";

    const nameEl = document.createElement("strong");
    nameEl.textContent = name;

    const dateLabel = monthYear(review.created_at);
    const dateEl = document.createElement("small");
    dateEl.textContent = dateLabel ? `${dateLabel} · Anywhere AI user` : "Anywhere AI user";

    meta.append(nameEl, dateEl);

    if (rating >= 1 && rating <= 5) {
      const stars = document.createElement("span");
      stars.className = "review-stars";
      stars.setAttribute("role", "img");
      stars.setAttribute("aria-label", `${rating} out of 5 stars`);
      for (let star = 1; star <= 5; star += 1) {
        const glyph = document.createElement("span");
        glyph.setAttribute("aria-hidden", "true");
        glyph.textContent = "★";
        if (star > rating) glyph.className = "is-empty";
        stars.appendChild(glyph);
      }
      meta.appendChild(stars);
    }

    head.append(avatar, meta);

    const body = document.createElement("p");
    body.className = "review-message";
    body.textContent = message;

    card.append(head, body);

    const label = categoryLabels[review.category];
    if (label) {
      const tag = document.createElement("span");
      tag.className = "review-tag";
      tag.textContent = label;
      card.appendChild(tag);
    }

    return card;
  };

  const loadReviews = async () => {
    if (!reviewsReady) return;

    try {
      const query = `select=name,category,rating,message,created_at&order=created_at.desc&limit=9`;
      const response = await fetch(
        `${reviewsUrl}/rest/v1/${encodeURIComponent(reviewsView)}?${query}`,
        { headers: supabaseHeaders(reviewsKey) }
      );

      if (!response.ok) throw new Error(`Reviews endpoint returned ${response.status}`);

      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return;

      const cards = rows
        .map((review, index) => buildReviewCard(review || {}, index))
        .filter(Boolean);

      if (cards.length === 0) return;

      reviewsGrid.replaceChildren(...cards);
      reviewsSection.hidden = false;
    } catch (error) {
      console.warn("Reviews could not be loaded:", error);
    }
  };

  loadReviews();
}
