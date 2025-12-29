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
from typing import List

# Graceful import handling for BeautifulSoup
# Wraps this in a try-except block to provide an error message if the user hasn't installed the required 'beautifulsoup4' library yet.
try:
    from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
    import warnings
    # Suppress warnings about parsing XML as HTML (common in EPUBs)
    # EPUBs often use XHTML which can trigger benign warnings in BeautifulSoup.
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
except ImportError:
    print("Error: Required library 'beautifulsoup4' is not installed")
    print("錯誤: 必需的 'beautifulsoup4' 庫尚未安裝")
    print("Tip: Use the helper script to auto-install dependencies:")
    print("提示: 使用輔助腳本自動安裝依賴項:")
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
        raise ValueError("Could not locate OPF rootfile in EPUB\n無法在 EPUB 中找到 OPF 根檔案")

def parse_opf(zip_ref: zipfile.ZipFile, opf_path: str) -> List[str]:
    """
    Parse the OPF file to determine the reading order (spine) of the book.
    Returns a list of file paths (inside the zip) in strict reading order.
    
    The OPF file has two critical sections:
    1. <manifest>: Lists ALL files in the book (images, styles, chapters).
    2. <spine>: Lists ONLY the reading order of the chapters (by ID).
    """
    # Read the OPF file content
    opf_content = zip_ref.read(opf_path)
    root = ET.fromstring(opf_content)
    
    # Create the OPF namespace map dynamically to handle varying versions (2.0 vs 3.0).
    # Grabs the namespace from the root tag itself.
    ns = {'pkg': root.tag.split('}')[0].strip('{')}
    
    # 1. Parse Manifest: Map ID -> Href (File Path)
    # Creates a dictionary where valid IDs point to their actual file locations.
    manifest_items = {}
    for item in root.findall(".//pkg:manifest/pkg:item", ns):
        item_id = item.attrib.get('id')
        href = item.attrib.get('href')
        if not item_id or not href:
            continue
        manifest_items[item_id] = href
        
    # 2. Parse Spine: Get linear reading order
    # The spine tells the parser the order in which to display the items found in the manifest.
    spine_hrefs = []
    for itemref in root.findall(".//pkg:spine/pkg:itemref", ns):
        item_id = itemref.attrib.get('idref')
        
        # Verify the ID exists in the manifest before adding it
        if item_id in manifest_items:
            href = manifest_items[item_id]
            spine_hrefs.append(href)
            
    # 3. Resolve paths relative to the OPF file location
    # Sometimes the OPF file is inside a subdirectory (e.g., 'OEBPS/content.opf').
    # Prepends that directory to the file paths to find them in the zip.
    opf_dir = os.path.dirname(opf_path)
    full_paths = []
    for href in spine_hrefs:
        # Decode URL-encoded characters (like %20 for spaces)
        href = urllib.parse.unquote(href)
        
        if opf_dir:
            # Join paths safely and ensure forward slashes for zip compatibility
            path = os.path.join(opf_dir, href).replace('\\', '/') 
        else:
            path = href
        full_paths.append(path)
        
    return full_paths

def epub_to_text(epub_path: str, output_txt_path: str) -> None:
    """
    Optimized extraction that streams text chapter-by-chapter.
    
    Instead of loading the entire book into memory, this function:
    1. Opens the EPUB as a Zip archive.
    2. Determines the reading order.
    3. Reads one chapter at a time, extracts text, writes to disk, and forgets it.
    """
    if not os.path.exists(epub_path):
        raise FileNotFoundError(f"Input file not found: {epub_path}\n找不到輸入檔案: {epub_path}")

    print(f"Opening: {epub_path}")
    print(f"正在打開: {epub_path}")
    
    # Open the EPUB file as a standard ZIP file
    try:
        with zipfile.ZipFile(epub_path, 'r') as zip_ref:
            try:
                # Step 1: Find the structure file (OPF)
                opf_path = get_epub_rootfile(zip_ref)
                
                # Step 2: Get the list of chapter files in the correct order
                ordered_files = parse_opf(zip_ref, opf_path)
            except Exception as e:
                raise ValueError(f"Failed to parse EPUB structure: {e}\n解析 EPUB 結構失敗: {e}")

            if not ordered_files:
                # Fallback: if spine is empty, grab HTML-ish files directly.
                ordered_files = sorted(
                    f for f in zip_ref.namelist()
                    if f.lower().endswith(('.html', '.htm', '.xhtml'))
                )
                print("Warning: No spine found; falling back to HTML file order in archive")
                print("警告: 未找到 spine；改為依壓縮檔中 HTML 檔案順序處理")

            if not ordered_files:
                raise ValueError("No readable HTML/XHTML content found in EPUB\n在 EPUB 中找不到可讀的 HTML/XHTML 內容")

            print(f"Found {len(ordered_files)} chapters/files, extracting...")
            print(f"找到 {len(ordered_files)} 個章節/檔案，正在提取...")
            
            # Open the output text file for writing
            output_dir = os.path.dirname(os.path.abspath(output_txt_path))
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            with open(output_txt_path, 'w', encoding='utf-8') as txt_file:
                # Iterate through each file in the spine
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
                        for element in soup(['script', 'style', 'title', 'meta']):
                            element.decompose()
                            
                        # Step 4: Extract text
                        # separator='\n\n' adds a blank line between every paragraph or block for readability.
                        # strip=True removes leading/trailing whitespace from the text logic.
                        text = soup.get_text(separator='\n\n', strip=True)
                        
                        if text:
                            # Write the cleaned text to our output file
                            txt_file.write(text)
                            
                            # Add a visual separator between chapters
                            txt_file.write("\n\n" + "-" * 20 + "\n\n") 
                            
                    except KeyError:
                        # This happens if the OPF lists a file that doesn't actually exist in the zip
                        print(f"Missing file: {file_path}")
                        print(f"缺少檔案: {file_path}")
                    except Exception as e:
                        print(f"Error processing: {file_path} - {e}")
                        print(f"處理檔案出錯: {file_path} - {e}")
                
                # Append footer
                txt_file.write("File converted using epub2txt.py\n")
                txt_file.write("https://github.com/SPACESODA/epub2txt\n")
    except zipfile.BadZipFile as e:
        raise ValueError(f"Invalid EPUB/ZIP file: {e}\n無效的 EPUB/ZIP 檔案: {e}")

    print(f"Done! TXT file saved to: {output_txt_path}")
    print(f"完成! 文本已保存至: {output_txt_path}")

if __name__ == "__main__":
    # Setup command line arguments
    parser = argparse.ArgumentParser(description="Convert Large EPUB files to TXT efficiently / 將大型 EPUB 檔案高效轉換為 TXT")
    parser.add_argument("epub_paths", nargs='*', help="File or Folder path(s) containing EPUBs / EPUB 檔案或資料夾路徑")
    parser.add_argument("-o", "--output", help="Path to the output TXT file (optional, single file only) / 輸出 TXT 檔案路徑 (可選，僅限單檔案)")

    args = parser.parse_args()
    
    # Interactive mode: If no arguments provided, ask user for input
    if not args.epub_paths:
        print("Tip: You can drag and drop a file here")
        print("提示: 您可以將檔案拖放到這裡")
        print("Please enter the path to EPUB file(s) or folder(s):")
        print("請輸入 EPUB 檔案或資料夾的路徑:")
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
            print("未輸入路徑")
            sys.exit(0)
    
    # Step 1: Expand folders into a list of specific files
    files_to_process = []
    
    for path in args.epub_paths:
        if os.path.isdir(path):
            # It's a folder: Scan for .epub files (one level deep, no recursion)
            print(f"Scanning folder: {path}")
            print(f"正在掃描資料夾: {path}")
            try:
                folder_epubs = [
                    os.path.join(path, f) 
                    for f in os.listdir(path) 
                    if f.lower().endswith('.epub')
                ]
                if not folder_epubs:
                    print(f"  No EPUB files found in: {path}")
                    print(f"  找不到 EPUB 檔案: {path}")
                else:
                    print(f"  Found {len(folder_epubs)} EPUBs.")
                    print(f"  找到 {len(folder_epubs)} EPUBs.")
                files_to_process.extend(folder_epubs)
            except Exception as e:
                print(f"  Error reading folder: {e}")
                print(f"  讀取資料夾出錯: {e}")
        else:
            # It's a file (or invalid path), add it directly
            files_to_process.append(path)
            
    # Remove duplicates just in case and sort
    files_to_process = sorted(list(set(files_to_process)))
            
    if not files_to_process:
        print("No files to process")
        print("無法處理的檔案")
        sys.exit(0)

    # Validation: Cannot use -o with multiple files
    if len(files_to_process) > 1 and args.output:
        print("Error: Cannot use -o argument with multiple input files")
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
            print(f"正在處理 ({count}/{total}): {os.path.basename(epub_path)}")
            epub_to_text(epub_path, output_path)
        except Exception as e:
            print(f"Critical Error processing {epub_path}: {e}")
            print(f"處理 {epub_path} 時發生嚴重錯誤: {e}")
            # If processing only one file, exit with error code
            if total == 1:
                sys.exit(1)
        
        # Divider
        if count < total:
            print("-" * 40)
