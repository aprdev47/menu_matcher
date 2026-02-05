export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuMatch {
  sourceItem: MenuItem;
  targetItem: MenuItem | null;
  confidence: number;
  isMatched: boolean;
  categoryId: string;
}

export interface MenuData {
  categories: MenuCategory[];
}
