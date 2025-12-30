document.addEventListener('DOMContentLoaded', () => {
    // Safety limits
    const MAX_FILE_SIZE_MB = 1024; // Effective no-limit (browser crash risk only)
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
        ja: {
            tooLarge: (size) => `ファイルサイズが大きすぎます。${size}MB未満のEPUBを使用してください。`,
            tooManyFiles: "EPUBに含まれるコンテンツファイルが多すぎるため、安全に処理できません。",
            noContent: "EPUB内に読み取り可能なHTML/XHTMLコンテンツが見つかりません。",
            missingOpf: "無効なEPUBです: container.xmlで指定されたOPFファイルが見つかりません。",
            invalidEpub: "無効なEPUB/ZIPファイルです。",
            invalidOpf: "無効なEPUBです: OPFファイルに必要なセクションが欠落しています。"
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

    const BLOCK_TAGS = new Set([
        'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'UL', 'OL', 'DL', 'DT', 'DD',
        'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH',
        'ARTICLE', 'SECTION', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE',
        'BLOCKQUOTE', 'PRE', 'HR'
    ]);

    const PRE_TAGS = new Set(['PRE', 'CODE', 'SAMP', 'KBD', 'TT']);

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
    const currentLang = document.documentElement.lang;
    const lang = (currentLang === 'zh-TW') ? 'zh' : (currentLang === 'ja' ? 'ja' : 'en');

    const TEXT = {
        en: {
            processing: "Processing...",
            unzipping: "Unzipping...",
            readingStructure: "Reading structure...",
            parsingChapters: "Parsing chapters...",
            extracting: "Extracting text...",
            extractingChapter: (current, total) => `Extracting chapter ${current}/${total}...`,
            packaging: "Packaging ZIP...",
            processingFile: (current, total) => `File ${current}/${total}:`,
            errorPrefix: "Error: ",
            onlyEpub: "Only .epub files are supported.",
            genericError: "An unexpected error occurred.",
            convertAnother: "Drag other .epub files to convert",
            selectFile: "select file(s)",
            downloadTxt: "Download TXT",
            downloadZip: "Download ZIP",
            fileError: (name, message) => `Failed to process "${name}": ${message}`
        },
        ja: {
            processing: "処理中...",
            unzipping: "展開中...",
            readingStructure: "構造を読み込み中...",
            parsingChapters: "章を解析中...",
            extracting: "テキストを抽出中...",
            extractingChapter: (current, total) => `章${current}/${total}を抽出中...`,
            packaging: "ZIPを作成中...",
            processingFile: (current, total) => `ファイル ${current}/${total}:`,
            errorPrefix: "エラー: ",
            onlyEpub: ".epubファイルのみ対応しています。",
            genericError: "予期しないエラーが発生しました。",
            convertAnother: "他の .epub ファイルをドラッグして変換",
            selectFile: "ファイルを選択",
            downloadTxt: "TXTをダウンロード",
            downloadZip: "ZIPをダウンロード",
            fileError: (name, message) => `「${name}」の処理に失敗しました: ${message}`
        },
        zh: {
            processing: "處理中...",
            unzipping: "正在解壓縮...",
            readingStructure: "正在讀取結構...",
            parsingChapters: "正在解析章節...",
            extracting: "正在提取文字...",
            extractingChapter: (current, total) => `正在提取章節 ${current}/${total}...`,
            packaging: "正在打包 ZIP...",
            processingFile: (current, total) => `檔案 ${current}/${total}:`,
            errorPrefix: "錯誤: ",
            onlyEpub: "請選擇 .epub 檔案。",
            genericError: "發生未預期的錯誤。",
            convertAnother: "拖放其他 .epub 檔案以轉換",
            selectFile: "選擇檔案",
            downloadTxt: "下載 TXT",
            downloadZip: "下載 ZIP",
            fileError: (name, message) => `「${name}」處理失敗: ${message}`
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
            handleFiles(e.dataTransfer.files);
        }
    });

    // Click to select
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
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

    async function handleFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        fileInput.value = '';

        const invalidFile = files.find(file => !file.name.toLowerCase().endsWith('.epub'));
        if (invalidFile) {
            showError(T.onlyEpub);
            return;
        }

        const oversizedFile = files.find(file => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
        if (oversizedFile) {
            showError(getErrorText('tooLarge'));
            return;
        }

        safeRevokeBlob();
        showLoading();

        try {
            if (files.length === 1) {
                const text = await extractEPUBText(files[0]);
                const resultFilename = files[0].name.replace(/\.epub$/i, '.txt');
                prepareTextDownload(text, resultFilename);
                return;
            }

            const zip = new JSZip();
            const usedNames = new Set();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                let text;
                try {
                    text = await extractEPUBText(file, { index: i, total: files.length });
                } catch (err) {
                    console.error(err);
                    showError(T.fileError(file.name, normalizeError(err)));
                    return;
                }
                const baseName = file.name.replace(/\.epub$/i, '.txt');
                const entryName = makeUniqueFilename(baseName, usedNames);
                usedNames.add(entryName);
                zip.file(entryName, text);
            }

            statusText.textContent = T.packaging;
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 },
                streamFiles: true
            });
            prepareBlobDownload(zipBlob, formatZipFilename(new Date()), 'zip');
        } catch (err) {
            console.error(err);
            showError(normalizeError(err));
        }
    }

    async function extractEPUBText(file, progressContext = null) {
        setStatus(T.unzipping, progressContext);

        // 1. Unzip
        const zip = await JSZip.loadAsync(file);

        // 2. Find Rootfile (OPF)
        setStatus(T.readingStructure, progressContext);
        const opfPath = await getRootFilePath(zip);

        // 3. Parse OPF to get reading order (Spine)
        setStatus(T.parsingChapters, progressContext);
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
        setStatus(T.extracting, progressContext);
        const output = [];
        const separator = "\n\n" + "-".repeat(20) + "\n\n";

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
            setStatus(T.extractingChapter(i + 1, chapterFiles.length), progressContext);

            const text = extractTextFromHTML(content);
            if (text.trim()) {
                output.push(text, separator);
            }
        }

        output.push("File converted using epub2txt\nhttps://github.com/SPACESODA/epub2txt\n");

        return output.join('');
    }

    // --- Helpers ---
    function setStatus(message, progressContext) {
        if (progressContext && progressContext.total > 1) {
            statusText.textContent = `${T.processingFile(progressContext.index + 1, progressContext.total)} ${message}`;
            return;
        }
        statusText.textContent = message;
    }

    function safeDecodeURIComponent(value) {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    function normalizeZipPath(path) {
        const parts = path.replace(/\\/g, '/').split('/');
        const stack = [];
        for (const part of parts) {
            if (!part || part === '.') {
                continue;
            }
            if (part === '..') {
                if (stack.length) stack.pop();
                continue;
            }
            stack.push(part);
        }
        return stack.join('/');
    }

    function resolveZipPath(opfDir, href) {
        const cleaned = href.split('#')[0];
        if (!cleaned) return null;
        const combined = opfDir ? `${opfDir}/${cleaned}` : cleaned;
        return normalizeZipPath(combined);
    }

    function findFirstOpfPath(zip) {
        const opfFiles = zip.file(/\.opf$/i);
        if (opfFiles.length > 0) {
            return opfFiles[0].name;
        }
        return null;
    }

    async function getRootFilePath(zip) {
        const containerFile = zip.file("META-INF/container.xml");
        if (containerFile) {
            const container = await containerFile.async("string");
            const parser = new DOMParser();
            const doc = parser.parseFromString(container, "application/xml");

            const rootfile = getFirstElementByLocalName(doc, 'rootfile');
            const fullPath = rootfile?.getAttribute("full-path");
            if (fullPath) return fullPath;
        }

        const fallbackPath = findFirstOpfPath(zip);
        if (fallbackPath) return fallbackPath;

        throw makeError('missingOpf');
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
        const manifest = getFirstElementByLocalName(doc, 'manifest');
        if (!manifest) throw makeError('invalidOpf');

        getElementsByLocalName(manifest, 'item').forEach(item => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            if (id && href) {
                manifestItems[id] = href;
            }
        });

        // 2. Map Spine: IDREF -> Href
        const spine = getFirstElementByLocalName(doc, 'spine');
        const spineHrefs = [];
        if (spine) {
            getElementsByLocalName(spine, 'itemref').forEach(itemref => {
                const idref = itemref.getAttribute("idref");
                if (manifestItems[idref]) {
                    spineHrefs.push(manifestItems[idref]);
                }
            });
        }

        // 3. Resolve paths relative to OPF
        const lastSlash = opfPath.lastIndexOf('/');
        const opfDir = lastSlash !== -1 ? opfPath.slice(0, lastSlash) : '';

        return spineHrefs
            .map(href => resolveZipPath(opfDir, safeDecodeURIComponent(href)))
            .filter(Boolean);
    }

    function extractTextFromHTML(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");

        ['script', 'style', 'title', 'meta', 'noscript'].forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        const root = doc.body || doc.documentElement || doc;
        const segments = collectTextSegments(root);
        return normalizeExtractedText(segments);
    }

    function normalizeExtractedText(segments) {
        const output = [];
        const normalBuffer = [];

        const flushNormal = () => {
            if (!normalBuffer.length) return;
            let text = normalBuffer.join('');
            text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            text = text.replace(/[ \t\f\v]+/g, ' ');
            text = text.replace(/ *\n */g, '\n');
            text = text.replace(/\n{3,}/g, '\n\n');
            output.push(text);
            normalBuffer.length = 0;
        };

        segments.forEach(segment => {
            if (segment.pre) {
                flushNormal();
                const preText = segment.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                output.push(preText);
            } else {
                normalBuffer.push(segment.text);
            }
        });

        flushNormal();
        let combined = output.join('');
        combined = combined.replace(/^\n+/, '').replace(/\n+$/, '');
        return combined;
    }

    function collectTextSegments(element, inPre = false, segments = []) {
        if (!element) return segments;

        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const content = inPre ? node.textContent : node.textContent.replace(/\s+/g, ' ');
                if (content) {
                    segments.push({ text: content, pre: inPre });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName;
                if (tagName === 'BR') {
                    segments.push({ text: "\n", pre: inPre });
                    return;
                }

                const isBlock = BLOCK_TAGS.has(tagName);
                const nextPre = inPre || PRE_TAGS.has(tagName);

                if (isBlock && !inPre) {
                    segments.push({ text: "\n", pre: false });
                }

                collectTextSegments(node, nextPre, segments);

                if (isBlock && !inPre) {
                    segments.push({ text: "\n", pre: false });
                }
            }
        });

        return segments;
    }

    function prepareTextDownload(text, filename) {
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        prepareBlobDownload(blob, filename, 'txt');
    }

    function getElementsByLocalName(node, localName) {
        if (!node) return [];
        if (node.getElementsByTagNameNS) {
            return Array.from(node.getElementsByTagNameNS('*', localName));
        }
        return Array.from(node.getElementsByTagName(localName));
    }

    function getFirstElementByLocalName(node, localName) {
        const elements = getElementsByLocalName(node, localName);
        return elements.length ? elements[0] : null;
    }

    function prepareBlobDownload(blob, filename, downloadType) {
        safeRevokeBlob();
        currentBlobUrl = URL.createObjectURL(blob);

        successFilename.textContent = filename;
        downloadBtn.textContent = downloadType === 'zip' ? T.downloadZip : T.downloadTxt;
        downloadBtn.setAttribute('data-umami-event', downloadType === 'zip' ? 'Download ZIP Button' : 'Download TXT Button');
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

    function makeUniqueFilename(name, usedNames) {
        if (!usedNames.has(name)) return name;
        const dotIndex = name.lastIndexOf('.');
        const base = dotIndex === -1 ? name : name.slice(0, dotIndex);
        const ext = dotIndex === -1 ? '' : name.slice(dotIndex);
        let counter = 2;
        let candidate = `${base} (${counter})${ext}`;
        while (usedNames.has(candidate)) {
            counter += 1;
            candidate = `${base} (${counter})${ext}`;
        }
        return candidate;
    }

    function formatZipFilename(date) {
        const pad = (value) => String(value).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        return `txt_files_${year}${month}${day}_${hours}${minutes}.zip`;
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
