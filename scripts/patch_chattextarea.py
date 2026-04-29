"""Remove the voiceStreamingSTT mic button block from ChatTextArea.tsx"""
import re

path = "webview-ui/src/components/chat/ChatTextArea.tsx"
with open(path, encoding="utf-8") as f:
    content = f.read()

# Pattern: the entire voiceStreamingSTT && (...) block (lines 1561–1589)
# We'll use a regex that matches from the opening brace to the closing ))}
pattern = r"\t\t\t\t\t\t\t\{voiceStreamingSTT &&\n.*?\t\t\t\t\t\t\t\t\)\)}\n"
match = re.search(pattern, content, re.DOTALL)
if match:
    content = content[:match.start()] + content[match.end():]
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)
    print("OK — removed voiceStreamingSTT block")
else:
    print("NOT FOUND — block not matched")
    # Print lines around expected location for debug
    lines = content.split("\n")
    for i, line in enumerate(lines[1555:1600], start=1556):
        print(f"{i}: {repr(line)}")
