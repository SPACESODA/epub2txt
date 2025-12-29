# epub2txt

**epub2txt** — A robust, efficient Python script to convert EPUB files to clean, readable plain text (TXT).

**epub2txt** — EPUB ファイルをクリーンで読みやすいプレーンテキスト (TXT) に変換する、堅牢で効率的な Python スクリプト。

**epub2txt** 是一個強大且高效的 Python 腳本，用於將 EPUB 檔案轉換為清晰易讀的純文字 (TXT)。

<br>

[English](#english) | [日本語](#japanese) | [中文](#chinese)

<br>

<a id="english"></a>
## epub2txt (English)

### Features

* **Batch Processing**: Convert multiple files or top-level folders in one run (non-recursive).
* **Formatting**: Adds blank lines between paragraphs.
* **Text Extraction**: Strips images, styles, scripts, and metadata—keeps only text from `.html/.xhtml` files.
* **Interactive Mode**: Run without arguments to enter interactive mode. Supports dragging multiple files and folders.
* **Output Handling**: If `-o` points to a new folder, it will be created; `-o` is for single inputs only.

### Quick Start

Automatically set up the environment and install dependencies.

#### Mac / Linux
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

#### Windows
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

### Manual Installation

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

### Usage Examples

**Note**: Replace `./run.sh` with `run.bat` on Windows.

**Custom Output Name**  
(Single input only)  
```bash
./run.sh myBook.epub -o myBook001.txt
```

**Multiple Files**  
```bash
./run.sh book1.epub book2.epub
```

**Multiple Files & Folders**  
```bash
./run.sh book1.epub /path/to/folder/ book2.epub
```

**Folder Processing**  
```bash
./run.sh /path/to/MyBooks/
```

### Notes

* **Output location**: Without `-o`, each `.epub` becomes a `.txt` beside the source file. `-o` cannot be used with multiple inputs.
* **Folder scanning**: Looks only one level deep; subfolders are skipped.
* **OPF fallback**: If the EPUB spine is empty, it falls back to processing all HTML/XHTML files in archive order.
* **Encoding**: Output files are forced to UTF-8 encoding.
* **Spacing**: Add a space between each path when passing multiple files or folders.

<br>
<br>

<a id="japanese"></a>
## epub2txt (日本語)

### 機能

* **一括処理**: 複数のファイルやトップレベルのフォルダを一度に変換します (再帰的ではありません)。
* **整形**: 段落間に空行を追加します。
* **テキスト抽出**: 画像、スタイル、スクリプト、メタデータを削除し、`.html/.xhtml` ファイルからテキストのみを保持します。
* **インタラクティブモード**: 引数なしで実行するとインタラクティブモードに入ります。複数のファイルやフォルダのドラッグ＆ドロップに対応しています。
* **出力処理**: `-o` で存在しないフォルダを指定した場合は作成します。`-o` は単一入力専用です。

### クイックスタート

環境のセットアップと依存関係のインストールを自動的に行います。

#### Mac / Linux
1. ターミナルを開きます。
2. `cd` を使用してスクリプトフォルダに移動します:
    ```bash
    cd /path/to/epub2txt
    ```
3. ヘルパースクリプトを実行します:
    ```bash
    ./run.sh 
    ```
    ```bash
    ./run.sh /path/to/myBook.epub
    ```

#### Windows
1. コマンドプロンプト `cmd` を開きます。
2. `cd` を使用してスクリプトフォルダに移動します:
    ```bat
    cd C:\path\to\epub2txt
    ```
3. ヘルパースクリプトを実行します:
    ```bat
    run.bat 
    ```
    ```bat
    run.bat C:\path\to\myBook.epub
    ```

### 手動インストール

手動で実行したい場合、またはヘルパースクリプトを使用したくない場合:

1.  **必須**: Python 3 がインストールされていること。
2.  **環境設定**:
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
3.  **実行**:
    ```bash
    python3 epub2txt.py 
    ```
    ```bash
    python3 epub2txt.py /path/to/myBook.epub
    ```

### 使用例

**注意**: Windows では `./run.sh` を `run.bat` に置き換えてください。

**カスタム出力名**  
(単一入力のみ)  
```bash
./run.sh myBook.epub -o myBook001.txt
```

**複数のファイル**  
```bash
./run.sh book1.epub book2.epub
```

**複数のファイルとフォルダ**  
```bash
./run.sh book1.epub /path/to/folder/ book2.epub
```

**フォルダの処理**  
```bash
./run.sh /path/to/MyBooks/
```

### 備考

* **出力場所**: `-o` なしの場合、各 `.epub` は元ファイルと同じ場所に `.txt` として出力されます。`-o` は複数入力では使用できません。
* **フォルダのスキャン**: 1階層のみスキャンし、サブフォルダはスキップされます。
* **OPF フォールバック**: EPUB のスパイン（spine）が空の場合、すべての HTML/XHTML ファイルをアーカイブ順に処理します。
* **エンコーディング**: 出力ファイルは UTF-8 に固定されます。
* **スペース**: 複数のファイルやフォルダを渡すときは、各パスの間にスペースを追加してください。

<br>
<br>

<a id="chinese"></a>
## epub2txt (中文)

### 功能

* **批量處理**: 一次轉換多個檔案或資料夾 (僅掃描第一層)。
* **段落排版**: 在段落之間添加空行。
* **文字提取**: 移除圖片、樣式、腳本與中繼資料，只保留 `.html/.xhtml` 文字。
* **互動模式**: 無參數執行即可進入互動模式，支援拖放多個檔案與資料夾。
* **輸出處理**: 若 `-o` 指向的新資料夾不存在會自動建立；`-o` 只適用單檔輸入。

### 快速開始

自動設置環境並安裝依賴項。

#### Mac / Linux
1. 打開終端機 (Terminal)。
2. 使用 `cd` 指令進入腳本資料夾:
    ```bash
    cd /path/to/epub2txt
    ```
3. 執行幫助腳本:
    ```bash
    ./run.sh 
    ```
    ```bash
    ./run.sh /path/to/myBook.epub
    ```

#### Windows
1. 打開命令提示字元 `cmd`。
2. 使用 `cd` 指令進入腳本資料夾:
    ```bat
    cd C:\path\to\epub2txt
    ```
3. 執行幫助腳本:
    ```bat
    run.bat 
    ```
    ```bat
    run.bat C:\path\to\myBook.epub
    ```

### 手動安裝

如果您偏好手動執行或不想使用幫助腳本:

1.  **需求**: 已安裝 Python 3。
2.  **環境**:
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
3.  **執行**:
    ```bash
    python3 epub2txt.py 
    ```
    ```bash
    python3 epub2txt.py /path/to/myBook.epub
    ```

### 用法示例

**注意**: 在 Windows 上請將 `./run.sh` 替換為 `run.bat`。

**自定義輸出名稱**  
(僅適用單檔輸入)  
```bash
./run.sh myBook.epub -o myBook001.txt
```

**多個檔案**  
```bash
./run.sh book1.epub book2.epub
```

**多個檔案與資料夾**  
```bash
./run.sh book1.epub /path/to/folder/ book2.epub
```

**資料夾處理**  
```bash
./run.sh /path/to/MyBooks/
```

### 備註

* **輸出位置**: 未使用 `-o` 時，每個 `.epub` 會在原路徑旁輸出 `.txt`；多檔輸入時不可搭配 `-o`。
* **資料夾掃描**: 僅掃描第一層，子資料夾不會處理。
* **OPF 後備處理**: 若 EPUB spine 為空，會改為依壓縮檔順序處理所有 HTML/XHTML 檔案。
* **編碼**: 輸出檔案強制使用 UTF-8 編碼。
* **空格**: 傳入多個檔案或資料夾時，請在路徑間加入空格。
