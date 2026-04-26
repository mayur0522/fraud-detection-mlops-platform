/**
 * Inference Page
 * Real-time fraud prediction with model selection, single + batch prediction.
 * Form fields are dynamically generated from the loaded model's input features.
 */
import { useState } from 'react';
import {
    Card, Row, Col, Typography, Form, Input, Button,
    Statistic, Tag, Progress, Divider, Select,
    Table, message, Spin, Alert, Upload, Tooltip
} from 'antd';
import {
    ThunderboltOutlined, SafetyOutlined, WarningOutlined,
    ExclamationCircleOutlined, UploadOutlined, CloudServerOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    inferenceService,
    PredictionResponse,
    BatchPredictionResult,
    InferenceModel
} from '@/services/inferenceService';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

export function Inference() {
    const { hasRole } = useAuth();
    const canInfer = hasRole(['ADMIN', 'ML_ENGINEER', 'DEPLOYER']);
    const [singleResult, setSingleResult] = useState<PredictionResponse | null>(null);
    const [batchResults, setBatchResults] = useState<BatchPredictionResult[] | null>(null);
    const [batchMeta, setBatchMeta] = useState<any>(null);
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [modelLoadError, setModelLoadError] = useState<string | null>(null);
    const [inputFeatures, setInputFeatures] = useState<string[]>([]);
    const [batchInput, setBatchInput] = useState('');
    const [selectedRiskFilter, setSelectedRiskFilter] = useState<string | null>(null);
    const [form] = Form.useForm();

    const handleRiskFilter = (riskLevel: string) => {
        if (selectedRiskFilter === riskLevel) {
            setSelectedRiskFilter(null); // Deselect
        } else {
            setSelectedRiskFilter(riskLevel);
        }
    };

    const filteredBatchResults = selectedRiskFilter
        ? batchResults?.filter(r => r.risk_level === selectedRiskFilter)
        : batchResults;

    // Fetch available models
    const { data: modelsData, isLoading: modelsLoading } = useQuery({
        queryKey: ['inference-models'],
        queryFn: inferenceService.listModels,
    });

    const models = modelsData?.data || [];

    // Load model mutation
    const loadModelMutation = useMutation({
        mutationFn: (modelId: string) => inferenceService.loadModel(modelId),
        onSuccess: (data) => {
            setModelLoaded(true);
            setModelLoadError(null);
            setSingleResult(null);
            setBatchResults(null);
            // Extract input features for dynamic form
            const features = data?.data?.input_features || [];
            setInputFeatures(features);
            form.resetFields();
            message.success(`Model loaded (${data?.data?.inference_engine || 'pickle'} engine)`);
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail || 'Failed to load model';
            // Still mark model as selected so batch prediction can proceed
            // (batch prediction uses the server-side loaded model, so single prediction via UI form will fail,
            //  but batch prediction from a JSON upload should still be allowed)
            setModelLoaded(true);
            setModelLoadError(detail);
            setInputFeatures([]);
            message.warning(`Model load issue: ${detail}. Batch prediction may still work if server has a model loaded.`);
        },
    });

    // Single prediction mutation
    const predictMutation = useMutation({
        mutationFn: inferenceService.predict,
        onSuccess: (data) => setSingleResult(data),
        onError: (err: any) => message.error(err?.response?.data?.detail || 'Prediction failed'),
    });

    // Batch prediction mutation
    const batchMutation = useMutation({
        mutationFn: inferenceService.predictBatch,
        onSuccess: (data) => {
            setBatchResults(data.data);
            setBatchMeta(data.meta);
        },
        onError: (err: any) => message.error(err?.response?.data?.detail || 'Batch prediction failed'),
    });

    const handleModelSelect = (modelId: string) => {
        setSelectedModelId(modelId);
        setModelLoaded(false);
        setModelLoadError(null);
        setInputFeatures([]);
        loadModelMutation.mutate(modelId);
    };

    const handlePredict = (values: any) => {
        // Convert numeric-looking strings to numbers
        const features: Record<string, any> = {};
        for (const [key, val] of Object.entries(values)) {
            if (val === undefined || val === null || val === '') continue;
            const num = Number(val);
            features[key] = isNaN(num) ? val : num;
        }
        predictMutation.mutate({ features });
    };

    const handleBatchPredict = () => {
        try {
            const parsed = JSON.parse(batchInput);
            const transactions = Array.isArray(parsed) ? parsed : [parsed];
            batchMutation.mutate(transactions);
        } catch {
            message.error('Invalid JSON. Provide an array of feature objects.');
        }
    };

    const getRiskColor = (riskLevel: string) => {
        const map: Record<string, string> = {
            CRITICAL: '#ff4d4f', HIGH: '#fa8c16', MEDIUM: '#faad14', LOW: '#52c41a',
        };
        return map[riskLevel] || '#8c8c8c';
    };

    const getRiskIcon = (riskLevel: string) => {
        switch (riskLevel) {
            case 'CRITICAL': return <ExclamationCircleOutlined />;
            case 'HIGH': case 'MEDIUM': return <WarningOutlined />;
            case 'LOW': return <SafetyOutlined />;
            default: return null;
        }
    };

    const getRiskTag = (riskLevel: string) => {
        const colorMap: Record<string, string> = {
            CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'gold', LOW: 'green',
        };
        return <Tag color={colorMap[riskLevel] || 'default'}>{riskLevel}</Tag>;
    };

    // Batch results table columns
    const batchColumns = [
        { title: '#', dataIndex: 'index', key: 'index', width: 50 },
        {
            title: 'Prediction',
            dataIndex: 'prediction',
            key: 'prediction',
            render: (v: number) => (
                <Tag color={v === 1 ? 'red' : 'green'}>{v === 1 ? 'FRAUD' : 'LEGIT'}</Tag>
            ),
        },
        {
            title: 'Fraud Score',
            dataIndex: 'fraud_score',
            key: 'fraud_score',
            render: (v: number) => `${(v * 100).toFixed(1)}%`,
        },
        {
            title: 'Confidence',
            dataIndex: 'confidence',
            key: 'confidence',
            render: (v: number) => `${(v * 100).toFixed(1)}%`,
        },
        {
            title: 'Risk',
            dataIndex: 'risk_level',
            key: 'risk_level',
            render: (v: string) => getRiskTag(v),
        },
    ];

    // Generate a human-readable label from column name
    const formatLabel = (name: string) =>
        name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return (
        <div className="fade-in">
            {/* Header with Model Selector */}
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                    <Title level={2} style={{ margin: 0 }}>Real-time Inference</Title>
                    <Text type="secondary">ONNX-powered fraud detection predictions</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CloudServerOutlined style={{ fontSize: 18 }} />
                    <Select
                        showSearch
                        filterOption={(input, option) => 
                            (option?.searchName?.toString().toLowerCase() ?? '').includes(input.toLowerCase())
                        }
                        placeholder="Select a model"
                        style={{ width: 320 }}
                        loading={modelsLoading}
                        value={selectedModelId}
                        onChange={handleModelSelect}
                        options={models.map((m: InferenceModel) => ({
                            value: m.model_id,
                            searchName: m.name,
                            label: (
                                <span>
                                    {m.name}
                                    <Tag
                                        color={m.status === 'PRODUCTION' ? 'green' : m.status === 'STAGING' ? 'blue' : 'default'}
                                        style={{ marginLeft: 8, fontSize: 10 }}
                                    >
                                        {m.status}
                                    </Tag>
                                </span>
                            ),
                        }))}
                    />
                    {modelLoaded && (
                        <Tag icon={<CheckCircleOutlined />} color="success">Loaded</Tag>
                    )}
                    {loadModelMutation.isPending && <Spin size="small" />}
                </div>
            </div>

            {!modelLoaded && !loadModelMutation.isPending && (
                <Alert
                    message="Select a model to begin inference"
                    description="Choose a trained model from the dropdown above."
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />
            )}

            {/* Two-Column Layout: Single + Batch */}
            <Row gutter={24}>
                {/* LEFT: Single Prediction */}
                <Col span={12}>
                    <Card
                        title={
                            <span>
                                Single Prediction
                                {inputFeatures.length > 0 && (
                                    <Tag style={{ marginLeft: 8 }}>{inputFeatures.length} features</Tag>
                                )}
                            </span>
                        }
                        extra={<ThunderboltOutlined />}
                        style={{ marginBottom: 24 }}
                    >
                        {modelLoaded && inputFeatures.length > 0 ? (
                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handlePredict}
                                style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}
                            >
                                {inputFeatures.map((featureName) => (
                                    <Form.Item
                                        key={featureName}
                                        name={featureName}
                                        label={formatLabel(featureName)}
                                    >
                                        <Input placeholder={featureName} />
                                    </Form.Item>
                                ))}
                                <Tooltip title={!canInfer ? "Your role does not have permission to run inference." : ""}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={predictMutation.isPending}
                                        icon={<ThunderboltOutlined />}
                                        size="large"
                                        style={{ width: '100%' }}
                                        disabled={!canInfer}
                                    >
                                        Predict
                                    </Button>
                                </Tooltip>
                            </Form>
                        ) : modelLoaded && modelLoadError ? (
                            <Alert
                                message="Model Load Warning"
                                description={`${modelLoadError}. Use Batch Prediction with JSON input to run predictions.`}
                                type="warning"
                                showIcon
                            />
                        ) : modelLoaded ? (
                            <Alert
                                message="Input features not available"
                                description="This model was trained before dynamic features were tracked. Use batch prediction with JSON input instead."
                                type="warning"
                                showIcon
                            />
                        ) : (
                            <div style={{ textAlign: 'center', padding: 32, color: '#bfbfbf' }}>
                                <ThunderboltOutlined style={{ fontSize: 36 }} />
                                <Title level={5} type="secondary" style={{ marginTop: 12 }}>
                                    Load a model to see input fields
                                </Title>
                            </div>
                        )}
                    </Card>

                    {/* Single Result */}
                    {singleResult && (
                        <Card>
                            <Alert
                                message={`Risk Level: ${singleResult.risk_level}`}
                                type={
                                    singleResult.risk_level === 'LOW' ? 'success' :
                                        singleResult.risk_level === 'MEDIUM' ? 'warning' : 'error'
                                }
                                showIcon
                                icon={getRiskIcon(singleResult.risk_level)}
                                style={{ marginBottom: 24 }}
                            />

                            <Row gutter={16} style={{ marginBottom: 24 }}>
                                <Col span={8}>
                                    <Card size="small">
                                        <Statistic
                                            title="Prediction"
                                            value={singleResult.prediction === 1 ? 'FRAUD' : 'LEGITIMATE'}
                                            valueStyle={{
                                                color: singleResult.prediction === 1 ? '#ff4d4f' : '#52c41a',
                                                fontSize: 18,
                                            }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small">
                                        <Statistic
                                            title="Fraud Score"
                                            value={singleResult.fraud_score * 100}
                                            suffix="%"
                                            precision={1}
                                            valueStyle={{ color: getRiskColor(singleResult.risk_level) }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={8}>
                                    <Card size="small">
                                        <Statistic
                                            title="Response Time"
                                            value={singleResult.response_time_ms}
                                            suffix="ms"
                                            precision={2}
                                        />
                                    </Card>
                                </Col>
                            </Row>

                            <div>
                                <Text strong>Confidence</Text>
                                <Progress
                                    percent={singleResult.confidence * 100}
                                    strokeColor={getRiskColor(singleResult.risk_level)}
                                    format={(p) => `${p?.toFixed(1)}%`}
                                />
                            </div>
                        </Card>
                    )}
                </Col>

                {/* RIGHT: Batch Prediction */}
                <Col span={12}>
                    <Card
                        title="Batch Prediction"
                        extra={<UploadOutlined />}
                        style={{ marginBottom: 24 }}
                    >
                        <Upload.Dragger
                            name="file"
                            multiple={false}
                            accept=".json,.csv"
                            showUploadList={false}
                            beforeUpload={(file) => {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    try {
                                        const text = e.target?.result as string;
                                        if (file.name.endsWith('.json')) {
                                            const json = JSON.parse(text);
                                            setBatchInput(JSON.stringify(json, null, 2));
                                            message.success('JSON loaded successfully');
                                        } else if (file.name.endsWith('.csv')) {
                                            // Robust CSV Parser (handles quoted values)
                                            const parseCSVLine = (line: string): string[] => {
                                                const values: string[] = [];
                                                let current = '';
                                                let inQuote = false;

                                                for (let i = 0; i < line.length; i++) {
                                                    const char = line[i];
                                                    const nextChar = i + 1 < line.length ? line[i + 1] : null;

                                                    if (char === '"' && nextChar === '"') {
                                                        // Escaped quote ("") -> add single quote to output
                                                        current += '"';
                                                        i++; // Skip next quote
                                                    } else if (char === '"') {
                                                        // Toggle quote mode, but don't add to output
                                                        inQuote = !inQuote;
                                                    } else if (char === ',' && !inQuote) {
                                                        // Field separator
                                                        values.push(current.trim());
                                                        current = '';
                                                    } else {
                                                        // Regular character
                                                        current += char;
                                                    }
                                                }
                                                values.push(current.trim());
                                                return values;
                                            };

                                            const lines = text.split(/\r?\n/).filter(line => line.trim());
                                            if (lines.length < 2) throw new Error('CSV must have header and at least one row');

                                            // Parse header
                                            const headers = parseCSVLine(lines[0]);

                                            // Check for missing columns
                                            if (inputFeatures.length > 0) {
                                                const missing = inputFeatures.filter(f => !headers.includes(f));
                                                if (missing.length > 0) {
                                                    message.warning(`Warning: CSV is missing ${missing.length} columns: ${missing.slice(0, 3).join(', ')}... (Features will be N/A)`);
                                                }
                                            }

                                            const data = lines.slice(1).map(line => {
                                                const values = parseCSVLine(line);
                                                const obj: Record<string, any> = {};
                                                headers.forEach((h, i) => {
                                                    const val = values[i];
                                                    // Try to convert number-like strings
                                                    if (val !== undefined && val !== '') {
                                                        const num = Number(val);
                                                        obj[h] = isNaN(num) ? val : num;
                                                    }
                                                });
                                                return obj;
                                            });

                                            // Filter out incomplete rows (>50% missing fields)
                                            const completeData = data.filter(row => {
                                                const nonNullFields = Object.values(row).filter(v => v !== undefined && v !== null && v !== '').length;
                                                const completeness = nonNullFields / headers.length;
                                                return completeness > 0.5; // Keep rows with >50% fields populated
                                            });

                                            const removedCount = data.length - completeData.length;
                                            if (removedCount > 0) {
                                                message.warning(`Removed ${removedCount} incomplete rows (fragments from multi-line addresses)`);
                                            }

                                            setBatchInput(JSON.stringify(completeData, null, 2));
                                            message.success(`CSV loaded (${completeData.length} valid rows, ${removedCount} fragments removed)`);
                                        }
                                    } catch (err) {
                                        message.error('Failed to parse file: ' + err);
                                    }
                                };
                                reader.readAsText(file);
                                return false; // Prevent upload
                            }}
                            style={{ marginBottom: 16 }}
                        >
                            <p className="ant-upload-drag-icon">
                                <UploadOutlined />
                            </p>
                            <p className="ant-upload-text">Test with large datasets</p>
                            <p className="ant-upload-hint">
                                Upload a CSV or JSON file to populate the batch input.
                            </p>
                        </Upload.Dragger>

                        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                            Or paste a JSON array manually:
                        </Text>
                        <TextArea
                            rows={6}
                            placeholder={
                                inputFeatures.length > 0
                                    ? `[\n  {${inputFeatures.slice(0, 3).map(f => `"${f}": ""`).join(', ')}},\n  ...\n]`
                                    : '[\n  {"column1": "value1", "column2": "value2"},\n  ...\n]'
                            }
                            value={batchInput}
                            onChange={(e) => setBatchInput(e.target.value)}
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                        />
                        <Tooltip title={!canInfer ? "Your role does not have permission to run inference." : ""}>
                            <Button
                                type="primary"
                                onClick={handleBatchPredict}
                                loading={batchMutation.isPending}
                                icon={<ThunderboltOutlined />}
                                size="large"
                                style={{ width: '100%', marginTop: 16 }}
                                disabled={!selectedModelId || !batchInput.trim() || !canInfer}
                            >
                                Predict Batch
                            </Button>
                        </Tooltip>
                    </Card>

                    {/* Batch Results */}
                    {batchResults ? (
                        <Card>
                            {batchMeta && (
                                <>
                                    <Row gutter={16} style={{ marginBottom: 12 }}>
                                        <Col span={6}>
                                            <Statistic title="Transactions" value={batchMeta.total_transactions} />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic
                                                title="Fraud Risk"
                                                value={batchMeta.fraud_count}
                                                suffix={`/ ${batchMeta.total_transactions}`}
                                                valueStyle={{ color: '#cf1322' }}
                                            />
                                        </Col>
                                        {batchMeta.has_amount ? (
                                            <Col span={6}>
                                                <Statistic
                                                    title={
                                                        <span style={{ cursor: 'help' }} title="Sum of amounts for transactions predicted as FRAUD">
                                                            Fraud Value <ExclamationCircleOutlined style={{ fontSize: 12, color: '#bfbfbf' }} />
                                                        </span>
                                                    }
                                                    value={batchMeta.fraud_total_amount ?? batchMeta.total_amount}
                                                    precision={2}
                                                    prefix="$"
                                                />
                                            </Col>
                                        ) : (
                                            <Col span={6}>
                                                <Statistic
                                                    title="Avg Latency"
                                                    value={batchMeta.avg_time_per_transaction_ms}
                                                    suffix="ms"
                                                    precision={2}
                                                />
                                            </Col>
                                        )}
                                        <Col span={6}>
                                            <Statistic
                                                title="Total Time"
                                                value={batchMeta.total_time_ms}
                                                suffix="ms"
                                                precision={0}
                                            />
                                        </Col>
                                    </Row>

                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                Fraud Ratio: {batchMeta.total_transactions ? (((batchMeta.fraud_count || 0) / batchMeta.total_transactions) * 100).toFixed(1) : '0.0'}%
                                            </Text>
                                            <div>
                                                {Object.entries(batchMeta.risk_summary || {}).map(([level, count]: [string, any]) => {
                                                    if (count === 0) return null;
                                                    const isSelected = selectedRiskFilter === level;
                                                    const isDimmed = selectedRiskFilter && !isSelected;

                                                    return (
                                                        <Tag
                                                            key={level}
                                                            color={getRiskColor(level)}
                                                            style={{
                                                                marginRight: 0,
                                                                marginLeft: 6,
                                                                cursor: 'pointer',
                                                                opacity: isDimmed ? 0.3 : 1,
                                                                border: isSelected ? '2px solid rgba(0,0,0,0.5)' : undefined,
                                                                transition: 'all 0.2s',
                                                                fontWeight: isSelected ? 'bold' : 'normal'
                                                            }}
                                                            onClick={() => handleRiskFilter(level)}
                                                        >
                                                            {level}: {count}
                                                            {isSelected && <CheckCircleOutlined style={{ marginLeft: 4 }} />}
                                                        </Tag>
                                                    );
                                                })}
                                                {selectedRiskFilter && (
                                                    <Button
                                                        size="small"
                                                        type="link"
                                                        onClick={() => setSelectedRiskFilter(null)}
                                                        style={{ padding: '0 4px', height: 22, marginLeft: 4 }}
                                                    >
                                                        Clear
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <Progress
                                            percent={batchMeta.total_transactions ? (((batchMeta.fraud_count || 0) / batchMeta.total_transactions) * 100) : 0}
                                            status="exception"
                                            showInfo={false}
                                            strokeColor="#cf1322"
                                            trailColor="#52c41a"
                                            strokeWidth={8}
                                        />
                                    </div>
                                </>
                            )}
                            <Divider style={{ margin: '12px 0' }} />
                            <Table
                                dataSource={filteredBatchResults || undefined}
                                columns={batchColumns}
                                rowKey="index"
                                size="small"
                                pagination={{ pageSize: 10 }}
                                scroll={{ y: 300 }}
                            />
                        </Card>
                    ) : (
                        modelLoaded && (
                            <Card style={{ textAlign: 'center', padding: 32 }}>
                                <UploadOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />
                                <Title level={5} type="secondary" style={{ marginTop: 12 }}>
                                    Paste JSON and click Predict Batch
                                </Title>
                            </Card>
                        )
                    )}
                </Col>
            </Row>
        </div>
    );
}
