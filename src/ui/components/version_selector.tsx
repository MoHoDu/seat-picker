import { useEffect, useState } from "react";

type AppVersion = {
  label: string;
  path: string;
};

type VersionManifest = {
  latest: string;
  versions: AppVersion[];
};

export function VersionSelector() {
  const [versions, setVersions] = useState<AppVersion[]>([]);

  useEffect(() => {
    fetch("/seat-picker/versions.json")
      .then((response) => response.json())
      .then((manifest: VersionManifest) => {
        setVersions(manifest.versions);
      })
      .catch(() => {
        setVersions([]);
      });
  }, []);

  const currentPath = window.location.pathname;

  return (
    <label className="version-selector">
      버전
      <select
        value={getCurrentVersionPath(currentPath, versions)}
        onChange={(event) => {
          window.location.href = event.currentTarget.value;
        }}
      >
        {versions.map((version) => (
          <option key={version.path} value={version.path}>
            {version.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function getCurrentVersionPath(
  currentPath: string,
  versions: AppVersion[],
): string {
  const matched = [...versions]
    .sort((a, b) => b.path.length - a.path.length)
    .find((version) => currentPath.startsWith(version.path));

  return matched?.path ?? versions[0]?.path ?? "/seat-picker/";
}
