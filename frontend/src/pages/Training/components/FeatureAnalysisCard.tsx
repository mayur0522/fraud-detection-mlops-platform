import { useState, useEffect, useMemo } from 'react';
import {
    Card, Tabs, Table, Button, Spin, Alert, Progress,
    Row, Col, Statistic, Slider, Tag, Space, InputNumber,
    Typography, message, Empty, Tooltip, Checkbox, Modal, Input
} from 'antd';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import {
    ReloadOutlined, SaveOutlined, CheckCircleOutlined,
    WarningOutlined, ExperimentOutlined, TableOutlined,
    FileTextOutlined, InfoCircleOutlined, FullscreenOutlined, DownloadOutlined
} from '@ant-design/icons';
import { featureService, FeatureSet } from '@/services/featureService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

type FeatureScoreRow = { name: string; importance: number; mutual_information: number };
type ExpandedFeatureRow = FeatureScoreRow & {
    combined_score?: number | null;
    recommendation: string;
    reason: string;
    status: 'variance' | 'correlation' | 'selected' | 'dropped';
};
type ScoreKey = 'importance' | 'mutual_information';

/** Format API datetime (UTC, possibly without 'Z') to local time string. */
function formatCreatedAt(createdAt: string | null | undefined): string {
    if (!createdAt) return '-';
    const asUtc = (createdAt.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(createdAt)) ? createdAt : createdAt + 'Z';
    return new Date(asUtc).toLocaleString();
}

interface FeatureAnalysisCardProps {
    featureSetId: string;
    onSelectionChange: (selectedFeatures: string[]) => void;
    datasetId?: string;
}

export function FeatureAnalysisCard({
    featureSetId,
    onSelectionChange,
    datasetId
}: FeatureAnalysisCardProps) {
    const [activeTab, setActiveTab] = useState('1');
    const [importanceThreshold, setImportanceThreshold] = useState<number>(0.01);
    const [topN, setTopN] = useState<number>(20);
    // State for auto-trigger
    const [hasTriggeredAutoAnalysis, setHasTriggeredAutoAnalysis] = useState(false);
    const [selectionMode, setSelectionMode] = useState<'threshold' | 'topN'>('topN');
    const [rankByScore, setRankByScore] = useState<ScoreKey>('importance');
    const [previewData, setPreviewData] = useState<{ columns: string[]; rows: any[] } | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [featureTableExpandedOpen, setFeatureTableExpandedOpen] = useState(false);
    const [expandedTableSearch, setExpandedTableSearch] = useState('');
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const [progressStartedAtMs, setProgressStartedAtMs] = useState<number | null>(null);

    const queryClient = useQueryClient();

    // Fetch Preview Data when tab is active
    useEffect(() => {
        if (activeTab === '3' && featureSetId && !previewData) {
            setIsPreviewLoading(true);
            featureService.previewFeatures(featureSetId).then(data => {
                setPreviewData(data);
            }).catch(err => {
                console.error("Failed to load preview:", err);
                message.error("Failed to load feature preview");
            }).finally(() => {
                setIsPreviewLoading(false);
            });
        }
    }, [activeTab, featureSetId, previewData]);

    // Poll for Feature Set Status
    const { data: featureSet, refetch, dataUpdatedAt } = useQuery({
        queryKey: ['featureSet', featureSetId],
        queryFn: ({ signal }) => featureService.getFeatureSet(featureSetId),
        refetchInterval: (query) => {
            const data = query.state.data;
            const status = data?.status;

            // Keep polling if running, queued, or if completed but missing scores (waiting for analysis)
            if (status === 'RUNNING' || status === 'QUEUED') return 1000;

            if (status === 'COMPLETED') {
                const hasScores = data?.selection_report?.scores && Object.keys(data.selection_report.scores).length > 0;
                if (!hasScores && !data?.error_message) {
                    return 1000; // Poll faster to catch the analysis start/finish
                }
            }

            return false;
        }
    });

    const reportForProgress = featureSet?.selection_report as any;
    const hasScoresForProgress = !!(reportForProgress?.scores && Object.keys(reportForProgress.scores).length > 0);
    const isProgressState =
        !featureSet ||
        featureSet.status === 'QUEUED' ||
        featureSet.status === 'RUNNING' ||
        featureSet.status === 'PROCESSING' ||
        (featureSet.status === 'COMPLETED' && !hasScoresForProgress && !reportForProgress?.error);

    const parseApiDateToMs = (value: string | null | undefined): number | null => {
        if (!value) return null;
        const candidates = [
            value,
            value.replace(' ', 'T'),
            value.endsWith('Z') ? value.slice(0, -1) : `${value}Z`,
        ];
        for (const candidate of candidates) {
            const ms = Date.parse(candidate);
            if (Number.isFinite(ms)) return ms;
        }
        return null;
    };

    useEffect(() => {
        // Reset local timer when switching feature sets.
        setProgressStartedAtMs(null);
    }, [featureSetId]);

    useEffect(() => {
        if (!isProgressState) return;

        const parsed = parseApiDateToMs(featureSet?.created_at);
        if (parsed != null) {
            setProgressStartedAtMs(parsed);
            return;
        }

        // Fallback: local start time if API timestamp is temporarily unavailable/invalid.
        setProgressStartedAtMs((prev) => prev ?? Date.now());
    }, [isProgressState, featureSet?.created_at]);

    useEffect(() => {
        if (!isProgressState) return;
        const t = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(t);
    }, [isProgressState]);

    const elapsedSeconds = (() => {
        if (!isProgressState) return 0;
        const startedAt = parseApiDateToMs(featureSet?.created_at) ?? progressStartedAtMs;
        if (!Number.isFinite(startedAt)) return 0;
        return Math.max(0, Math.floor((nowMs - (startedAt as number)) / 1000));
    })();

    const staleSeconds = dataUpdatedAt ? Math.floor((nowMs - dataUpdatedAt) / 1000) : 0;

    const formatElapsed = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const getProgressModel = (): {
        percent: number;
        stageTitle: string;
        hint: string;
    } => {
        if (!featureSet) {
            return {
                percent: 5,
                stageTitle: 'Preparing feature job',
                hint: 'Setting up task and syncing status.',
            };
        }

        const queuePercent = Math.min(18, 8 + Math.floor(elapsedSeconds / 3));
        const runPercent = Math.min(88, 22 + Math.floor(elapsedSeconds * 1.1));
        const analyzePercent = Math.min(98, 90 + Math.floor(elapsedSeconds / 5));

        if (featureSet.status === 'QUEUED') {
            return {
                percent: queuePercent,
                stageTitle: 'Queued',
                hint: 'Worker is waiting to start feature computation.',
            };
        }

        if (featureSet.status === 'RUNNING' || featureSet.status === 'PROCESSING') {
            return {
                percent: runPercent,
                stageTitle: 'Computing engineered features',
                hint: 'Transforming dataset and generating feature artifacts.',
            };
        }

        if (featureSet.status === 'COMPLETED' && !hasScoresForProgress && !reportForProgress?.error) {
            return {
                percent: analyzePercent,
                stageTitle: 'Analyzing feature importance',
                hint: 'Calculating XGBoost importance and mutual information scores.',
            };
        }

        return {
            percent: 100,
            stageTitle: 'Completed',
            hint: 'Feature engineering finished.',
        };
    };

    const analyzeMutation = useMutation({
        mutationFn: () => featureService.analyzeFeatureSet(featureSetId),
        onSuccess: () => {
            message.loading({ content: 'Analysis running...', key: 'analysis' });
            queryClient.invalidateQueries({ queryKey: ['featureSet', featureSetId] });
        },
        onError: () => {
            message.error({ content: 'Failed to trigger analysis', key: 'analysis' });
            setHasTriggeredAutoAnalysis(false); // Reset so we can try again
        }
    });


    // Auto-trigger analysis when Feature Set is ready but no scores in report
    useEffect(() => {
        const report = featureSet?.selection_report as any;
        const hasScores = report?.scores && Object.keys(report.scores).length > 0;

        if (featureSet?.status === 'COMPLETED' && !hasScores && !hasTriggeredAutoAnalysis && !analyzeMutation.isPending) {
            setHasTriggeredAutoAnalysis(true);
            analyzeMutation.mutate();
        }
    }, [featureSet, hasTriggeredAutoAnalysis, analyzeMutation]);

    // Compute Graph Data & Selection (includes both XGBoost importance and Mutual Information)
    const { graphData, selectionStats, recommendedSelection } = useMemo(() => {
        if (!featureSet?.selection_report?.scores) return { graphData: [], selectionStats: null, recommendedSelection: [] as string[] };

        const scores = featureSet.selection_report.scores as Record<string, any>;
        const getScore = (r: FeatureScoreRow): number => rankByScore === 'importance' ? r.importance : r.mutual_information;
        const data: FeatureScoreRow[] = Object.entries(scores)
            .map(([name, metrics]: [string, any]) => ({
                name,
                importance: Number(metrics.importance ?? 0),
                mutual_information: Number(metrics.mutual_information ?? 0)
            }))
            .sort((a, b) => getScore(b) - getScore(a));

        let selected: string[] = [];
        const scoreValue = getScore;

        if (selectionMode === 'topN') {
            selected = data.slice(0, topN).map(d => d.name);
        } else {
            selected = data.filter(d => scoreValue(d) >= importanceThreshold).map(d => d.name);
        }

        return {
            graphData: data,
            selectionStats: {
                selected: selected.length,
                dropped: data.length - selected.length
            },
            recommendedSelection: selected
        };
    }, [featureSet, importanceThreshold, topN, selectionMode, rankByScore]);

    const chartData = useMemo(() => {
        return graphData.filter((d: FeatureScoreRow) => (recommendedSelection as string[]).includes(d.name));
    }, [graphData, recommendedSelection]);

    // Full table for expanded modal: all scores, recommendation, reason, status
    const expandedTableData = useMemo((): ExpandedFeatureRow[] => {
        const report = featureSet?.selection_report as any;
        const scores = report?.scores as Record<string, any> | undefined;
        const removed = report?.removed as { variance_filter?: string[]; correlation_filter?: string[] } | undefined;
        const selectedFeatureNames = (featureSet?.selected_features || []) as string[];
        const allFeatureNames = (featureSet?.all_features || featureSet?.selected_features || []) as string[];

        if (scores && Object.keys(scores).length > 0) {
            return Object.entries(scores).map(([name, m]: [string, any]) => {
                const inVar = removed?.variance_filter?.includes(name);
                const inCorr = removed?.correlation_filter?.includes(name);
                const isSelectedByReport = m?.recommendation === 'selected';
                const isSelectedByList = selectedFeatureNames.includes(name);
                let status: ExpandedFeatureRow['status'] = 'dropped';
                if (inVar) status = 'variance';
                else if (inCorr) status = 'correlation';
                else if (isSelectedByReport || isSelectedByList) status = 'selected';
                return {
                    name,
                    importance: Number(m?.importance ?? 0),
                    mutual_information: Number(m?.mutual_information ?? 0),
                    combined_score: m?.combined_score != null ? Number(m.combined_score) : null,
                    recommendation: isSelectedByReport || isSelectedByList ? 'selected' : (m?.recommendation ?? 'dropped'),
                    reason: m?.reason ?? '—',
                    status,
                };
            });
        }
        // No scores yet (e.g. before analysis): build table from all_features so selected features are visible
        if (allFeatureNames.length === 0) return [];
        return allFeatureNames.map((name) => {
            const isSelected = selectedFeatureNames.includes(name);
            return {
                name,
                importance: 0,
                mutual_information: 0,
                combined_score: null,
                recommendation: isSelected ? 'selected' : 'dropped',
                reason: isSelected ? 'Selected for training.' : '—',
                status: (isSelected ? 'selected' : 'dropped') as ExpandedFeatureRow['status'],
            };
        });
    }, [featureSet?.selection_report, featureSet?.selected_features, featureSet?.all_features]);

    const filteredExpandedData = useMemo(() => {
        if (!expandedTableSearch.trim()) return expandedTableData;
        const q = expandedTableSearch.trim().toLowerCase();
        return expandedTableData.filter((r) => r.name.toLowerCase().includes(q));
    }, [expandedTableData, expandedTableSearch]);

    // Aggregation for expanded modal: selected vs rejected (with breakdown)
    const expandedAggregation = useMemo(() => {
        const selected = expandedTableData.filter((r) => r.status === 'selected').length;
        const variance = expandedTableData.filter((r) => r.status === 'variance').length;
        const correlation = expandedTableData.filter((r) => r.status === 'correlation').length;
        const dropped = expandedTableData.filter((r) => r.status === 'dropped').length;
        const rejected = variance + correlation + dropped;
        return { selected, rejected, variance, correlation, dropped };
    }, [expandedTableData]);

    const renderVisualizationTab = () => {
        const report = featureSet?.selection_report as any;
        const hasScores = report?.scores && Object.keys(report.scores).length > 0;
        const progressModel = getProgressModel();

        const progressPanel = (
            <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
                <Card bordered style={{ borderRadius: 12 }}>
                    <Row gutter={24} align="middle">
                        <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                            <Progress
                                type="circle"
                                percent={progressModel.percent}
                                width={128}
                                status="active"
                                format={(p) => `${p}%`}
                            />
                        </Col>
                        <Col xs={24} md={16}>
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Title level={5} style={{ margin: 0 }}>
                                    {progressModel.stageTitle}
                                </Title>
                                <Text type="secondary">{progressModel.hint}</Text>
                                <Text type="secondary">
                                    Elapsed: {formatElapsed(elapsedSeconds)}
                                </Text>
                                <Progress
                                    percent={progressModel.percent}
                                    status="active"
                                    strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                                />
                                {staleSeconds >= 25 && (
                                    <Alert
                                        type="info"
                                        showIcon
                                        message="Still working in background"
                                        description="This can take longer on larger datasets. You can refresh status anytime."
                                        action={
                                            <Button size="small" onClick={() => refetch()}>
                                                Refresh Status
                                            </Button>
                                        }
                                    />
                                )}
                            </Space>
                        </Col>
                    </Row>
                </Card>
            </div>
        );

        // Loading State (Initial or Analyzing)
        if (!featureSet || analyzeMutation.isPending || (featureSet.status === 'COMPLETED' && !hasScores && !report?.error)) {
            return progressPanel;
        }

        // Processing State
        if (featureSet.status === 'RUNNING' || featureSet.status === 'QUEUED' || featureSet.status === 'PROCESSING') {
            return progressPanel;
        }

        // Check for error in report
        if (report?.error) {
            return (
                <div style={{ padding: 24 }}>
                    <Alert
                        type="warning"
                        showIcon
                        message="Analysis Incomplete"
                        description={report.error}
                        action={
                            <Button size="small" type="primary" onClick={() => analyzeMutation.mutate()}>
                                Retry Analysis
                            </Button>
                        }
                    />
                    <div style={{ marginTop: 24, textAlign: 'center' }}>
                        <ExperimentOutlined style={{ fontSize: 48, color: '#faad14' }} />
                        <Title level={5} style={{ marginTop: 16 }}>Visualization Unavailable</Title>
                        <Paragraph type="secondary">
                            We couldn't verify the target column to calculate feature importance scores.
                            Please check your dataset schema or retry.
                        </Paragraph>
                    </div>
                </div>
            );
        }

        // Dynamic chart height: each bar gets 28px, minimum 300px
        const dynamicChartHeight = Math.max(300, chartData.length * 28 + 40);
        const stages = report?.stages as { original?: number; after_variance?: number; after_correlation?: number; final_selected?: number } | undefined;
        const removed = report?.removed as { variance_filter?: string[]; correlation_filter?: string[] } | undefined;
        const varRemoved = removed?.variance_filter?.length ?? 0;
        const corrRemoved = removed?.correlation_filter?.length ?? 0;
        const orig = stages?.original ?? graphData.length;
        const afterVar = stages?.after_variance ?? orig;
        const afterCorr = stages?.after_correlation ?? afterVar;

        return (
            <>
                {/* Pipeline summary */}
                {stages && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                        <Text strong style={{ marginRight: 8 }}>Pipeline:</Text>
                        <Text type="secondary">
                            {orig} Total → {afterVar} after variance filter ({varRemoved} removed) → {afterCorr} after correlation filter ({corrRemoved} removed)
                        </Text>
                    </div>
                )}
                {/* Scoring methodology */}
                <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 12 }}>
                    <Text strong>Scoring:</Text> Features are ranked by XGBoost model importance (contribution to prediction) and by Mutual Information (Information Gain with the target). Both metrics are computed independently; use the toggle below to rank by either.
                </Paragraph>

                <Row gutter={24}>
                    {/* Left: Visualization — only selected features shown */}
                    <Col span={16} style={{ display: 'flex', flexDirection: 'column' }}>
                        <Card
                            title={`Feature ${rankByScore === 'importance' ? 'XGBoost Importance' : 'Mutual Information'} (${chartData.length} of ${graphData.length} selected)`}
                            size="small"
                            style={{ display: 'flex', flexDirection: 'column' }}
                            bodyStyle={{ overflowY: 'auto', maxHeight: 620, padding: '12px 12px 0' }}
                        >
                            <div style={{ width: '100%', height: dynamicChartHeight }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" domain={[0, (dataMax: number) => Math.max(dataMax * 1.05, 0.1)]} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={180}
                                            tick={{ fontSize: 12 }}
                                            interval={0}
                                        />
                                        <RechartsTooltip
                                            content={({ active, payload }: any) => {
                                                if (!active || !payload?.length) return null;
                                                const p = payload[0].payload;
                                                return (
                                                    <div style={{ background: '#fff', padding: 10, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e8e8e8' }}>
                                                        <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
                                                        <div>XGBoost Importance: {p.importance.toFixed(4)}</div>
                                                        <div>Mutual Information: {p.mutual_information.toFixed(4)}</div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        {selectionMode === 'threshold' && (
                                            <ReferenceLine x={importanceThreshold} stroke="red" strokeDasharray="3 3" label="Threshold" />
                                        )}
                                        <Bar dataKey={rankByScore} fill="#1890ff" radius={[0, 4, 4, 0]}>
                                            {chartData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill="#1890ff" />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Right: Controls & Table */}
                    <Col span={8} style={{ maxHeight: 660, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Card title="Selection Controls" size="small" style={{ marginBottom: 16 }}>
                            <div style={{ marginBottom: 24 }}>
                                {/* Rank by: XGBoost vs Mutual Information */}
                                <div style={{ marginBottom: 12 }}>
                                    <Text strong style={{ display: 'block', marginBottom: 6 }}>Rank by</Text>
                                    <Space>
                                        <Button
                                            size="small"
                                            type={rankByScore === 'importance' ? 'primary' : 'default'}
                                            onClick={() => setRankByScore('importance')}
                                        >
                                            XGBoost Importance
                                        </Button>
                                        <Button
                                            size="small"
                                            type={rankByScore === 'mutual_information' ? 'primary' : 'default'}
                                            onClick={() => setRankByScore('mutual_information')}
                                        >
                                            Mutual Information
                                        </Button>
                                    </Space>
                                </div>

                                {/* Mode Toggle */}
                                <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                                    <Button
                                        size="small"
                                        type={selectionMode === 'topN' ? 'primary' : 'default'}
                                        onClick={() => setSelectionMode('topN')}
                                    >
                                        Top N
                                    </Button>
                                    <Button
                                        size="small"
                                        type={selectionMode === 'threshold' ? 'primary' : 'default'}
                                        onClick={() => setSelectionMode('threshold')}
                                    >
                                        Threshold
                                    </Button>
                                </div>

                                {selectionMode === 'threshold' ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text strong>Score Threshold</Text>
                                            <InputNumber
                                                size="small"
                                                min={0}
                                                max={1}
                                                step={0.001}
                                                value={importanceThreshold}
                                                onChange={(v) => setImportanceThreshold(v || 0.01)}
                                                style={{ width: 80 }}
                                            />
                                        </div>
                                        <Slider
                                            min={0}
                                            max={Math.max(...(graphData?.map(d => d[rankByScore] as number) ?? [0.1]), 0.1)}
                                            step={0.001}
                                            value={importanceThreshold}
                                            onChange={setImportanceThreshold}
                                            tooltip={{ formatter: (v) => v?.toFixed(4) }}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text strong>Select Top Features</Text>
                                            <InputNumber
                                                size="small"
                                                min={1}
                                                max={graphData?.length}
                                                value={topN}
                                                onChange={(v) => setTopN(v || 10)}
                                                style={{ width: 60 }}
                                            />
                                        </div>
                                        <Slider
                                            min={1}
                                            max={graphData?.length || 20}
                                            value={topN}
                                            onChange={(v: number) => setTopN(v)}
                                        />
                                        <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                                            Top {topN} features by {rankByScore === 'importance' ? 'XGBoost Importance' : 'Mutual Information'}.
                                        </Paragraph>
                                    </>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                                    <Text type="secondary">Selected: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{selectionStats?.selected}</span></Text>
                                    <Text type="secondary">Dropped: {selectionStats?.dropped}</Text>
                                </div>
                            </div>
                        </Card>

                        <Card
                            title="Feature List"
                            size="small"
                            style={{ flex: 1, overflow: 'hidden' }}
                            bodyStyle={{ height: '100%', overflowY: 'auto', padding: 0 }}
                            extra={
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<FullscreenOutlined />}
                                    onClick={() => setFeatureTableExpandedOpen(true)}
                                >
                                    Open full feature table
                                </Button>
                            }
                        >
                            <Table
                                dataSource={graphData}
                                rowKey="name"
                                size="small"
                                pagination={false}
                                sticky
                                columns={[
                                    {
                                        title: 'Feature',
                                        dataIndex: 'name',
                                        key: 'name',
                                        render: (t: string) => {
                                            const isSelected = (recommendedSelection as string[]).includes(t as string);
                                            return (
                                                <Text delete={!isSelected} type={!isSelected ? 'secondary' : undefined}>
                                                    {isSelected && <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />}
                                                    {t}
                                                </Text>
                                            )
                                        }
                                    },
                                    {
                                        title: 'XGBoost',
                                        dataIndex: 'importance',
                                        key: 'importance',
                                        width: 80,
                                        render: (v: number) => (v ?? 0).toFixed(4),
                                        sorter: (a: { importance: number }, b: { importance: number }) => a.importance - b.importance,
                                        defaultSortOrder: 'descend'
                                    },
                                    {
                                        title: 'MI Score',
                                        dataIndex: 'mutual_information',
                                        key: 'mi',
                                        width: 80,
                                        render: (v: number) => (v ?? 0).toFixed(4),
                                        sorter: (a: { mutual_information: number }, b: { mutual_information: number }) => a.mutual_information - b.mutual_information
                                    },
                                    {
                                        title: 'Status',
                                        key: 'status',
                                        width: 120,
                                        render: (_: unknown, row: FeatureScoreRow) => {
                                            const inVar = ((removed?.variance_filter || []) as string[]).includes(row.name);
                                            const inCorr = ((removed?.correlation_filter || []) as string[]).includes(row.name);
                                            const isSelected = (recommendedSelection as string[]).includes(row.name);
                                            if (inVar) return <Tag color="orange">Dropped (variance)</Tag>;
                                            if (inCorr) return <Tag color="volcano">Dropped (correlation)</Tag>;
                                            return isSelected ? <Tag color="green">Selected</Tag> : <Tag>Dropped</Tag>;
                                        }
                                    }
                                ]}
                            />
                        </Card>
                    </Col>
                </Row>
            </>
        );
    };

    const renderMetadataTab = () => (
        <Card>
            <Typography>
                <Title level={4}>Artifact Metadata</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <Statistic title="Feature Set Name" value={featureSet?.name} prefix={<FileTextOutlined />} />
                    <Statistic title="Status" value={featureSet?.status} valueStyle={{ color: featureSet?.status === 'COMPLETED' ? '#3f8600' : '#cf1322' }} />
                    <Statistic title="Dataset ID" value={featureSet?.dataset_id} groupSeparator="" formatter={(v) => <Text copyable>{v}</Text>} />
                    <Statistic title="Created At" value={formatCreatedAt(featureSet?.created_at)} />
                    <Statistic title="Total Features" value={featureSet?.all_features?.length ?? featureSet?.feature_count ?? 'N/A'} />
                    <Statistic title="Selected Features" value={selectionStats?.selected || featureSet?.selected_feature_count} />
                    <Statistic title="Input Rows" value={featureSet?.input_rows?.toLocaleString() ?? 'N/A'} />
                    <Statistic
                        title="Dataset Shape"
                        value={featureSet?.input_rows != null && featureSet?.feature_count != null
                            ? `${featureSet.input_rows.toLocaleString()} x ${featureSet.feature_count}`
                            : 'N/A'}
                    />
                    <Statistic title="Version" value={featureSet?.version ?? 'N/A'} />
                    <Statistic
                        title="Processing Time"
                        value={featureSet?.processing_time_seconds != null
                            ? featureSet.processing_time_seconds < 60
                                ? `${featureSet.processing_time_seconds}s`
                                : `${Math.floor(featureSet.processing_time_seconds / 60)}m ${featureSet.processing_time_seconds % 60}s`
                            : 'N/A'}
                    />
                </div>
            </Typography>
        </Card>
    );

    const downloadPreviewCsv = () => {
        if (!previewData?.columns?.length || !previewData?.rows?.length) return;
        const headers = previewData.columns;
        const rows = previewData.rows.map((row: any) =>
            headers.map((col: string) => {
                const val = row[col];
                const str = val == null ? '' : String(val);
                return `"${str.replace(/"/g, '""')}"`;
            }).join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feature-preview-${featureSetId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('Preview downloaded');
    };

    const renderPreviewTab = () => (
        <Card title="Raw Data Preview (Top 50 Rows)">
            {isPreviewLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin tip="Loading preview data..." />
                </div>
            ) : !previewData && !isPreviewLoading ? (
                <Empty description="No preview data available" />
            ) : (
                <>
                    <Table
                        dataSource={previewData?.rows || []}
                        columns={previewData?.columns?.map(col => ({
                            title: col,
                            dataIndex: col,
                            key: col,
                            width: 120,
                            ellipsis: true
                        }))}
                        scroll={{ x: 'max-content', y: 500 }}
                        size="small"
                        pagination={false}
                        bordered
                    />
                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                        <Button type="primary" icon={<DownloadOutlined />} onClick={downloadPreviewCsv}>
                            Download preview (CSV)
                        </Button>
                    </div>
                </>
            )}
        </Card>
    );

    const report = featureSet?.selection_report as any;
    const stages = report?.stages as { original?: number; after_variance?: number; after_correlation?: number; final_selected?: number } | undefined;
    const removed = report?.removed as { variance_filter?: string[]; correlation_filter?: string[] } | undefined;
    const configUsed = report?.config_used as Record<string, number> | undefined;
    const pipelineSummary = stages
        ? `${stages.original ?? 0} Total → ${stages.after_variance ?? 0} after variance filter (${removed?.variance_filter?.length ?? 0} removed) → ${stages.after_correlation ?? 0} after correlation filter (${removed?.correlation_filter?.length ?? 0} removed) → ${stages.final_selected ?? 0} selected`
        : '';

    const exportExpandedCsv = () => {
        const headers = ['Feature', 'XGBoost Importance', 'MI Score', 'Combined Score', 'Recommendation', 'Reason', 'Status'];
        const rows = filteredExpandedData.map((r: ExpandedFeatureRow) => [
            r.name,
            r.importance.toFixed(4),
            r.mutual_information.toFixed(4),
            r.combined_score != null ? r.combined_score.toFixed(4) : '',
            r.recommendation,
            r.reason,
            r.status,
        ]);
        const csv = [headers.join(','), ...rows.map((row: (string | number)[]) => row.map((c: string | number) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feature-selection-detail-${featureSetId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('CSV downloaded');
    };

    return (
        <div style={{ height: '100%' }}>
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                type="card"
                items={[
                    {
                        key: '1',
                        label: <span><ExperimentOutlined /> Visualization & Selection</span>,
                        children: renderVisualizationTab()
                    },
                    {
                        key: '2',
                        label: <span><InfoCircleOutlined /> Metadata</span>,
                        children: renderMetadataTab()
                    },
                    {
                        key: '3',
                        label: <span><TableOutlined /> Preview</span>,
                        children: renderPreviewTab()
                    }
                ]}
            />
            <Modal
                title="Feature selection detail — review before training"
                open={featureTableExpandedOpen}
                onCancel={() => setFeatureTableExpandedOpen(false)}
                width={Math.min(1200, typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1200)}
                footer={[
                    <Button key="export" icon={<DownloadOutlined />} onClick={exportExpandedCsv}>
                        Export CSV
                    </Button>,
                    <Button key="close" type="primary" onClick={() => setFeatureTableExpandedOpen(false)}>
                        Close
                    </Button>,
                ]}
            >
                <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    All scores and parameters used for feature selection. Review carefully; training is time-consuming and has cost implications.
                </Paragraph>
                {pipelineSummary && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                        <Text strong style={{ marginRight: 8 }}>Pipeline:</Text>
                        <Text type="secondary">{pipelineSummary}</Text>
                    </div>
                )}
                {configUsed && Object.keys(configUsed).length > 0 && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, fontSize: 12 }}>
                        <Text strong style={{ marginRight: 8 }}>Config used:</Text>
                        <Text type="secondary">
                            variance_threshold={configUsed.variance_threshold}, correlation_threshold={configUsed.correlation_threshold}, max_features={configUsed.max_features}, mi_weight={configUsed.mi_weight}, importance_weight={configUsed.importance_weight}
                        </Text>
                    </div>
                )}
                <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                    <Space size="middle">
                        <Statistic title="Selected" value={expandedAggregation.selected} valueStyle={{ color: '#52c41a' }} />
                        <Statistic title="Rejected" value={expandedAggregation.rejected} valueStyle={{ color: '#cf1322' }} />
                        {expandedAggregation.rejected > 0 && (
                            <Space size="small" style={{ marginLeft: 8 }}>
                                <Tag color="orange">Variance: {expandedAggregation.variance}</Tag>
                                <Tag color="volcano">Correlation: {expandedAggregation.correlation}</Tag>
                                <Tag>Dropped: {expandedAggregation.dropped}</Tag>
                            </Space>
                        )}
                    </Space>
                </div>
                <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                    <Input.Search
                        placeholder="Search by feature name"
                        allowClear
                        value={expandedTableSearch}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpandedTableSearch(e.target.value)}
                        style={{ maxWidth: 280 }}
                    />
                </div>
                <Table<ExpandedFeatureRow>
                    dataSource={filteredExpandedData}
                    rowKey="name"
                    size="small"
                    scroll={{ x: 900, y: 400 }}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `Total ${t} features` }}
                    columns={[
                        { title: 'Feature', dataIndex: 'name', key: 'name', width: 160, fixed: 'left', sorter: (a: ExpandedFeatureRow, b: ExpandedFeatureRow) => a.name.localeCompare(b.name) },
                        { title: 'XGBoost Importance', dataIndex: 'importance', key: 'importance', width: 120, sorter: (a: ExpandedFeatureRow, b: ExpandedFeatureRow) => a.importance - b.importance, render: (v: number) => (v ?? 0).toFixed(4) },
                        { title: 'MI Score', dataIndex: 'mutual_information', key: 'mi', width: 100, sorter: (a: ExpandedFeatureRow, b: ExpandedFeatureRow) => a.mutual_information - b.mutual_information, render: (v: number) => (v ?? 0).toFixed(4) },
                        { title: 'Combined Score', dataIndex: 'combined_score', key: 'combined_score', width: 120, sorter: (a: ExpandedFeatureRow, b: ExpandedFeatureRow) => (a.combined_score ?? -1) - (b.combined_score ?? -1), render: (v: number | null) => v != null ? v.toFixed(4) : '—' },
                        { title: 'Recommendation', dataIndex: 'recommendation', key: 'recommendation', width: 100, sorter: (a: ExpandedFeatureRow, b: ExpandedFeatureRow) => a.recommendation.localeCompare(b.recommendation), render: (v: string) => <Tag color={v === 'selected' ? 'green' : 'default'}>{v}</Tag> },
                        { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true, render: (t: string) => <Tooltip title={t}><span>{t}</span></Tooltip> },
                        { title: 'Status', dataIndex: 'status', key: 'status', width: 120, sorter: (a: ExpandedFeatureRow, b: ExpandedFeatureRow) => a.status.localeCompare(b.status), render: (s: string) => { if (s === 'variance') return <Tag color="orange">Dropped (variance)</Tag>; if (s === 'correlation') return <Tag color="volcano">Dropped (correlation)</Tag>; if (s === 'selected') return <Tag color="green">Selected</Tag>; return <Tag>Dropped</Tag>; } },
                    ]}
                />
            </Modal>
        </div>
    );
}


