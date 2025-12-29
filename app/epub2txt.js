document.addEventListener('DOMContentLoaded', () => {
    // Safety limits
    const MAX_FILE_SIZE_MB = 2048; // Effective no-limit (browser crash risk only)
    const MAX_CHAPTER_FILES = 3000; // Avoid pathological spine sizes

    const ERRORS = {
        en: {
            tooLarge: (size) => `File too large. Please use an EPUB under ${size}MB.`,
            tooManyFiles: "EPUB has too many content files to process safely.",
            noContent: "No readable HTML/XHTML content found in EPUB.",
            missingOpf: "Invalid EPUB: OPF file declared in container.xml not found.",
            invalidEpub: "Invalid EPUB/ZIP file.",
            invalidOpf: "Invalid EPUB: OPF file is missing required sections."
        },
        zh: {
            tooLarge: (size) => `檔案過大，請使用小於 ${size}MB 的 EPUB。`,
            tooManyFiles: "此 EPUB 內容檔案過多，無法安全處理。",
            noContent: "EPUB 中沒有可讀的 HTML/XHTML 內容。",
            missingOpf: "無效的 EPUB: container.xml 指定的 OPF 檔案不存在。",
            invalidEpub: "無效的 EPUB/ZIP 檔案。",
            invalidOpf: "無效的 EPUB: OPF 檔案缺少必要的區段。"
        }
    };

    // UI Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loadingState = document.getElementById('loading-state');
    const successState = document.getElementById('success-state');
    const dropContent = document.querySelector('.drop-content');
    const errorState = document.getElementById('error-state');
    const statusText = document.getElementById('status-text');
    const successFilename = document.getElementById('success-filename');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const retryBtn = document.getElementById('retry-btn');
    const errorMsg = document.getElementById('error-msg');

    let currentBlobUrl = null;

    // Localization
    const lang = document.documentElement.lang === 'zh-TW' ? 'zh' : 'en';

    const TEXT = {
        en: {
            processing: "Processing...",
            unzipping: "Unzipping...",
            readingStructure: "Reading structure...",
            parsingChapters: "Parsing chapters...",
            extracting: "Extracting text...",
            extractingChapter: (current, total) => `Extracting chapter ${current}/${total}...`,
            errorPrefix: "Error: ",
            onlyEpub: "Only .epub files are supported.",
            genericError: "An unexpected error occurred.",
            convertAnother: "Drag another .epub file to convert",
            selectFile: "select file"
        },
        zh: {
            processing: "處理中...",
            unzipping: "正在解壓縮...",
            readingStructure: "正在讀取結構...",
            parsingChapters: "正在解析章節...",
            extracting: "正在提取文字...",
            extractingChapter: (current, total) => `正在提取章節 ${current}/${total}...`,
            errorPrefix: "錯誤: ",
            onlyEpub: "請選擇 .epub 檔案。",
            genericError: "發生未預期的錯誤。",
            convertAnother: "拖放其他 .epub 檔案以轉換",
            selectFile: "選擇檔案"
        }
    };

    const T = TEXT[lang];

    // --- Event Listeners ---

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Click to select
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Reset / Retry
    if (resetBtn) {
        resetBtn.addEventListener('click', resetUI);
    }
    if (retryBtn) {
        retryBtn.addEventListener('click', resetUI);
    }

    // --- Core Logic ---

    async function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.epub')) {
            showError(T.onlyEpub);
            return;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            showError(getErrorText('tooLarge'));
            return;
        }

        showLoading();

        try {
            await processEPUB(file);
        } catch (err) {
            console.error(err);
            showError(normalizeError(err));
        }
    }

    async function processEPUB(file) {
        statusText.textContent = T.unzipping;

        // 1. Unzip
        const zip = await JSZip.loadAsync(file);

        // 2. Find Rootfile (OPF)
        statusText.textContent = T.readingStructure;
        const opfPath = await getRootFilePath(zip);

        // 3. Parse OPF to get reading order (Spine)
        statusText.textContent = T.parsingChapters;
        let chapterFiles = await parseOPF(zip, opfPath);

        // Fallback: if spine is empty, use HTML-like files in archive order
        if (!chapterFiles.length) {
            chapterFiles = zip.file(/\.x?html?$/i).map(f => f.name).sort();
        }

        if (chapterFiles.length > MAX_CHAPTER_FILES) {
            throw makeError('tooManyFiles');
        }

        if (!chapterFiles.length) {
            throw makeError('noContent');
        }

        // 4. Extract Text
        statusText.textContent = T.extracting;
        let fullText = "";

        for (let i = 0; i < chapterFiles.length; i++) {
            const path = chapterFiles[i];

            // Skip non-HTML entries defensively
            const lowerPath = path.toLowerCase();
            if (!lowerPath.endsWith('.html') && !lowerPath.endsWith('.htm') && !lowerPath.endsWith('.xhtml')) {
                continue;
            }

            // Handle missing files in spine gracefully
            let content;
            try {
                content = await zip.file(path).async("string");
            } catch (e) {
                console.warn("Could not read file:", path);
                continue;
            }

            // Basic progress update
            statusText.textContent = T.extractingChapter(i + 1, chapterFiles.length);

            const text = extractTextFromHTML(content);
            if (text.trim()) {
                fullText += text + "\n\n" + "-".repeat(20) + "\n\n";
            }
        }

        // Footer (Localization neutral or keep English?) 
        // Let's keep a consistent footer
        fullText += "File converted using epub2txt Web App\nhttps://github.com/SPACESODA/epub2txt";

        // 5. Prepare Download
        const resultFilename = file.name.replace(/\.epub$/i, '.txt');
        prepareDownload(fullText, resultFilename);
    }

    // --- Helpers ---

    async function getRootFilePath(zip) {
        const container = await zip.file("META-INF/container.xml").async("string");
        const parser = new DOMParser();
        const doc = parser.parseFromString(container, "application/xml");

        const rootfile = doc.querySelector("rootfile");
        if (!rootfile) throw makeError('missingOpf');

        return rootfile.getAttribute("full-path");
    }

    async function parseOPF(zip, opfPath) {
        const opfFile = zip.file(opfPath);
        if (!opfFile) {
            throw makeError('missingOpf');
        }

        const opfContent = await opfFile.async("string");
        const parser = new DOMParser();
        const doc = parser.parseFromString(opfContent, "application/xml");

        // 1. Map Manifest: ID -> Href
        const manifestItems = {};
        const manifest = doc.getElementsByTagName("manifest")[0];
        if (!manifest) throw makeError('invalidOpf');

        Array.from(manifest.getElementsByTagName("item")).forEach(item => {
            manifestItems[item.getAttribute("id")] = item.getAttribute("href");
        });

        // 2. Map Spine: IDREF -> Href
        const spine = doc.getElementsByTagName("spine")[0];
        const spineHrefs = [];
        if (spine) {
            Array.from(spine.getElementsByTagName("itemref")).forEach(itemref => {
                const idref = itemref.getAttribute("idref");
                if (manifestItems[idref]) {
                    spineHrefs.push(manifestItems[idref]);
                }
            });
        }

        // 3. Resolve paths relative to OPF
        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));

        return spineHrefs.map(href => {
            href = decodeURIComponent(href);
            if (opfDir) {
                return opfDir + "/" + href;
            }
            return href;
        });
    }

    function extractTextFromHTML(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");

        ['script', 'style', 'title', 'meta', 'noscript'].forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        return getTextWithNewlines(doc.body);
    }

    function getTextWithNewlines(element) {
        let text = "";

        if (!element) return "";

        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Mimic 'strip=True': trim whitespace, but be careful with inline spacing?
                // Actually, 'get_text(strip=True)' removes ALL surrounding whitespace of individual text nodes.
                // If we want "clean", trimming is good.
                const content = node.textContent.trim();
                if (content) {
                    text += content;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName;

                // Comprehensive list of block-level elements to ensure separation
                const isBlock = [
                    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                    'LI', 'TR', 'TD', 'TH', 'ARTICLE', 'SECTION', 'MAIN',
                    'HEADER', 'FOOTER', 'BLOCKQUOTE', 'PRE', 'HR'
                ].includes(tagName);

                const isBr = tagName === 'BR';

                // Block Start
                if (isBlock) text += "\n";

                text += getTextWithNewlines(node);

                // Block End
                if (isBlock) text += "\n";

                // Explicit Line Break
                // Note: Python get_text(separator='\n\n') turns everything into double newlines.
                // Here, <br> adds one newline. 
                if (isBr) text += "\n";
            }
        });

        return text;
    }

    function prepareDownload(text, filename) {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        safeRevokeBlob();
        currentBlobUrl = URL.createObjectURL(blob);

        successFilename.textContent = filename;
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            const link = document.createElement("a");
            link.href = currentBlobUrl;
            link.download = filename;
            link.click();
        };

        showSuccess();
    }

    // --- UI Transitions ---

    function showLoading() {
        dropContent.classList.add('hidden');
        errorState.classList.add('hidden');
        successState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        dropZone.style.pointerEvents = 'none';
    }

    function showSuccess() {
        loadingState.classList.add('hidden');
        successState.classList.remove('hidden');
        dropZone.style.pointerEvents = 'auto';

        // Update the reset text dynamically
        const resetContainer = document.getElementById('reset-container');
        if (resetContainer) {
            resetContainer.textContent = T.convertAnother;
        }

        // Track successful conversion
        if (window.umami) {
            umami.track('File Converted');
        }
    }

    function showError(msg) {
        loadingState.classList.add('hidden');
        dropContent.classList.add('hidden');
        successState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMsg.textContent = msg;
        dropZone.style.pointerEvents = 'auto';
    }

    function resetUI(e) {
        e.stopPropagation();
        safeRevokeBlob();
        fileInput.value = '';
        loadingState.classList.add('hidden');
        successState.classList.add('hidden');
        errorState.classList.add('hidden');
        dropContent.classList.remove('hidden');
    }

    function safeRevokeBlob() {
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
    }

    function makeError(code, params = {}) {
        const err = new Error(code);
        err.code = code;
        err.params = params;
        return err;
    }

    function getErrorText(code, params = {}) {
        const dict = ERRORS[lang] || ERRORS.en;
        const entry = dict[code];
        if (typeof entry === 'function') return entry(params.size || MAX_FILE_SIZE_MB);
        if (typeof entry === 'string') return entry;
        return T.genericError;
    }

    function normalizeError(err) {
        if (err && err.code) {
            return getErrorText(err.code, err.params);
        }
        if (err && typeof err.message === 'string') {
            const msg = err.message.toLowerCase();
            if (msg.includes('invalid epub/zip')) return getErrorText('invalidEpub');
        }
        return err?.message || T.genericError;
    }

});
