import zipfile
import os

def create_robust_epub(output_path):
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 1. Define content
    # We will create a simple EPUB structure: mimetype, container.xml, content.opf, and our HTML content.
    
    html_content = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Robust List Test</title>
</head>
<body>
  <h1>Robust List Test</h1>
  
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

  <p>Complex Content in Items:</p>
  <ul>
    <li>
      <strong>Bold Title</strong><br/>
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

  <p>Empty List Edge Case:</p>
  <ul></ul>

  <p>End of test.</p>
</body>
</html>
"""

    opf_content = """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:12345</dc:identifier>
    <dc:title>Robust List Test</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
    <itemref idref="nav"/>
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
      <li><a href="content.xhtml">Content</a></li>
    </ol>
  </nav>
</body>
</html>
"""

    container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        z.writestr('META-INF/container.xml', container_xml)
        z.writestr('content.opf', opf_content)
        z.writestr('content.xhtml', html_content)
        z.writestr('nav.xhtml', nav_content)

    print(f"Created {output_path}")

if __name__ == "__main__":
    create_robust_epub("test-data/robust_test.epub")
