"""
Mock Supabase storage - saves to a local JSON file.
"""

import json
import os

STORAGE_FILE = "storage.json"


def _load_data():
    if os.path.exists(STORAGE_FILE):
        with open(STORAGE_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_data(data):
    with open(STORAGE_FILE, "w") as f:
        json.dump(data, f, indent=2)


# Get a value by key
def get(key):
    data = _load_data()
    return data.get(key)


# Set a value by key
def set(key, value):
    data = _load_data()
    data[key] = value
    _save_data(data)


# Delete a key
def delete(key):
    data = _load_data()
    if key in data:
        del data[key]
        _save_data(data)


# Get all data
def get_all():
    return _load_data()


# Clear all data
def clear():
    _save_data({})


# ===== Specific helpers =====

def get_api_key(name):
    """Get an API key by name (e.g. 'gemini', 'openai')"""
    keys = get("api_keys") or {}
    return keys.get(name)


def set_api_key(name, value):
    """Set an API key by name"""
    keys = get("api_keys") or {}
    keys[name] = value
    set("api_keys", keys)


def get_global_variables():
    """Get all global variables"""
    return get("global_variables") or []


def set_global_variables(variables):
    """Set global variables (list of {name, value})"""
    set("global_variables", variables)


def get_setting(name):
    """Get a user setting"""
    settings = get("settings") or {}
    return settings.get(name)


def set_setting(name, value):
    """Set a user setting"""
    settings = get("settings") or {}
    settings[name] = value
    set("settings", settings)
