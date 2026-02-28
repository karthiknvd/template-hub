// ─── Global State ─────────────────────────────────────────────────────────────
let hasUnsavedChanges = false;
let currentEditable = null;
let currentTemplate = '';
let templateIframe = null;

// ─── DOM References ────────────────────────────────────────────────────────────
const mainPage = document.getElementById('mainPage');
const previewMode = document.getElementById('previewMode');
const templateContainer = document.getElementById('templateContainer');
const backButton = document.getElementById('backButton');
const confirmModal = document.getElementById('confirmModal');

// ─── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initializeCards();
    setupEventListeners();
    setupCardAnimations();
    injectFloatingToolbar();
    injectInlineToolbar();
});

// ─── Floating Drag Toolbar (Back + Download) ───────────────────────────────────
function injectFloatingToolbar() {
    if (backButton) backButton.style.display = 'none';

    const style = document.createElement('style');
    style.textContent = `
        #floatingToolbar {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: none;
            align-items: center;
            gap: 6px;
            background: rgba(15,15,20,0.92);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.13);
            border-radius: 100px;
            padding: 7px 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            user-select: none;
            cursor: grab;
        }
        #floatingToolbar.dragging { cursor: grabbing !important; box-shadow: 0 16px 48px rgba(0,0,0,0.45); }
        #floatingToolbar .tb-btn { cursor: pointer; }

        /* Drag grip */
        #tbGrip {
            display: flex;
            flex-direction: column;
            gap: 3px;
            padding: 2px 6px 2px 2px;
            opacity: 0.4;
            flex-shrink: 0;
        }
        #tbGrip span { display: flex; gap: 3px; }
        #tbGrip span i { width: 3px; height: 3px; border-radius: 50%; background: white; display: block; }
        #tbHint {
            position: absolute;
            top: calc(100% + 10px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.75);
            color: rgba(255,255,255,0.85);
            font-size: 0.7rem;
            padding: 5px 12px;
            border-radius: 20px;
            white-space: nowrap;
            pointer-events: none;
            transition: opacity 0.5s ease;
            font-family: inherit;
        }
        #tbHint.hidden { display: none; }
        #tbHint.fade { opacity: 0; }

        .tb-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            background: transparent;
            border: none;
            border-radius: 100px;
            color: rgba(255,255,255,0.85);
            font-size: 0.83rem;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.18s, color 0.18s;
        }
        .tb-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .tb-btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: #fff !important;
        }
        .tb-btn-primary:hover { background: linear-gradient(135deg, #7b8ff5, #8b5fbf) !important; }
        .tb-divider { width:1px; height:22px; background:rgba(255,255,255,0.15); margin:0 2px; flex-shrink:0; }

        #dragShield {
            display: none; position: fixed; inset: 0;
            z-index: 99999; cursor: grabbing; background: transparent;
        }

        /* ── Inline text toolbar ── */
        #inlineToolbar {
            position: fixed;
            z-index: 99998;
            display: none;
            align-items: center;
            gap: 4px;
            background: rgba(15,15,20,0.95);
            backdrop-filter: blur(14px);
            border: 1px solid rgba(255,255,255,0.13);
            border-radius: 10px;
            padding: 5px 8px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.4);
            pointer-events: all;
        }
        #inlineToolbar .it-btn {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.75);
            cursor: pointer;
            padding: 5px 8px;
            border-radius: 6px;
            font-size: 0.82rem;
            font-weight: 700;
            font-family: inherit;
            transition: background 0.15s, color 0.15s;
            white-space: nowrap;
            display: flex; align-items: center; gap: 4px;
            line-height: 1;
        }
        #inlineToolbar .it-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        #inlineToolbar .it-btn.active {
            background: rgba(102,126,234,0.3);
            color: #a5b4fc;
        }
        #inlineToolbar .it-divider { width:1px; height:18px; background:rgba(255,255,255,0.12); margin: 0 2px; flex-shrink:0; }
        #inlineToolbar input[type="color"] {
            width: 26px; height: 26px;
            border: 2px solid rgba(255,255,255,0.15);
            border-radius: 6px;
            cursor: pointer;
            background: none;
            padding: 1px;
            flex-shrink: 0;
        }
        #itSize {
            color: rgba(255,255,255,0.4);
            font-size: 0.72rem;
            min-width: 34px;
            text-align: center;
            font-family: inherit;
        }
        [data-ih-editable]:focus {
            outline: 2px solid #667eea !important;
            outline-offset: 3px !important;
        }
        [data-ih-img] {
            position: relative;
        }
        [data-ih-img]:hover {
            outline: 2px dashed #667eea !important;
            outline-offset: 3px;
            cursor: pointer !important;
        }
    `;
    document.head.appendChild(style);

    // Drag shield
    const shield = document.createElement('div');
    shield.id = 'dragShield';
    document.body.appendChild(shield);

    // Toolbar — always fully visible, labels always shown
    const toolbar = document.createElement('div');
    toolbar.id = 'floatingToolbar';
    toolbar.innerHTML = `
        <div id="tbGrip">
            <span><i></i><i></i></span>
            <span><i></i><i></i></span>
            <span><i></i><i></i></span>
        </div>
        <div id="tbHint" class="hidden">⠿ drag to move</div>
        <div class="tb-divider"></div>
        <button id="tbBack" class="tb-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M5 12L12 19M5 12L12 5"/>
            </svg>
            Back
        </button>
        <div class="tb-divider"></div>
        <button id="tbDownload" class="tb-btn tb-btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download HTML
        </button>
    `;
    document.body.appendChild(toolbar);

    document.getElementById('tbBack').addEventListener('click', handleBackClick);
    document.getElementById('tbDownload').addEventListener('click', downloadTemplate);

    // ── Drag ──────────────────────────────────────────────────────────────────
    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0, toolbarW = 0, toolbarH = 0;

    function initAbsPos() {
        if (toolbar.dataset.positioned) return;
        const r = toolbar.getBoundingClientRect();
        toolbar.style.left = r.left + 'px';
        toolbar.style.top = r.top + 'px';
        toolbar.style.transform = 'none';
        toolbar.dataset.positioned = '1';
    }

    function onIframeMouseMove(e) {
        if (!isDragging || !templateIframe) return;
        const r = templateIframe.getBoundingClientRect();
        moveDrag(e.clientX + r.left, e.clientY + r.top);
    }

    function startDrag(clientX, clientY) {
        initAbsPos();
        isDragging = true;
        const r = toolbar.getBoundingClientRect();
        toolbarW = r.width; toolbarH = r.height;
        dragOffsetX = clientX - r.left;
        dragOffsetY = clientY - r.top;
        toolbar.classList.add('dragging');
        shield.style.display = 'block';
        try {
            const id = templateIframe?.contentDocument;
            if (id) { id.addEventListener('mousemove', onIframeMouseMove); id.addEventListener('mouseup', endDrag); }
        } catch(e) {}
    }

    function moveDrag(clientX, clientY) {
        if (!isDragging) return;
        let x = Math.max(0, Math.min(window.innerWidth - toolbarW, clientX - dragOffsetX));
        let y = Math.max(0, Math.min(window.innerHeight - toolbarH, clientY - dragOffsetY));
        toolbar.style.left = x + 'px';
        toolbar.style.top = y + 'px';
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        toolbar.classList.remove('dragging');
        shield.style.display = 'none';
        try {
            const id = templateIframe?.contentDocument;
            if (id) { id.removeEventListener('mousemove', onIframeMouseMove); id.removeEventListener('mouseup', endDrag); }
        } catch(e) {}
    }

    toolbar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.tb-btn')) return;
        startDrag(e.clientX, e.clientY); e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);
    toolbar.addEventListener('touchstart', (e) => {
        if (e.target.closest('.tb-btn')) return;
        const t = e.touches[0]; startDrag(t.clientX, t.clientY); e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', (e) => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }, { passive: false });
    document.addEventListener('touchend', endDrag);
}

// ─── Inline Toolbar ────────────────────────────────────────────────────────────
function injectInlineToolbar() {
    // Single shared file input — created once, reused for every image
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.cssText = 'display:none;position:fixed;top:-9999px';
    fileInput.id = 'inlineImageUpload';
    document.body.appendChild(fileInput);

    const toolbar = document.createElement('div');
    toolbar.id = 'inlineToolbar';
    toolbar.innerHTML = `
        <input type="color" id="itColor" title="Text color" value="#000000">
        <div class="it-divider"></div>
        <button class="it-btn" id="itDecrease" title="Smaller">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span id="itSize">16px</span>
        <button class="it-btn" id="itIncrease" title="Larger">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="it-divider"></div>
        <button class="it-btn" id="itBold" title="Bold"><b style="font-size:0.9rem">B</b></button>
        <button class="it-btn" id="itItalic" title="Italic"><i style="font-size:0.9rem">I</i></button>
        <div class="it-divider"></div>
        <button class="it-btn" id="itDone" style="color:#818cf8;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            Done
        </button>
    `;
    document.body.appendChild(toolbar);

    document.getElementById('itColor').addEventListener('input', (e) => {
        if (currentEditable) { currentEditable.style.color = e.target.value; hasUnsavedChanges = true; }
    });

    document.getElementById('itDecrease').addEventListener('click', () => changeInlineSize(-2));
    document.getElementById('itIncrease').addEventListener('click', () => changeInlineSize(2));

    // Bold — toggle active state by checking queryCommandState
    document.getElementById('itBold').addEventListener('click', () => {
        try {
            templateIframe.contentDocument.execCommand('bold');
            updateFormatButtons();
            hasUnsavedChanges = true;
        } catch(e) {}
    });

    // Italic — same
    document.getElementById('itItalic').addEventListener('click', () => {
        try {
            templateIframe.contentDocument.execCommand('italic');
            updateFormatButtons();
            hasUnsavedChanges = true;
        } catch(e) {}
    });

    document.getElementById('itDone').addEventListener('click', closeInlineEdit);

    // Close when clicking in parent page (not toolbar)
    document.addEventListener('mousedown', (e) => {
        if (!document.getElementById('inlineToolbar').contains(e.target)) {
            closeInlineEdit();
        }
    });
}

// Update Bold/Italic button active states based on current selection
function updateFormatButtons() {
    try {
        const iframeDoc = templateIframe?.contentDocument;
        if (!iframeDoc) return;
        const boldBtn = document.getElementById('itBold');
        const italicBtn = document.getElementById('itItalic');
        if (boldBtn) boldBtn.classList.toggle('active', iframeDoc.queryCommandState('bold'));
        if (italicBtn) italicBtn.classList.toggle('active', iframeDoc.queryCommandState('italic'));
    } catch(e) {}
}

function positionInlineToolbar(el) {
    const toolbar = document.getElementById('inlineToolbar');
    if (!toolbar || !templateIframe) return;

    const iframeRect = templateIframe.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    toolbar.style.display = 'flex';
    // Measure toolbar width after making it visible
    const tbW = toolbar.offsetWidth;
    const tbH = toolbar.offsetHeight;

    const elTop = iframeRect.top + elRect.top;
    const elLeft = iframeRect.left + elRect.left;

    let top = elTop - tbH - 8;
    if (top < 8) top = elTop + elRect.height + 8;

    let left = elLeft;
    if (left + tbW > window.innerWidth - 8) left = window.innerWidth - tbW - 8;
    if (left < 8) left = 8;

    toolbar.style.top = top + 'px';
    toolbar.style.left = left + 'px';

    // Sync color + size
    const computed = templateIframe.contentWindow.getComputedStyle(el);
    document.getElementById('itColor').value = rgbToHex(computed.color);
    document.getElementById('itSize').textContent = Math.round(parseFloat(computed.fontSize)) + 'px';

    // Sync bold/italic state
    updateFormatButtons();
}

function closeInlineEdit() {
    const toolbar = document.getElementById('inlineToolbar');
    if (toolbar) toolbar.style.display = 'none';
    if (currentEditable) {
        currentEditable.contentEditable = 'false';
        currentEditable.style.outline = '';
        currentEditable.style.outlineOffset = '';
        currentEditable = null;
    }
}

function changeInlineSize(delta) {
    if (!currentEditable || !templateIframe) return;
    const size = parseFloat(templateIframe.contentWindow.getComputedStyle(currentEditable).fontSize);
    const newSize = Math.max(8, Math.min(200, size + delta));
    currentEditable.style.fontSize = newSize + 'px';
    document.getElementById('itSize').textContent = newSize + 'px';
    hasUnsavedChanges = true;
}

// ─── Card Animations ───────────────────────────────────────────────────────────
function setupCardAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.delay || 0;
                setTimeout(() => entry.target.classList.add('visible'), delay);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.template-card').forEach(card => observer.observe(card));
}

// ─── Template Cards ────────────────────────────────────────────────────────────
function initializeCards() {
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => loadTemplate(card.dataset.template));
    });
}

// ─── Event Listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
    if (backButton) backButton.addEventListener('click', handleBackClick);
    ['downloadBtn','editorPanel','closeEditor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.getElementById('cancelBack')?.addEventListener('click', () => { confirmModal.style.display = 'none'; });
    document.getElementById('confirmBack')?.addEventListener('click', () => { confirmModal.style.display = 'none'; resetAndGoBack(); });
    window.onbeforeunload = () => { if (hasUnsavedChanges) return "You have unsaved changes."; };
}

// ─── Load Template ─────────────────────────────────────────────────────────────
function loadTemplate(templateName) {
    currentTemplate = templateName;
    templateContainer.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%; height:100vh; border:none; display:block;';
    iframe.id = 'templateIframe';
    templateContainer.appendChild(iframe);
    templateIframe = iframe;

    fetch(`templates/${templateName}.html?v=${Date.now()}`)
        .then(res => {
            if (!res.ok) throw new Error('Template not found: ' + res.status);
            return res.text();
        })
        .then(html => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(html);
            iframeDoc.close();

            mainPage.style.display = 'none';
            previewMode.style.display = 'block';
            document.getElementById('floatingToolbar').style.display = 'flex';
            // Show drag hint briefly then fade
            const hint = document.getElementById('tbHint');
            if (hint) {
                hint.classList.remove('hidden', 'fade');
                setTimeout(() => hint.classList.add('fade'), 2500);
                setTimeout(() => hint.classList.add('hidden'), 3200);
            }

            iframe.onload = () => setupIframeInteractivity(iframe);
            setTimeout(() => {
                if (iframe.contentDocument?.readyState === 'complete') setupIframeInteractivity(iframe);
            }, 600);
        })
        .catch(err => { alert('Error loading template: ' + err.message); resetAndGoBack(); });
}

// ─── Setup Inline Editing Inside iframe ───────────────────────────────────────
function setupIframeInteractivity(iframe) {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc) return;

    const SKIP = new Set(['SCRIPT','STYLE','META','LINK','TITLE','HTML','HEAD','NOSCRIPT','IFRAME','BR','HR','SVG','PATH','CIRCLE','RECT','LINE','POLYLINE','POLYGON','G','DEFS','USE']);
    const TEXT_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LABEL','LI','DT','DD','TD','TH','CAPTION','FIGCAPTION','BLOCKQUOTE','CITE','SMALL','STRONG','EM','B','I','U','S','TIME','MARK','ABBR','ADDRESS','CODE','PRE']);

    let textCount = 0, imgCount = 0;

    iframeDoc.querySelectorAll('*').forEach(el => {
        if (SKIP.has(el.tagName)) return;

        // ── Images ────────────────────────────────────────────────────────────
        if (el.tagName === 'IMG') {
            el.dataset.ihImg = '1';
            el.style.cursor = 'pointer';
            el.title = 'Click to replace image';

            let imgClickLocked = false;
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Lock prevents double-fire from event bubbling
                if (imgClickLocked) return;
                imgClickLocked = true;

                const picker = iframeDoc.createElement('input');
                picker.type = 'file';
                picker.accept = 'image/*';
                picker.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
                iframeDoc.body.appendChild(picker);

                picker.addEventListener('change', () => {
                    if (picker.parentNode) picker.parentNode.removeChild(picker);
                    const file = picker.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => { el.src = re.target.result; hasUnsavedChanges = true; };
                        reader.readAsDataURL(file);
                    }
                    // Unlock after file chosen
                    setTimeout(() => { imgClickLocked = false; }, 300);
                });

                // Unlock if user cancels (no change event fires)
                picker.addEventListener('cancel', () => {
                    if (picker.parentNode) picker.parentNode.removeChild(picker);
                    setTimeout(() => { imgClickLocked = false; }, 300);
                });

                setTimeout(() => picker.click(), 0);
            });

            imgCount++;
            return;
        }

        // ── Text elements ─────────────────────────────────────────────────────
        const isTextTag = TEXT_TAGS.has(el.tagName);
        const hasDirectText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        if (!isTextTag && !hasDirectText) return;

        // Skip wrappers that contain images
        const containsImg = el.querySelector('img');
        if (containsImg && !isTextTag) return;

        // Skip <li> / container elements whose only content is a child <a> or inline tag
        // — the <a> itself is already editable, making both editable causes double outlines
        if (!isTextTag && hasDirectText === false) return;
        const onlyChildIsInline = el.children.length === 1 &&
            ['A','BUTTON','SPAN','STRONG','EM','B','I'].includes(el.children[0].tagName) &&
            ![...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        if (onlyChildIsInline) return;

        el.dataset.ihEditable = '1';
        el.style.cursor = 'text';

        el.addEventListener('mouseenter', function() {
            if (this !== currentEditable) {
                this.style.outline = '2px dashed rgba(102,126,234,0.5)';
                this.style.outlineOffset = '3px';
            }
        });
        el.addEventListener('mouseleave', function() {
            if (this !== currentEditable) {
                this.style.outline = '';
                this.style.outlineOffset = '';
            }
        });

        el.addEventListener('click', function(e) {
            e.stopPropagation();
            if (currentEditable && currentEditable !== this) {
                currentEditable.contentEditable = 'false';
                currentEditable.style.outline = '';
                currentEditable.style.outlineOffset = '';
            }
            currentEditable = this;
            this.contentEditable = 'true';
            this.focus();
            positionInlineToolbar(this);
            this.addEventListener('input', () => { hasUnsavedChanges = true; });
            // Update bold/italic state on selection change
            iframeDoc.addEventListener('selectionchange', updateFormatButtons);
        });

        textCount++;
    });

    // Close when clicking empty space
    iframeDoc.addEventListener('click', (e) => {
        if (!e.target.dataset.ihEditable && !e.target.dataset.ihImg) closeInlineEdit();
    });

    // Reposition toolbar on scroll
    iframeWin.addEventListener('scroll', () => {
        if (currentEditable) positionInlineToolbar(currentEditable);
    }, { passive: true });

    console.log(`✅ ${textCount} text, ${imgCount} images ready`);
}

// ─── Back / Reset ──────────────────────────────────────────────────────────────
function handleBackClick() {
    closeInlineEdit();
    if (hasUnsavedChanges) { confirmModal.style.display = 'flex'; } else { resetAndGoBack(); }
}

function resetAndGoBack() {
    mainPage.style.display = 'block';
    previewMode.style.display = 'none';
    const toolbar = document.getElementById('floatingToolbar');
    if (toolbar) {
        toolbar.style.display = 'none';
        toolbar.style.left = '50%'; toolbar.style.top = '20px';
        toolbar.style.transform = 'translateX(-50%)';
        delete toolbar.dataset.positioned;
    }
    closeInlineEdit();
    hasUnsavedChanges = false;
    templateContainer.innerHTML = '';
    templateIframe = null;
}

// ─── Download ──────────────────────────────────────────────────────────────────
function downloadTemplate() {
    if (!templateIframe) { alert('No template loaded.'); return; }
    try {
        closeInlineEdit();
        const iframeDoc = templateIframe.contentDocument || templateIframe.contentWindow.document;
        iframeDoc.querySelectorAll('[data-ih-editable]').forEach(el => {
            el.removeAttribute('data-ih-editable');
            el.contentEditable = 'false';
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.cursor = '';
        });
        iframeDoc.querySelectorAll('[data-ih-img]').forEach(el => {
            el.removeAttribute('data-ih-img');
            el.style.cursor = '';
            el.removeAttribute('title');
        });
        const html = '<!DOCTYPE html>\n' + iframeDoc.documentElement.outerHTML;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentTemplate}-edited.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        hasUnsavedChanges = false;
        setTimeout(() => setupIframeInteractivity(templateIframe), 150);
    } catch (err) { alert('Error: ' + err.message); }
}

// ─── Utility ───────────────────────────────────────────────────────────────────
function rgbToHex(rgb) {
    if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '#000000';
    if (rgb.startsWith('#')) return rgb;
    const nums = rgb.match(/\d+/g);
    if (!nums || nums.length < 3) return '#000000';
    const [r, g, b] = nums.map(Number);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

console.log('✅ Template Hub ready');