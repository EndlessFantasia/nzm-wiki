"""Compare a staged reference patch with refs, or its preserved Apply backups."""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def differences(old, new, path=""):
    if type(old) is not type(new):
        return [{"path": path, "before": old, "after": new}]
    result = []
    if isinstance(old, dict):
        for key in sorted(old.keys() | new.keys()):
            pointer = path + "/" + key.replace("~", "~0").replace("/", "~1")
            if key not in old or key not in new:
                result.append({"path": pointer, "change": "added" if key in new else "removed",
                               "before": old.get(key), "after": new.get(key)})
            else:
                result.extend(differences(old[key], new[key], pointer))
    elif isinstance(old, list):
        if len(old) != len(new):
            result.append({"path": path, "before": old, "after": new})
        else:
            for index, (a, b) in enumerate(zip(old, new)):
                result.extend(differences(a, b, f"{path}/{index}"))
    elif old != new:
        result.append({"path": path, "before": old, "after": new})
    return result


def exports(path):
    objects = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(objects, list):
        raise ValueError(f"Expected package export array: {path}")
    result = {}
    for obj in objects:
        key = obj["Type"] + ":" + obj["Name"]
        if "Outer" in obj:
            key += "@" + obj["Outer"]["ObjectName"]
        if key in result:
            raise ValueError(f"Duplicate export identity: {key}")
        result[key] = obj
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", type=Path)
    args = parser.parse_args()
    run = args.run.resolve()
    manifest = json.loads((run / "manifest.json").read_text(encoding="utf-8-sig"))
    if manifest["status"] != "staged":
        raise ValueError("A completed stage is required")
    applied = (run / "publish.json").exists()
    records = []
    for entry in manifest["files"]:
        source = run / "content" / entry["path"]
        if hashlib.sha256(source.read_bytes()).hexdigest().upper() != entry["sha256"]:
            raise ValueError(f"Staged hash mismatch: {entry['path']}")
        record = {"path": entry["path"], "status": "added" if not entry["previousSha256"] else
                  "unchanged" if entry["sha256"] == entry["previousSha256"] else "changed"}
        if source.suffix == ".json":
            new = exports(source)
            record["exports"] = list(new)
            if entry["previousSha256"]:
                old_path = (run / "backup" if applied else Path(manifest["destination"])) / entry["path"]
                if hashlib.sha256(old_path.read_bytes()).hexdigest().upper() != entry["previousSha256"]:
                    raise ValueError(f"Baseline hash mismatch: {entry['path']}")
                record["differences"] = differences(exports(old_path), new)
                record["differenceCount"] = len(record["differences"])
        records.append(record)
    report = {"schemaVersion": 1, "comparison": "refs before Apply (preserved backup after Apply)",
              "summary": dict(Counter(r["status"] for r in records)), "files": records}
    (run / "reference-diff.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"summary": report["summary"], "json": [
        {"path": r["path"], "status": r["status"], "differences": r.get("differenceCount")}
        for r in records if r["path"].endswith(".json")]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
