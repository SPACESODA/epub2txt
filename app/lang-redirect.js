(() => {
    const STORAGE_KEY = 'epub2txt-lang';
    const path = window.location.pathname || '/';

    const normalizeLang = (value) => {
        if (!value) return null;
        const lower = String(value).toLowerCase();
        if (lower.startsWith('ja')) return 'ja';
        if (lower.startsWith('zh')) return 'zh';
        return 'en';
    };

    const getBasePath = () => {
        if (path.includes('/ja/')) {
            return `${path.split('/ja/')[0]}/`;
        }
        if (path.includes('/zh/')) {
            return `${path.split('/zh/')[0]}/`;
        }
        const withoutFile = path.endsWith('/index.html')
            ? path.slice(0, path.lastIndexOf('/') + 1)
            : path;
        return withoutFile.endsWith('/') ? withoutFile : `${withoutFile}/`;
    };

    const normalizePath = (value) => {
        let normalized = value.endsWith('/index.html')
            ? value.slice(0, value.lastIndexOf('/') + 1)
            : value;
        if (!normalized.endsWith('/')) {
            normalized += '/';
        }
        return normalized;
    };

    const basePath = getBasePath();
    const currentLang = path.includes('/ja/')
        ? 'ja'
        : path.includes('/zh/')
            ? 'zh'
            : 'en';

    const targetFor = (lang) => {
        if (lang === 'ja') return `${basePath}ja/`;
        if (lang === 'zh') return `${basePath}zh/`;
        return basePath;
    };

    const redirectIfNeeded = (lang) => {
        const target = targetFor(lang);
        if (normalizePath(path) === normalizePath(target)) return;
        window.location.replace(target);
    };

    const safeStorageGet = (key) => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    };

    const safeStorageSet = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Ignore storage failures to keep redirects functional.
        }
    };

    const saved = normalizeLang(safeStorageGet(STORAGE_KEY));
    if (saved && saved !== currentLang) {
        redirectIfNeeded(saved);
        return;
    }

    if (!saved) {
        const languageList = (navigator.languages && navigator.languages.length)
            ? navigator.languages
            : [navigator.language || navigator.userLanguage || ''];
        let detected = 'en';
        for (const lang of languageList) {
            const normalized = normalizeLang(lang);
            if (normalized === 'ja') {
                detected = 'ja';
                break;
            }
            if (normalized === 'zh') {
                detected = 'zh';
            }
        }
        if (detected !== currentLang) {
            redirectIfNeeded(detected);
            return;
        }
    }

    const detectLangFromHref = (href) => {
        if (!href) return 'en';
        let pathname = '';
        try {
            pathname = new URL(href, window.location.href).pathname.toLowerCase();
        } catch {
            pathname = String(href).toLowerCase();
        }
        if (pathname.includes('/ja/')) return 'ja';
        if (pathname.includes('/zh/')) return 'zh';
        return 'en';
    };

    document.addEventListener('DOMContentLoaded', () => {
        const links = document.querySelectorAll('.lang-switch');
        const savePreference = (link) => {
            const href = link.getAttribute('href') || '';
            const preference = detectLangFromHref(href);
            safeStorageSet(STORAGE_KEY, preference);
        };
        links.forEach((link) => {
            link.addEventListener('click', () => savePreference(link));
            link.addEventListener('pointerdown', () => savePreference(link));
            link.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    savePreference(link);
                }
            });
        });
    });
})();
