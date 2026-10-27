import { useEffect, useRef } from 'react'
import type { Label } from '../../db/types'

// The label picker, in the inspector beside the canvas. It was a row of chips
// in the toolbar, which a real schema of 7 to 18 labels wrapped onto two or
// three lines, taking the height a portrait page needs. From ten labels it
// goes two-up, so eighteen still fit nine rows; the cost is that a long name
// is cut short there, which is why each button carries its name as a title.
export const TWO_COLUMN_FROM = 10

interface LabelListProps {
  labels: Label[]
  selectedLabelId: string | null
  onSelectLabel: (labelId: string) => void
}

export function LabelList({ labels, selectedLabelId, onSelectLabel }: LabelListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedLabelId])

  return (
    <div
      ref={listRef}
      role="group"
      aria-label="Labels"
      className="ts-label-list"
      data-columns={labels.length >= TWO_COLUMN_FROM ? 2 : 1}
    >
      {labels.map((label) => {
        const selected = selectedLabelId === label.id
        return (
          <button
            key={label.id}
            type="button"
            className="ts-label-btn"
            aria-pressed={selected}
            title={label.name}
            onClick={() => onSelectLabel(label.id)}
          >
            <span className="ts-swatch" style={{ background: label.color }} aria-hidden="true" />
            <span className="mono ts-label-name" style={{ fontWeight: selected ? 700 : 400 }}>
              {label.name}
            </span>
            {label.hotkey && (
              <span className="ts-kbd" style={{ minWidth: 17, height: 17, fontSize: 10 }}>
                {label.hotkey}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
