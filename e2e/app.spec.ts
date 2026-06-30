import { expect, test, type Page } from "@playwright/test";

const storageKey = "seat-picker:v1:project";

test("runs the core teacher flow from setup to result", async ({ page }) => {
  await openFreshProject(page);

  await page.getByRole("button", { name: "다음" }).click();
  await enterStudents(page, ["김민준", "이서연", "김민준"]);

  await expect(page.getByText("김민준 01")).toBeVisible();
  await expect(page.getByText("김민준 02")).toBeVisible();

  await page.getByRole("radio", { name: "김민준 01 앞자리" }).check();
  await page.getByRole("radio", { name: "이서연 중간자리" }).check();
  await page.getByRole("radio", { name: "김민준 02 무선호" }).check();
  await page.getByRole("button", { name: "추첨 시작" }).click();

  await expect(page.getByRole("heading", { name: "추첨 연출" })).toBeVisible();

  await completeDrawing(page);

  await expect(page.getByRole("heading", { name: "배정 결과" })).toBeVisible();
  await expect(page.getByText("Seed")).toBeVisible();
  await expect(page.getByText("1순위 배정")).toBeVisible();
  await expect(page.getByText("무선호 배정")).toBeVisible();
  await expect(page.getByText("김민준").first()).toBeVisible();
  await expect(page.getByText("이서연")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PNG 저장 위치/이름 선택" }),
  ).toBeVisible();
});

test("restores saved progress after refresh", async ({ page }) => {
  await openFreshProject(page);

  await page.getByRole("button", { name: "다음" }).click();
  await enterStudents(page, ["김민준", "이서연"]);
  await page.getByRole("radio", { name: "김민준 앞자리" }).check();

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toContain("김민준");

  await page.reload();

  await expect(page.getByRole("heading", { name: "선호 선택" })).toBeVisible();
  await expect(page.getByText("김민준")).toBeVisible();
  await expect(page.getByRole("radio", { name: "김민준 앞자리" })).toBeChecked();
});

test("does not assign students to unavailable seats", async ({ page }) => {
  await openFreshProject(page);

  await setGrid(page, 1, 2);
  await page.getByRole("button", { name: /1-1/ }).click();
  await expect(page.getByRole("button", { name: /1-1/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "다음" }).click();
  await enterStudents(page, ["김민준"]);
  await page.getByRole("radio", { name: "김민준 앞자리" }).check();
  await page.getByRole("button", { name: "추첨 시작" }).click();
  await completeDrawing(page);

  const unavailableSeat = page.locator(".result-grid .seat-cell", {
    hasText: "1-1",
  });
  const availableSeat = page.locator(".result-grid .seat-cell", {
    hasText: "1-2",
  });

  await expect(unavailableSeat).toContainText("빈 자리");
  await expect(unavailableSeat).not.toContainText("김민준");
  await expect(availableSeat).toContainText("김민준");
});

test("supports playback pause, resume, and skip controls", async ({ page }) => {
  await openFreshProject(page);
  await startDrawingWithPreferences(page, [
    { name: "김민준", preferenceLabel: "앞자리" },
    { name: "이서연", preferenceLabel: "중간자리" },
    { name: "박지호", preferenceLabel: "뒷자리" },
  ]);

  await expect(page.getByRole("radio", { name: "연출 속도 보통" })).toBeChecked();

  await page.getByRole("button", { name: "일시정지" }).click();
  await expect(page.getByRole("button", { name: "일시정지됨" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "재생" })).toBeEnabled();

  await page.getByRole("button", { name: "재생" }).click();
  await page.getByRole("button", { name: "현재 학생 연출 건너뛰기" }).click();
  await page.getByRole("button", { name: "현재 구역 연출 건너뛰기" }).click();
  await expect(
    page.getByRole("button", { name: "전체 연출 건너뛰기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "전체 연출 건너뛰기" }).click();

  await expect(page.getByText("모든 구역 추첨 완료")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "전체 연출 건너뛰기" }),
  ).toBeDisabled();
});

test("shows the PNG save cancellation message", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
    });
  });
  await openFreshProject(page);
  await startDrawingWithStudents(page, ["김민준", "이서연"]);
  await completeDrawing(page);

  await page.getByRole("button", { name: "PNG 저장 위치/이름 선택" }).click();

  await expect(page.getByText("PNG 저장이 취소되었습니다.")).toBeVisible();
});

test("blocks impossible rosters before preference selection", async ({ page }) => {
  await openFreshProject(page);

  await setGrid(page, 1, 1);
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("학생 이름 목록").fill("김민준\n이서연");

  await expect(
    page.getByText(
      "학생 2명은 사용 가능 좌석 1석보다 많습니다. 좌석을 늘리거나 명단을 줄이세요.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "명단 적용 및 선호 선택" }),
  ).toBeDisabled();
});

async function openFreshProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await page.reload();
  await expect(page.getByRole("heading", { name: "좌석 설정" })).toBeVisible();
}

async function enterStudents(page: Page, names: readonly string[]): Promise<void> {
  await page.getByLabel("학생 이름 목록").fill(names.join("\n"));
  await page.getByRole("button", { name: "명단 적용 및 선호 선택" }).click();
  await expect(page.getByRole("heading", { name: "선호 선택" })).toBeVisible();
}

async function setGrid(
  page: Page,
  rows: number,
  columns: number,
): Promise<void> {
  await page.getByRole("spinbutton", { name: "행" }).fill(String(rows));
  await page.getByRole("spinbutton", { name: "열" }).fill(String(columns));
}

async function startDrawingWithStudents(
  page: Page,
  names: readonly string[],
): Promise<void> {
  await page.getByRole("button", { name: "다음" }).click();
  await enterStudents(page, names);

  for (const name of names) {
    await page.getByRole("radio", { name: `${name} 앞자리` }).check();
  }

  await page.getByRole("button", { name: "추첨 시작" }).click();
  await expect(page.getByRole("heading", { name: "추첨 연출" })).toBeVisible();
}

async function startDrawingWithPreferences(
  page: Page,
  students: ReadonlyArray<{ name: string; preferenceLabel: string }>,
): Promise<void> {
  await page.getByRole("button", { name: "다음" }).click();
  await enterStudents(
    page,
    students.map((student) => student.name),
  );

  for (const student of students) {
    await page
      .getByRole("radio", {
        name: `${student.name} ${student.preferenceLabel}`,
      })
      .check();
  }

  await page.getByRole("button", { name: "추첨 시작" }).click();
  await expect(page.getByRole("heading", { name: "추첨 연출" })).toBeVisible();
}

async function completeDrawing(page: Page): Promise<void> {
  await page.getByRole("button", { name: "전체 연출 건너뛰기" }).click();
  await expect(page.getByText("모든 구역 추첨 완료")).toBeVisible();
  await page.getByRole("button", { name: "결과 보기" }).click();
}
