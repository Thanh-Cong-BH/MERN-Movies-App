from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import torch
import torch.nn as nn
import numpy as np
import pickle
import os
import sys

# ✅ FIX: Create fake 'src' module to handle imports
class FakeModule:
    def __init__(self, name):
        self.name = name
    
    def __getattr__(self, item):
        return FakeModule(f"{self.name}.{item}")

# Register fake modules
sys.modules['src'] = FakeModule('src')
sys.modules['src.models'] = FakeModule('src.models')
sys.modules['src.models.lightgcn'] = FakeModule('src.models.lightgcn')
sys.modules['src.models.base'] = FakeModule('src.models.base')

app = FastAPI(title="Movie Recommendation API")

# CORS để Node.js backend có thể gọi
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables để load model
model = None
user_mapping = {}  # MongoDB _id -> model index
movie_mapping = {}  # MongoDB _id -> model index
reverse_movie_mapping = {}  # model index -> MongoDB _id

class RecommendationRequest(BaseModel):
    user_id: str
    top_k: int = 10

class RecommendationResponse(BaseModel):
    user_id: str
    recommendations: List[dict]

import torch
import torch.nn as nn

# ✅ IMPORTANT: Define model class trước khi load
class ImprovedLightGCN(nn.Module):
    """
    Simplified version for inference only
    Copy từ training code
    """
    def __init__(self, num_users, num_items, embedding_dim=64, n_layers=3, 
                 reg_lambda=1e-4, dropout=0.0, use_layer_attention=False):
        super(ImprovedLightGCN, self).__init__()
        
        self.num_users = num_users
        self.num_items = num_items
        self.embedding_dim = embedding_dim
        self.n_layers = n_layers
        self.reg_lambda = reg_lambda
        self.dropout = dropout
        self.use_layer_attention = use_layer_attention
        
        self.user_embedding = nn.Embedding(num_users, embedding_dim)
        self.item_embedding = nn.Embedding(num_items, embedding_dim)
        
        if use_layer_attention:
            self.layer_attention = nn.Parameter(
                torch.ones(n_layers + 1) / (n_layers + 1)
            )
        
        self.Graph = None
        self.cached_users = None
        self.cached_items = None
        self._cache_valid = False
    
    def computer(self):
        """Graph convolution"""
        if self.Graph is None:
            # No graph - return raw embeddings
            return self.user_embedding.weight, self.item_embedding.weight
        
        users_emb = self.user_embedding.weight
        items_emb = self.item_embedding.weight
        all_emb = torch.cat([users_emb, items_emb])
        
        embs = [all_emb]
        
        for layer in range(self.n_layers):
            all_emb = torch.sparse.mm(self.Graph, all_emb)
            embs.append(all_emb)
        
        embs = torch.stack(embs, dim=1)
        
        if self.use_layer_attention:
            attention = torch.softmax(self.layer_attention, dim=0)
            final_emb = torch.sum(embs * attention.view(1, -1, 1), dim=1)
        else:
            final_emb = torch.mean(embs, dim=1)
        
        users, items = torch.split(final_emb, [self.num_users, self.num_items])
        return users, items
    
    def clear_cache(self):
        self.cached_users = None
        self.cached_items = None
        self._cache_valid = False

def load_model():
    """Load trained LightGCN model và mappings"""
    global model, user_mapping, movie_mapping, reverse_movie_mapping
    
    model_path = os.getenv("MODEL_PATH", "./models/lightgcn_direct.pt")
    mapping_path = os.getenv("MAPPING_PATH", "./models/id_mappings.pkl")
    
    try:
        print(f"Loading model from {model_path}...")
        
        # ✅ BEST METHOD: Register class mapping for torch.load
        import importlib
        
        # Create temporary module in memory
        class TempModule:
            ImprovedLightGCN = ImprovedLightGCN
            LightGCNPlusPlus = ImprovedLightGCN
        
        # Register in sys.modules
        sys.modules['src.models.lightgcn'] = TempModule
        
        # Now torch.load can find the class
        checkpoint = torch.load(
            model_path,
            map_location=torch.device('cpu'),
            weights_only=False
        )
        
        # Check format
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            print("Detected checkpoint format - reconstructing model...")
            config = checkpoint['model_config']
            model = ImprovedLightGCN(**config)
            model.load_state_dict(checkpoint['model_state_dict'])
        else:
            model = checkpoint
        
        # Set to eval mode
        model.eval()
        if hasattr(model, 'clear_cache'):
            model.clear_cache()
        
        print(f"✅ Model loaded!")
        print(f"   Type: {type(model).__name__}")
        print(f"   Users: {model.num_users}, Items: {model.num_items}")
        
        # Load mappings
        print(f"Loading mappings from {mapping_path}...")
        with open(mapping_path, 'rb') as f:
            mappings = pickle.load(f)
            user_mapping = mappings['user_mapping']
            movie_mapping = mappings['movie_mapping']
            reverse_movie_mapping = mappings['reverse_movie_mapping']
        
        print(f"   Mappings: {len(user_mapping)} users, {len(movie_mapping)} movies")
        
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        import traceback
        traceback.print_exc()
        raise

@app.on_event("startup")
async def startup_event():
    """Load model khi service khởi động"""
    load_model()

@app.get("/")
async def root():
    return {
        "service": "Movie Recommendation API",
        "status": "running",
        "model_loaded": model is not None,
        "total_users": len(user_mapping),
        "total_movies": len(movie_mapping)
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Generate recommendations cho user
    
    Input: user_id (MongoDB ObjectId string)
    Output: List of recommended movie IDs với scores
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    user_id = request.user_id
    top_k = request.top_k
    
    # Check if user exists in mapping
    if user_id not in user_mapping:
        # Cold start: return popular movies
        return await get_popular_movies(top_k)
    
    try:
        # Get user index
        user_idx = user_mapping[user_id]
        
        # Set model to eval mode (để dùng cache)
        model.eval()
        
        # Generate predictions using cached embeddings
        with torch.no_grad():
            # Ensure cache is valid
            if not model._cache_valid:
                model.cached_users, model.cached_items = model.computer()
                model._cache_valid = True
            
            # Get user embedding
            user_emb = model.cached_users[user_idx]
            
            # Get all item embeddings
            all_item_embs = model.cached_items
            
            # Calculate scores (dot product)
            scores = torch.matmul(user_emb, all_item_embs.T)
            scores = scores.cpu().numpy()
        
        # Get top-k movie indices
        top_indices = np.argsort(scores)[::-1][:top_k]
        
        # Convert indices to MongoDB IDs
        recommendations = []
        for idx in top_indices:
            movie_id = reverse_movie_mapping.get(int(idx))
            if movie_id:
                recommendations.append({
                    "movieId": movie_id,
                    "score": float(scores[idx])
                })
        
        return RecommendationResponse(
            user_id=user_id,
            recommendations=recommendations
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

@app.post("/recommend/batch")
async def batch_recommendations(user_ids: List[str], top_k: int = 10):
    """Batch recommendations cho multiple users"""
    results = {}
    
    for user_id in user_ids:
        try:
            rec = await get_recommendations(RecommendationRequest(user_id=user_id, top_k=top_k))
            results[user_id] = rec.recommendations
        except Exception as e:
            results[user_id] = {"error": str(e)}
    
    return results

async def get_popular_movies(top_k: int = 10):
    """
    Cold start solution: return popular movies
    Dựa vào số lượng interactions
    """
    # TODO: Implement logic lấy popular movies từ database
    # Tạm thời return empty
    return RecommendationResponse(
        user_id="unknown",
        recommendations=[]
    )

@app.post("/reload")
async def reload_model():
    """Reload model (sau khi retrain)"""
    try:
        load_model()
        return {"status": "success", "message": "Model reloaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reloading model: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)