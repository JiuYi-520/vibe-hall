import { splitHighlight } from '../lib/highlight'

interface HighlightedProps {
  text: string
  query?: string
}

/** 命中部分用 <mark> 标出；没有查询词时直接返回纯文本。 */
export function Highlighted({ text, query }: HighlightedProps) {
  if (!query || !query.trim()) return <>{text}</>
  return (
    <>
      {splitHighlight(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={`${segment.text}-${index}`} className="hl">
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ),
      )}
    </>
  )
}
