document.addEventListener('DOMContentLoaded', () => {
    // Safety limits
    const MAX_FILE_SIZE_MB = 1024; // Effective no-limit (browser crash risk only)
    const MAX_CHAPTER_FILES = 3000; // Avoid pathological spine sizes

    const ERRORS = {
        en: {
            tooLarge: (size) => `File too large. Please use an EPUB under ${size}MB`,
            tooManyFiles: "EPUB has too many content files to process safely",
            noContent: "No readable HTML/XHTML content found in EPUB",
            missingOpf: "Invalid EPUB: OPF file declared in container.xml not found",
            invalidEpub: "Invalid EPUB/ZIP file",
            invalidOpf: "Invalid EPUB: OPF file is missing required sections"
        },
        ja: {
            tooLarge: (size) => `ファイルサイズが大きすぎます。${size}MB未満のEPUBを使用してください`,
            tooManyFiles: "EPUBに含まれるコンテンツファイルが多すぎるため、安全に処理できません",
            noContent: "EPUB内に読み取り可能なHTML/XHTMLコンテンツが見つかりません",
            missingOpf: "無効なEPUBです: container.xmlで指定されたOPFファイルが見つかりません",
            invalidEpub: "無効なEPUB/ZIPファイルです",
            invalidOpf: "無効なEPUBです: OPFファイルに必要なセクションが欠落しています"
        },
        zh: {
            tooLarge: (size) => `檔案過大，請使用小於 ${size}MB 的 EPUB`,
            tooManyFiles: "此 EPUB 內容檔案過多，無法安全處理",
            noContent: "EPUB 中沒有可讀的 HTML/XHTML 內容",
            missingOpf: "無效的 EPUB: container.xml 指定的 OPF 檔案不存在",
            invalidEpub: "無效的 EPUB/ZIP 檔案",
            invalidOpf: "無效的 EPUB: OPF 檔案缺少必要的區段"
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
    const HEADING_TAGS = {
        H1: 1,
        H2: 2,
        H3: 3,
        H4: 4,
        H5: 5,
        H6: 6
    };
    const MAX_HEADING_LEVEL = 6;

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
            onlyEpub: "Only .epub files are supported",
            genericError: "An unexpected error occurred",
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
            onlyEpub: ".epubファイルのみ対応しています",
            genericError: "予期しないエラーが発生しました",
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
            onlyEpub: "僅支援 .epub 檔案",
            genericError: "發生未預期的錯誤",
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

        // Ignore non-EPUB files unless none are valid.
        const epubFiles = files.filter(file => file.name.toLowerCase().endsWith('.epub'));
        if (!epubFiles.length) {
            showError(T.onlyEpub);
            return;
        }

        const oversizedFile = epubFiles.find(file => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
        if (oversizedFile) {
            showError(getErrorText('tooLarge'));
            return;
        }

        safeRevokeBlob();
        showLoading();

        try {
            if (epubFiles.length === 1) {
                const text = await extractEPUBText(epubFiles[0]);
                const resultFilename = epubFiles[0].name.replace(/\.epub$/i, '.txt');
                prepareTextDownload(text, resultFilename);
                return;
            }

            const zip = new JSZip();
            const usedNames = new Set();
            let successfulCount = 0;
            let lastError = null;
            let lastErrorFile = null;
            let lastSuccessText = null;
            let lastSuccessFilename = null;

            for (let i = 0; i < epubFiles.length; i++) {
                const file = epubFiles[i];
                let text;
                try {
                    text = await extractEPUBText(file, { index: i, total: epubFiles.length });
                } catch (err) {
                    console.error(err);
                    lastError = err;
                    lastErrorFile = file;
                    continue;
                }
                const baseName = file.name.replace(/\.epub$/i, '.txt');
                const entryName = makeUniqueFilename(baseName, usedNames);
                usedNames.add(entryName);
                zip.file(entryName, text);
                successfulCount += 1;
                lastSuccessText = text;
                lastSuccessFilename = entryName;
            }

            // If everything failed, surface the last error; otherwise return TXT or ZIP.
            if (successfulCount === 0) {
                const errorMessage = lastErrorFile
                    ? T.fileError(lastErrorFile.name, normalizeError(lastError))
                    : T.genericError;
                showError(errorMessage);
                return;
            }

            if (successfulCount === 1) {
                prepareTextDownload(lastSuccessText, lastSuccessFilename);
                return;
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
        const opfData = await parseOPF(zip, opfPath);
        let chapterFiles = opfData.spineHrefs;
        const tocEntries = await parseTocEntries(zip, opfData.tocPath);
        const chapterAnchors = selectChapterAnchors(tocEntries);

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
        const separator = "\n\n---\n\n";
        let wroteContent = false;
        let lastWasSeparator = false;

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
                const entry = zip.file(path);
                if (!entry) {
                    console.warn("Could not read file:", path);
                    continue;
                }
                const bytes = await entry.async("uint8array");
                content = decodeBytesToString(bytes);
            } catch (e) {
                console.warn("Could not read file:", path);
                continue;
            }

            // Basic progress update
            setStatus(T.extractingChapter(i + 1, chapterFiles.length), progressContext);

            const normalizedPath = normalizeZipPath(path);
            const anchorIds = chapterAnchors.get(normalizedPath) || [];
            const text = extractTextFromHTML(content, anchorIds);
            if (text.trim()) {
                output.push(text);
                wroteContent = true;
                lastWasSeparator = false;
                output.push(separator);
                lastWasSeparator = true;
            }
        }

        if (!lastWasSeparator) {
            output.push("\n\n");
        }
        const convertedAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
        output.push(`File converted by epub2txt\nhttps://github.com/SPACESODA/epub2txt\nConverted at: ${convertedAt}\n`);

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

    function decodeBytesToString(bytes) {
        const encoding = sniffEncoding(bytes) || 'utf-8';
        try {
            return new TextDecoder(encoding).decode(bytes);
        } catch (e) {
            return new TextDecoder('utf-8').decode(bytes);
        }
    }

    function sniffEncoding(bytes) {
        if (!bytes || !bytes.length) return null;
        const headerBytes = bytes.subarray(0, 2048);
        let headerText = '';
        try {
            headerText = new TextDecoder('utf-8').decode(headerBytes);
        } catch (e) {
            return null;
        }

        const xmlMatch = headerText.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i);
        if (xmlMatch) return normalizeEncodingName(xmlMatch[1]);

        const metaCharsetMatch = headerText.match(/<meta[^>]*charset=["']?\s*([^"'\s/>]+)/i);
        if (metaCharsetMatch) return normalizeEncodingName(metaCharsetMatch[1]);

        const metaHttpEquivMatch = headerText.match(/<meta[^>]*http-equiv=["']content-type["'][^>]*content=["'][^"']*charset=([^"']+)["']/i);
        if (metaHttpEquivMatch) return normalizeEncodingName(metaHttpEquivMatch[1]);

        return null;
    }

    function normalizeEncodingName(name) {
        if (!name) return null;
        const cleaned = String(name).trim().toLowerCase().replace(/_/g, '-');
        if (cleaned === 'utf8') return 'utf-8';
        return cleaned;
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
        let navHref = null;
        let ncxHref = null;
        const manifest = getFirstElementByLocalName(doc, 'manifest');
        if (!manifest) throw makeError('invalidOpf');

        getElementsByLocalName(manifest, 'item').forEach(item => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            const properties = item.getAttribute("properties") || '';
            const mediaType = item.getAttribute("media-type") || '';
            if (id && href) {
                manifestItems[id] = href;
            }
            if (href && properties.split(/\s+/).includes('nav')) {
                navHref = href;
            }
            if (href && mediaType === 'application/x-dtbncx+xml') {
                ncxHref = href;
            }
        });

        // 2. Map Spine: IDREF -> Href
        const spine = getFirstElementByLocalName(doc, 'spine');
        const spineHrefs = [];
        if (spine) {
            const tocId = spine.getAttribute("toc");
            if (tocId && manifestItems[tocId]) {
                ncxHref = manifestItems[tocId];
            }
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

        const resolvedSpine = spineHrefs
            .map(href => resolveZipPath(opfDir, safeDecodeURIComponent(href)))
            .filter(Boolean);
        const tocHref = navHref || ncxHref;
        const tocPath = tocHref ? resolveZipPath(opfDir, safeDecodeURIComponent(tocHref)) : null;

        return { spineHrefs: resolvedSpine, tocPath };
    }

    function splitTocHref(tocDir, href) {
        if (!href) return { path: null, fragment: '' };
        const hashIndex = href.indexOf('#');
        const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
        const fragment = hashIndex === -1 ? '' : href.slice(hashIndex + 1);
        const path = pathPart ? resolveZipPath(tocDir, safeDecodeURIComponent(pathPart)) : null;
        return { path, fragment: fragment ? safeDecodeURIComponent(fragment) : '' };
    }

    function escapeAttributeValue(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function insertAnchorMarkers(doc, anchorIds) {
        if (!anchorIds || !anchorIds.length) return;
        const seenTargets = new Set();
        anchorIds.forEach(anchorId => {
            if (!anchorId) return;
            let target = doc.getElementById(anchorId);
            if (!target) {
                const selector = `[name="${escapeAttributeValue(anchorId)}"]`;
                target = doc.querySelector(selector);
            }
            if (!target) return;
            const headingTarget = target.closest('h1,h2,h3,h4,h5,h6');
            const markerTarget = headingTarget || target;
            if (!markerTarget.parentNode || seenTargets.has(markerTarget)) return;
            seenTargets.add(markerTarget);
            const marker = doc.createElement('epub2txt-sep');
            markerTarget.parentNode.insertBefore(marker, markerTarget);
        });
    }

    async function parseTocEntries(zip, tocPath) {
        if (!tocPath) return [];
        const tocFile = zip.file(tocPath);
        if (!tocFile) return [];
        const tocContent = await tocFile.async("string");
        const tocDir = tocPath.lastIndexOf('/') !== -1 ? tocPath.slice(0, tocPath.lastIndexOf('/')) : '';
        if (tocPath.toLowerCase().endsWith('.ncx')) {
            return parseNcxTocEntries(tocContent, tocDir);
        }
        return parseNavTocEntries(tocContent, tocDir);
    }

    function parseNavTocEntries(navContent, tocDir) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(navContent, "text/html");
        const navs = Array.from(doc.querySelectorAll('nav'));
        let tocNav = navs.find(nav => nav.getAttribute('epub:type') === 'toc' || nav.getAttribute('role') === 'doc-toc');
        if (!tocNav && navs.length) {
            tocNav = navs[0];
        }
        if (!tocNav) return [];
        const listRoot = tocNav.querySelector('ol, ul');
        if (!listRoot) return [];

        const entries = [];
        const walkList = (listEl, depth) => {
            const items = Array.from(listEl.children).filter(el => el.tagName === 'LI');
            items.forEach(li => {
                const link = li.querySelector(':scope > a[href]') || li.querySelector('a[href]');
                if (link) {
                    const title = link.textContent.replace(/\s+/g, ' ').trim();
                    const rawHref = link.getAttribute('href');
                    const { path, fragment } = splitTocHref(tocDir, rawHref);
                    if (path) {
                        entries.push({ path, fragment, title, depth });
                    }
                }
                const childList = li.querySelector(':scope > ol, :scope > ul');
                if (childList) {
                    walkList(childList, depth + 1);
                }
            });
        };

        walkList(listRoot, 1);
        return entries;
    }

    function parseNcxTocEntries(ncxContent, tocDir) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(ncxContent, "application/xml");
        const navMap = getFirstElementByLocalName(doc, 'navMap');
        if (!navMap) return [];

        const entries = [];
        const walkNavPoints = (node, depth) => {
            const navPoints = getChildElementsByLocalName(node, 'navPoint');
            navPoints.forEach(point => {
                const content = getFirstElementByLocalName(point, 'content');
                const src = content ? content.getAttribute('src') : '';
                const navLabel = getFirstElementByLocalName(point, 'navLabel');
                const textEl = navLabel ? getFirstElementByLocalName(navLabel, 'text') : null;
                const title = (textEl?.textContent || '').trim();
                const { path, fragment } = splitTocHref(tocDir, src);
                if (path) {
                    entries.push({ path, fragment, title, depth });
                }
                walkNavPoints(point, depth + 1);
            });
        };

        walkNavPoints(navMap, 1);
        return entries;
    }

    function selectChapterAnchors(entries) {
        if (!entries.length) return new Map();

        const anchorsByPath = new Map();
        entries.forEach(entry => {
            if (entry.depth !== 1) return;
            if (!entry.path || !entry.fragment) return;
            const lower = entry.path.toLowerCase();
            if (!lower.endsWith('.html') && !lower.endsWith('.htm') && !lower.endsWith('.xhtml')) return;
            const path = normalizeZipPath(entry.path);
            const list = anchorsByPath.get(path) || [];
            if (!list.includes(entry.fragment)) {
                list.push(entry.fragment);
                anchorsByPath.set(path, list);
            }
        });
        return anchorsByPath;
    }

    function extractTextFromHTML(htmlString, anchorIds = []) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");

        doc.querySelectorAll('script').forEach(el => {
            const type = (el.getAttribute('type') || '').toLowerCase();
            if (!type.includes('math/tex') && !type.includes('math/latex')) {
                el.remove();
            }
        });
        ['style', 'title', 'meta', 'noscript'].forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        insertAnchorMarkers(doc, anchorIds);
        const root = doc.body || doc.documentElement || doc;
        const state = { hasContent: false, lastWasSeparator: false };
        const segments = collectTextSegments(root, false, [], state);
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

    /**
     * Recursive function to traverse the DOM and collect text segments.
     * Mirrors the logic in the Python script's `get_clean_text`.
     * 
     * @param {Node} element - The DOM node to traverse.
     * @param {boolean} inPre - Whether the current node is inside a <pre> tag.
     * @param {Array} segments - Accumulator for text segments.
     * @param {Object} state - Tracks state across recursion (e.g., hasContent, lastWasSeparator).
     * @param {number} listDepth - Current nesting level of lists (for indentation).
     */
    function collectTextSegments(element, inPre = false, segments = [], state = null, listDepth = 0) {
        if (!element) return segments;
        if (!state) {
            state = { hasContent: false, lastWasSeparator: false };
        }

        const isMathBlock = (node) => {
            const display = (node.getAttribute && node.getAttribute('display') || '').toLowerCase();
            if (display === 'block') return true;
            const className = (node.getAttribute && node.getAttribute('class') || '').toLowerCase();
            return className.includes('block') || className.includes('display');
        };

        const isMathLikeClass = (node) => {
            const className = (node.getAttribute && node.getAttribute('class') || '').toLowerCase();
            return className.includes('math') || className.includes('katex') || className.includes('latex') || className.includes('equation');
        };

        const looksLikeLatex = (text) => /\\[A-Za-z]+|[_^]|\\frac|\\sum|\\int/.test(text || '');

        const getMathAnnotationLatex = (node) => {
            const annotations = node.getElementsByTagName('annotation');
            for (const ann of annotations) {
                const encoding = (ann.getAttribute('encoding') || '').toLowerCase();
                if (encoding.includes('tex') || encoding.includes('latex')) {
                    const text = (ann.textContent || '').trim();
                    if (text) return text;
                }
            }
            return '';
        };

        const pushSegment = (text, pre, isContent = false) => {
            if (!text) return;
            segments.push({ text, pre });
            if (isContent) {
                state.hasContent = true;
                state.lastWasSeparator = false;
            }
        };

        element.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const content = inPre ? node.textContent : node.textContent.replace(/\s+/g, ' ');
                if (content) {
                    pushSegment(content, inPre, Boolean(content.trim()));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName;
                if (tagName === 'EPUB2TXT-SEP') {
                    if (state.hasContent && !state.lastWasSeparator) {
                        segments.push({ text: "\n\n---\n\n", pre: false });
                        state.lastWasSeparator = true;
                    }
                    return;
                }
                if (tagName === 'BR') {
                    pushSegment("\n", inPre);
                    return;
                }

                if (tagName === 'SCRIPT') {
                    const type = (node.getAttribute('type') || '').toLowerCase();
                    if (type.includes('math/tex') || type.includes('math/latex')) {
                        const latex = (node.textContent || '').trim();
                        if (latex) {
                            const isBlock = type.includes('mode=display');
                            if (!inPre && isBlock) pushSegment("\n", false);
                            const wrapped = isBlock ? `$$${latex}$$` : `$${latex}$`;
                            pushSegment(wrapped, false, true);
                            if (!inPre && isBlock) pushSegment("\n", false);
                        }
                    }
                    return;
                }

                if (tagName === 'MATH') {
                    const latex = getMathAnnotationLatex(node);
                    const isBlock = isMathBlock(node);
                    if (latex) {
                        if (!inPre && isBlock) pushSegment("\n", false);
                        const wrapped = isBlock ? `$$${latex}$$` : `$${latex}$`;
                        pushSegment(wrapped, false, true);
                        if (!inPre && isBlock) pushSegment("\n", false);
                        return;
                    }
                    if (isBlock && !inPre) pushSegment("\n", false);
                    collectTextSegments(node, inPre, segments, state, listDepth);
                    if (isBlock && !inPre) pushSegment("\n", false);
                    return;
                }

                if (tagName === 'IMG') {
                    const altText = node.getAttribute('alt') || node.getAttribute('aria-label') || node.getAttribute('title') || '';
                    const isMathImage = isMathLikeClass(node) || looksLikeLatex(altText) || node.getAttribute('role') === 'math';
                    if (altText && isMathImage) {
                        const isBlock = isMathBlock(node);
                        if (!inPre && isBlock) pushSegment("\n", false);
                        pushSegment(`[MATH: ${altText.trim()}]`, false, true);
                        if (!inPre && isBlock) pushSegment("\n", false);
                        return;
                    }
                }

                // Handle Bold
                if (tagName === 'B' || tagName === 'STRONG') {
                    if (!inPre) pushSegment("**", false);
                    collectTextSegments(node, inPre, segments, state, listDepth);
                    if (!inPre) pushSegment("**", false);
                    return;
                }

                // Handle Lists
                if (tagName === 'UL' || tagName === 'OL') {
                    if (!inPre) pushSegment("\n", false);
                    collectTextSegments(node, inPre, segments, state, listDepth + 1);
                    if (!inPre) pushSegment("\n", false);
                    return;
                }

                if (tagName === 'LI') {
                    if (!inPre) {
                        pushSegment("\n", false);
                        const indent = "    ".repeat(Math.max(0, listDepth - 1));
                        pushSegment(indent + "- ", true);
                    }
                    collectTextSegments(node, inPre, segments, state, listDepth);
                    if (!inPre) pushSegment("\n", false);
                    return;
                }

                const headingLevel = HEADING_TAGS[tagName];
                if (headingLevel && !inPre) {
                    const headingText = node.textContent.replace(/\s+/g, ' ').trim();
                    if (headingText) {
                        const level = Math.min(headingLevel, MAX_HEADING_LEVEL);
                        pushSegment("\n", false);
                        pushSegment(`${"#".repeat(level)} ${headingText}`, false, true);
                        pushSegment("\n", false);
                        return;
                    }
                }

                const isBlock = BLOCK_TAGS.has(tagName);
                const nextPre = inPre || PRE_TAGS.has(tagName);

                if (isBlock && !inPre) {
                    pushSegment("\n", false);
                }

                collectTextSegments(node, nextPre, segments, state, listDepth);

                if (isBlock && !inPre) {
                    pushSegment("\n", false);
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

    function getChildElementsByLocalName(node, localName) {
        if (!node || !node.children) return [];
        return Array.from(node.children).filter(child => child.localName === localName);
    }

    function getFirstElementByLocalName(node, localName) {
        const elements = getElementsByLocalName(node, localName);
        return elements.length ? elements[0] : null;
    }

    /**
     * Handles the creation of a temporary Object URL for downloading.
     * Revokes any existing URL to prevent memory leaks before creating a new one.
     */
    function prepareBlobDownload(blob, filename, downloadType) {
        safeRevokeBlob();
        currentBlobUrl = URL.createObjectURL(blob);

        successFilename.textContent = filename;
        downloadBtn.textContent = downloadType === 'zip' ? T.downloadZip : T.downloadTxt;
        downloadBtn.setAttribute('data-umami-event', downloadType === 'zip' ? 'epub | Download ZIP Button' : 'epub | Download TXT Button');
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
            umami.track('epub | File Converted');
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

    /**
     * Generates a unique filename by appending a counter if the name already exists.
     * e.g., "book.txt" -> "book (2).txt" -> "book (3).txt"
     */
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
