export type MptAsset = {
  key: string;
  name: string;
  expectedReturn: number;
  volatility: number;
  weight: number;
  color: string;
};

export type FrontierPoint = {
  risk: number;
  ret: number;
  weights: number[];
  sharpe: number;
};

export function covarianceMatrix(assets: MptAsset[], correlations: number[][]) {
  return assets.map((asset, i) =>
    assets.map((other, j) => correlations[i][j] * asset.volatility * other.volatility),
  );
}

export function portfolioMetrics(assets: MptAsset[], correlations: number[][], weights?: number[], riskFree = 2.5) {
  const w = (weights ?? assets.map((asset) => asset.weight)).map((value) => value / 100);
  const covariance = covarianceMatrix(assets, correlations);
  const expectedReturn = assets.reduce((sum, asset, index) => sum + w[index] * asset.expectedReturn, 0);
  let variance = 0;
  for (let i = 0; i < assets.length; i += 1) {
    for (let j = 0; j < assets.length; j += 1) variance += w[i] * w[j] * covariance[i][j];
  }
  const volatility = Math.sqrt(Math.max(variance, 0));
  const sharpe = volatility > 0 ? (expectedReturn - riskFree) / volatility : 0;
  const marginal = covariance.map((row) => row.reduce((sum, value, j) => sum + value * w[j], 0) / Math.max(volatility, 1e-9));
  const riskContribution = marginal.map((value, index) => w[index] * value);
  return { expectedReturn, volatility, sharpe, riskContribution };
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(values: number[]) {
  const sum = values.reduce((total, value) => total + value, 0);
  return values.map((value) => (value / sum) * 100);
}

export function frontierSamples(assets: MptAsset[], correlations: number[][], allowShort = false, seed = 42) {
  const random = mulberry32(seed);
  const points = [] as Array<{ risk: number; ret: number; sharpe: number; weights: number[] }>;
  for (let sample = 0; sample < 2200; sample += 1) {
    let weights: number[];
    if (allowShort) {
      const raw = assets.map(() => random() * 1.8 - 0.4);
      const sum = raw.reduce((total, value) => total + value, 0);
      if (Math.abs(sum) < 0.1) continue;
      weights = raw.map((value) => (value / sum) * 100);
      if (weights.some((value) => value < -50 || value > 150)) continue;
    } else {
      weights = normalize(assets.map(() => -Math.log(Math.max(random(), 1e-8))));
    }
    const metrics = portfolioMetrics(assets, correlations, weights);
    points.push({ risk: metrics.volatility, ret: metrics.expectedReturn, sharpe: metrics.sharpe, weights });
  }
  return points;
}

export function efficientEnvelope(points: Array<{ risk: number; ret: number }>) {
  if (!points.length) return [];
  const minRisk = Math.min(...points.map((point) => point.risk));
  const maxRisk = Math.max(...points.map((point) => point.risk));
  const bins = 48;
  const result: Array<{ risk: number; ret: number }> = [];
  for (let index = 0; index < bins; index += 1) {
    const low = minRisk + ((maxRisk - minRisk) * index) / bins;
    const high = minRisk + ((maxRisk - minRisk) * (index + 1)) / bins;
    const bucket = points.filter((point) => point.risk >= low && point.risk < high);
    if (!bucket.length) continue;
    const best = bucket.reduce((a, b) => (a.ret > b.ret ? a : b));
    result.push({ risk: best.risk, ret: best.ret });
  }
  return result.sort((a, b) => a.risk - b.risk);
}

function invert(matrix: number[][]) {
  const size = matrix.length;
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: size }, (_, j) => i === j ? 1 : 0)]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    if (Math.abs(augmented[pivot][column]) < 1e-9) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    augmented[column] = augmented[column].map((value) => value / divisor);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      augmented[row] = augmented[row].map((value, index) => value - factor * augmented[column][index]);
    }
  }
  return augmented.map((row) => row.slice(size));
}

function multiply(matrix: number[][], vector: number[]) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

export function minimumVariancePortfolio(assets: MptAsset[], correlations: number[][], longOnly = true, riskFree = 2.5) {
  const covariance = covarianceMatrix(assets, correlations);
  const subsets: number[][] = [];
  if (longOnly) {
    for (let mask = 1; mask < 2 ** assets.length; mask += 1) {
      subsets.push(assets.map((_, index) => index).filter((index) => mask & (1 << index)));
    }
  } else subsets.push(assets.map((_, index) => index));
  let best: FrontierPoint | null = null;
  for (const subset of subsets) {
    let subsetWeights: number[];
    if (subset.length === 1) {
      subsetWeights = [1];
    } else {
      const sigma = subset.map((i) => subset.map((j) => covariance[i][j]));
      const inverse = invert(sigma);
      if (!inverse) continue;
      const inverseOnes = multiply(inverse, subset.map(() => 1));
      const total = inverseOnes.reduce((sum, value) => sum + value, 0);
      if (Math.abs(total) < 1e-10) continue;
      subsetWeights = inverseOnes.map((value) => value / total);
    }
    if (longOnly && subsetWeights.some((weight) => weight < -1e-7)) continue;
    const fullWeights = assets.map(() => 0);
    subset.forEach((assetIndex, index) => { fullWeights[assetIndex] = Math.abs(subsetWeights[index]) < 1e-10 ? 0 : subsetWeights[index] * 100; });
    const metrics = portfolioMetrics(assets, correlations, fullWeights, riskFree);
    const candidate = { risk: metrics.volatility, ret: metrics.expectedReturn, weights: fullWeights, sharpe: metrics.sharpe };
    if (!best || candidate.risk < best.risk) best = candidate;
  }
  return best;
}

export function minimumVariancePortfolioForReturn(assets: MptAsset[], correlations: number[][], target: number, longOnly = true, riskFree = 2.5) {
  const covariance = covarianceMatrix(assets, correlations);
  const subsets: number[][] = [];
  if (longOnly) {
    for (let mask = 1; mask < 2 ** assets.length; mask += 1) {
      const indices = assets.map((_, index) => index).filter((index) => mask & (1 << index));
      subsets.push(indices);
    }
  } else subsets.push(assets.map((_, index) => index));
  let best: FrontierPoint | null = null;
  for (const subset of subsets) {
    let subsetWeights: number[];
    if (subset.length === 1) {
      if (Math.abs(assets[subset[0]].expectedReturn - target) > 1e-7) continue;
      subsetWeights = [1];
    } else {
      const sigma = subset.map((i) => subset.map((j) => covariance[i][j]));
      const inverse = invert(sigma);
      if (!inverse) continue;
      const ones = subset.map(() => 1);
      const mu = subset.map((index) => assets[index].expectedReturn);
      const inverseOnes = multiply(inverse, ones);
      const inverseMu = multiply(inverse, mu);
      const a = ones.reduce((sum, value, index) => sum + value * inverseOnes[index], 0);
      const b = ones.reduce((sum, value, index) => sum + value * inverseMu[index], 0);
      const c = mu.reduce((sum, value, index) => sum + value * inverseMu[index], 0);
      const determinant = a * c - b * b;
      if (Math.abs(determinant) < 1e-8) continue;
      const alpha = (c - b * target) / determinant;
      const beta = (a * target - b) / determinant;
      subsetWeights = inverseOnes.map((value, index) => alpha * value + beta * inverseMu[index]);
    }
    if (longOnly && subsetWeights.some((weight) => weight < -1e-7)) continue;
    const fullWeights = assets.map(() => 0);
    subset.forEach((assetIndex, index) => { fullWeights[assetIndex] = Math.abs(subsetWeights[index]) < 1e-10 ? 0 : subsetWeights[index] * 100; });
    const metrics = portfolioMetrics(assets, correlations, fullWeights, riskFree);
    const candidate = { risk: metrics.volatility, ret: metrics.expectedReturn, weights: fullWeights, sharpe: metrics.sharpe };
    if (!best || candidate.risk < best.risk) best = candidate;
  }
  return best;
}

export function exactEfficientFrontier(assets: MptAsset[], correlations: number[][], longOnly = true, steps = 90, riskFree = 2.5, fullFrontier = false) {
  const minReturn = Math.min(...assets.map((asset) => asset.expectedReturn));
  const maxReturn = Math.max(...assets.map((asset) => asset.expectedReturn));
  const returnSpan = Math.max(maxReturn - minReturn, 1);
  const low = longOnly ? minReturn : minReturn - returnSpan;
  const high = longOnly ? maxReturn : maxReturn + returnSpan;
  const points: FrontierPoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const target = low + ((high - low) * step) / steps;
    const point = minimumVariancePortfolioForReturn(assets, correlations, target, longOnly, riskFree);
    if (point) points.push(point);
  }
  const minimumVariance = minimumVariancePortfolio(assets, correlations, longOnly, riskFree);
  if (minimumVariance) points.push(minimumVariance);
  if (!points.length) return [];
  const byReturn = points.sort((a, b) => a.ret - b.ret);
  if (!longOnly && fullFrontier) return byReturn;
  const minimumIndex = byReturn.reduce((best, point, index) => point.risk < byReturn[best].risk ? index : best, 0);
  return byReturn.slice(minimumIndex).sort((a, b) => a.risk - b.risk);
}

export function unconstrainedFrontier(assets: MptAsset[], correlations: number[][], stepsPerReturnSpan = 90, riskFree = 2.5) {
  return exactEfficientFrontier(assets, correlations, false, stepsPerReturnSpan * 3, riskFree, true);
}

export function isPositiveSemidefinite(matrix: number[][]) {
  const n = matrix.length;
  const lower = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k += 1) sum -= lower[i][k] * lower[j][k];
      if (i === j) {
        if (sum < -1e-7) return false;
        lower[i][j] = Math.sqrt(Math.max(sum, 1e-10));
      } else lower[i][j] = sum / lower[j][j];
    }
  }
  return true;
}

function standardNormal(random: () => number) {
  const u = Math.max(random(), 1e-9);
  const v = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulatePortfolio(assets: MptAsset[], correlations: number[][], years = 10, seed = 20260909) {
  const random = mulberry32(seed);
  const metrics = portfolioMetrics(assets, correlations);
  const months = years * 12;
  const paths: Array<Array<{ month: number; value: number }>> = [];
  for (let path = 0; path < 10; path += 1) {
    let value = 1000;
    const series = [{ month: 0, value }];
    for (let month = 1; month <= months; month += 1) {
      const shock = standardNormal(random);
      const monthlyReturn = metrics.expectedReturn / 1200 + (metrics.volatility / 100 / Math.sqrt(12)) * shock;
      value = Math.max(0, value * (1 + monthlyReturn));
      series.push({ month, value });
    }
    paths.push(series);
  }
  return paths;
}

export function simulationSigmaBands(expectedReturn: number, volatility: number, years = 10, initialValue = 1000) {
  const annualReturn = expectedReturn / 100;
  const annualVolatility = volatility / 100;
  return Array.from({ length: years * 12 + 1 }, (_, month) => {
    const elapsedYears = month / 12;
    const baseline = initialValue * Math.exp(annualReturn * elapsedYears);
    const logReturnSigma = annualVolatility * Math.sqrt(elapsedYears);
    return {
      month,
      expected: baseline,
      plusSigma: baseline * Math.exp(logReturnSigma),
      minusSigma: baseline * Math.exp(-logReturnSigma),
    };
  });
}
