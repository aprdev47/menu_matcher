import { useState, useEffect, useMemo, useRef } from 'react';
import type { MenuCategory, MenuItem, MenuMatch } from '../types';
import { calculateConfidence } from '../utils/matching';

interface MenuMatcherProps {
  sourceMenu: MenuCategory[];
  targetMenu: MenuCategory[];
  onMatch: (sourceItemId: string, targetItemId: string | null, categoryId: string) => void;
  onCreate: (sourceItem: MenuItem, categoryId: string) => void;
  onUnmatch: (sourceItemId: string, categoryId: string) => void;
  onDeleteItem: (targetItemId: string, categoryId: string) => void;
}

export function MenuMatcher({ sourceMenu, targetMenu, onMatch, onCreate, onUnmatch, onDeleteItem }: MenuMatcherProps) {
  const [matches, setMatches] = useState<Map<string, MenuMatch>>(new Map());
  const [selectedSourceItem, setSelectedSourceItem] = useState<string | null>(null);
  const initialMatchDone = useRef(false);

  // Auto-match items on initial load only
  useEffect(() => {
    // Only run auto-match once on initial load
    if (initialMatchDone.current) return;

    const newMatches = new Map<string, MenuMatch>();

    sourceMenu.forEach(sourceCategory => {
      const targetCategory = targetMenu.find(tc => tc.id === sourceCategory.id || tc.name === sourceCategory.name);

      sourceCategory.items.forEach(sourceItem => {
        type BestMatch = { item: MenuItem; confidence: number };
        let bestMatch: BestMatch | null = null;

        if (targetCategory) {
          // Find best match in the same category
          for (const targetItem of targetCategory.items) {
            const confidence = calculateConfidence(sourceItem.name, targetItem.name);

            if (bestMatch === null || confidence > bestMatch.confidence) {
              bestMatch = { item: targetItem, confidence };
            }
          }
        }

        // Auto-match if confidence is 100% (exact match)
        let isMatched = false;
        let matchedItem: MenuItem | null = null;
        let confidenceScore = 0;

        if (bestMatch !== null) {
          confidenceScore = bestMatch.confidence;
          if (bestMatch.confidence === 100) {
            isMatched = true;
            matchedItem = bestMatch.item;
          }
        }

        newMatches.set(sourceItem.id, {
          sourceItem,
          targetItem: matchedItem,
          confidence: confidenceScore,
          isMatched,
          categoryId: sourceCategory.id,
        });
      });
    });

    setMatches(newMatches);
    initialMatchDone.current = true;
  }, [sourceMenu, targetMenu]);

  // Group matches by category and status
  const groupedMatches = useMemo(() => {
    const grouped: Record<string, { matched: MenuMatch[]; unmatched: MenuMatch[] }> = {};

    sourceMenu.forEach(category => {
      grouped[category.id] = { matched: [], unmatched: [] };
    });

    matches.forEach(match => {
      if (match.isMatched) {
        grouped[match.categoryId]?.matched.push(match);
      } else {
        grouped[match.categoryId]?.unmatched.push(match);
      }
    });

    return grouped;
  }, [matches, sourceMenu]);

  // Get unmatched target items for a category
  const getUnmatchedTargetItems = (categoryId: string): MenuItem[] => {
    const targetCategory = targetMenu.find(tc => tc.id === categoryId);
    if (!targetCategory) return [];

    const matchedTargetIds = new Set(
      Array.from(matches.values())
        .filter(m => m.targetItem && m.categoryId === categoryId)
        .map(m => m.targetItem!.id)
    );

    return targetCategory.items.filter(item => !matchedTargetIds.has(item.id));
  };

  // Handle manual matching
  const handleManualMatch = (sourceItemId: string, targetItemId: string) => {
    const match = matches.get(sourceItemId);
    if (!match) return;

    const targetCategory = targetMenu.find(tc => tc.id === match.categoryId);
    const targetItem = targetCategory?.items.find(item => item.id === targetItemId);

    if (targetItem) {
      const newMatches = new Map(matches);
      newMatches.set(sourceItemId, {
        ...match,
        targetItem,
        confidence: calculateConfidence(match.sourceItem.name, targetItem.name),
        isMatched: true,
      });

      setMatches(newMatches);
      onMatch(sourceItemId, targetItemId, match.categoryId);
      setSelectedSourceItem(null);
    }
  };

  // Handle target item click
  const handleTargetItemClick = (targetItemId: string) => {
    if (selectedSourceItem) {
      // If source is selected, match immediately
      handleManualMatch(selectedSourceItem, targetItemId);
    }
  };

  // Check if item with same name already exists in target category
  const itemExistsInTarget = (sourceItemId: string): boolean => {
    const match = matches.get(sourceItemId);
    if (!match) return false;

    const targetCategory = targetMenu.find(tc => tc.id === match.categoryId);
    if (!targetCategory) return false;

    // Check if any item in target category has the same name (case-insensitive)
    const sourceItemName = match.sourceItem.name.toLowerCase().trim();
    return targetCategory.items.some(
      item => item.name.toLowerCase().trim() === sourceItemName
    );
  };

  // Handle create new item
  const handleCreate = (sourceItemId: string) => {
    const match = matches.get(sourceItemId);
    if (!match) return;

    // Validate: don't create if item with same name exists
    if (itemExistsInTarget(sourceItemId)) {
      return;
    }

    onCreate(match.sourceItem, match.categoryId);

    const newMatches = new Map(matches);
    newMatches.set(sourceItemId, {
      ...match,
      isMatched: true,
      targetItem: { ...match.sourceItem, id: `created-${sourceItemId}` },
      confidence: 100,
    });

    setMatches(newMatches);
  };

  // Handle unmatch
  const handleUnmatch = (targetItemId: string) => {
    const matchEntry = Array.from(matches.entries()).find(
      ([, match]) => match.targetItem?.id === targetItemId
    );

    if (!matchEntry) return;

    const [sourceItemId, match] = matchEntry;
    const newMatches = new Map(matches);
    newMatches.set(sourceItemId, {
      ...match,
      targetItem: null,
      isMatched: false,
    });

    setMatches(newMatches);
    onUnmatch(sourceItemId, match.categoryId);
  };

  // Handle delete item
  const handleDeleteItem = (targetItemId: string, categoryId: string) => {
    const matchEntry = Array.from(matches.entries()).find(
      ([, match]) => match.targetItem?.id === targetItemId
    );

    if (matchEntry) {
      const [sourceItemId, match] = matchEntry;
      const newMatches = new Map(matches);
      newMatches.set(sourceItemId, {
        ...match,
        targetItem: null,
        isMatched: false,
      });
      setMatches(newMatches);
    }

    onDeleteItem(targetItemId, categoryId);
  };

  // Suggest matches for a source item
  const getSuggestedMatches = (sourceItemId: string): { item: MenuItem; confidence: number }[] => {
    const match = matches.get(sourceItemId);
    if (!match) return [];

    const unmatchedItems = getUnmatchedTargetItems(match.categoryId);

    return unmatchedItems
      .map(item => ({
        item,
        confidence: calculateConfidence(match.sourceItem.name, item.name),
      }))
      .filter(suggestion => suggestion.confidence > 30)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Menu Matcher</h1>
        <p className="text-sm text-gray-600 mt-1">Match items from source menu to target menu</p>
      </header>

      {/* Column Headers */}
      <div className="grid grid-cols-2 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="bg-blue-50 border-r border-gray-200 px-6 py-3">
          <h2 className="text-lg font-semibold text-blue-900">Source Menu</h2>
          {selectedSourceItem && (
            <p className="text-xs text-blue-700 mt-1">Click a target item to match</p>
          )}
        </div>
        <div className="bg-green-50 px-6 py-3">
          <h2 className="text-lg font-semibold text-green-900">Target Menu</h2>
        </div>
      </div>

      {/* Unified Scrolling Content */}
      <div className="flex-1 overflow-y-auto">
        {sourceMenu.map(category => {
          const unmatchedSourceItems = groupedMatches[category.id]?.unmatched || [];
          const matchedItems = groupedMatches[category.id]?.matched || [];
          const unmatchedTargetItems = getUnmatchedTargetItems(category.id);

          return (
            <div key={category.id} className="border-b border-gray-300">
              {/* Category Header */}
              <div className="grid grid-cols-2 bg-gray-100 sticky top-0">
                <div className="border-r border-gray-300 px-6 py-2 font-semibold text-gray-800">
                  {category.name}
                </div>
                <div className="px-6 py-2 font-semibold text-gray-800">
                  {category.name}
                </div>
              </div>

              {/* Unmatched Section */}
              {(unmatchedSourceItems.length > 0 || unmatchedTargetItems.length > 0) && (
                <div>
                  <div className="grid grid-cols-2 bg-red-50 border-b border-red-100">
                    <div className="border-r border-red-100 px-6 py-2 text-xs font-semibold text-red-700 uppercase">
                      Unmatched ({unmatchedSourceItems.length})
                    </div>
                    <div className="px-6 py-2 text-xs font-semibold text-yellow-700 uppercase">
                      Unmatched ({unmatchedTargetItems.length})
                    </div>
                  </div>

                  {/* Unmatched Source Items */}
                  {unmatchedSourceItems.map(match => {
                    const suggestions = getSuggestedMatches(match.sourceItem.id);
                    return (
                      <div key={match.sourceItem.id} className="grid grid-cols-2 border-b border-gray-200">
                        {/* Source Side */}
                        <div
                          className={`border-r border-gray-200 px-6 py-4 ${
                            selectedSourceItem === match.sourceItem.id ? 'bg-blue-100' : 'bg-red-50 hover:bg-red-100'
                          }`}
                          onClick={() => setSelectedSourceItem(match.sourceItem.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{match.sourceItem.name}</div>
                              {match.sourceItem.description && (
                                <div className="text-xs text-gray-500 mt-1">{match.sourceItem.description}</div>
                              )}
                              {match.sourceItem.price && (
                                <div className="text-sm text-gray-600 mt-1">${match.sourceItem.price.toFixed(2)}</div>
                              )}

                              {/* Suggested Matches */}
                              {suggestions.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <div className="text-xs font-medium text-gray-600">Suggestions:</div>
                                  {suggestions.map(suggestion => (
                                    <div key={suggestion.item.id} className="flex items-center gap-2 text-xs">
                                      <span className={`px-2 py-0.5 rounded-full font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                                        {Math.round(suggestion.confidence)}%
                                      </span>
                                      <span className="text-gray-700 flex-1 truncate">{suggestion.item.name}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleManualMatch(match.sourceItem.id, suggestion.item.id);
                                        }}
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        Match
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Duplicate warning */}
                              {itemExistsInTarget(match.sourceItem.id) && (
                                <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                  Item with this name already exists in target
                                </div>
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreate(match.sourceItem.id);
                              }}
                              disabled={itemExistsInTarget(match.sourceItem.id)}
                              className={`px-3 py-1 text-sm rounded flex-shrink-0 ${
                                itemExistsInTarget(match.sourceItem.id)
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                              title={itemExistsInTarget(match.sourceItem.id) ? 'Item already exists in target' : 'Create new item in target'}
                            >
                              Create
                            </button>
                          </div>
                        </div>

                        {/* Target Side - Empty for unmatched source items */}
                        <div className="px-6 py-4 bg-gray-50"></div>
                      </div>
                    );
                  })}

                  {/* Unmatched Target Items */}
                  {unmatchedTargetItems.map(item => {
                    const isCreatedItem = item.id.startsWith('created-');
                    return (
                      <div key={item.id} className="grid grid-cols-2 border-b border-gray-200">
                        {/* Source Side - Empty for unmatched target items */}
                        <div className="border-r border-gray-200 px-6 py-4 bg-gray-50"></div>

                        {/* Target Side */}
                        <div
                          className={`px-6 py-4 bg-yellow-50 hover:bg-yellow-100 ${
                            selectedSourceItem ? 'cursor-pointer' : ''
                          }`}
                          onClick={() => handleTargetItemClick(item.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                              )}
                              {item.price && (
                                <div className="text-sm text-gray-600 mt-1">${item.price.toFixed(2)}</div>
                              )}
                            </div>

                            {isCreatedItem && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.id, category.id);
                                }}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded flex-shrink-0"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matched Section */}
              {matchedItems.length > 0 && (
                <div>
                  <div className="grid grid-cols-2 bg-green-50 border-b border-green-100">
                    <div className="border-r border-green-100 px-6 py-2 text-xs font-semibold text-green-700 uppercase">
                      Matched ({matchedItems.length})
                    </div>
                    <div className="px-6 py-2 text-xs font-semibold text-green-700 uppercase">
                      Matched ({matchedItems.length})
                    </div>
                  </div>

                  {matchedItems.map(match => {
                    const isCreatedItem = match.targetItem?.id.startsWith('created-');
                    return (
                      <div key={match.sourceItem.id} className="grid grid-cols-2 border-b border-gray-200 hover:bg-gray-50">
                        {/* Source Side */}
                        <div className="border-r border-gray-200 px-6 py-4">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{match.sourceItem.name}</div>
                              {match.sourceItem.description && (
                                <div className="text-xs text-gray-500 mt-1">{match.sourceItem.description}</div>
                              )}
                              {match.confidence < 100 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {Math.round(match.confidence)}% match
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Target Side */}
                        <div className="px-6 py-4">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{match.targetItem?.name}</div>
                              {match.targetItem?.description && (
                                <div className="text-xs text-gray-500 mt-1">{match.targetItem.description}</div>
                              )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => match.targetItem && handleUnmatch(match.targetItem.id)}
                                className="px-2 py-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded"
                              >
                                Unmatch
                              </button>
                              {isCreatedItem && (
                                <button
                                  onClick={() => match.targetItem && handleDeleteItem(match.targetItem.id, category.id)}
                                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
