import { useEffect, useState, type ReactNode } from "react";

type AppVersion = {
  label: string;
  path: string;
};

type VersionManifest = {
  latest: string;
  versions: AppVersion[];
};

type PatchNote = {
  title: string;
  markdown: string;
};

const fallbackLatestVersion = "v1.2";

const patchNotesByVersion: Record<string, PatchNote> = {
  "v1.2": {
    title: "v1.2 패치 노트",
    markdown: `## 수정
- 선호자 수와 좌석 수가 딱 맞는 구역에서 밀려온 학생이 기존 선호자를 밀어내지 않도록 수정했습니다.

## 추가
- 버전 선택 영역에 패치 노트 보기 버튼을 추가했습니다.
- 현재 버전의 수정/추가/삭제 내용을 큰 팝업에서 확인할 수 있게 했습니다.

## 삭제
- 없음`,
  },
};

export function VersionSelector() {
  const [manifest, setManifest] = useState<VersionManifest>({
    latest: fallbackLatestVersion,
    versions: [],
  });
  const [openPatchNote, setOpenPatchNote] = useState<PatchNote | null>(null);

  useEffect(() => {
    fetch("/seat-picker/versions.json")
      .then((response) => response.json())
      .then((manifest: VersionManifest) => {
        setManifest(manifest);
      })
      .catch(() => {
        setManifest({ latest: fallbackLatestVersion, versions: [] });
      });
  }, []);

  useEffect(() => {
    if (!openPatchNote) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPatchNote(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openPatchNote]);

  const currentPath = window.location.pathname;
  const currentVersionKey = getCurrentVersionKey(currentPath, manifest);
  const currentPatchNote = currentVersionKey
    ? patchNotesByVersion[currentVersionKey]
    : undefined;
  const currentVersionPath = getCurrentVersionPath(
    currentPath,
    manifest.versions,
  );

  return (
    <>
      <div className="version-controls">
        {currentPatchNote ? (
          <button
            type="button"
            className="secondary patch-note-button"
            onClick={() => setOpenPatchNote(currentPatchNote)}
          >
            패치 노트 보기
          </button>
        ) : null}
        <label className="version-selector">
          버전
          <select
            value={currentVersionPath}
            onChange={(event) => {
              window.location.href = event.currentTarget.value;
            }}
          >
            {manifest.versions.map((version) => (
              <option key={version.path} value={version.path}>
                {version.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {openPatchNote ? (
        <div
          className="patch-note-overlay"
          data-testid="patch-note-overlay"
          onClick={() => setOpenPatchNote(null)}
        >
          <section
            className="patch-note-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patch-note-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="patch-note-header">
              <h2 id="patch-note-title">{openPatchNote.title}</h2>
              <button
                type="button"
                className="secondary"
                onClick={() => setOpenPatchNote(null)}
              >
                닫기
              </button>
            </div>
            <div className="patch-note-content">
              {renderMarkdown(openPatchNote.markdown)}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function getCurrentVersionKey(
  currentPath: string,
  manifest: VersionManifest,
): string | null {
  const matchedVersion = getCurrentVersion(currentPath, manifest.versions);

  if (matchedVersion?.path === "/seat-picker/") {
    return manifest.latest;
  }

  const matchedVersionKey = matchedVersion
    ? getVersionKeyFromVersion(matchedVersion)
    : null;

  return (
    matchedVersionKey ??
    getVersionKeyFromPath(currentPath) ??
    manifest.latest ??
    null
  );
}

function getCurrentVersionPath(
  currentPath: string,
  versions: AppVersion[],
): string {
  const matched = getCurrentVersion(currentPath, versions);

  return matched?.path ?? versions[0]?.path ?? "/seat-picker/";
}

function getCurrentVersion(
  currentPath: string,
  versions: AppVersion[],
): AppVersion | undefined {
  return [...versions]
    .sort((a, b) => b.path.length - a.path.length)
    .find((version) => currentPath.startsWith(version.path));
}

function getVersionKeyFromVersion(version: AppVersion): string | null {
  return (
    getVersionKeyFromPath(version.path) ?? getVersionKeyFromLabel(version.label)
  );
}

function getVersionKeyFromPath(path: string): string | null {
  return path.match(/\/versions\/([^/]+)\//)?.[1] ?? null;
}

function getVersionKeyFromLabel(label: string): string | null {
  return label.match(/^v\d+(?:\.\d+)*$/)?.[0] ?? null;
}

function renderMarkdown(markdown: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      blocks.push(<h4 key={`h4-${blocks.length}`}>{trimmed.slice(4)}</h4>);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(<h3 key={`h3-${blocks.length}`}>{trimmed.slice(3)}</h3>);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(<h2 key={`h2-${blocks.length}`}>{trimmed.slice(2)}</h2>);
      continue;
    }

    blocks.push(<p key={`p-${blocks.length}`}>{trimmed}</p>);
  }

  flushList();

  return blocks;
}
