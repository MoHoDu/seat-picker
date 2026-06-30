import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the seat setup step first", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "seat-picker" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "좌석 설정" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
  });

  it("connects student input, preferences, assignment, and result flow", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.type(
      screen.getByLabelText("학생 이름 목록"),
      "김민준\n이서연\n김민준",
    );
    await user.click(
      screen.getByRole("button", { name: "명단 적용 및 선호 선택" }),
    );

    expect(screen.getByText("김민준 01")).toBeInTheDocument();
    expect(screen.getByText("김민준 02")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "김민준 01 앞자리" }));
    await user.click(screen.getByRole("radio", { name: "이서연 중간자리" }));
    await user.click(screen.getByRole("radio", { name: "김민준 02 무선호" }));
    await user.click(screen.getByRole("button", { name: "추첨 시작" }));

    expect(
      screen.getByRole("heading", { name: "추첨 연출" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "결과 보기" }));

    expect(
      screen.getByRole("heading", { name: "배정 결과" })
    ).toBeInTheDocument();
    expect(screen.getByText("Seed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "PNG 저장 위치/이름 선택" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 뽑기" })).toBeInTheDocument();
    expect(screen.getByText("1순위 배정")).toBeInTheDocument();
    expect(screen.getAllByText("김민준").length).toBeGreaterThan(0);
    expect(screen.getByText("이서연")).toBeInTheDocument();
  });

  it("restores the saved project after remounting the app", async () => {
    const user = userEvent.setup();
    const rendered = render(<App />);

    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.type(screen.getByLabelText("학생 이름 목록"), "김민준\n이서연");
    await user.click(
      screen.getByRole("button", { name: "명단 적용 및 선호 선택" }),
    );
    await user.click(screen.getByRole("radio", { name: "김민준 앞자리" }));

    await waitFor(() => {
      expect(localStorage.getItem("seat-picker:v1:project")).toContain("김민준");
    });

    rendered.unmount();
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "선호 선택" })
    ).toBeInTheDocument();
    expect(screen.getByText("김민준")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "김민준 앞자리" })).toBeChecked();
  });

  it("plays the drawing animation through zone, student, and seat phases", async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.change(screen.getByLabelText("학생 이름 목록"), {
      target: { value: "김민준\n이서연" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "명단 적용 및 선호 선택" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "김민준 앞자리" }));
    fireEvent.click(screen.getByRole("radio", { name: "이서연 앞자리" }));
    fireEvent.click(screen.getByRole("button", { name: "추첨 시작" }));

    expect(screen.getByText(/구역 추첨 시작/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("학생 슬롯")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getByText("자리 슬롯")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByText("좌석 확정")).toBeInTheDocument();
  });
});
