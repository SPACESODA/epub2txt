# epub2txt

**epub2txt** — A robust, efficient Python script to convert EPUB files to clean, readable plain text (TXT).  
**epub2txt** 是一個強大且高效的 Python 腳本，用於將 EPUB 文件轉換為清晰易讀的純文本 (TXT)。

## Features / 功能

*   **Batch Processing**: Convert multiple files or entire folders at once.  
    **批量處理**: 一次轉換多個文件或整個文件夾。
*   **Smart Formatting**: Automatically adds double spacing between paragraphs for better readability.  
    **智能排版**: 自動在段落之間添加空行，提高可讀性。
*   **Clean Output**: Removes images, styles, and scripts, keeping only the text.  
    **乾淨輸出**: 移除圖片、樣式和腳本，只保留文字。

## Installation / 安裝

1.  **Requirement**: You need Python 3 installed.  
    **需求**: 您需要安裝 Python 3。
2.  **Setup Environment**: Create and activate a virtual environment. This is **required** on many modern systems to prevent installation errors.  
    **設定環境**: 建立並啟用虛擬環境。這在許多現代系統上是**必須**的，以避免安裝錯誤。

    **Mac / Linux**:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```

    **Windows**:
    ```bat
    python -m venv .venv
    .venv\Scripts\activate
    ```

3.  **Install Library**: Install the required `beautifulsoup4` library.  
    **安裝庫**: 安裝必需的 `beautifulsoup4` 庫。

    ```bash
    pip install beautifulsoup4
    ```

## Usage / 用法

### 1. Single File / 單個文件

Convert a single EPUB file. The output TXT will have the same name.  
轉換單個 EPUB 文件。輸出的 TXT 文件將使用相同的名稱。

```bash
python3 epub2txt.py book.epub
```

**Custom Output Name / 自定義輸出名稱**:  
(Only works for single files / 僅適用於單個文件)

```bash
python3 epub2txt.py book.epub -o my_book.txt
```

### 2. Multiple Files / 多個文件

Convert multiple specific files at once.  
一次轉換多個特定文件。

```bash
python3 epub2txt.py book1.epub book2.epub book3.epub
```

### 3. Folder Processing / 文件夾處理

Convert all EPUB files inside a folder (non-recursive).  
轉換文件夾內的所有 EPUB 文件 (不包含子文件夾)。

```bash
python3 epub2txt.py /path/to/MyBooks/
```

### 4. Mixed Input / 混合輸入

Combine files and folders in one command.  
在一個指令中混合使用文件和文件夾。

```bash
python3 epub2txt.py specific_book.epub /folder1/ /folder2/
```

## Notes / 備註

*   **Images**: All images are ignored to keep the output file small and text-focused.  
    **圖片**: 所有圖片都會被忽略，以保持輸出文件小巧且專注於文字。
*   **Encoding**: Output files are forced to UTF-8 encoding to support all languages and emojis.  
    **編碼**: 輸出文件強制使用 UTF-8 編碼，以支持所有語言和表情符號。
*   **Spaces**: When processing multiple files or folders, ensure there is a **space** between each path in your command.  
    **空格**: 要處理多個文件或文件夾時，請確保在命令中的每個路徑之間有**空格**。
