// Plain greedy CTC decoding of one recognised line. The Indra recogniser's ONNX graph already
// takes the per-frame argmax (output `ids`) and that class's probability (output `conf`); what
// is left to do here is the CTC rule: drop blanks (class 0) and collapse runs of the same class.
// No language model, no beam search.

export interface CtcLine {
  // Class ids that survived collapsing and blank removal, in order. A repeated id survives only
  // when a blank or another class sits between its two runs.
  ids: number[]
  // Mean per-frame max probability over the kept frames (0 when nothing was kept).
  meanConf: number
}

export function ctcGreedyDecode(
  ids: ArrayLike<number | bigint>,
  conf: ArrayLike<number>,
  length: number,
): CtcLine {
  const kept: number[] = []
  let confSum = 0
  let prev = -1
  for (let t = 0; t < length; t++) {
    const id = Number(ids[t])
    // Same rule as indra_ocr/pipeline.py: keep = (seq != 0) & (first frame, or differs from the
    // previous frame).
    if (id !== 0 && (t === 0 || id !== prev)) {
      kept.push(id)
      confSum += conf[t]
    }
    prev = id
  }
  return { ids: kept, meanConf: kept.length ? confSum / kept.length : 0 }
}

// Per-frame argmax over a [T][C] logits (or probability) array, for callers that hold raw
// scores instead of the graph's built-in argmax.
export function argmaxFrames(frames: ArrayLike<ArrayLike<number>>): number[] {
  const out: number[] = []
  for (let t = 0; t < frames.length; t++) {
    let best = 0
    for (let c = 1; c < frames[t].length; c++) if (frames[t][c] > frames[t][best]) best = c
    out.push(best)
  }
  return out
}

// Vocabulary: class 0 is the CTC blank, class i is chars[i - 1]. Mirrors indra_ocr/vocab.py's
// Vocab.decode, including the space it inserts after a LaTeX command token that is followed by
// a letter so "\alpha" + "x" does not read back as "\alphax".
export function decodeIds(ids: number[], chars: string[]): string {
  const toks = ids.filter((i) => i > 0 && i <= chars.length).map((i) => chars[i - 1])
  let out = ''
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    out += t
    const next = k + 1 < toks.length ? toks[k + 1] : ''
    if (
      [...t].length > 2 &&
      t[0] === '\\' &&
      /^\p{L}+$/u.test(t.slice(1)) &&
      /^\p{L}/u.test(next)
    ) {
      out += ' '
    }
  }
  return out
}
