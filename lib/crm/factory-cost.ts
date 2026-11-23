import {fixed, lineAmount} from './decimal';
import type {FlowLine, FlowSnapshot} from './document-flow-model';

function priceFactoryLine(line: FlowLine): FlowLine {
  if (line.costUnitPrice === undefined) return line;
  const costAmount = fixed(line.quantity) === 0n
    ? '0'
    : line.costUnitPrice === null ? null : lineAmount(line.costUnitPrice, line.quantity, 'HALF_UP');
  return {...line, costAmount};
}

export function applyFactoryCostTotals(snapshot: FlowSnapshot): FlowSnapshot {
  if (snapshot.kind !== 'DISPATCH' && snapshot.kind !== 'RECEIPT') return snapshot;
  if (!snapshot.lines.some(line => line.costUnitPrice !== undefined)) return snapshot;

  const lines = snapshot.lines.map(priceFactoryLine);
  let known = 0n;
  let missing = 0;
  for (const line of lines) {
    if (line.costAmount == null) {
      if (fixed(line.quantity) > 0n) missing++;
    } else {
      known += BigInt(line.costAmount);
    }
  }
  const totals: Record<string,string> = {...snapshot.totals, costKnown: known.toString(), costMissing: String(missing)};
  if (missing) delete totals.cost;
  else totals.cost = known.toString();
  return {...snapshot, lines, totals};
}
