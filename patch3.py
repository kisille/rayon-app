#!/usr/bin/env python3
"""Patch 3: iCloud contact suggestions fix + Mitnahmeplanung MonthPicker"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def patch_file(rel_path, old, new):
    path = os.path.join(BASE, rel_path)
    with open(path, 'r') as f:
        content = f.read()
    if old not in content:
        if new in content:
            print(f"  SKIP {rel_path} (already patched)")
            return True
        print(f"  FAIL {rel_path} (old string not found)")
        return False
    content = content.replace(old, new, 1)
    with open(path, 'w') as f:
        f.write(content)
    print(f"  OK   {rel_path}")
    return True

print("=== Patch 3: iCloud fix + Mitnahmeplanung MonthPicker ===\n")

# 1) App.jsx — add extra attributes to global autocomplete handler
print("[1/3] App.jsx — enhanced iCloud suppression")
patch_file(
    'frontend/src/App.jsx',
    """        e.target.setAttribute('autocomplete', 'off');
        e.target.setAttribute('data-lpignore', 'true');
        e.target.setAttribute('data-form-type', 'other');
      }""",
    """        e.target.setAttribute('autocomplete', 'off');
        e.target.setAttribute('data-lpignore', 'true');
        e.target.setAttribute('data-form-type', 'other');
        e.target.setAttribute('data-1p-ignore', 'true');
        e.target.setAttribute('autocorrect', 'off');
        e.target.setAttribute('autocapitalize', 'off');
        // Safari iCloud-Kontaktvorschläge unterdrücken
        if (e.target.type === 'text') {
          e.target.setAttribute('role', 'combobox');
        }
      }"""
)

# 2) SearchableSelect.jsx — change type="text" to type="search"
print("[2/3] SearchableSelect.jsx — type=search for iCloud fix")
patch_file(
    'frontend/src/components/SearchableSelect.jsx',
    'type="text"',
    'type="search"'
)
patch_file(
    'frontend/src/components/SearchableSelect.jsx',
    'className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400"',
    'className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400 [&::-webkit-search-cancel-button]:hidden"'
)

# 3) Mitnahmeplanung.jsx — add MonthPicker import + replace date input
print("[3/3] Mitnahmeplanung.jsx — MonthPicker")
patch_file(
    'frontend/src/pages/Mitnahmeplanung.jsx',
    "import { SearchableSelect } from '../components/SearchableSelect.jsx';",
    "import { SearchableSelect } from '../components/SearchableSelect.jsx';\nimport MonthPicker from '../components/MonthPicker';"
)
patch_file(
    'frontend/src/pages/Mitnahmeplanung.jsx',
    """        <input
          type="date"
          className="input w-auto"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          autoComplete="off"
        />""",
    '        <MonthPicker value={datum} onChange={setDatum} mode="date" />'
)

print("\n=== Done! Run: cd frontend && npm run build ===")
