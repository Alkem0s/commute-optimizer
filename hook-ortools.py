# hook-ortools.py
from PyInstaller.utils.hooks import collect_dynamic_libs

# Collect all DLLs from OR-Tools package
binaries = collect_dynamic_libs('ortools')