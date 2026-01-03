import zipfile
import os

def create_robust_epub(output_path):
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 1. Define content payloads for a multi-file EPUB structure.
    intro_content = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Intro</title>
  <link rel="stylesheet" type="text/css" href="../styles/base.css"/>
</head>
<body>
  <h1 id="intro">Robust EPUB Test</h1>
  <p>This file includes baseline paragraphs, blockquotes, and inline elements.</p>
  <blockquote>
    <p>Quoted text with an <em>emphasis</em> and <strong>strong</strong> inline mix.</p>
  </blockquote>
  <p>Inline code example: <code>const value = 42;</code></p>
  <p>Entity coverage: Caf&#233;, &#x00E9;clair, and &#169; symbols.</p>
  <hr/>
  <p>Jump to <a href="../text/ch1.xhtml#lists">chapter 1 lists</a>.</p>
</body>
</html>
"""

    chapter_one_content = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Chapter 1</title>
  <link rel="stylesheet" type="text/css" href="../styles/base.css"/>
  <style type="text/css">
    .hidden { display: none; }
  </style>
  <script type="text/javascript">
    console.log("script should be ignored");
  </script>
</head>
<body>
  <h1 id="lists">Chapter 1: Lists and Blocks</h1>

  <p>Standard unordered list:</p>
  <ul>
    <li>Item A</li>
    <li>Item B</li>
  </ul>

  <p>Deeply nested mixed list:</p>
  <ul>
    <li>Level 1
      <ol>
        <li>Level 2 Ordered
          <ul>
            <li>Level 3 Unordered</li>
            <li>Level 3 Item 2
              <ul>
                <li>Level 4</li>
                <li>Level 4
                  <ul>
                    <li>Level 5</li>
                    <li>Level 5
                      <ul>
                        <li>Level 6 Deepest</li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ol>
    </li>
  </ul>

  <p>Complex content in items:</p>
  <ul>
    <li>
      <strong>Bold title</strong><br/>
      Description on new line.
    </li>
    <li>
      Code example: <code>print("hello")</code> inside item.
    </li>
    <li>
      Item with pre block:
      <pre>
def foo():
    return "bar"
      </pre>
    </li>
  </ul>

  <p>Definition list:</p>
  <dl>
    <dt>Term A</dt>
    <dd>Description A</dd>
    <dt>Term B</dt>
    <dd>Description B with <span class="hidden">hidden text</span>.</dd>
  </dl>

  <p>Table with headers:</p>
  <table>
    <thead>
      <tr><th>Col A</th><th>Col B</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Alpha</td></tr>
      <tr><td>2</td><td>Beta</td></tr>
    </tbody>
  </table>

  <p>Empty list edge case:</p>
  <ul></ul>
</body>
</html>
"""

    chapter_two_content = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Chapter 2</title>
  <link rel="stylesheet" type="text/css" href="../styles/base.css"/>
</head>
<body>
  <h1 id="section-2">Chapter 2: Headings and Structure</h1>
  <h2>Subsection A</h2>
  <p>Paragraph with <a href="ch2.xhtml#section-2">self link</a> and a footnote marker.<sup>[1]</sup></p>
  <h3>Subsection A.1</h3>
  <p>Multiple paragraphs should keep blank lines between them.</p>
  <p>Second paragraph in the same section.</p>
  <h6>Subsection A.1.a (H6)</h6>
  <p>H6 should render as six hashes in output.</p>
  <figure>
    <img src="../images/cover.svg" alt="Cover"/>
    <figcaption>Figure caption text.</figcaption>
  </figure>
  <div>
    <p>Nested div paragraph.</p>
  </div>
</body>
</html>
"""

    appendix_content = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Appendix</title>
</head>
<body>
  <h1>Appendix</h1>
  <p>This file is marked non-linear in the spine.</p>
</body>
</html>
"""

    css_content = """body { font-family: serif; }
table { border-collapse: collapse; }
td, th { border: 1px solid #333; padding: 2px 4px; }
"""

    opf_content = """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:12345</dc:identifier>
    <dc:title>Robust EPUB Test</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="intro" href="text/intro.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="appendix" href="text/appendix.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/base.css" media-type="text/css"/>
    <item id="cover" href="images/cover.svg" media-type="image/svg+xml"/>
  </manifest>
  <spine>
    <itemref idref="intro"/>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="appendix" linear="no"/>
  </spine>
</package>
"""

    # Minimal Nav file required for EPUB 3
    nav_content = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>TOC</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="text/intro.xhtml#intro">Intro</a></li>
      <li>
        <a href="text/ch1.xhtml#lists">Chapter 1</a>
        <ol>
          <li><a href="text/ch1.xhtml#lists">Lists</a></li>
        </ol>
      </li>
      <li><a href="text/ch2.xhtml#section-2">Chapter 2</a></li>
    </ol>
  </nav>
</body>
</html>
"""

    ncx_content = """<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:12345"/>
    <meta name="dtb:depth" content="2"/>
  </head>
  <docTitle><text>Robust EPUB Test</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>Intro</text></navLabel>
      <content src="text/intro.xhtml#intro"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>Chapter 1</text></navLabel>
      <content src="text/ch1.xhtml#lists"/>
    </navPoint>
    <navPoint id="navPoint-3" playOrder="3">
      <navLabel><text>Chapter 2</text></navLabel>
      <content src="text/ch2.xhtml#section-2"/>
    </navPoint>
  </navMap>
</ncx>
"""

    container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml', container_xml)
        z.writestr('OEBPS/content.opf', opf_content)
        z.writestr('OEBPS/nav.xhtml', nav_content)
        z.writestr('OEBPS/toc.ncx', ncx_content)
        z.writestr('OEBPS/text/intro.xhtml', intro_content)
        z.writestr('OEBPS/text/ch1.xhtml', chapter_one_content)
        z.writestr('OEBPS/text/ch2.xhtml', chapter_two_content)
        z.writestr('OEBPS/text/appendix.xhtml', appendix_content)
        z.writestr('OEBPS/styles/base.css', css_content)
        z.writestr('OEBPS/images/cover.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>')

    print(f"Created {output_path}")

if __name__ == "__main__":
    create_robust_epub("test-data/robust_test.epub")
