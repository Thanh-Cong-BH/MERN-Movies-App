"""
Script để tạo ID mappings giữa MongoDB ObjectIds và model indices

Chạy sau khi train model để sync với database thực tế

Usage: python generate_mappings.py
"""

import pymongo
import pickle
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/moviesApp")
client = pymongo.MongoClient(MONGODB_URI)
db = client.get_default_database()

def generate_mappings():
    """
    Tạo mappings giữa MongoDB _id và model indices
    Dựa trên interactions collection
    """
    print("🔄 Generating ID mappings...")
    
    # Get unique user IDs from interactions
    print("Fetching unique users...")
    unique_users = db.interactions.distinct("userId")
    print(f"Found {len(unique_users)} unique users")
    
    # Get unique movie IDs from interactions  
    print("Fetching unique movies...")
    unique_movies = db.interactions.distinct("movieId")
    print(f"Found {len(unique_movies)} unique movies")
    
    # Create mappings: MongoDB ObjectId (string) -> model index (int)
    user_mapping = {}
    for idx, user_id in enumerate(sorted(unique_users, key=str)):
        user_mapping[str(user_id)] = idx
    
    movie_mapping = {}
    reverse_movie_mapping = {}
    for idx, movie_id in enumerate(sorted(unique_movies, key=str)):
        movie_mapping[str(movie_id)] = idx
        reverse_movie_mapping[idx] = str(movie_id)
    
    # Save mappings
    mappings = {
        'user_mapping': user_mapping,
        'movie_mapping': movie_mapping,
        'reverse_movie_mapping': reverse_movie_mapping
    }
    
    output_path = "./models/id_mappings.pkl"
    os.makedirs("./models", exist_ok=True)
    
    with open(output_path, 'wb') as f:
        pickle.dump(mappings, f)
    
    print(f"\n✅ Mappings saved to {output_path}")
    print(f"   Users: {len(user_mapping)}")
    print(f"   Movies: {len(movie_mapping)}")
    
    # Also save as JSON for debugging
    import json
    json_path = "./models/id_mappings.json"
    
    # Convert to JSON-serializable format (sample only, full file too large)
    sample_mappings = {
        'user_mapping_sample': dict(list(user_mapping.items())[:10]),
        'movie_mapping_sample': dict(list(movie_mapping.items())[:10]),
        'stats': {
            'total_users': len(user_mapping),
            'total_movies': len(movie_mapping)
        }
    }
    
    with open(json_path, 'w') as f:
        json.dump(sample_mappings, f, indent=2)
    
    print(f"   Sample saved to {json_path}")

if __name__ == "__main__":
    generate_mappings()
    client.close()