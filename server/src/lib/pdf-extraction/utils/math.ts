const clamp = (value: number, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));

const mean = (values: number[]) => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        const left = sorted[mid - 1] ?? 0;
        const right = sorted[mid] ?? left;
        return (left + right) / 2;
    }
    return sorted[mid] ?? 0;
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
    return sorted[index] ?? 0;
};

const stdDev = (values: number[], meanValue: number) => {
    if (!values.length) return 0;
    const variance = values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / values.length;
    return Math.sqrt(variance);
};

export {
    clamp,
    mean,
    median,
    percentile,
    stdDev,
};
