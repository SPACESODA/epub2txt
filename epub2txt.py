#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# epub2txt.py
#
# Author: SPACESODA / ANTHONYC
# GitHub: https://github.com/SPACESODA/epub2txt
# License: MIT License

import sys
import os
import argparse
import zipfile
import xml.etree.ElementTree as ET
import urllib.parse
import shlex
import re
import posixpath
from datetime import datetime, timezone

# Graceful import handling for BeautifulSoup
# Wraps this in a try-except block to provide an error message if the user hasn't installed the required 'beautifulsoup4' library yet.
try:
    from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
    from bs4.element import NavigableString, Tag
    import warnings
    # Suppress warnings about parsing XML as HTML (common in EPUBs)
    # EPUBs often use XHTML which can trigger benign warnings in BeautifulSoup.
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
except ImportError:
    print("Error: Required library 'beautifulsoup4' is not installed. You may use the helper script to auto-install dependencies:")
    print("エラー: 必要なライブラリ 'beautifulsoup4' がインストールされていません。依存関係を自動インストールするには、ヘルパースクリプトを使うこともできます:")
    print("錯誤: 必需的 'beautifulsoup4' 庫尚未安裝。您可以使用輔助腳本自動安裝依賴項:")
    print("Mac/Linux: ./run.sh ")
    print("Windows: run.bat ")
    sys.exit(1)

# XML Namespaces used in EPUB standards.
# These URLs are required to correctly find tags within the EPUB's internal XML files.
NAMESPACES = {
    'n': 'urn:oasis:names:tc:opendocument:xmlns:container',
    'pkg': 'http://www.idpf.org/2007/opf',
    'dc': 'http://purl.org/dc/elements/1.1/'
}

BLOCK_TAGS = {
    'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'ul', 'ol', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'article', 'section', 'main', 'header', 'footer', 'nav', 'aside',
    'blockquote', 'pre', 'hr'
}

PRE_TAGS = {'pre', 'code', 'samp', 'kbd', 'tt'}

SKIP_TAGS = {'script', 'style', 'title', 'meta', 'noscript'}

HEADING_TAGS = {
    'h1': 1,
    'h2': 2,
    'h3': 3,
    'h4': 4,
    'h5': 5,
    'h6': 6
}
MAX_HEADING_LEVEL = 6
ANCHOR_MARKER_TAG = 'epub2txt-sep'

def resolve_zip_path(base_dir: str, href: str) -> str:
    if not href:
        return ""
    href = urllib.parse.unquote(href)
    href = href.split('#', 1)[0]
    if not href:
        return ""
    if base_dir:
        return posixpath.normpath(posixpath.join(base_dir, href))
    return posixpath.normpath(href)

def split_toc_href(base_dir: str, href: str):
    if not href:
        return "", ""
    path_part, _, fragment = href.partition('#')
    path = resolve_zip_path(base_dir, path_part)
    fragment = urllib.parse.unquote(fragment) if fragment else ""
    return path, fragment


def get_epub_rootfile(zip_ref: zipfile.ZipFile) -> str:
    """
    Read META-INF/container.xml to find the path of the .opf file.
    
    Every valid EPUB must have a 'META-INF/container.xml' file.
    This file points to the 'rootfile' (usually ends in .opf), which contains the book's metadata and file structure.
    """
    try:
        # Read the container.xml file from inside the zip
        container_xml = zip_ref.read('META-INF/container.xml')
        root = ET.fromstring(container_xml)
        
        # Find the <rootfile> tag using the namespace
        rootfile_path = root.find(".//n:rootfile", NAMESPACES).attrib['full-path']
        return rootfile_path
    except Exception:
        # Fallback: If container.xml is missing or broken, search effectively
        # for any file ending in '.opf' to try and salvage the book.
        for name in zip_ref.namelist():
            if name.endswith('.opf'):
                return name
        raise ValueError(
            "Could not locate OPF rootfile in EPUB\n"
            "EPUB 内に OPF のルートファイルが見つかりません\n"
            "無法在 EPUB 中找到 OPF 根檔案"
        )

def parse_opf(zip_ref: zipfile.ZipFile, opf_path: str):
    """
    Parse the OPF file to determine the reading order (spine) of the book.
    Returns the spine file paths and the TOC file path (if found).
    
    The OPF file has two critical sections:
    1. <manifest>: Lists ALL files in the book (images, styles, chapters).
    2. <spine>: Lists ONLY the reading order of the chapters (by ID).
    """
    # Read the OPF file content
    opf_content = zip_ref.read(opf_path)
    root = ET.fromstring(opf_content)
    
    # Create the OPF namespace map dynamically to handle varying versions (2.0 vs 3.0).
    # Some OPFs are un-namespaced; handle both cases.
    has_namespace = '}' in root.tag
    ns = {'pkg': root.tag.split('}')[0].strip('{')} if has_namespace else {}
    
    # 1. Parse Manifest: Map ID -> Href (File Path)
    # Creates a dictionary where valid IDs point to their actual file locations.
    manifest_items = {}
    nav_href = None
    ncx_href = None
    if has_namespace:
        manifest_items_iter = root.findall(".//pkg:manifest/pkg:item", ns)
    else:
        manifest_items_iter = root.findall(".//manifest/item")
    for item in manifest_items_iter:
        item_id = item.attrib.get('id')
        href = item.attrib.get('href')
        if not item_id or not href:
            continue
        properties = item.attrib.get('properties', '')
        if properties and 'nav' in properties.split():
            nav_href = href
        media_type = item.attrib.get('media-type', '')
        if media_type == 'application/x-dtbncx+xml':
            ncx_href = href
        manifest_items[item_id] = href
        
    # 2. Parse Spine: Get linear reading order
    # The spine tells the parser the order in which to display the items found in the manifest.
    spine_hrefs = []
    spine = root.find(".//pkg:spine", ns) if has_namespace else root.find(".//spine")
    if spine is not None:
        toc_id = spine.attrib.get('toc')
        if toc_id and toc_id in manifest_items:
            ncx_href = manifest_items[toc_id]
        if has_namespace:
            spine_items = spine.findall(".//pkg:itemref", ns)
        else:
            spine_items = spine.findall(".//itemref")
        for itemref in spine_items:
            item_id = itemref.attrib.get('idref')
            if item_id in manifest_items:
                spine_hrefs.append(manifest_items[item_id])
            
    # 3. Resolve paths relative to the OPF file location
    # Sometimes the OPF file is inside a subdirectory (e.g., 'OEBPS/content.opf').
    # Prepends that directory to the file paths to find them in the zip.
    opf_dir = posixpath.dirname(opf_path)
    full_paths = []
    for href in spine_hrefs:
        path = resolve_zip_path(opf_dir, href)
        if path:
            full_paths.append(path)

    toc_href = nav_href or ncx_href
    toc_path = resolve_zip_path(opf_dir, toc_href) if toc_href else None

    return full_paths, toc_path

def parse_nav_toc_entries(nav_content: str, toc_dir: str):
    soup = BeautifulSoup(nav_content, 'html.parser')
    nav = (
        soup.find('nav', attrs={'epub:type': 'toc'})
        or soup.find('nav', attrs={'role': 'doc-toc'})
        or soup.find('nav')
    )
    if not nav:
        return []
    list_root = nav.find(['ol', 'ul'])
    if not list_root:
        return []

    entries = []

    def walk_list(list_tag, depth):
        for li in list_tag.find_all('li', recursive=False):
            link = li.find('a', href=True)
            if link:
                title = " ".join(link.get_text(" ", strip=True).split())
                path, fragment = split_toc_href(toc_dir, link.get('href'))
                if path:
                    entries.append({'path': path, 'fragment': fragment, 'title': title, 'depth': depth})
            child_list = li.find(['ol', 'ul'], recursive=False)
            if child_list:
                walk_list(child_list, depth + 1)

    walk_list(list_root, 1)
    return entries

def parse_ncx_toc_entries(ncx_content: str, toc_dir: str):
    try:
        root = ET.fromstring(ncx_content)
    except ET.ParseError:
        return []

    def local_name(elem):
        return elem.tag.split('}')[-1]

    def child_by_local_name(elem, name):
        for child in list(elem):
            if local_name(child) == name:
                return child
        return None

    entries = []

    def walk_nav_point(nav_point, depth):
        content = child_by_local_name(nav_point, 'content')
        src = content.attrib.get('src') if content is not None else ''
        nav_label = child_by_local_name(nav_point, 'navLabel')
        title = ""
        if nav_label is not None:
            text_el = child_by_local_name(nav_label, 'text')
            if text_el is not None and text_el.text:
                title = text_el.text.strip()
        path, fragment = split_toc_href(toc_dir, src)
        if path:
            entries.append({'path': path, 'fragment': fragment, 'title': title, 'depth': depth})
        for child in list(nav_point):
            if local_name(child) == 'navPoint':
                walk_nav_point(child, depth + 1)

    nav_map = None
    for elem in root.iter():
        if local_name(elem) == 'navMap':
            nav_map = elem
            break

    if nav_map is None:
        return entries

    for child in list(nav_map):
        if local_name(child) == 'navPoint':
            walk_nav_point(child, 1)

    return entries

def parse_toc_entries(zip_ref: zipfile.ZipFile, toc_path: str):
    if not toc_path:
        return []
    try:
        toc_content = zip_ref.read(toc_path)
    except KeyError:
        return []

    toc_dir = posixpath.dirname(toc_path)
    if toc_path.lower().endswith('.ncx'):
        return parse_ncx_toc_entries(toc_content, toc_dir)
    return parse_nav_toc_entries(toc_content, toc_dir)

def select_toc_chapter_anchors(entries):
    if not entries:
        return {}

    anchors = {}
    for entry in entries:
        if entry.get('depth') != 1:
            continue
        path = entry.get('path') or ''
        fragment = entry.get('fragment') or ''
        if not path.lower().endswith(('.html', '.htm', '.xhtml')):
            continue
        if not fragment:
            continue
        path = posixpath.normpath(path)
        anchor_list = anchors.setdefault(path, [])
        if fragment not in anchor_list:
            anchor_list.append(fragment)
    return anchors

def insert_anchor_markers(soup: BeautifulSoup, anchor_ids):
    if not anchor_ids:
        return
    seen_targets = set()
    for anchor_id in anchor_ids:
        if not anchor_id:
            continue
        target = soup.find(id=anchor_id) or soup.find(attrs={'name': anchor_id})
        if not target:
            continue
        heading_target = target.find_parent(list(HEADING_TAGS.keys()))
        target = heading_target or target
        target_key = id(target)
        if target_key in seen_targets:
            continue
        seen_targets.add(target_key)
        marker = soup.new_tag(ANCHOR_MARKER_TAG)
        target.insert_before(marker)

def epub_to_text(epub_path: str, output_txt_path: str) -> None:
    """
    Optimized extraction that streams text chapter-by-chapter.
    
    Instead of loading the entire book into memory, this function:
    1. Opens the EPUB as a Zip archive.
    2. Determines the reading order.
    3. Reads one chapter at a time, extracts text, writes to disk, and forgets it.
    """
    if not os.path.exists(epub_path):
        raise FileNotFoundError(
            f"Input file not found: {epub_path}\n"
            f"入力ファイルが見つかりません: {epub_path}\n"
            f"找不到輸入檔案: {epub_path}"
        )

    print(f"Opening: {epub_path}")
    print(f"開いています: {epub_path}")
    print(f"正在打開: {epub_path}")
    
    # Open the EPUB file as a standard ZIP file
    try:
        with zipfile.ZipFile(epub_path, 'r') as zip_ref:
            try:
                # Step 1: Find the structure file (OPF)
                opf_path = get_epub_rootfile(zip_ref)
                
                # Step 2: Get the list of chapter files in the correct order
                ordered_files, toc_path = parse_opf(zip_ref, opf_path)
            except Exception as e:
                raise ValueError(
                    f"Failed to parse EPUB structure: {e}\n"
                    f"EPUB 構造の解析に失敗しました: {e}\n"
                    f"解析 EPUB 結構失敗: {e}"
                )

            if not ordered_files:
                # Fallback: if spine is empty, grab HTML-ish files directly.
                ordered_files = sorted(
                    f for f in zip_ref.namelist()
                    if f.lower().endswith(('.html', '.htm', '.xhtml'))
                )
                print("Warning: No spine found; falling back to HTML file order in archive")
                print("警告: spine が見つからないため、アーカイブ内の HTML ファイル順で処理します")
                print("警告: 未找到 spine; 改為依壓縮檔中 HTML 檔案順序處理")

            if not ordered_files:
                raise ValueError(
                    "No readable HTML/XHTML content found in EPUB\n"
                    "EPUB 内に読み取り可能な HTML/XHTML コンテンツが見つかりません\n"
                    "在 EPUB 中找不到可讀的 HTML/XHTML 內容"
                )

            toc_entries = parse_toc_entries(zip_ref, toc_path)
            chapter_anchors = select_toc_chapter_anchors(toc_entries)

            print(f"Found {len(ordered_files)} chapters/files, extracting...")
            print(f"章またはファイルを {len(ordered_files)} 件検出しました。抽出中...")
            print(f"找到 {len(ordered_files)} 個章節/檔案，正在提取...")
            
            # Open the output text file for writing
            output_dir = os.path.dirname(os.path.abspath(output_txt_path))
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            with open(output_txt_path, 'w', encoding='utf-8') as txt_file:
                # Iterate through each file in the spine
                wrote_content = False
                last_was_separator = False
                chapter_separator = "\n\n---\n\n"

                for file_path in ordered_files:
                    try:
                        # Read the raw bytes of the chapter from the zip
                        content = zip_ref.read(file_path)
                        
                        # Check if file is HTML/XHTML based on extension
                        # Skips images, CSS, and other non-text files here.
                        lower_path = file_path.lower()
                        if not lower_path.endswith(('.html', '.xhtml', '.htm')):
                            continue

                        # Step 3: Parse HTML using BeautifulSoup
                        soup = BeautifulSoup(content, 'html.parser')
                        
                        # Remove non-content elements that are not desired in the text file
                        # script/style = code
                        # title/meta = invisible browser metadata
                        for element in soup(['script', 'style', 'title', 'meta', 'noscript']):
                            element.decompose()
                            
                        # Step 4: Extract text
                        # Use helper function to handle spacing intelligently
                        normalized_path = posixpath.normpath(file_path)
                        anchor_ids = chapter_anchors.get(normalized_path, [])
                        insert_anchor_markers(soup, anchor_ids)
                        text = get_clean_text(soup)
                        
                        if text.strip():
                            txt_file.write(text)
                            wrote_content = True
                            last_was_separator = False
                            txt_file.write(chapter_separator)
                            last_was_separator = True
                            
                    except KeyError:
                        # This happens if the OPF lists a file that doesn't actually exist in the zip
                        print(f"Missing file: {file_path}")
                        print(f"見つからないファイル: {file_path}")
                        print(f"缺少檔案: {file_path}")
                    except Exception as e:
                        print(f"Error processing: {file_path} - {e}")
                        print(f"処理中にエラーが発生しました: {file_path} - {e}")
                        print(f"處理檔案出錯: {file_path} - {e}")
                
                # Append footer
                if not last_was_separator:
                    txt_file.write("\n\n")
                conversion_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                txt_file.write("File converted by epub2txt\n")
                txt_file.write("https://github.com/SPACESODA/epub2txt\n")
                txt_file.write(f"Converted at: {conversion_timestamp}\n")
    except zipfile.BadZipFile as e:
        raise ValueError(
            f"Invalid EPUB file: {e}\n"
            f"無効な EPUB ファイルです: {e}\n"
            f"無效的 EPUB 檔案: {e}"
        )

    print(f"Done! TXT file saved to: {output_txt_path}")
    print(f"完了! TXT ファイルを保存しました: {output_txt_path}")
    print(f"完成! 文本已保存至: {output_txt_path}")

def normalize_extracted_text(segments) -> str:
    output = []
    normal_buffer = []

    def flush_normal():
        if not normal_buffer:
            return
        text = "".join(normal_buffer)
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        text = re.sub(r"[ \t\f\v]+", " ", text)
        text = re.sub(r" *\n *", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        output.append(text)
        normal_buffer.clear()

    for text, is_pre in segments:
        if is_pre:
            flush_normal()
            pre_text = text.replace('\r\n', '\n').replace('\r', '\n')
            output.append(pre_text)
        else:
            normal_buffer.append(text)

    flush_normal()
    combined = "".join(output)
    combined = re.sub(r"^\n+", "", combined)
    combined = re.sub(r"\n+$", "", combined)
    return combined

def get_clean_text(soup: BeautifulSoup) -> str:
    """
    Extract text from BeautifulSoup object with intelligent whitespace handling.
    Preserves sentence structure for LLMs while maintaining paragraph separation.
    
    This function traverses the DOM tree recursively:
    - Block elements (p, div, etc.) trigger line breaks.
    - Lists are flattened with indentation to preserve hierarchy.
    - Script/Style/Meta tags are ignored.
    """
    root = soup.body or soup
    if not root:
        return ""

    parts = []
    state = {'has_content': False, 'last_sep': False}

    def add_text(text: str, is_pre: bool, is_content: bool = False):
        if not text:
            return
        parts.append((text, is_pre))
        if is_content:
            state['has_content'] = True
            state['last_sep'] = False

    def add_separator():
        if state['has_content'] and not state['last_sep']:
            parts.append(("\n\n---\n\n", False))
            state['last_sep'] = True

    def walk(node, in_pre: bool = False, list_depth: int = 0):
        for child in node.children:
            if isinstance(child, NavigableString):
                text = str(child)
                if in_pre:
                    if text:
                        add_text(text, True, is_content=bool(text.strip()))
                else:
                    text = re.sub(r"\s+", " ", text)
                    if text:
                        add_text(text, False, is_content=bool(text.strip()))
                continue

            if isinstance(child, Tag):
                name = child.name.lower()
                if name in SKIP_TAGS:
                    continue
                if name == ANCHOR_MARKER_TAG:
                    add_separator()
                    continue
                if name == 'br':
                    add_text("\n", in_pre)
                    continue

                if name in ('b', 'strong'):
                    if not in_pre:
                        add_text("**", False)
                    walk(child, in_pre, list_depth)
                    if not in_pre:
                        add_text("**", False)
                    continue

                # Handle Lists
                if name in ('ul', 'ol'):
                    if not in_pre:
                        add_text("\n", False)
                    walk(child, in_pre, list_depth + 1)
                    if not in_pre:
                        add_text("\n", False)
                    continue

                if name == 'li':
                    if not in_pre:
                        add_text("\n", False)
                        # Indent based on depth (depth 1 = no indent, depth 2 = 2 spaces, etc.)
                        indent = "    " * max(0, list_depth - 1)
                        add_text(indent + "- ", True)
                    walk(child, in_pre, list_depth)
                    if not in_pre:
                        add_text("\n", False)
                    continue

                heading_level = HEADING_TAGS.get(name)
                if heading_level and not in_pre:
                    heading_text = child.get_text(" ", strip=True)
                    if heading_text:
                        add_text("\n", False)
                        level = min(heading_level, MAX_HEADING_LEVEL)
                        add_text("#" * level + " " + heading_text, False, is_content=True)
                        add_text("\n", False)
                        continue

                is_block = name in BLOCK_TAGS
                next_pre = in_pre or name in PRE_TAGS
                if is_block and not in_pre:
                    add_text("\n", False)

                walk(child, next_pre, list_depth)

                if is_block and not in_pre:
                    add_text("\n", False)

    walk(root)
    return normalize_extracted_text(parts)


if __name__ == "__main__":
    # Setup command line arguments
    parser = argparse.ArgumentParser(
        description="Convert Large EPUB files to TXT efficiently / 大型 EPUB ファイルを効率的に TXT に変換 / 將大型 EPUB 檔案高效轉換為 TXT"
    )
    parser.add_argument(
        "epub_paths",
        nargs='*',
        help="File or Folder path(s) containing EPUBs / EPUB ファイルまたはフォルダのパス / EPUB 檔案或資料夾路徑"
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Path to the output TXT file (optional, single file only) / 出力 TXT ファイルのパス (任意、単一入力のみ) / 輸出 TXT 檔案路徑 (可選，僅限單檔案)"
    )

    args = parser.parse_args()
    
    # Interactive mode: If no arguments provided, ask user for input
    if not args.epub_paths:
        print("Drag and drop EPUB files or folders here, or type the path below:")
        print("ここに EPUB ファイル／フォルダをドラッグ＆ドロップするか、下にパスを入力してください:")
        print("請將 EPUB 檔案或資料夾拖放到這裡，或在下方輸入路徑:")
        p = input("> ").strip()

        if p:
            # Use shlex to correctly parse shell-style arguments
            # posix=True (default) handles escaping for Mac/Linux (e.g. \ )
            # posix=False is needed for Windows to preserve backslashes in paths
            use_posix = (os.name != 'nt')
            
            try:
                args.epub_paths = shlex.split(p, posix=use_posix)
                
                # Windows Quirk: shlex in non-posix mode does not strip quotes automatically
                # This often happens when dragging multiple files, where Windows surrounds EVERY path with quotes.
                if not use_posix:
                    cleaned_paths = []
                    for path in args.epub_paths:
                        # Strip matching outer quotes cleanly
                        if path.startswith('"') and path.endswith('"'):
                            path = path[1:-1]
                        elif path.startswith("'") and path.endswith("'"):
                            path = path[1:-1]
                        cleaned_paths.append(path)
                    args.epub_paths = cleaned_paths
                    
            except ValueError:
                # Fallback: Treat as single literal string if parsing fails
                args.epub_paths = [p]
        else:
            print("No path entered")
            print("パスが入力されていません")
            print("未輸入路徑")
            sys.exit(0)
    
    # Step 1: Expand folders into a list of specific files
    files_to_process = []
    
    for path in args.epub_paths:
        if os.path.isdir(path):
            # It's a folder: Scan for .epub files (one level deep, no recursion)
            print(f"Scanning folder: {path}")
            print(f"フォルダをスキャン中: {path}")
            print(f"正在掃描資料夾: {path}")
            try:
                folder_epubs = [
                    os.path.join(path, f) 
                    for f in os.listdir(path) 
                    if f.lower().endswith('.epub')
                ]
                if not folder_epubs:
                    print(f"  No EPUB files found in: {path}")
                    print(f"  EPUB ファイルが見つかりません: {path}")
                    print(f"  找不到 EPUB 檔案: {path}")
                else:
                    print(f"  Found {len(folder_epubs)} EPUBs.")
                    print(f"  EPUB を {len(folder_epubs)} 件見つけました。")
                    print(f"  找到 {len(folder_epubs)} EPUBs.")
                files_to_process.extend(folder_epubs)
            except Exception as e:
                print(f"  Error reading folder: {e}")
                print(f"  フォルダの読み込み中にエラーが発生しました: {e}")
                print(f"  讀取資料夾出錯: {e}")
        else:
            # It's a file (or invalid path), add it directly
            files_to_process.append(path)
            
    # Remove duplicates just in case and sort
    files_to_process = sorted(list(set(files_to_process)))
            
    if not files_to_process:
        print("No files to process")
        print("処理するファイルがありません")
        print("無法處理的檔案")
        sys.exit(0)

    # Validation: Cannot use -o with multiple files
    if len(files_to_process) > 1 and args.output:
        print("Error: Cannot use -o argument with multiple input files")
        print("エラー: 複数入力では -o を使用できません")
        print("錯誤: 不能對多個輸入檔案使用 -o 參數")
        sys.exit(1)

    # Process files
    count = 0
    total = len(files_to_process)
    
    for epub_path in files_to_process:
        count += 1
        # Determine output path
        if total == 1 and args.output:
            output_path = args.output
        else:
            output_path = os.path.splitext(epub_path)[0] + ".txt"

        try:
            print(f"Processing ({count}/{total}): {os.path.basename(epub_path)}")
            print(f"処理中 ({count}/{total}): {os.path.basename(epub_path)}")
            print(f"正在處理 ({count}/{total}): {os.path.basename(epub_path)}")
            epub_to_text(epub_path, output_path)
        except Exception as e:
            print(f"Error processing {epub_path}: {e}")
            print(f"処理中にエラーが発生しました: {epub_path} - {e}")
            print(f"處理 {epub_path} 時發生錯誤: {e}")
            # If processing only one file, exit with error code
            if total == 1:
                sys.exit(1)
        
        # Divider
        if count < total:
            print("-" * 40)
