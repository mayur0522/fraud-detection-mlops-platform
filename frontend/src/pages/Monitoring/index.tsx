/**
 * Monitoring Page
 * Track data drift, model performance, and bias metrics.
 */
import { useState, useEffect } from 'react';
import {
    Card, Row, Col, Typography, Tag, Table, Tabs, Progress,
    Statistic, Space, Button, Tooltip, Alert, Select, Skeleton
} from 'antd';
import {
    LineChartOutlined, WarningOutlined, CheckCircleOutlined,
    ReloadOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    BarChart, Bar, Cell
} from 'recharts';
import { monitoringService } from '@/services/monitoringService';

import { api } from '../../api/axios';

const { Title, Text } = Typography;

export function Monitoring() {
    const [activeTab, setActiveTab] = useState('drift');
    const [modelId, setModelId] = useState<string | null>(null);
    const [models, setModels] = useState<{
        model_id: string;
        name?: string;
        algorithm?: string;
        status?: string;
        metrics?: Record<string, number>;
        created_at?: string;
    }[]>([]);
    const queryClient = useQueryClient();

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await api.get(`/inference/models`);
                const list = res.data?.data || [];
                setModels(list);
                if (list.length > 0) setModelId(list[0].model_id);
            } catch (err) {
                console.error('Failed to fetch models for monitoring', err);
            }
        };
        fetchModels();
    }, []);

    // Fetch drift metrics
    const { data: driftData, isLoading: driftLoading } = useQuery({
        queryKey: ['drift', modelId],
        queryFn: () => monitoringService.getDriftMetrics(modelId!),
        enabled: !!modelId,
    });

    // Fetch bias metrics
    const { data: biasData, isLoading: biasLoading } = useQuery({
        queryKey: ['bias', modelId],
        queryFn: () => monitoringService.getBiasMetrics(modelId!),
        enabled: !!modelId,
    });

    // Fetch performance metrics
    const { data: performanceData, isLoading: performanceLoading } = useQuery({
        queryKey: ['performance', modelId],
        queryFn: () => monitoringService.getPerformanceMetrics(modelId!),
        enabled: !!modelId,
    });

    // Fetch baselines
    const { data: baselinesData, isLoading: baselinesLoading } = useQuery({
        queryKey: ['baselines', modelId],
        queryFn: () => monitoringService.getBaselines(modelId!),
        enabled: !!modelId,
    });

    // Refresh mutations
    const refreshMetricsMutation = useMutation({
        mutationFn: async () => {
            await Promise.allSettled([
                monitoringService.triggerDriftComputation(modelId!),
                monitoringService.triggerBiasComputation(modelId!),
            ]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['drift'] });
            queryClient.invalidateQueries({ queryKey: ['bias'] });
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OK': return 'green';
            case 'WARNING': return 'orange';
            case 'CRITICAL': return 'red';
            case 'NO_DATA': return 'default';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'OK': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'WARNING': return <WarningOutlined style={{ color: '#faad14' }} />;
            case 'CRITICAL': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
            case 'NO_DATA': return <ExclamationCircleOutlined style={{ color: '#aaa' }} />;
            default: return null;
        }
    };

    // Prepare drift table data
    const getDriftTableData = () => {
        if (!driftData?.data?.features) return [];
        return Object.entries(driftData.data.features).map(([name, metrics]: [string, any]) => ({
            key: name,
            feature: name,
            ...metrics,
        }));
    };

    // Prepare bias table data
    const getBiasTableData = () => {
        if (!biasData?.data?.protected_attributes) return [];
        return Object.entries(biasData.data.protected_attributes).map(([name, metrics]: [string, any]) => ({
            key: name,
            attribute: name,
            ...metrics,
        }));
    };

    const driftColumns = [
        {
            title: 'Feature',
            dataIndex: 'feature',
            key: 'feature',
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: 'PSI',
            dataIndex: 'psi',
            key: 'psi',
            render: (psi: number) => (
                <Tooltip title={`PSI: ${psi.toFixed(4)}`}>
                    <Progress
                        percent={Math.min(psi / 0.25 * 100, 100)}
                        size="small"
                        strokeColor={psi > 0.25 ? '#ff4d4f' : psi > 0.1 ? '#faad14' : '#52c41a'}
                        format={() => psi.toFixed(3)}
                    />
                </Tooltip>
            ),
        },
        {
            title: 'KS Statistic',
            dataIndex: 'ks_statistic',
            key: 'ks_statistic',
            render: (ks: number) => ks.toFixed(4),
        },
        {
            title: 'P-Value',
            dataIndex: 'ks_p_value',
            key: 'ks_p_value',
            render: (p: number) => (
                <Tag color={p < 0.05 ? 'red' : 'green'}>{p.toFixed(4)}</Tag>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Space>
                    {getStatusIcon(status)}
                    <Tag color={getStatusColor(status)}>{status}</Tag>
                </Space>
            ),
        },
    ];

    const biasColumns = [
        {
            title: 'Protected Attribute',
            dataIndex: 'attribute',
            key: 'attribute',
            render: (name: string) => <Text strong>{name}</Text>,
        },
        {
            title: (
                <Tooltip title="Difference in fraud prediction rate between the most- and least-flagged demographic group. 0 = perfectly fair. > 0.1 = WARNING, > 0.2 = CRITICAL.">
                    <span style={{ borderBottom: '1px dashed #aaa', cursor: 'help' }}>Demographic Parity Diff ⓘ</span>
                </Tooltip>
            ),
            dataIndex: 'demographic_parity_diff',
            key: 'demographic_parity_diff',
            render: (diff: number) => (
                <Tag color={diff > 0.2 ? 'red' : diff > 0.1 ? 'orange' : 'green'}>
                    {diff.toFixed(3)} {diff > 0.2 ? '⚠ HIGH' : diff > 0.1 ? '⚠' : '✓'}
                </Tag>
            ),
        },
        {
            title: (
                <Tooltip title="Ratio of fraud prediction rate of the least-flagged group vs most-flagged group. 80% Rule: must be ≥ 0.80. Values near 0% mean one group is almost never flagged while another is heavily flagged.">
                    <span style={{ borderBottom: '1px dashed #aaa', cursor: 'help' }}>Disparate Impact ⓘ</span>
                </Tooltip>
            ),
            dataIndex: 'disparate_impact',
            key: 'disparate_impact',
            render: (di: number) => (
                <Tag color={di < 0.7 ? 'red' : di < 0.8 ? 'orange' : 'green'}>
                    {(di * 100).toFixed(1)}% {di < 0.7 ? '⚠ CRITICAL' : di < 0.8 ? '⚠ LOW' : '✓ OK'}
                </Tag>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Space>
                    {getStatusIcon(status)}
                    <Tag color={getStatusColor(status)}>{status}</Tag>
                </Space>
            ),
        },
    ];

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <Title level={2} style={{ margin: 0 }}>Monitoring</Title>
                    <Text type="secondary">Track drift, performance, and bias metrics</Text>
                </div>
                <Space>
                    <Select
                        style={{ minWidth: 380 }}
                        value={modelId}
                        onChange={(val: string) => setModelId(val)}
                        placeholder="Select model"
                        options={models.map(m => {
                            const f1 = m.metrics?.f1 != null
                                ? `F1: ${(m.metrics.f1 * 100).toFixed(1)}%`
                                : 'F1: N/A';
                            const date = m.created_at
                                ? new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '';
                            const label = [m.name || 'Unnamed model', f1, date].filter(Boolean).join(' · ');
                            return {
                                value: m.model_id,
                                label: (
                                    <Space>
                                        <Tag
                                            color={m.status === 'PRODUCTION' ? 'green' : 'blue'}
                                            style={{ margin: 0 }}
                                        >
                                            {m.status || 'MODEL'}
                                        </Tag>
                                        <span title={m.model_id}>{label}</span>
                                    </Space>
                                ),
                            };
                        })}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => refreshMetricsMutation.mutate()}
                        loading={refreshMetricsMutation.isPending}
                    >
                        Refresh Metrics
                    </Button>
                </Space>
            </div>

            {/* Status Summary Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Drift Status"
                            value={
                                driftData?.data?.overall_status === 'NO_DATA'
                                    ? 'Awaiting Data'
                                    : (driftData?.data?.overall_status || 'N/A')
                            }
                            prefix={getStatusIcon(driftData?.data?.overall_status || '')}
                            valueStyle={{
                                color: driftData?.data?.overall_status === 'OK' ? '#3f8600' :
                                    driftData?.data?.overall_status === 'WARNING' ? '#cf9700' :
                                        driftData?.data?.overall_status === 'CRITICAL' ? '#cf1322' : '#888'
                            }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Bias Status"
                            value={
                                biasData?.data?.overall_status === 'NO_DATA'
                                    ? 'Awaiting Data'
                                    : (biasData?.data?.overall_status || 'N/A')
                            }
                            prefix={getStatusIcon(biasData?.data?.overall_status || '')}
                            valueStyle={{
                                color: biasData?.data?.overall_status === 'OK' ? '#3f8600' :
                                    biasData?.data?.overall_status === 'NO_DATA' ? '#888' : '#cf9700'
                            }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Current F1 Score"
                            value={(performanceData?.data?.current?.f1 || 0) * 100}
                            suffix="%"
                            precision={1}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'drift',
                        label: (
                            <span>
                                <LineChartOutlined /> Data Drift
                            </span>
                        ),
                        children: (
                            <Card>
                                {driftData?.data?.overall_status === 'CRITICAL' && (
                                    <Alert
                                        message="Critical Drift Detected"
                                        description="Significant drift has been detected in one or more features. Consider retraining the model."
                                        type="error"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />
                                )}
                                <Table
                                    loading={driftLoading}
                                    dataSource={getDriftTableData()}
                                    columns={driftColumns}
                                    pagination={false}
                                />
                            </Card>
                        ),
                    },
                    {
                        key: 'performance',
                        label: (
                            <span>
                                <LineChartOutlined /> Performance
                            </span>
                        ),
                        children: (
                            <Card title="Current Performance vs Baselines">
                                {performanceLoading || baselinesLoading ? (
                                    <Skeleton active />
                                ) : (
                                    <Row gutter={[16, 16]}>
                                        {[
                                            { key: 'f1', label: 'F1 Score' },
                                            { key: 'precision', label: 'Precision' },
                                            { key: 'recall', label: 'Recall' },
                                            { key: 'auc', label: 'ROC AUC' }
                                        ].map(m => {
                                            const currentVal = (performanceData?.data?.current as any)?.[m.key] || 0;
                                            const baseline = baselinesData?.data?.find((b: any) => b.metric_name === m.key);
                                            const threshold = baseline ? baseline.threshold : null;
                                            // These metrics are strictly "greater than" thresholds.
                                            const passed = threshold !== null ? currentVal >= threshold : true;

                                            return (
                                                <Col span={6} key={m.key}>
                                                    <Card bordered style={{ textAlign: 'center', background: '#fafafa' }}>
                                                        <Progress
                                                            type="dashboard"
                                                            percent={currentVal * 100}
                                                            format={(percent) => `${percent?.toFixed(1)}%`}
                                                            strokeColor={threshold !== null ? (passed ? '#52c41a' : '#ff4d4f') : '#1890ff'}
                                                        />
                                                        <Title level={5} style={{ marginTop: 16 }}>{m.label}</Title>
                                                        <Text type="secondary">
                                                            {threshold !== null ? (
                                                                <>
                                                                    Baseline: <b>{(threshold * 100).toFixed(1)}%</b><br />
                                                                    <Tag color={passed ? 'green' : 'red'} style={{ marginTop: 8 }}>
                                                                        {passed ? 'PASS' : 'FAIL'}
                                                                    </Tag>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    No baseline set<br />
                                                                    <Tag color="default" style={{ marginTop: 8 }}>N/A</Tag>
                                                                </>
                                                            )}
                                                        </Text>
                                                    </Card>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                )}
                            </Card>
                        ),
                    },
                    {
                        key: 'bias',
                        label: (
                            <span>
                                <WarningOutlined /> Bias Detection
                            </span>
                        ),
                        children: (
                            <Card
                                title="Bias / Fairness Detection"
                                extra={
                                    modelId
                                        ? <Tag color="blue">Model: {modelId.slice(0, 8)}…</Tag>
                                        : null
                                }
                            >
                                {biasData?.data?.overall_status === 'CRITICAL' && (
                                    <Alert
                                        message="Critical Bias Detected"
                                        description="One or more protected attributes show a severe disparity in how the model assigns fraud labels. Review the attribute rows below and consider retraining with balanced data."
                                        type="error"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />
                                )}
                                {biasData?.data?.overall_status === 'WARNING' && (
                                    <Alert
                                        message="Bias Warning"
                                        description="Fairness thresholds have been exceeded for one or more protected attributes."
                                        type="warning"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />
                                )}
                                <Table
                                    loading={biasLoading}
                                    dataSource={getBiasTableData()}
                                    columns={biasColumns}
                                    pagination={false}
                                />
                                <div style={{ marginTop: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        <strong>How to interpret:</strong>&nbsp;
                                        <strong>Demographic Parity Diff</strong> — difference in fraud flagging rate between groups (lower is fairer, threshold: &lt;0.1). &nbsp;
                                        <strong>Disparate Impact</strong> — ratio of min group rate ÷ max group rate (higher is fairer, must be ≥80% per the 80% rule). &nbsp;
                                        A value of <strong>0.0%</strong> means one group is <em>never</em> predicted as fraud while another is — a very strong signal.
                                    </Text>
                                </div>
                            </Card>
                        ),
                    },
                ]}
            />
        </div>
    );
}
