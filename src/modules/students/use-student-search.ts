"use client";

import { useEffect, useState, useTransition } from "react";

import { searchStudentsAction } from "@/modules/students/students.actions";
import type { QuickSearchItem } from "@/modules/students/students.service";

/** Ô tìm học sinh có debounce — dùng chung cho tìm nhanh, thêm em học bù, nhóm anh chị em. */
export function useStudentSearch(delay = 180) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<QuickSearchItem[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => start(async () => setResults(await searchStudentsAction(q))), delay);
    return () => clearTimeout(t);
  }, [q, delay]);

  const setQuery = (value: string) => {
    setQ(value);
    if (!value.trim()) setResults([]);
  };
  const reset = () => setQuery("");

  return { q, setQuery, results: q.trim() ? results : [], pending, reset };
}
