/**
 * Feature API Service
 * Handles all API calls for feature engineering operations.
 */
import { api } from '../api/axios';

export interface FeatureSet {
    id: string;
    dataset_id: string;
    name: string;
    description?: string;
    version: string;
    status: string;
    config: {
        transaction_features: boolean;
        behavioral_features: boolean;
        temporal_features: boolean;
        aggregation_features: boolean;
        aggregation_windows: string[];
        enable_feature_selection: boolean;
        max_features: number;
    };
    all_features?: string[];
    selected_features?: string[];
    selection_report?: {
        stages: {
            original: number;
            after_variance: number;
            after_correlation: number;
            final_selected: number;
        };
        scores: Record<string, {
            mutual_information: number;
            importance: number;
            rank: number;
        }>;
    };
    feature_count?: number;
    selected_feature_count?: number;
    input_rows?: number;
    processing_time_seconds?: number;
    created_at: string;
    completed_at?: string;
    error_message?: string;
    storage_path?: string;
}

export interface ComputeFeaturesRequest {
    dataset_id: string;
    name: string;
    description?: string;
    transaction_features?: boolean;
    behavioral_features?: boolean;
    temporal_features?: boolean;
    aggregation_features?: boolean;
    aggregation_windows?: string[];
    enable_feature_selection?: boolean;
    max_features?: number;
}

export const featureService = {
    /**
     * List all feature sets.
     */
    async listFeatureSets(datasetId?: string, status?: string): Promise<{ data: FeatureSet[] }> {
        const params: Record<string, string> = {};
        if (datasetId) params.dataset_id = datasetId;
        if (status) params.status = status;

        const response = await api.get('/features/sets', { params });
        return response.data;
    },

    /**
     * Get a single feature set.
     */
    async getFeatureSet(id: string): Promise<FeatureSet> {
        const response = await api.get(`/features/sets/${id}`);
        return response.data.data;
    },

    /**
     * Start feature computation.
     */
    async computeFeatures(request: ComputeFeaturesRequest): Promise<{ data: { id: string; status: string; message: string; reused?: boolean } }> {
        const response = await api.post('/features/compute', request);
        return response.data;
    },

    /**
     * Get default feature configuration.
     */
    async getDefaultConfig(): Promise<ComputeFeaturesRequest> {
        const response = await api.get('/features/config/default');
        return response.data.data;
    },

    /**
     * Delete a feature set.
     */
    async deleteFeatureSet(id: string): Promise<void> {
        await api.delete(`/features/sets/${id}`);
    },

    /**
     * Trigger feature analysis.
     */
    async analyzeFeatureSet(id: string): Promise<void> {
        await api.post(`/features/sets/${id}/analyze`);
    },

    /**
     * Preview feature Data.
     */
    async previewFeatures(id: string, limit: number = 50): Promise<{
        columns: string[];
        rows: any[];
        total_rows: number;
        dataset_version: string;
    }> {
        const response = await api.get(`/features/sets/${id}/preview`, {
            params: { limit }
        });
        return response.data.data;
    },
};

