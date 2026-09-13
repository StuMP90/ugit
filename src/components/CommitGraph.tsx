import type { CommitInfo, RepoStatus, Selection } from "../types";

const ROW_HEIGHT = 30;
const LANE_WIDTH = 16;
const LANE_PAD = 10;
const LANE_COLORS = [
  "#4f9dde",
  "#e0763e",
  "#5fbf6f",
  "#c25fd0",
  "#d9c04a",
  "#e05f7e",
  "#48b8b0",
  "#9a7fe0",
];

function laneColor(lane: number) {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

function formatDate(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  commits: CommitInfo[];
  status: RepoStatus | null;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  matchIds?: Set<string>;
}

export default function CommitGraph({ commits, status, selection, onSelect, matchIds }: Props) {
  const hasChanges =
    !!status &&
    (status.staged.length > 0 || status.unstaged.length > 0 || status.conflicted.length > 0);

  const workingLane = commits.length > 0 ? commits[0].lane : 0;
  const rows = hasChanges ? commits.length + 1 : commits.length;
  const maxLane = Math.max(
    workingLane,
    ...commits.map((c) => Math.max(c.lane, ...c.parent_lanes, 0)),
    0
  );
  const graphWidth = (maxLane + 1) * LANE_WIDTH + LANE_PAD * 2;

  const idToIndex = new Map<string, number>();
  commits.forEach((c, i) => idToIndex.set(c.id, i + (hasChanges ? 1 : 0)));

  const paths: { d: string; color: string }[] = [];
  const dots: { x: number; y: number; color: string }[] = [];

  function laneX(lane: number) {
    return LANE_PAD + lane * LANE_WIDTH + LANE_WIDTH / 2;
  }
  function rowY(row: number) {
    return row * ROW_HEIGHT + ROW_HEIGHT / 2;
  }

  if (hasChanges) {
    dots.push({ x: laneX(workingLane), y: rowY(0), color: "#e8c34a" });
    if (commits.length > 0) {
      paths.push({
        d: `M ${laneX(workingLane)} ${rowY(0)} L ${laneX(commits[0].lane)} ${rowY(1)}`,
        color: laneColor(commits[0].lane),
      });
    }
  }

  commits.forEach((c, i) => {
    const row = i + (hasChanges ? 1 : 0);
    dots.push({ x: laneX(c.lane), y: rowY(row), color: laneColor(c.lane) });
    c.parent_ids.forEach((pid, pi) => {
      const plane = c.parent_lanes[pi] ?? c.lane;
      const parentRow = idToIndex.get(pid);
      const color = laneColor(pi === 0 ? c.lane : plane);
      if (parentRow !== undefined) {
        if (plane === c.lane) {
          paths.push({
            d: `M ${laneX(c.lane)} ${rowY(row)} L ${laneX(plane)} ${rowY(parentRow)}`,
            color,
          });
        } else {
          const midY = rowY(row) + (rowY(parentRow) - rowY(row)) * 0.5;
          paths.push({
            d: `M ${laneX(c.lane)} ${rowY(row)} C ${laneX(c.lane)} ${midY}, ${laneX(
              plane
            )} ${midY}, ${laneX(plane)} ${rowY(parentRow)}`,
            color,
          });
        }
      }
    });
  });

  return (
    <div className="commit-graph">
      <div className="commit-graph-scroll" style={{ position: "relative", height: rows * ROW_HEIGHT }}>
        <svg
          width={graphWidth}
          height={rows * ROW_HEIGHT}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
          {paths.map((p, i) => (
            <path key={i} d={p.d} stroke={p.color} strokeWidth={2} fill="none" />
          ))}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={5} fill={d.color} stroke="#1a1a1a" strokeWidth={1.5} />
          ))}
        </svg>

        {hasChanges && (
          <div
            className={
              "commit-row" + (selection?.kind === "working" ? " selected" : "")
            }
            style={{ height: ROW_HEIGHT, paddingLeft: graphWidth }}
            onClick={() => onSelect({ kind: "working" })}
          >
            <span className="commit-summary working-summary">Uncommitted changes</span>
            <span className="commit-meta">
              {status!.staged.length + status!.unstaged.length + status!.conflicted.length} file(s)
            </span>
          </div>
        )}

        {commits.map((c) => (
          <div
            key={c.id}
            id={`commit-row-${c.id}`}
            className={
              "commit-row" +
              (selection?.kind === "commit" && selection.id === c.id ? " selected" : "") +
              (matchIds?.has(c.id) ? " search-match" : "")
            }
            style={{ height: ROW_HEIGHT, paddingLeft: graphWidth }}
            onClick={() => onSelect({ kind: "commit", id: c.id })}
            title={c.message}
          >
            {c.refs.map((r) => (
              <span className="ref-badge" key={r}>
                {r}
              </span>
            ))}
            <span className="commit-summary">{c.summary}</span>
            <span className="commit-meta">{c.author_name}</span>
            <span className="commit-meta commit-date">{formatDate(c.timestamp)}</span>
            <span className="commit-meta commit-hash">{c.short_id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
