"""
Utility script để quản lý user mappings cho LightGCN model

Cách dùng:
    # Thêm 1 user
    python manage_mappings.py add <mongodb_user_id> [user_index]
    
    # Thêm nhiều users
    python manage_mappings.py add-bulk user1_id user2_id user3_id
    
    # Xem thông tin
    python manage_mappings.py info
    
    # Kiểm tra user
    python manage_mappings.py check <mongodb_user_id>
    
    # List users đã thêm (MongoDB format)
    python manage_mappings.py list-mongo

Ví dụ:
    python manage_mappings.py add 696c03da336a401d3822467d 0
    python manage_mappings.py check 696c03da336a401d3822467d
"""

import pickle
import sys
import os

MAPPING_FILE = os.getenv("MAPPING_PATH", "./models/id_mappings.pkl")


def load_mappings():
    with open(MAPPING_FILE, 'rb') as f:
        return pickle.load(f)


def save_mappings(mappings):
    # Backup first
    backup_path = MAPPING_FILE + '.bak'
    if os.path.exists(MAPPING_FILE):
        import shutil
        shutil.copy(MAPPING_FILE, backup_path)
    
    with open(MAPPING_FILE, 'wb') as f:
        pickle.dump(mappings, f)
    print(f"✅ Saved to {MAPPING_FILE}")


def add_user(mongo_id: str, user_index: int = 0):
    """Thêm MongoDB user ID vào mapping"""
    mappings = load_mappings()
    
    if mongo_id in mappings['user_mapping']:
        print(f"⚠️ User {mongo_id} already exists -> index {mappings['user_mapping'][mongo_id]}")
        return
    
    # Validate index
    max_index = max(mappings['user_mapping'].values())
    if user_index > max_index:
        print(f"⚠️ Index {user_index} > max index {max_index}. Using {max_index}")
        user_index = max_index
    
    mappings['user_mapping'][mongo_id] = user_index
    save_mappings(mappings)
    print(f"✅ Added: {mongo_id} -> index {user_index}")


def add_bulk(mongo_ids: list, start_index: int = 0):
    """Thêm nhiều users, mỗi user được gán index khác nhau"""
    mappings = load_mappings()
    
    for i, mongo_id in enumerate(mongo_ids):
        if mongo_id not in mappings['user_mapping']:
            idx = (start_index + i) % len(mappings['user_mapping'])
            mappings['user_mapping'][mongo_id] = idx
            print(f"✅ Added: {mongo_id} -> index {idx}")
        else:
            print(f"⚠️ Skipped (exists): {mongo_id}")
    
    save_mappings(mappings)


def check_user(mongo_id: str):
    """Kiểm tra user có trong mapping không"""
    mappings = load_mappings()
    
    if mongo_id in mappings['user_mapping']:
        print(f"✅ Found: {mongo_id} -> index {mappings['user_mapping'][mongo_id]}")
    else:
        print(f"❌ Not found: {mongo_id}")
        print(f"\nHint: Run 'python manage_mappings.py add {mongo_id}' to add this user")


def show_info():
    """Hiển thị thông tin về mappings"""
    mappings = load_mappings()
    
    print("=" * 50)
    print("ID MAPPINGS INFO")
    print("=" * 50)
    print(f"Total users: {len(mappings['user_mapping'])}")
    print(f"Total movies: {len(mappings['movie_mapping'])}")
    print(f"User index range: 0 - {max(mappings['user_mapping'].values())}")
    
    # Count MongoDB-style IDs (24 chars hex)
    mongo_users = [u for u in mappings['user_mapping'].keys() if len(u) == 24]
    print(f"\nMongoDB users added: {len(mongo_users)}")
    
    if mongo_users:
        print("\nMongoDB users:")
        for u in mongo_users[:10]:
            print(f"  {u} -> index {mappings['user_mapping'][u]}")
        if len(mongo_users) > 10:
            print(f"  ... and {len(mongo_users) - 10} more")


def list_mongo_users():
    """Liệt kê tất cả MongoDB users đã thêm"""
    mappings = load_mappings()
    
    mongo_users = [(u, idx) for u, idx in mappings['user_mapping'].items() if len(u) == 24]
    
    if not mongo_users:
        print("No MongoDB users found in mappings")
        return
    
    print(f"MongoDB users ({len(mongo_users)}):")
    for user_id, idx in mongo_users:
        print(f"  {user_id} -> index {idx}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "add":
        if len(sys.argv) < 3:
            print("Usage: python manage_mappings.py add <mongodb_user_id> [user_index]")
            sys.exit(1)
        mongo_id = sys.argv[2]
        user_index = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        add_user(mongo_id, user_index)
    
    elif command == "add-bulk":
        if len(sys.argv) < 3:
            print("Usage: python manage_mappings.py add-bulk <id1> <id2> ...")
            sys.exit(1)
        mongo_ids = sys.argv[2:]
        add_bulk(mongo_ids)
    
    elif command == "check":
        if len(sys.argv) < 3:
            print("Usage: python manage_mappings.py check <mongodb_user_id>")
            sys.exit(1)
        check_user(sys.argv[2])
    
    elif command == "info":
        show_info()
    
    elif command == "list-mongo":
        list_mongo_users()
    
    else:
        print(f"Unknown command: {command}")
        print(__doc__)