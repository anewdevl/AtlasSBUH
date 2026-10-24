import { categories, categoryIds, type CategoryId } from './categories';
import type { AnalysisRequest } from './contracts';

export function sanitizeCategorySelection(request: AnalysisRequest): AnalysisRequest {
  const categoryId: CategoryId = categoryIds.includes(request.categoryId) ? request.categoryId : 'cafe';
  const requestedAdjacent = Array.isArray(request.adjacentCategoryIds) ? request.adjacentCategoryIds : [];
  const adjacentCategoryIds = requestedAdjacent.filter((id) => categories[categoryId].adjacent.includes(id));
  return { ...request, categoryId, adjacentCategoryIds };
}
