# epub2txt

**epub2txt** — A robust, efficient Python script to convert EPUB files to clean, readable plain text (TXT).  
**epub2txt** 是一個強大且高效的 Python 腳本，用於將 EPUB 檔案轉換為清晰易讀的純文本 (TXT)。

## Features / 功能

* **Batch Processing**: Convert multiple files or top-level folders in one run (non-recursive).  
  **批量處理**: 一次轉換多個檔案或資料夾 (僅掃描第一層)。
* **Smart Formatting**: Adds blank lines between paragraphs for better readability.  
  **智能排版**: 在段落之間添加空行，提高可讀性。
* **Clean Output**: Strips images, styles, scripts, and metadata—keeps only text from `.html/.xhtml` files.  
  **乾淨輸出**: 移除圖片、樣式、腳本與中繼資料，只保留 `.html/.xhtml` 文字。
* **Interactive Drag & Drop**: Run without arguments to enter interactive mode. Supports dragging multiple files and folders at once!  
  **互動式拖放**: 無參數執行即可進入互動模式，支援一次拖放多個檔案與資料夾！
* **Safe defaults**: If `-o` points to a new folder, it will be created; `-o` is for single inputs only.  
  **安全預設**: 若 `-o` 指向的新資料夾不存在會自動建立；`-o` 只適用單檔輸入。

## Quick Start / 快速開始

Automatically set up the environment and install dependencies.  
自動設置環境並安裝依賴項。

### Mac / Linux
1. Open your terminal.
2. Navigate to the script folder using `cd`:
    ```bash
    cd /path/to/epub2txt
    ```
3. Run the helper script:
    ```bash
    ./run.sh 
    ```
    ```bash
    ./run.sh /path/to/myBook.epub
    ```
      

### Windows
1. Open Command Prompt `cmd`.
2. Navigate to the script folder using `cd`:
    ```bat
    cd C:\path\to\epub2txt
    ```
3. Run the helper script:
    ```bat
    run.bat 
    ```
    ```bat
    run.bat C:\path\to\myBook.epub
    ```

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
    ```bash
    python3 epub2txt.py /path/to/myBook.epub
    ```

## Usage Examples / 用法示例

**Note**: Replace `./run.sh` with `run.bat` on Windows.  
**注意**: 在 Windows 上請將 `./run.sh` 替換為 `run.bat`。

**Custom Output Name / 自定義輸出名稱**  
(Single input only / 僅適用單檔輸入)  
```bash
./run.sh myBook.epub -o myBook001.txt
```

**Multiple Files / 多個檔案**  
```bash
./run.sh book1.epub book2.epub
```

**Multiple Files & Folders / 多個檔案與資料夾**  
```bash
./run.sh book1.epub /path/to/folder/ book2.epub
```

**Folder Processing / 資料夾處理**  
```bash
./run.sh /path/to/MyBooks/
```

## Notes / 備註

* **Output location**: Without `-o`, each `.epub` becomes a `.txt` beside the source file. `-o` cannot be used with multiple inputs.  
  **輸出位置**: 未使用 `-o` 時，每個 `.epub` 會在原路徑旁輸出 `.txt`；多檔輸入時不可搭配 `-o`。
* **Folder scanning**: Looks only one level deep; subfolders are skipped.  
  **資料夾掃描**: 僅掃描第一層，子資料夾不會處理。
* **OPF fallback**: If the EPUB spine is empty, it falls back to processing all HTML/XHTML files in archive order.  
  **OPF 後備處理**: 若 EPUB spine 為空，會改為依壓縮檔順序處理所有 HTML/XHTML 檔案。
* **Encoding**: Output files are forced to UTF-8 encoding.  
  **編碼**: 輸出檔案強制使用 UTF-8 編碼。
* **Spacing**: Add a space between each path when passing multiple files or folders.  
  **空格**: 傳入多個檔案或資料夾時，請在路徑間加入空格。
