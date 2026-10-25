'use client';
import { useEffect, useRef, useState } from 'react';
import { categorySuggestionSchema, type CategorySuggestion } from '../lib/category-suggestion';
import { classify } from '../lib/classify';
import type { AnalysisRequest } from '../lib/contracts';

export function useBusiness(request: AnalysisRequest, apply: (request: AnalysisRequest) => void) {
 const [description, setText] = useState(''), [manual, setManual] = useState(false);
 const [interpretation, setInterpretation] = useState<CategorySuggestion | null>(null), [classifying, setClassifying] = useState(false);
 const epoch = useRef(0), control = useRef<AbortController | null>(null);
 useEffect(()=>()=>{epoch.current++;control.current?.abort();},[]);
 function cancel() { epoch.current++; control.current?.abort(); setClassifying(false); }
 function describe(text: string) { cancel(); setText(text); setInterpretation(null); }
 function override(value: boolean) { cancel(); setManual(value); setInterpretation(null); }
 async function resolve(): Promise<AnalysisRequest> {
  if (manual) return request;
  if (description.trim().length < 3) throw new Error('Describe your business, or enable a manual business type in Advanced settings.');
  if (interpretation?.categoryId) return { ...request, categoryId: interpretation.categoryId };
  cancel(); const id = epoch.current, controller = new AbortController(); control.current = controller; setClassifying(true);
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
   let suggestion: CategorySuggestion;
   try {
    const response = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description }), signal: controller.signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Business interpretation unavailable.');
    suggestion = categorySuggestionSchema.parse(data);
   } catch (error) {
    if (controller.signal.aborted) throw error;
    const local = classify(description); if (local.matches.length !== 1) throw error;
    suggestion = { categoryId: local.matches[0], explanation: 'Matched a supported business alias locally. AI interpretation was unavailable.' };
   }
   if (id !== epoch.current) throw new DOMException('Outdated interpretation', 'AbortError');
   setInterpretation(suggestion);
   if (!suggestion.categoryId) throw new Error('No reliable mapped type found. Refine the description or select a manual type.');
   const next = { ...request, categoryId: suggestion.categoryId, adjacentCategoryIds: suggestion.categoryId === request.categoryId ? request.adjacentCategoryIds : [] };
   apply(next); return next;
  } finally { clearTimeout(timer); if (id === epoch.current) setClassifying(false); }
 }
 return { description, describe, manual, override, interpretation, classifying, resolve, cancel };
}
