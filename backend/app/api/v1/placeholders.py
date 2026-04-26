"""
Placeholder routers for Sprint 2+ features.
These will be implemented in subsequent sprints.
"""
from fastapi import APIRouter

# Features Router (Sprint 2)
features_router = APIRouter(prefix="/features", tags=["Features"])

@features_router.get("/sets")
async def list_feature_sets():
    return {"data": [], "message": "Feature sets endpoint - Sprint 2"}

@features_router.post("/compute")
async def compute_features():
    return {"message": "Feature computation endpoint - Sprint 2"}


# Training Router (Sprint 2-3)
training_router = APIRouter(prefix="/training", tags=["Training"])

@training_router.get("/jobs")
async def list_training_jobs():
    return {"data": [], "message": "Training jobs endpoint - Sprint 2"}

@training_router.post("/jobs")
async def create_training_job():
    return {"message": "Create training job endpoint - Sprint 2"}

@training_router.get("/algorithms")
async def list_algorithms():
    return {
        "data": [
            {"id": "xgboost", "name": "XGBoost", "description": "Gradient boosting for tabular data"},
            {"id": "lightgbm", "name": "LightGBM", "description": "Fast gradient boosting"},
            {"id": "neural_network", "name": "Neural Network", "description": "Deep learning model"},
        ]
    }


# Models Router (Sprint 3)
models_router = APIRouter(prefix="/models", tags=["Models"])

@models_router.get("")
async def list_models():
    return {"data": [], "message": "Models endpoint - Sprint 3"}

@models_router.post("/{model_id}/promote")
async def promote_model(model_id: str):
    return {"message": f"Promote model {model_id} - Sprint 3"}


# Inference Router (Sprint 3)
inference_router = APIRouter(prefix="/predict", tags=["Inference"])

@inference_router.post("")
async def predict():
    return {"message": "Prediction endpoint - Sprint 3"}

@inference_router.post("/explain")
async def predict_with_explanation():
    return {"message": "Prediction with SHAP explanation - Sprint 3"}


# Monitoring Router (Sprint 4)
monitoring_router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

@monitoring_router.get("/drift")
async def get_drift_metrics():
    return {"data": [], "message": "Drift metrics endpoint - Sprint 4"}

@monitoring_router.get("/bias")
async def get_bias_metrics():
    return {"data": [], "message": "Bias metrics endpoint - Sprint 5"}


# Alerts Router (Sprint 5)
alerts_router = APIRouter(prefix="/alerts", tags=["Alerts"])

@alerts_router.get("")
async def list_alerts():
    return {"data": [], "message": "Alerts endpoint - Sprint 5"}
