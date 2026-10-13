"use client";

import { useLayoutEffect } from "react";

export function ReloadScrollToTop() {
  useLayoutEffect(() => {
    const navigation = performance
      .getEntriesByType("navigation")
      .at(0) as PerformanceNavigationTiming | undefined;

    if (navigation?.type !== "reload") return;

    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  return null;
}
