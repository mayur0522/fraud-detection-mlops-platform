"""
Feature Service
Business logic for feature engineering operations.
"""
from app.core.time import IST, now_ist
from typing import Optional, Tuple, List, Dict, Any
from uuid import UUID
import logging

import json
import hashlib
from sqlalchemy import select, func, update, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.feature_set import FeatureSet
from app.models.dataset import Dataset

logger = logging.getLogger(__name__)


class FeatureService:
    """Service for feature engineering operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def list_feature_sets(
        self,
        dataset_id: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[FeatureSet], int]:
        """List feature sets with pagination and filtering."""
        query = select(FeatureSet).order_by(FeatureSet.created_at.desc())
        count_query = select(func.count(FeatureSet.id))
        
        # Filter non-deleted
        conditions = [FeatureSet.is_deleted == False]
        
        if dataset_id:
            conditions.append(FeatureSet.dataset_id == UUID(dataset_id))
        
        if status:
            conditions.append(FeatureSet.status == status)
            
        # Apply conditions
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))
        
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        result = await self.db.execute(query)
        feature_sets = result.scalars().all()
        
        return list(feature_sets), total
    
    async def get_feature_set(self, feature_set_id: str) -> Optional[FeatureSet]:
        """Get a single feature set by ID."""
        try:
            uuid_id = UUID(feature_set_id)
        except ValueError:
            return None
        
        result = await self.db.execute(
            select(FeatureSet).where(FeatureSet.id == uuid_id)
        )
        return result.scalar_one_or_none()
    
    async def create_feature_set(
        self,
        dataset_id: str,
        name: str,
        config: Dict[str, Any],
        description: Optional[str] = None,
    ) -> FeatureSet:
        """Create a new feature set and trigger computation."""
        # Verify dataset exists
        dataset = await self.db.execute(
            select(Dataset).where(Dataset.id == UUID(dataset_id))
        )
        if not dataset.scalar_one_or_none():
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Compute config hash for deduplication
        config_hash = self._compute_config_hash(dataset_id, config)
        
        # Check for existing COMPLETED feature set with same hash (and not deleted)
        existing_result = await self.db.execute(
            select(FeatureSet).where(
                FeatureSet.config_hash == config_hash,
                FeatureSet.status == "COMPLETED",
                FeatureSet.is_deleted == False
            ).order_by(FeatureSet.created_at.desc())
        )
        existing_set = existing_result.scalars().first()
        
        if existing_set:
            logger.info(f"Reusing existing feature set {existing_set.id} for identical config")
            existing_set.reused = True  # strict typing might complain, but runtime is fine
            return existing_set

        # Create feature set record
        feature_set = FeatureSet(
            dataset_id=UUID(dataset_id),
            name=name,
            description=description,
            config=config,
            config_hash=config_hash,
            status="QUEUED",
        )
        
        self.db.add(feature_set)
        await self.db.commit()
        await self.db.refresh(feature_set)
        
        # Trigger async computation
        from app.workers.feature_worker import compute_features
        compute_features.delay(str(feature_set.id))
        
        logger.info(f"Created feature set {feature_set.id}, computation queued")
        
        feature_set.reused = False
        return feature_set

    def _compute_config_hash(self, dataset_id: str, config: Dict[str, Any]) -> str:
        """Generate a deterministic hash for deduplication."""
        # Sort keys to ensure consistent JSON string
        # Filter out random/volatile fields if any (none in current config spec)
        config_str = json.dumps(config, sort_keys=True)
        raw_str = f"{dataset_id}:{config_str}"
        return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()
    
    async def update_feature_set_status(
        self,
        feature_set_id: str,
        status: str,
        progress: float = None,
        error_message: str = None,
        selected_features: List[str] = None,
        selection_report: Dict = None,
    ) -> bool:
        """Update feature set status and results."""
        try:
            uuid_id = UUID(feature_set_id)
        except ValueError:
            return False
        
        update_data = {"status": status}
        if selected_features:
            update_data["selected_features"] = selected_features
            update_data["selected_feature_count"] = len(selected_features)
        if selection_report:
            update_data["selection_report"] = selection_report
        if error_message:
            update_data["error_message"] = error_message
        if status == "COMPLETED":
            from datetime import datetime
            update_data["completed_at"] = now_ist()
        
        await self.db.execute(
            update(FeatureSet)
            .where(FeatureSet.id == uuid_id)
            .values(**update_data)
        )
        await self.db.commit()
        return True
    
    async def delete_feature_set(self, feature_set_id: str) -> bool:
        """Delete a feature set and its blob artifacts from Azure Storage."""
        feature_set = await self.get_feature_set(feature_set_id)
        if not feature_set:
            return False
        
        # Soft delete
        feature_set.is_deleted = True
        feature_set.deleted_at = now_ist()
        
        # We KEEP blob artifacts for now to allow potential restore or audit.
        # If hard cleanup is needed, a separate 'prune_deleted' task can be made.
        
        await self.db.commit()
        logger.info(f"Soft deleted feature set {feature_set_id}")
        return True
    
    async def analyze_feature_set(self, feature_set_id: str) -> bool:
        """Trigger async analysis of a feature set."""
        feature_set = await self.get_feature_set(feature_set_id)
        if not feature_set:
            return False
            
        from app.workers.feature_worker import analyze_features
        analyze_features.delay(feature_set_id)
        return True

    async def preview_features(self, feature_set_id: str, limit: int = 50) -> Dict[str, Any]:
        """Preview feature data from parquet file."""
        import pandas as pd
        import io
        from azure.storage.blob import BlobServiceClient
        from app.core.config import get_settings
        
        feature_set = await self.get_feature_set(feature_set_id)
        if not feature_set or not feature_set.storage_path:
            raise ValueError(f"Feature set {feature_set_id} not found or missing storage path")
            
        settings = get_settings()
        blob_path = feature_set.storage_path
        
        blob_service = BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)
        # Feature artifacts are written to the FEATURES container by feature_worker.
        # Accept both styles:
        # 1) bare blob path: features/raw/{id}/features.parquet
        # 2) full path: <container>/<blob_path>
        if "/" in blob_path:
            container_prefix, possible_blob_path = blob_path.split("/", 1)
            if container_prefix == settings.AZURE_STORAGE_CONTAINER_FEATURES:
                container_name = container_prefix
                blob_path = possible_blob_path
            elif container_prefix == settings.AZURE_STORAGE_CONTAINER_DATASETS:
                # Backward compatibility for any old records accidentally pointing to datasets.
                container_name = container_prefix
                blob_path = possible_blob_path
            else:
                container_name = settings.AZURE_STORAGE_CONTAINER_FEATURES
        else:
            container_name = settings.AZURE_STORAGE_CONTAINER_FEATURES

        container_client = blob_service.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_path)
        
        blob_data = blob_client.download_blob().readall()
        df = pd.read_parquet(io.BytesIO(blob_data))
        
        # Return first N rows
        preview_df = df.head(limit)
        
        # Replace NaN with null for JSON serialization
        preview_df = preview_df.where(pd.notnull(preview_df), None)
        
        return {
            "columns": list(preview_df.columns),
            "rows": preview_df.to_dict(orient="records"),
            "total_rows": len(df),
            "shape": df.shape,
            "dataset_version": feature_set.version
        }
    
    
    async def get_default_config(self) -> dict:
        """Get default feature engineering configuration."""
        return {
        "column_mapping": None,  # Auto-detect column roles if not provided
        "transaction_features": True,
        "behavioral_features": True,
        "temporal_features": True,
        "aggregation_features": True,
        "aggregation_windows": ["1h", "24h", "7d"],
        "enable_feature_selection": True,
        "max_features": 30,
        "variance_threshold": 0.01,
        "correlation_threshold": 0.95,
    }
    
    # ===== Synchronous methods for Celery workers =====
    
    def get_feature_set_sync(self, feature_set_id: str) -> Optional[FeatureSet]:
        """Get a single feature set by ID (sync version for Celery)."""
        try:
            uuid_id = UUID(feature_set_id)
        except ValueError:
            return None
        
        result = self.db.execute(
            select(FeatureSet).where(FeatureSet.id == uuid_id)
        )
        return result.scalar_one_or_none()
    
    def update_feature_set_status_sync(
        self,
        feature_set_id: str,
        status: str,
        progress: float = None,
        error_message: str = None,
        selected_features: List[str] = None,
        selection_report: Dict = None,
        storage_path: str = None,
        feature_count: int = None,
        all_features: List[str] = None,
        input_rows: int = None,
        processing_time_seconds: int = None,
    ) -> bool:
        """Update feature set status and results (sync version for Celery)."""
        try:
            uuid_id = UUID(feature_set_id)
        except ValueError:
            return False
        
        update_data = {"status": status}
        if selected_features:
            update_data["selected_features"] = selected_features
            update_data["selected_feature_count"] = len(selected_features)
        if selection_report:
            update_data["selection_report"] = selection_report
        if error_message:
            update_data["error_message"] = error_message
        if storage_path:
            update_data["storage_path"] = storage_path
        if feature_count is not None:
            update_data["feature_count"] = feature_count
        if all_features is not None:
            update_data["all_features"] = all_features
        if input_rows is not None:
            update_data["input_rows"] = input_rows
        if processing_time_seconds is not None:
            update_data["processing_time_seconds"] = processing_time_seconds
        if status == "COMPLETED":
            from datetime import datetime
            update_data["completed_at"] = now_ist()
        
        self.db.execute(
            update(FeatureSet)
            .where(FeatureSet.id == uuid_id)
            .values(**update_data)
        )
        return True

