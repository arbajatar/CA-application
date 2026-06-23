import sys

filepath = r"c:\Project\Integration of nexus\CA-application\resources\react\pages\ca\TaskDetailPage.jsx"
query = "rowsPerPage"

with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
    for i, line in enumerate(f, 1):
        if query in line:
            print(f"{i}: {line.strip()}")
