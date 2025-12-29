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

## Quick Start / 快速開始

### Mac / Linux
1.  Open your terminal.
2.  Navigate to the script folder using `cd`:
    ```bash
    cd Downloads/epub2txt
    ```
3.  Run the helper script `./run.sh `:
    ```bash
    ./run.sh /path/to/myBook.epub
    ```

### Windows
1.  Open Command Prompt (cmd).
2.  Navigate to the script folder using `cd`:
    ```bat
    cd Downloads\epub2txt
    ```
3.  Run the helper script `run.bat `:
    ```bat
    run.bat C:\path\to\myBook.epub
    ```

This will automatically set up the environment and install dependencies for you.  
這將自動為您設置環境並安裝依賴項。

---

## Manual Installation / 手動安裝

If you prefer to run it manually or don't want to use the helper scripts:

1.  **Requirement**: Python 3 installed.
2.  **Environment**:
    ```bash
    # Mac / Linux
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
    ```bat
    :: Windows
    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt
    ```
3.  **Run**:
    ```bash
    python3 epub2txt.py
    ```

## Usage Examples / 用法示例

**Note**: Replace `./run.sh` with `run.bat` on Windows.
**注意**: 在 Windows 上請將 `./run.sh` 替換為 `run.bat`。

**Custom Output Name / 自定義輸出名稱**
```bash
./run.sh myBook.epub -o myBook001.txt
```

**Multiple Files / 多個文件**
```bash
./run.sh book1.epub book2.epub
```

**Folder Processing / 文件夾處理**
```bash
./run.sh /path/to/MyBooks/
```

## Notes / 備註

*   **Images**: All images are ignored to keep the output file small and text-focused.  
    **圖片**: 所有圖片都會被忽略，以保持輸出文件小巧且專注於文字。
*   **Encoding**: Output files are forced to UTF-8 encoding to support all languages and emojis.  
    **編碼**: 輸出文件強制使用 UTF-8 編碼，以支持所有語言和表情符號。
*   **Spaces**: When processing multiple files or folders, ensure there is a **space** between each path in your command.  
    **空格**: 要處理多個文件或文件夾時，請確保在命令中的每個路徑之間有**空格**。
