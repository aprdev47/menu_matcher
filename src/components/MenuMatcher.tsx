import { useState, useEffect, useMemo } from 'react';
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
  const [selectedTargetItem, setSelectedTargetItem] = useState<string | null>(null);

  // Auto-match items on initial load
  useEffect(() => {
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
  const handleManualMatch = () => {
    if (!selectedSourceItem || !selectedTargetItem) return;

    const match = matches.get(selectedSourceItem);
    if (!match) return;

    const targetCategory = targetMenu.find(tc => tc.id === match.categoryId);
    const targetItem = targetCategory?.items.find(item => item.id === selectedTargetItem);

    if (targetItem) {
      const newMatches = new Map(matches);
      newMatches.set(selectedSourceItem, {
        ...match,
        targetItem,
        confidence: calculateConfidence(match.sourceItem.name, targetItem.name),
        isMatched: true,
      });

      setMatches(newMatches);
      onMatch(selectedSourceItem, selectedTargetItem, match.categoryId);
      setSelectedSourceItem(null);
      setSelectedTargetItem(null);
    }
  };

  // Handle create new item
  const handleCreate = (sourceItemId: string) => {
    const match = matches.get(sourceItemId);
    if (!match) return;

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
    // Find the match that uses this target item
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
    // First unmatch if it's matched
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

      <div className="flex-1 flex overflow-hidden">
        {/* Source Menu Panel */}
        <div className="flex-1 overflow-y-auto border-r border-gray-200 bg-white">
          <div className="sticky top-0 bg-blue-50 border-b border-blue-100 px-6 py-3">
            <h2 className="text-lg font-semibold text-blue-900">Source Menu</h2>
          </div>

          {sourceMenu.map(category => (
            <div key={category.id} className="border-b border-gray-200">
              <div className="bg-gray-100 px-6 py-2 font-medium text-gray-700">
                {category.name}
              </div>

              {/* Unmatched Items */}
              {groupedMatches[category.id]?.unmatched.length > 0 && (
                <div className="bg-red-50">
                  <div className="px-6 py-2 text-xs font-semibold text-red-700 uppercase">
                    Unmatched ({groupedMatches[category.id].unmatched.length})
                  </div>
                  {groupedMatches[category.id].unmatched.map(match => {
                    const suggestions = getSuggestedMatches(match.sourceItem.id);
                    return (
                      <div
                        key={match.sourceItem.id}
                        className={`px-6 py-3 border-b border-red-100 ${
                          selectedSourceItem === match.sourceItem.id ? 'bg-blue-100' : 'hover:bg-red-100'
                        }`}
                        onClick={() => setSelectedSourceItem(match.sourceItem.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{match.sourceItem.name}</div>
                            {match.sourceItem.description && (
                              <div className="text-xs text-gray-500 mt-1">
                                {match.sourceItem.description}
                              </div>
                            )}
                            {match.sourceItem.price && (
                              <div className="text-sm text-gray-600 mt-1">
                                ${match.sourceItem.price.toFixed(2)}
                              </div>
                            )}

                            {/* Suggested Matches */}
                            {suggestions.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs font-medium text-gray-600">Suggestions:</div>
                                {suggestions.map(suggestion => (
                                  <div
                                    key={suggestion.item.id}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <span
                                      className={`px-2 py-0.5 rounded-full font-medium ${getConfidenceColor(
                                        suggestion.confidence
                                      )}`}
                                    >
                                      {Math.round(suggestion.confidence)}%
                                    </span>
                                    <span className="text-gray-700">{suggestion.item.name}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSourceItem(match.sourceItem.id);
                                        setSelectedTargetItem(suggestion.item.id);
                                        setTimeout(handleManualMatch, 0);
                                      }}
                                      className="ml-auto text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      Match
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreate(match.sourceItem.id);
                            }}
                            className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matched Items */}
              {groupedMatches[category.id]?.matched.length > 0 && (
                <div>
                  <div className="px-6 py-2 text-xs font-semibold text-green-700 uppercase bg-green-50">
                    Matched ({groupedMatches[category.id].matched.length})
                  </div>
                  {groupedMatches[category.id].matched.map(match => (
                    <div
                      key={match.sourceItem.id}
                      className="px-6 py-3 border-b border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{match.sourceItem.name}</div>
                          {match.sourceItem.description && (
                            <div className="text-xs text-gray-500 mt-1">
                              {match.sourceItem.description}
                            </div>
                          )}
                        </div>
                        {match.confidence < 100 && (
                          <span className="text-xs text-gray-500">
                            {Math.round(match.confidence)}% match
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Target Menu Panel */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="sticky top-0 bg-green-50 border-b border-green-100 px-6 py-3">
            <h2 className="text-lg font-semibold text-green-900">Target Menu</h2>
          </div>

          {targetMenu.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p>Target menu is empty</p>
              <p className="text-sm mt-2">Create items from the source menu</p>
            </div>
          ) : (
            targetMenu.map(category => {
              const unmatchedItems = getUnmatchedTargetItems(category.id);
              const matchedItems = category.items.filter(item =>
                Array.from(matches.values()).some(
                  m => m.targetItem?.id === item.id && m.categoryId === category.id
                )
              );

              return (
                <div key={category.id} className="border-b border-gray-200">
                  <div className="bg-gray-100 px-6 py-2 font-medium text-gray-700">
                    {category.name}
                  </div>

                  {/* Unmatched Items */}
                  {unmatchedItems.length > 0 && (
                    <div className="bg-yellow-50">
                      <div className="px-6 py-2 text-xs font-semibold text-yellow-700 uppercase">
                        Unmatched ({unmatchedItems.length})
                      </div>
                      {unmatchedItems.map(item => {
                        const isCreatedItem = item.id.startsWith('created-');
                        return (
                          <div
                            key={item.id}
                            className={`px-6 py-3 border-b border-yellow-100 ${
                              selectedTargetItem === item.id ? 'bg-blue-100' : 'hover:bg-yellow-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => setSelectedTargetItem(item.id)}
                              >
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
                                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                  title="Delete this item"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Matched Items */}
                  {matchedItems.length > 0 && (
                    <div>
                      <div className="px-6 py-2 text-xs font-semibold text-green-700 uppercase bg-green-50">
                        Matched ({matchedItems.length})
                      </div>
                      {matchedItems.map(item => {
                        const match = Array.from(matches.values()).find(
                          m => m.targetItem?.id === item.id
                        );
                        const isCreatedItem = item.id.startsWith('created-');
                        return (
                          <div
                            key={item.id}
                            className="px-6 py-3 border-b border-gray-100 hover:bg-gray-50"
                          >
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                                )}
                                {match && match.sourceItem.name !== item.name && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    matched with "{match.sourceItem.name}"
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleUnmatch(item.id)}
                                  className="px-2 py-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded"
                                  title="Unmatch this item"
                                >
                                  Unmatch
                                </button>
                                {isCreatedItem && (
                                  <button
                                    onClick={() => handleDeleteItem(item.id, category.id)}
                                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                    title="Delete this item"
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
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Match Button */}
      {selectedSourceItem && selectedTargetItem && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleManualMatch}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Match Selected Items
          </button>
        </div>
      )}
    </div>
  );
}
