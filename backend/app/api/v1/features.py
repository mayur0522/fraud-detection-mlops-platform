"""
Features API Endpoints
Feature engineering and selection operations.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.services.feature_service import FeatureService

router = APIRouter(prefix="/features", tags=["Features"])


class FeatureConfigRequest(BaseModel):
    """Request body for feature computation."""
    dataset_id: str
    name: str
    description: Optional[str] = None
    column_mapping: Optional[dict] = Field(
        default=None,
        description="Mapping from dataset columns to expected feature columns. "
                    "Example: {'Transaction Date': 'timestamp', 'Amount': 'amount'}"
    )
    transaction_features: bool = True
    behavioral_features: bool = True
    temporal_features: bool = True
    aggregation_features: bool = True
    aggregation_windows: list = Field(default=["1h", "24h", "7d"])
    enable_feature_selection: bool = True
    max_features: int = 30


@router.get("/sets")
async def list_feature_sets(
    dataset_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List all feature sets with optional filtering."""
    service = FeatureService(db)
    feature_sets, total = await service.list_feature_sets(
        dataset_id=dataset_id,
        status=status,
        page=page,
        page_size=min(page_size, 100),
    )
    
    return {
        "data": [
            {
                "id": str(fs.id),
                "dataset_id": str(fs.dataset_id),
                "name": fs.name,
                "description": fs.description,
                "version": fs.version,
                "status": fs.status,
                "feature_count": fs.feature_count,
                "selected_feature_count": fs.selected_feature_count,
                "created_at": (fs.created_at.isoformat() + "Z") if fs.created_at else None,
                "completed_at": (fs.completed_at.isoformat() + "Z") if fs.completed_at else None,
                "config": fs.config,
                "storage_path": fs.storage_path,
                "error_message": fs.error_message,
            }
            for fs in feature_sets
        ],
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
        }
    }


@router.post("/compute", status_code=status.HTTP_201_CREATED)
async def compute_features(
    request: FeatureConfigRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Start feature computation for a dataset.
    
    This creates a feature set and triggers async computation.
    """
    service = FeatureService(db)
    
    config = {
        "column_mapping": request.column_mapping,
        "transaction_features": request.transaction_features,
        "behavioral_features": request.behavioral_features,
        "temporal_features": request.temporal_features,
        "aggregation_features": request.aggregation_features,
        "aggregation_windows": request.aggregation_windows,
        "enable_feature_selection": request.enable_feature_selection,
        "max_features": request.max_features,
    }
    
    try:
        feature_set = await service.create_feature_set(
            dataset_id=request.dataset_id,
            name=request.name,
            config=config,
            description=request.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    reused = getattr(feature_set, "reused", False)
    
    return {
        "status": "success",
        "data": {
            "id": str(feature_set.id),
            "status": feature_set.status,
            "message": "Feature set reused from registry" if reused else "Feature computation started",
            "reused": reused
        }
    }


@router.get("/sets/{feature_set_id}")
async def get_feature_set(
    feature_set_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get feature set details including selection report."""
    service = FeatureService(db)
    feature_set = await service.get_feature_set(feature_set_id)
    
    if not feature_set:
        raise HTTPException(status_code=404, detail="Feature set not found")
    
    return {
        "data": {
            "id": str(feature_set.id),
            "dataset_id": str(feature_set.dataset_id),
            "name": feature_set.name,
            "description": feature_set.description,
            "version": feature_set.version,
            "config": feature_set.config,
            "status": feature_set.status,
            "all_features": feature_set.all_features,
            "selected_features": feature_set.selected_features,
            "selection_report": feature_set.selection_report,
            "feature_count": feature_set.feature_count,
            "selected_feature_count": feature_set.selected_feature_count,
            "input_rows": feature_set.input_rows,
            "processing_time_seconds": feature_set.processing_time_seconds,
            "error_message": feature_set.error_message,
            "created_at": (feature_set.created_at.isoformat() + "Z") if feature_set.created_at else None,
            "completed_at": (feature_set.completed_at.isoformat() + "Z") if feature_set.completed_at else None,
        }
    }


@router.get("/config/default")
async def get_default_config(db: AsyncSession = Depends(get_db)):
    """Get default feature engineering configuration."""
    service = FeatureService(db)
    config = await service.get_default_config()
    return {"data": config}


@router.delete("/sets/{feature_set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feature_set(
    feature_set_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a feature set."""
    service = FeatureService(db)
    success = await service.delete_feature_set(feature_set_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Feature set not found")
    
    return None


@router.post("/sets/{feature_set_id}/analyze")
async def analyze_features(
    feature_set_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Trigger feature analysis (background task)."""
    service = FeatureService(db)
    success = await service.analyze_feature_set(feature_set_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feature set not found")
    return {"message": "Analysis started"}


@router.get("/sets/{feature_set_id}/preview")
async def preview_features(
    feature_set_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Preview feature data from parquet file."""
    service = FeatureService(db)
    try:
        data = await service.preview_features(feature_set_id, limit)
        return {"data": data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

