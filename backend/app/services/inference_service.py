"""
Inference Service
Loads trained models (ONNX + preprocessor) and provides prediction methods.
"""
import numpy as np
import pandas as pd
import pickle
import logging
import time
from typing import Dict, Any, List, Optional
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ml_model import MLModel
from app.core.storage import storage_service
from ml.inference.onnx_engine import ONNXInferenceEngine, InferenceResult

logger = logging.getLogger(__name__)


class InferenceService:
    """
    Manages ONNX model loading and real-time prediction.
    
    Uses a hybrid approach:
    - Pickle preprocessor (FraudFeatureEngineer) for feature transformation
    - ONNX engine for fast model inference
    """
    
    _instance: Optional["InferenceService"] = None
    
    def __init__(self):
        self._loaded_model_id: Optional[str] = None
        self._onnx_engine: Optional[ONNXInferenceEngine] = None
        self._pipeline = None  # Pickle pipeline fallback
        self._preprocessor = None  # FraudFeatureEngineer
        self._calibrator = None  # Platt scaler (LogisticRegression on raw probs)
        self._model_info: Optional[Dict[str, Any]] = None
        self._feature_names: Optional[List[str]] = None
        self._use_onnx: bool = False
        self._optimal_threshold: float = 0.5  # Loaded from manifest; corrects scale_pos_weight bias
    
    @classmethod
    def get_instance(cls) -> "InferenceService":
        """Singleton. No threading lock — safe for asyncio context."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def list_available_models(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """List all trained models available for inference."""
        from app.models.training_job import TrainingJob
        
        result = await db.execute(
            select(MLModel, TrainingJob.name.label("job_name"))
            .outerjoin(TrainingJob, TrainingJob.model_id == MLModel.id)
            .where(MLModel.status.in_(['STAGING', 'PRODUCTION', 'TRAINED']))
            .order_by(desc(MLModel.created_at))
        )
        rows = result.all()
        
        return [
            {
                "model_id": str(m.id),
                "name": f"{job_name} ({m.algorithm})" if job_name else m.name,
                "algorithm": m.algorithm,
                "version": m.version,
                "status": m.status,
                "metrics": m.metrics,
                "feature_names": m.feature_names,
                "has_onnx": m.onnx_path is not None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "is_loaded": str(m.id) == self._loaded_model_id,
            }
            for m, job_name in rows
        ]
    
    async def load_model(self, model_id: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Load a model for inference. Prefers ONNX, falls back to pickle pipeline.
        """
        # Skip if already loaded
        if self._loaded_model_id == model_id and (self._onnx_engine is not None or self._pipeline is not None):
            logger.info(f"Model {model_id} already loaded, skipping")
            return self._model_info
        
        # Fetch model record
        result = await db.execute(
            select(MLModel).where(MLModel.id == UUID(model_id))
        )
        model = result.scalar_one_or_none()
        
        if not model:
            raise ValueError(f"Model {model_id} not found")
        
        logger.info(f"Loading model {model_id}: {model.name}")
        
        # Reset state
        self._onnx_engine = None
        self._pipeline = None
        self._preprocessor = None
        self._calibrator = None
        self._use_onnx = False
        self._optimal_threshold = 0.5  # Default; overridden by manifest if present
        
        # Try ONNX first
        if model.onnx_path:
            try:
                onnx_bytes = await storage_service.download_model(model.onnx_path)
                logger.info(f"Downloaded ONNX model: {len(onnx_bytes)} bytes")
                
                # Download preprocessor
                preprocessor_path = model.onnx_path.rsplit("/", 1)[0] + "/preprocessor.pkl"
                try:
                    preprocessor_bytes = await storage_service.download_model(preprocessor_path)
                    self._preprocessor = pickle.loads(preprocessor_bytes)
                    logger.info("Preprocessor loaded")
                except Exception as e:
                    logger.warning(f"Could not load preprocessor: {e}")

                # Verify artifact version manifest
                manifest_path = model.onnx_path.rsplit("/", 1)[0] + "/manifest.json"
                try:
                    import json, hashlib
                    manifest_bytes = await storage_service.download_model(manifest_path)
                    manifest = json.loads(manifest_bytes)
                    # Verify ONNX checksum matches manifest
                    actual_checksum = hashlib.sha256(onnx_bytes).hexdigest()
                    if manifest.get("onnx_checksum") and manifest["onnx_checksum"] != actual_checksum:
                        logger.warning(
                            f"ONNX checksum mismatch! Manifest expects {manifest['onnx_checksum'][:16]}... "
                            f"but loaded {actual_checksum[:16]}... — artifacts may be from different training jobs"
                        )
                    else:
                        logger.info(f"Artifact version verified: job={manifest.get('training_job_id', 'unknown')}")
                    # Load the calibrated classification threshold computed at training time
                    if "optimal_threshold" in manifest:
                        self._optimal_threshold = float(manifest["optimal_threshold"])
                        logger.info(f"Loaded optimal threshold from manifest: {self._optimal_threshold:.4f}")
                    # Load Platt calibrator if present
                    if manifest.get("is_calibrated"):
                        artifact_base = model.onnx_path.rsplit("/", 1)[0]
                        try:
                            cal_bytes = await storage_service.download_model(artifact_base + "/calibrator.pkl")
                            self._calibrator = pickle.loads(cal_bytes)
                            logger.info("Platt calibrator loaded — probabilities will be calibrated at inference")
                        except Exception as cal_e:
                            logger.warning(f"Could not load calibrator: {cal_e}")
                except Exception as e:
                    logger.info(f"No version manifest found (older model): {e}")
                
                self._onnx_engine = ONNXInferenceEngine(onnx_bytes=onnx_bytes)
                self._use_onnx = True
                logger.info("Using ONNX engine for inference")
            except Exception as e:
                logger.warning(f"ONNX load failed, falling back to pickle: {e}")
        
        # Fallback to pickle pipeline
        if not self._use_onnx and model.storage_path:
            try:
                pipeline_bytes = await storage_service.download_model(model.storage_path)
                self._pipeline = pickle.loads(pipeline_bytes)
                logger.info(f"Loaded pickle pipeline for inference")
            except Exception as e:
                raise ValueError(f"Failed to load model: {e}")
        
        if not self._use_onnx and self._pipeline is None:
            raise ValueError(f"Model {model_id} has no loadable artifacts")
        
        self._loaded_model_id = model_id
        self._feature_names = model.feature_names
        
        # Extract raw input column names for dynamic form
        input_features = None
        if self._preprocessor and hasattr(self._preprocessor, 'feature_names_in_'):
            input_features = self._preprocessor.feature_names_in_
        elif self._pipeline and hasattr(self._pipeline, 'named_steps'):
            fe = self._pipeline.named_steps.get('fraud_features')
            if fe and hasattr(fe, 'feature_names_in_'):
                input_features = fe.feature_names_in_
        
        self._model_info = {
            "model_id": str(model.id),
            "name": model.name,
            "algorithm": model.algorithm,
            "version": model.version,
            "status": model.status,
            "metrics": model.metrics,
            "feature_names": model.feature_names,
            "input_features": input_features,
            "inference_engine": "onnx" if self._use_onnx else "pickle",
            "optimal_threshold": self._optimal_threshold,
        }
        # Also check metrics JSON for threshold persisted by trainer (pickle path / older ONNX models)
        if model.metrics and "optimal_threshold" in model.metrics:
            threshold_from_metrics = float(model.metrics["optimal_threshold"])
            # Manifest wins if already set by manifest load above; otherwise use metrics
            if self._optimal_threshold == 0.5:
                self._optimal_threshold = threshold_from_metrics
                self._model_info["optimal_threshold"] = self._optimal_threshold
                logger.info(f"Loaded optimal threshold from model metrics: {self._optimal_threshold:.4f}")

        logger.info(f"Model {model_id} loaded via {'ONNX' if self._use_onnx else 'pickle'} | threshold={self._optimal_threshold:.4f} | calibrated={self._calibrator is not None}")
        return self._model_info
    
    def _calibrate(self, fraud_score: float) -> float:
        """Apply Platt calibrator to a single raw probability score."""
        if self._calibrator is None:
            return fraud_score
        import numpy as np
        raw = np.array([[fraud_score]], dtype=np.float64)
        return float(self._calibrator.predict_proba(raw)[0, 1])

    def _calibrate_batch(self, scores: np.ndarray) -> np.ndarray:
        """Apply Platt calibrator to a batch of raw probability scores."""
        if self._calibrator is None:
            return scores
        raw = scores.reshape(-1, 1).astype(np.float64)
        return self._calibrator.predict_proba(raw)[:, 1]
    
    def _safe_float(self, val: Any, default: float = 0.0) -> float:
        import math
        try:
            f = float(val)
            return default if math.isnan(f) or math.isinf(f) else f
        except (ValueError, TypeError):
            return default
    
    def predict_single(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Make a single prediction using ONNX or pickle pipeline."""
        if self._onnx_engine is None and self._pipeline is None:
            raise RuntimeError("No model loaded. Call load_model() first.")
        
        start = time.perf_counter()
        
        df = pd.DataFrame([features])
        
        if self._use_onnx:
            # ONNX path: preprocess then ONNX engine
            if self._preprocessor is not None:
                transformed = self._preprocessor.transform(df)
                if isinstance(transformed, pd.DataFrame):
                    feature_array = transformed.values.astype(np.float32)
                else:
                    feature_array = np.array(transformed, dtype=np.float32)
            else:
                feature_array = df.values.astype(np.float32)
            
            result = self._onnx_engine.predict(feature_array)
            raw_score = self._safe_float(result.fraud_score)
            fraud_score = self._safe_float(self._calibrate(raw_score))  # Platt-corrected
            prediction = 1 if fraud_score >= self._optimal_threshold else 0
            confidence = self._safe_float(abs(fraud_score - 0.5) * 2)
        else:
            # Pickle pipeline path
            proba = self._pipeline.predict_proba(df)[0]
            raw_score = self._safe_float(proba[1] if len(proba) > 1 else proba[0])
            fraud_score = self._safe_float(self._calibrate(raw_score))  # Platt-corrected
            prediction = 1 if fraud_score >= self._optimal_threshold else 0
            confidence = self._safe_float(abs(fraud_score - 0.5) * 2)
        
        total_ms = (time.perf_counter() - start) * 1000
        risk_level = self._get_risk_level(fraud_score)
        
        return {
            "prediction": prediction,
            "fraud_score": fraud_score,
            "confidence": confidence,
            "risk_level": risk_level,
            "response_time_ms": round(total_ms, 2),
            "model_id": self._loaded_model_id,
        }
    
    def predict_batch(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Make batch predictions using ONNX or pickle pipeline."""
        if self._onnx_engine is None and self._pipeline is None:
            raise RuntimeError("No model loaded. Call load_model() first.")
        
        start = time.perf_counter()
        df = pd.DataFrame(transactions)
        
        # Data quality check: warn about rows with excessive missing values
        if len(df) > 0:
            missing_pct = df.isnull().sum(axis=1) / len(df.columns)
            problematic_rows = missing_pct[missing_pct > 0.5]
            
            if len(problematic_rows) > 0:
                logger.warning(
                    f"Found {len(problematic_rows)} rows with >50% missing values. "
                    f"These may produce unreliable predictions. Row indices: {problematic_rows.index.tolist()[:10]}"
                )
        
        if len(df) == 0:
            return {
                "results": [],
                "meta": {
                    "total_transactions": 0,
                    "fraud_count": 0,
                    "legit_count": 0,
                    "risk_summary": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
                    "total_amount": 0.0,
                    "avg_amount": 0.0,
                    "fraud_total_amount": 0.0,
                    "fraud_avg_amount": 0.0,
                    "all_transactions_amount": 0.0,
                    "all_transactions_avg_amount": 0.0,
                    "has_amount": False,
                    "total_time_ms": 0.0,
                    "avg_time_per_transaction_ms": 0.0,
                    "model_id": self._loaded_model_id,
                }
            }

        # Normalize columns to match expected features (case-insensitive fallback)
        if self._model_info and self._model_info.get("input_features"):
            expected = set(self._model_info["input_features"])
            mapping = {}
            for col in df.columns:
                if col in expected:
                    continue
                # Try case insensitive match
                match = next((e for e in expected if e.lower() == col.lower()), None)
                if match:
                    mapping[col] = match
            
            if mapping:
                logger.info(f"Normalizing input columns: {mapping}")
                df.rename(columns=mapping, inplace=True)
        
        if self._use_onnx:
            if self._preprocessor is not None:
                transformed = self._preprocessor.transform(df)
                if isinstance(transformed, pd.DataFrame):
                    feature_array = transformed.values.astype(np.float32)
                else:
                    feature_array = np.array(transformed, dtype=np.float32)
            else:
                feature_array = df.values.astype(np.float32)
            
            results = self._onnx_engine.predict_batch(feature_array)
            raw_scores = np.array([self._safe_float(r.fraud_score) for r in results])
            cal_scores = self._calibrate_batch(raw_scores)  # Platt-corrected probabilities
            formatted = []
            for i, (r, fs) in enumerate(zip(results, cal_scores)):
                fs = self._safe_float(fs)
                pred = 1 if fs >= self._optimal_threshold else 0
                formatted.append({
                    "index": i,
                    "prediction": pred,
                    "fraud_score": round(fs, 4),
                    "confidence": round(self._safe_float(abs(fs - 0.5) * 2), 4),
                    "risk_level": self._get_risk_level(fs),
                })
        else:
            probas = self._pipeline.predict_proba(df)
            raw_scores = np.array([
                self._safe_float(probas[i][1] if probas.shape[1] > 1 else probas[i][0])
                for i in range(len(probas))
            ])
            cal_scores = self._calibrate_batch(raw_scores)  # Platt-corrected probabilities
            formatted = []
            for i, fs in enumerate(cal_scores):
                fs = self._safe_float(fs)
                pred = 1 if fs >= self._optimal_threshold else 0
                formatted.append({
                    "index": i,
                    "prediction": pred,
                    "fraud_score": round(fs, 4),
                    "confidence": round(self._safe_float(abs(fs - 0.5) * 2), 4),
                    "risk_level": self._get_risk_level(fs),
                })
        
        # Calculate extended metrics
        fraud_count = sum(1 for r in formatted if r['prediction'] == 1)
        legit_count = len(formatted) - fraud_count
        
        risk_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        scores = []
        for r in formatted:
            risk_counts[r['risk_level']] = risk_counts.get(r['risk_level'], 0) + 1
            scores.append(r['fraud_score'])
            
        # Financial impact logic
        total_amount = 0.0
        avg_amount = 0.0
        fraud_total_amount = 0.0
        fraud_avg_amount = 0.0
        all_transactions_amount = 0.0
        all_transactions_avg_amount = 0.0
        amount_col = self._get_amount_column(df)
        
        if amount_col:
            try:
                # Ensure numeric
                amounts = pd.to_numeric(df[amount_col], errors='coerce').fillna(0)
                all_transactions_amount = self._safe_float(amounts.sum())
                all_transactions_avg_amount = self._safe_float(amounts.mean())

                # Sum and average amount only for predicted fraud transactions.
                fraud_indices = [r["index"] for r in formatted if r["prediction"] == 1]
                if fraud_indices:
                    fraud_amounts = amounts.iloc[fraud_indices]
                    fraud_total_amount = self._safe_float(fraud_amounts.sum())
                    fraud_avg_amount = self._safe_float(fraud_amounts.mean())

                # Keep existing API keys for UI backward compatibility, but with fraud-only semantics.
                total_amount = fraud_total_amount
                avg_amount = fraud_avg_amount
            except Exception as e:
                logger.warning(f"Failed to calculate amount stats: {e}")

        total_ms = (time.perf_counter() - start) * 1000
        
        return {
            "results": formatted,
            "meta": {
                "total_transactions": len(formatted),
                "fraud_count": fraud_count,
                "legit_count": legit_count,
                "risk_summary": risk_counts,
                "total_amount": round(total_amount, 2),
                "avg_amount": round(avg_amount, 2),
                "fraud_total_amount": round(fraud_total_amount, 2),
                "fraud_avg_amount": round(fraud_avg_amount, 2),
                "all_transactions_amount": round(all_transactions_amount, 2),
                "all_transactions_avg_amount": round(all_transactions_avg_amount, 2),
                "has_amount": amount_col is not None,
                "total_time_ms": round(total_ms, 2),
                "avg_time_per_transaction_ms": round(total_ms / max(len(formatted), 1), 2),
                "model_id": self._loaded_model_id,
            }
        }

    def _get_amount_column(self, df: pd.DataFrame) -> Optional[str]:
        """Heuristic to find transaction amount column."""
        candidates = ['amount', 'transaction_amount', 'txn_amt', 'value', 'total_amount']
        # Check exact matches first
        for col in df.columns:
            if col.lower() in candidates:
                return col
        # Check partial matches
        for col in df.columns:
            if 'amount' in col.lower():
                return col
        return None
    
    def get_loaded_model_info(self) -> Optional[Dict[str, Any]]:
        """Return info about currently loaded model, or None."""
        return self._model_info
    
    @staticmethod
    def _get_risk_level(fraud_score: float) -> str:
        if fraud_score > 0.9:
            return "CRITICAL"
        elif fraud_score > 0.7:
            return "HIGH"
        elif fraud_score > 0.4:
            return "MEDIUM"
        else:
            return "LOW"
